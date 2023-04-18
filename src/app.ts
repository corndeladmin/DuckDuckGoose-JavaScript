import * as path from "path";
import { format } from "date-fns";

// express
import express from "express";
// database
import { QueryTypes } from "sequelize";
import { db, User as DbUser } from "./database/index";
import { iterPages } from "./pagination";
// sessions
import session from "express-session";
import sessionSequelize from "connect-session-sequelize";
// authentication
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import crypto from "node:crypto";

const app = express();
app.use(express.static(path.join(__dirname, "/static")));
app.use(express.urlencoded());
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "/views"));

const itemsPerPage = 5;
declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}

const SequelizeStore = sessionSequelize(session.Store);
app.use(session({
  secret: "duck duck duck goose goose",
  resave: false,
  saveUninitialized: false,
  store: new SequelizeStore({
    db: db,
  }),
}));

passport.use(new LocalStrategy(async (username, password, done) => {
  const user = await DbUser.findOne({
    where: {
      username: username,
    },
  });

  if (user === null) {
    return done(null, false, { message: "Incorrect username or password." });
  }

  crypto.pbkdf2(password, user.salt, 310000, 32, "sha256", (err, hash) => {
    if (err) {
      return done(err);
    }

    if (!crypto.timingSafeEqual(user.hashedPassword, hash)) {
      return done(null, false, { message: "Incorrect username or password." });
    }

    return done(null, user);
  });
}));
app.use(passport.authenticate("session"));
passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, user.id)
  });
});
passport.deserializeUser((id, done) => {
  DbUser.findOne({
    where: {
      id: id,
    },
  })
    .then((user) => done(null, user))
    .catch((reason) => {
      console.error(`Failed to fetch user with id ${id}`);
      console.error(JSON.stringify(reason, null, 2));
      done(reason);
    });
});

// routes
app.get("/", (req, res) => {
  res.render("welcome", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
  });
});

app.get("/users", async (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;
  
  const whereClauses: string[] = [];
  
  if (search) {
    whereClauses.push(`u."username" ILIKE CONCAT('%', :search, '%')`);
  }

  // have to use raw SQL because sequelize isn't very well written
  // notice, no string interpolation of variables, to avoid SQL injection
  // https://xkcd.com/327/
  const query = `
    SELECT
      u."id" AS "id",
      u."username" AS "username",
      u."nHonks" AS "nHonks"
    FROM (
      SELECT
        u."id" AS "id",
        u."username" AS "username",
        u."nHonks" AS "nHonks"
      FROM (
        SELECT
          u."id" AS "id",
          u."username" AS "username",
          COUNT(h."id") AS "nHonks"
        FROM
          users u
          LEFT JOIN honks h
            ON u."id" = h."userId"
        ${search ? `WHERE u."username" ILIKE CONCAT('%', :search, '%')` : ""}
        GROUP BY u."id"
        ORDER BY u."username"
      ) AS u
      GROUP BY u."id", u."username", u."nHonks"
    ) AS u
    GROUP BY u."id", u."username", u."nHonks"
    LIMIT :limit OFFSET :offset;
  `;
  const countQuery = `
    SELECT
      COUNT(*) AS "total"
    FROM users u
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""};
  `;
  
  const users = await db.query<{
    id: number,
    username: string,
    nHonks: string,
  }>(
    query,
    {
      replacements: {
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
        userId: req.user?.id,
        search: search,
      },
      type: QueryTypes.SELECT,
    }
  );
  const userTotalResult = await db.query<{ total: string }>(
    countQuery,
    {
      replacements: {
        userId: req.user?.id,
        search: search,
      },
      type: QueryTypes.SELECT,
    }
  );
  const userTotal: number = parseInt(userTotalResult[0].total);

  res.render("users", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
    users: {
      total: userTotal,
      items: users,
      pages: iterPages(page, Math.ceil(userTotal / itemsPerPage)),
      page: page,
    },
    format,
    filter,
    search,
  });
});

app.get("/register", (req, res) => {
  const errors = {
    username: [],
    password: [],
    confirmPassword: [],
  };

  res.render("register", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
    errors,
  });
});

app.post("/register", (req, res, next) => {
  const salt = crypto.randomBytes(16);
  crypto.pbkdf2(req.body.password, salt, 310000, 32, "sha256", async (err, hash) => {
    if (err) {
      return next(err);
    }
    
    const newUser = await DbUser.create({
      username: req.body.username,
      hashedPassword: hash,
      salt: salt,
    });
    
    req.login(newUser, (err) => {
      if (err) {
        return next(err);
      }
      
      res.redirect(303, "/");
    })
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
  });
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login",
}));

app.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect(303, "/");
  });
});

app.listen(3000);

import * as path from "path";
import { format } from "date-fns";

// express
import express, { RequestHandler } from "express";
// database
import { Includeable, Op, QueryTypes, WhereOptions } from "sequelize";
import { db, Honk, User as DbUser } from "./database/index";
import { iterPages } from "./pagination";
// sessions
import session from "express-session";
import sessionSequelize from "connect-session-sequelize";
// authentication
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import crypto from "node:crypto";
import user from "./database/user";

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

// my middleware
const requiresLogin: RequestHandler = (req, res, next) => {
  if (req.user === undefined) {
    res.redirect(303, "/login");
  } else {
    next();
  }
}

// routes
app.get("/", (req, res) => {
  res.render("welcome", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
  });
});

app.get("/honks", async (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;

  let where: WhereOptions<Honk> = {};
  let include: Includeable = {
    model: DbUser,
    required: true,
  };
  
  if (filter === "followed_users" && req.user) {
    include.include = [{
      model: DbUser,
      as: "followers",
      where: {
        id: req.user.id,
      },
    }];
  }
  
  if (search !== undefined) {
    where["content"] = {
      [Op.iLike]: `%${search}%`,
    };
  }
  
  const honks = await Honk.findAndCountAll({
    order: [
      ["createdAt", "DESC"],
    ],
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    include: include,
    where: where,
  });

  res.render("honks", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
    honks: {
      total: honks.count,
      items: honks.rows,
      pages: iterPages(page, Math.ceil(honks.count / itemsPerPage)),
      page,
    },
    format,
    filter,
    search,
  });
});

app.get("/honk", requiresLogin, (req, res) => {
  res.render("honk", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
    errors: [],
  });
});

app.post("/honk", requiresLogin, (req, res) => {
  const isValid = true;  // TODO: real validation

  if (isValid) {
    Honk.create({
      content: req.body.content,
      userId: req.user.id,
    })
      .then(() => res.redirect(303, "/honks"))
      .catch((reason) => {
        console.error("Unable to create honk");
        console.error(reason);
        res.redirect(303, "/honk");
      });
  } else {
    res.redirect(303, "/honk");
  }
});

app.get("/users", async (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;
  
  const whereClauses: string[] = [];
  
  if (filter === "followed_users" && req.user) {
    whereClauses.push(`f."followerId" = :userId`);
  }
  
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
      u."nHonks" AS "nHonks",
      u."nFollowers" AS "nFollowers"
    FROM (
      SELECT
        u."id" AS "id",
        u."username" AS "username",
        u."nHonks" AS "nHonks",
        COUNT(f."followerId") AS "nFollowers"
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
      LEFT JOIN follows f ON f."followeeId" = u."id"
      GROUP BY u."id", u."username", u."nHonks"
    ) AS u
    LEFT JOIN follows f ON f."followeeId" = u."id"
    ${filter === "followed_users" && req.user ? `WHERE f."followerId" = :userId` : ""}
    GROUP BY u."id", u."username", u."nHonks", u."nFollowers"
    LIMIT :limit OFFSET :offset;
  `;
  const countQuery = `
    SELECT
      COUNT(*) AS "total"
    FROM users u
    ${filter === "followed_users" && req.user ? `LEFT JOIN follows f ON f."followeeId" = u."id"` : ""}
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""};
  `;
  
  const users = await db.query<{
    id: number,
    username: string,
    nHonks: string,
    nFollowers: string,
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

app.get("/user/:userId", async (req, res, next) => {
  try {
    const search = req.query["search"];
    const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;
    let userId: number;
    try {
      userId = parseInt(req.params["userId"]);
    } catch (e) {
      throw new Error(`Unable to parse userId "${req.params["userId"]}" as integer`);
    }

    const user = await DbUser.findOne({
      attributes: ["id", "username"],
      where: {
        id: userId
      },
      include: [{ model: DbUser, as: "followers" }],
    });

    let where: WhereOptions<Honk> = {
      userId: userId,
    };

    if (search !== undefined) {
      where["content"] = {
        [Op.iLike]: `%${search}%`,
      };
    }
    
    const userHonks = await Honk.findAndCountAll({
      where: where,
      order: [
        ["createdAt", "DESC"],
      ],
      limit: itemsPerPage,
      offset: (page - 1) * itemsPerPage,
    });

    res.render("user", {
      currentUser: {
        isAuthenticated: req.user !== undefined,
        id: req.user?.id,
      },
      user: {
        ...user.dataValues,
        honks: {
          total: userHonks.count,
          items: userHonks.rows,
          pages: iterPages(page, Math.ceil(userHonks.count / itemsPerPage)),
          page,
        },
      },
      format,
      search,
    });
  }
  catch(err) {
    next(err)
  }
});

app.post("/user/:userId/follow", requiresLogin, async (req, res) => {
  let userId: number;
  try {
    userId = parseInt(req.params["userId"]);
  } catch (e) {
    throw new Error(`Unable to parse userId "${req.params["userId"]}" as integer`);
  }
  
  const thisUser = await DbUser.findOne({
    where: {
      id: req.user.id,
    },
  });
  
  const userToFollow = await DbUser.findOne({
    where: {
      id: userId,
    },
  });
  
  await userToFollow.addFollower(thisUser);
  
  res.redirect(303, `/user/${userId}`);
});

app.post("/user/:userId/unfollow", requiresLogin, async (req, res) => {
  let userId: number;
  try {
    userId = parseInt(req.params["userId"]);
  } catch (e) {
    throw new Error(`Unable to parse userId "${req.params["userId"]}" as integer`);
  }

  const thisUser = await DbUser.findOne({
    where: {
      id: req.user.id,
    },
  });

  const userToUnfollow = await DbUser.findOne({
    where: {
      id: userId,
    },
  });

  await userToUnfollow.removeFollower(thisUser);

  res.redirect(303, `/user/${userId}`);
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
      
      res.redirect(303, "/honks");
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
  successRedirect: "/honks",
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

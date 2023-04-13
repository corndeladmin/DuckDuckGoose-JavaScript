import * as path from "path";
import { format } from "date-fns";

// express
import express from "express";
// database
import { Op, WhereOptions } from "sequelize";
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

// routes
app.get("/", (req, res) => {
  res.render("welcome", {
    currentUser: {
      isAuthenticated: req.user !== undefined,
      id: req.user?.id,
    },
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
      }
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

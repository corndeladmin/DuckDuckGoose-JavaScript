import * as path from "path";
import { format } from "date-fns";

// express
import express from "express";
const app = express();
app.use(express.static(path.join(__dirname, "/static")));
app.use(express.urlencoded());
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "/views"));

// database
import { db, User as DbUser, Honk } from "./database/index";
import { iterPages } from "./pagination";
const itemsPerPage = 5;
declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}

// sessions
import session from "express-session";
import sessionSequelize from "connect-session-sequelize";
const SequelizeStore = sessionSequelize(session.Store);
app.use(session({
  secret: "duck duck duck goose goose",
  resave: false,
  saveUninitialized: false,
  store: new SequelizeStore({
    db: db,
  }),
}));

// authentication
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import crypto from "node:crypto";
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
      isAuthenticated: false,
      ...req.user,
    },
  });
});

app.get("/honks", async (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;

  const honks = await Honk.findAll({
    order: [
      ["createdAt", "DESC"],
    ],
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    include: DbUser,
  });
  const totalHonks = await Honk.count();

  res.render("honks", {
    currentUser: { isAuthenticated: false },
    honks: {
      total: totalHonks,
      items: honks,
      pages: iterPages(page, Math.ceil(totalHonks / itemsPerPage)),
      page,
    },
    format,
    filter,
    search,
  });
});

app.get("/honk", (req, res) => {
  res.render("honk", {
    currentUser: { isAuthenticated: false },
    errors: [],
  });
});

app.post("/honk", (req, res) => {
  const isValid = true;  // TODO: real validation

  if (isValid) {
    // TODO: create honk in db
    res.redirect(303, "/honks");
  } else {
    res.redirect(303, "/honk");
  }
});

app.get("/users", async (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;

  const users = await DbUser.findAll({
    attributes: ["id", "username"],
    order: ["username"],
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    include: [Honk, { model: DbUser, as: "followers" }],
  });
  const totalUsers = await DbUser.count();

  res.render("users", {
    currentUser: { isAuthenticated: false },
    users: {
      total: totalUsers,
      items: users,
      pages: iterPages(page, Math.ceil(totalUsers / itemsPerPage)),
      page: page,
    },
    format,
    filter,
    search,
  });
});

app.get("/user/:userId", async (req, res) => {
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
  
  if (user === null) {
    res.sendStatus(404);
    return;
  }
  
  const userHonks = await Honk.findAndCountAll({
    where: {
      userId: userId
    },
    order: [
      ["createdAt", "DESC"],
    ],
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
  });

  res.render("user", {
    currentUser: { isAuthenticated: true, id: 1 },
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
});

app.get("/register", (req, res) => {
  const errors = {
    username: [],
    password: [],
    confirmPassword: [],
  };

  res.render("register", {
    currentUser: { isAuthenticated: false },
    errors,
  });
});

app.post("/register", (req, res, next) => {
  const isValid = true;  // TODO: real validation
  const errors = {
    username: [],
    password: [],
    confirmPassword: [],
  };

  if (isValid) {
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
  } else {
    res.render("register", {
      currentUser: { isAuthenticated: false },
      errors,
    });
  }
});

app.get("/login", (req, res) => {
  res.render("login", {
    currentUser: { isAuthenticated: false },
  });
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/honks",
  failureRedirect: "/login",
}))

app.listen(3000);

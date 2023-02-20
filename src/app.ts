import * as path from "path";

// express
import express, { RequestHandler } from "express";
// database
import { db, Honk, User as DbUser } from "./database/index";
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
    Honk.build({
      content: req.body.content,
      userId: req.user.id,
    });
  } else {
    res.redirect(303, "/honk");
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

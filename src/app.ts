import * as path from "path";
import { format } from "date-fns";

// express
import express from "express";
const app = express();
app.use(express.static(path.join(__dirname, "/static")));
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "/views"));

// database
import { User, Honk } from "./database/index";
import { iterPages } from "./pagination";
const itemsPerPage = 5;

// routes
app.get("/", (req, res) => {
  res.render("welcome", { currentUser: { isAuthenticated: false } });
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
    include: User,
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

  const users = await User.findAll({
    attributes: ["id", "username"],
    order: ["username"],
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    include: [Honk, { model: User, as: "followers" }],
  });
  const totalUsers = await User.count();

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

  const user = await User.findOne({
    attributes: ["id", "username"],
    where: {
      id: userId
    },
    include: [{ model: User, as: "followers" }],
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

app.post("/register", (req, res) => {
  const isValid = true;  // TODO: real validation
  const errors = {
    username: [],
    password: [],
    confirmPassword: [],
  };

  if (isValid) {
    // TODO: create user in db
    res.redirect(303, "/login");
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

app.listen(3000);

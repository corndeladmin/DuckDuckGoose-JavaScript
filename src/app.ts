import * as path from "path";
import { format } from "date-fns";

// express
import express from "express";
const app = express();
app.use(express.static(path.join(__dirname, "/static")));
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "/views"));

// routes
app.get("/", (req, res) => {
  res.render("welcome", { currentUser: { isAuthenticated: false } });
});

app.get("/honks", (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page = req.query["page"];

  res.render("honks", {
    currentUser: { isAuthenticated: false },
    honks: {
      total: 1,
      items: [
        {
          user: { id: 1, username: "tim" },
          content: "I am a honk!",
          timestamp: new Date(),
        }
      ],
      iterPages: () => [1],
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

app.get("/users", (req, res) => {
  const filter = req.query["filter"];
  const search = req.query["search"];
  const page = req.query["page"];

  res.render("users", {
    currentUser: { isAuthenticated: false },
    users: {
      total: 2,
      items: [
        {
          id: 1,
          username: "tim",
          followers: ["emily"],
          honks: ["honk!"],
        },
        {
          id: 2,
          username: "emily",
          followers: ["tim"],
          honks: ["honk!", "honk!!"],
        },
      ],
      iterPages: () => [1, undefined, 3, undefined, 5],
      page: page ?? 1,
    },
    format,
    filter,
    search,
  });
});

app.listen(3000);

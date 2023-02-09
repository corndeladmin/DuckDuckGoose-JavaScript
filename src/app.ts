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
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;

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
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;

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
      page: page,
    },
    format,
    filter,
    search,
  });
});

app.get("/user/:userId", (req, res) => {
  const search = req.query["search"];
  const page: number = req.query["page"] ? parseInt(req.query["page"] as string) : 1;

  let user;
  if (req.params["userId"] === "1") {
    user = {
      id: 1,
      username: "tim",
      followers: [{ id: 2 }],
      honks: {
        total: 1,
        items: [
          {
            content: "I am a honk!",
            timestamp: new Date(),
          }
        ],
        iterPages: () => [1],
        page,
      }
    };
  } else if (req.params["userId"] === "2") {
    user = {
      id: 2,
      username: "emily",
      followers: [{ id: 1 }],
      honks: {
        total: 3,
        items: [
          {
            content: `I am a honk on page ${page}!`,
            timestamp: new Date(),
          },
        ],
        iterPages: () => [1, undefined, 3, undefined, 5],
        page,
      }
    };
  }

  res.render("user", {
    currentUser: { isAuthenticated: true, id: 1 },
    user,
    format,
    search,
  });
});

app.get("/register", (req, res) => {
  res.render("register", {
    currentUser: { isAuthenticated: false },
  });
});

app.listen(3000);

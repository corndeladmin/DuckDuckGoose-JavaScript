import * as path from "path";

// express
import express from "express";
const app = express();
app.use(express.static(path.join(__dirname, "/static")));
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "/views"));

app.get("/", (req, res) => {
  res.render("welcome", { currentUser: { isAuthenticated: false } });
});

app.listen(3000);

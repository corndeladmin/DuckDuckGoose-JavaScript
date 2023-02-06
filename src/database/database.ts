import { Sequelize } from "sequelize";

const sequelize = new Sequelize("postgres://duckduckgoose:duckduckgoose@localhost:5432/duckduckgoose");

sequelize.authenticate()
  .then(() => console.log("Connected to database"))
  .catch(() => console.error("Couldn't connect to database"))

export default sequelize;

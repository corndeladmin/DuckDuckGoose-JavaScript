import Honk from "./honk";
import User from "./user";

User.hasMany(Honk);
Honk.belongsTo(User);

User.belongsToMany(User, {
  as: "follower",
  through: "follows",
  foreignKey: "followerId",
  otherKey: "followeeId",
});

import db from "./database";
db.sync()
  .then(() => console.log("Successfully synchronised database models"));

export { db, User, Honk };

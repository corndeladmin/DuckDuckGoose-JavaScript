import { DataTypes, Model } from "sequelize";
import db from "./database";

class User extends Model {}

User.init({
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hashedPassword: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  sequelize: db,
  modelName: "user",
});

export default User;

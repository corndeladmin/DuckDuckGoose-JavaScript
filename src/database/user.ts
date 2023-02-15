import { DataTypes, Model } from "sequelize";
import db from "./database";

class User extends Model {
  declare id: number;
  declare username: string;
  declare hashedPassword: Buffer;
  declare salt: Buffer;
}

User.init({
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hashedPassword: {
    type: DataTypes.BLOB,
    allowNull: false,
  },
  salt: {
    type: DataTypes.BLOB,
    allowNull: false,
  },
}, {
  sequelize: db,
  modelName: "user",
});

export default User;

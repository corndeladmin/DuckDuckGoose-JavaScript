import { DataTypes, Model } from "sequelize";
import db from "./database";

class Honk extends Model {
  declare userId: number;
}

Honk.init({
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  sequelize: db,
  modelName: "honk",
});

export default Honk;

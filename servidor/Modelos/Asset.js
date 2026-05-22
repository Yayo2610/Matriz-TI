const mongoose = require("mongoose");

const AssetSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, required: true, unique: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    type: { type: String, default: "Computadora" },
    typeOther: { type: String },
    assignedTo: { type: String },
    department: { type: String },
    status: { type: String, default: "En Stock" },
  },
  { timestamps: true }, // <--- ¡ESTA ES LA LÍNEA MÁGICA!
);

module.exports = mongoose.model("Asset", AssetSchema);

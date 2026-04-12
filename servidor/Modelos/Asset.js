const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true },
  type: { type: String, required: true }, // Laptop, Monitor, Mouse, etc.
  brand: { type: String, required: true },
  model: { type: String, required: true },
  status: {type: String, enum: ['Disponible', 'Asignado', 'En Reparación'], default: 'Disponible'},
  assignedTo: { type: String, default: 'Ninguno' }, // Aquí iría el nombre del empleado
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Asset', AssetSchema);
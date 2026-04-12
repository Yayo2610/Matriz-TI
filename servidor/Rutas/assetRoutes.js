const express = require('express');
const router = express.Router();
const Asset = require('../Modelos/Asset'); // Ojo: La carpeta debe llamarse 'Modelos'

// GET: Obtener todos los equipos
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST: Registrar un equipo nuevo
router.post('/', async (req, res) => {
  const asset = new Asset(req.body);
  try {
    const newAsset = await asset.save();
    res.status(201).json(newAsset);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Eliminar un equipo
router.delete('/:id', async (req, res) => {
  await Asset.findByIdAndDelete(req.params.id);
  res.json({ message: "Equipo eliminado" });
});

// Actualizar estatus (Editar)
router.put('/:id', async (req, res) => {
  const updatedAsset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updatedAsset);
});
module.exports = router;
const express = require("express");
const router = express.Router();
const Asset = require("../Modelos/Asset"); // Ojo: La carpeta debe llamarse 'Modelos'

console.log("==== LEYENDO NUEVAS RUTAS DE ASSETS ====");

// GET: Obtener todos los equipos
router.get("/", async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST: Registrar un equipo nuevo (Manual)
router.post("/", async (req, res) => {
  const asset = new Asset(req.body);
  try {
    const newAsset = await asset.save();
    res.status(201).json(newAsset);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 🚀 NUEVO: POST para Carga Masiva (Bulk)
router.post("/bulk", async (req, res) => {
  try {
    const assetsData = req.body;

    // Mongoose insertMany es una operación atómica y super rápida
    const result = await Asset.insertMany(assetsData);

    res.status(201).json({
      success: true,
      message: `${result.length} equipos insertados correctamente`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🚀 GET para obtener las métricas del Dashboard
// (Ubicado aquí estratégicamente antes de los endpoints con /:id)
router.get("/metrics", async (req, res) => {
  try {
    const metrics = await Asset.aggregate([
      {
        $facet: {
          totalAssets: [{ $count: "count" }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        },
      },
    ]);

    const total = metrics[0].totalAssets[0]?.count || 0;
    const statusCounts = metrics[0].byStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        total,
        status: {
          enStock: statusCounts["En Stock"] || 0,
          asignado: statusCounts["Asignado"] || 0,
          enMantenimiento: statusCounts["En Mantenimiento"] || 0,
          dadoDeBaja: statusCounts["Dado de Baja"] || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Eliminar un equipo
router.delete("/:id", async (req, res) => {
  await Asset.findByIdAndDelete(req.params.id);
  res.json({ message: "Equipo eliminado" });
});

// Actualizar estatus (Editar)
router.put("/:id", async (req, res) => {
  const updatedAsset = await Asset.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(updatedAsset);
});

// Única exportación al final del archivo
module.exports = router;

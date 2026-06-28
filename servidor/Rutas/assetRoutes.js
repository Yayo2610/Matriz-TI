const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const { Readable } = require("stream");
const Asset = require("../Modelos/Asset"); // Asegúrate de que la ruta sea correcta

console.log("==== LEYENDO NUEVAS RUTAS DE ASSETS ====");

// Configuración de multer (usamos memoria para no guardar en disco)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ----------------------------------------------
// GET: Obtener todos los equipos
router.get("/", async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------
// POST: Registrar un equipo nuevo (Manual, vía JSON)
router.post("/", async (req, res) => {
  const asset = new Asset(req.body);
  try {
    const newAsset = await asset.save();
    res.status(201).json(newAsset);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ----------------------------------------------
// 🚀 NUEVO: POST para Carga Masiva desde archivo CSV
// Ahora espera un archivo con campo 'file' (multipart/form-data)
router.post("/bulk", upload.single("file"), async (req, res) => {
  try {
    // Si no hay archivo, devolvemos error
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:
          "No se recibió ningún archivo. Asegúrate de usar el campo 'file'.",
      });
    }

    // Convertir el buffer del archivo a string
    const csvString = req.file.buffer.toString("utf8");
    const results = [];

    // Creamos un stream legible a partir del string
    const stream = Readable.from(csvString);

    // Parseamos el CSV con encabezados
    // Las columnas esperadas: S/N, Marca, Modelo, Tipo, Nombre, Área
    // Si tu CSV tiene encabezados, usa skipLines: 1 para saltarlos.
    // Si NO tiene encabezados, usa headers: false y luego accede por índice.
    const parsePromise = new Promise((resolve, reject) => {
      stream
        .pipe(
          csv({
            headers: ["S/N", "Marca", "Modelo", "Tipo", "Nombre", "Área"],
            skipLines: 0, // Cambia a 1 si la primera línea contiene los títulos
          }),
        )
        .on("data", (row) => {
          // Mapear cada fila al modelo Asset
          const serialNumber = row["S/N"]?.trim() || "";
          const brand = row["Marca"]?.trim() || "";
          const model = row["Modelo"]?.trim() || "";
          const type = row["Tipo"]?.trim() || "";
          const name = row["Nombre"]?.trim() || "";
          const area = row["Área"]?.trim() || "";

          // Validar campos obligatorios (ajusta según tu modelo)
          if (!serialNumber || !brand || !model || !type || !name || !area) {
            // Si falta algún campo, podrías saltar la fila o lanzar error.
            // Aquí optamos por omitir la fila y registrar una advertencia.
            console.warn("Fila incompleta omitida:", row);
            return;
          }

          // Construir objeto para el modelo
          const assetData = {
            serialNumber,
            brand,
            model,
            type,
            name,
            area,
            // Puedes agregar un estado por defecto o dejarlo como viene en el CSV si existe
            status: row["Estado"]?.trim() || "En Stock", // Si no viene, ponemos "En Stock"
            assignedTo: row["Asignado a"]?.trim() || null,
            // Otros campos que tengas en el modelo (ej. purchaseDate, etc.)
          };

          results.push(assetData);
        })
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });

    const assetsToInsert = await parsePromise;

    if (assetsToInsert.length === 0) {
      return res.status(400).json({
        success: false,
        error: "El archivo CSV no contiene datos válidos o está vacío.",
      });
    }

    // Insertar todos los activos en la base de datos
    // Puedes usar insertMany con opción ordered: false para continuar aunque algunos fallen
    const inserted = await Asset.insertMany(assetsToInsert, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${inserted.length} equipos insertados correctamente de ${assetsToInsert.length} procesados.`,
      data: inserted,
    });
  } catch (error) {
    console.error("Error en /bulk:", error);
    // Si el error es de duplicado (serialNumber único), lo capturamos
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error:
          "Error de duplicado: algunos seriales ya existen en la base de datos.",
        details: error.message,
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------
// 🚀 GET para obtener las métricas del Dashboard
router.get("/metrics", async (req, res) => {
  try {
    const metrics = await Asset.aggregate([
      {
        $facet: {
          totalAssets: [{ $count: "count" }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
          byArea: [{ $group: { _id: "$area", count: { $sum: 1 } } }],
        },
      },
    ]);

    const total = metrics[0].totalAssets[0]?.count || 0;
    const statusCounts = metrics[0].byStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    const typeCounts = metrics[0].byType.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    const areaCounts = metrics[0].byArea.reduce((acc, curr) => {
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
        types: typeCounts,
        areas: areaCounts,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------
// DELETE: Eliminar un equipo
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Asset.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }
    res.json({ message: "Equipo eliminado" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------
// PUT: Actualizar un equipo
router.put("/:id", async (req, res) => {
  try {
    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!updatedAsset) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }
    res.json(updatedAsset);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Única exportación al final del archivo
module.exports = router;

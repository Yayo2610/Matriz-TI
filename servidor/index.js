const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const multer = require("multer"); // ✅ CORREGIDO: "multer" no "mutter"
const csv = require("csv-parser");
const { Readable } = require("stream");
require("dotenv").config();

const app = express();

// ==========================================
// 🛡️ CONFIGURACIÓN DE HARDENING
// ==========================================
app.set("trust proxy", 1); // ✅ Para que rate-limit funcione correctamente en Render
app.use(helmet());
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.",
  },
});
app.use(limiter);

// ==========================================
// 🛡️ MIDDLEWARES DE VALIDACIÓN
// ==========================================
const validarActivo = [
  body("serialNumber")
    .trim()
    .isAlphanumeric()
    .withMessage("La serie debe ser alfanumérica y sin espacios")
    .escape(),
  body("type")
    .notEmpty()
    .withMessage("El tipo de activo es obligatorio")
    .escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

// ==========================================
// 🗄️ MODELOS DE DATOS
// ==========================================
const User =
  mongoose.models.Account ||
  mongoose.model(
    "Account",
    new mongoose.Schema(
      {
        email: { type: String, required: true, unique: true, trim: true },
        password: { type: String, required: true },
        role: {
          type: String,
          required: true,
          enum: ["admin", "tecnico", "coordinador"],
        },
      },
      { timestamps: true },
    ),
  );

const AssetSchema = new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true },
  brand: String,
  model: String,
  type: { type: String, required: true },
  typeOther: { type: String, default: "" },
  status: { type: String, default: "En Stock" },
  assignedTo: { type: String, default: "N/A" },
  department: { type: String, default: "N/A" },
  assignmentDate: { type: Date, default: Date.now },
});

const Asset = mongoose.models.Asset || mongoose.model("Asset", AssetSchema);

// ==========================================
// 🔑 RUTAS DE AUTENTICACIÓN
// ==========================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      role,
    });

    await user.save();
    res.status(201).json({ message: "Usuario creado con éxito" });
  } catch (err) {
    res.status(400).json({
      error:
        "Error al registrar usuario (el correo podría ya existir o el rol es inválido)",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "CLAVE_SECRETA_SOPORTE",
        { expiresIn: "8h" },
      );
      res.json({ token, role: user.role });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ==========================================
// 📊 RUTAS DE ACTIVOS & MÉTRICAS
// ==========================================
app.get("/api/assets/metrics", async (req, res) => {
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

app.get("/api/assets", async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/assets", validarActivo, async (req, res) => {
  try {
    const newAsset = new Asset(req.body);
    await newAsset.save();
    res.status(201).json(newAsset);
  } catch (err) {
    res.status(400).json({ error: "Error: S/N duplicado o inválido" });
  }
});

app.delete("/api/assets/:id", async (req, res) => {
  try {
    await Asset.findByIdAndDelete(req.params.id);
    res.json({ message: "Activo eliminado" });
  } catch (err) {
    res.status(400).json({ error: "No se pudo eliminar el activo" });
  }
});

app.put("/api/assets/:id", async (req, res) => {
  try {
    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(updatedAsset);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar" });
  }
});

// ==========================================
// 🚀 NUEVA RUTA PARA CARGA MASIVA (CSV)
// ==========================================
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/api/assets/bulk", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:
          "No se recibió ningún archivo. Asegúrate de usar el campo 'file'.",
      });
    }

    const csvString = req.file.buffer.toString("utf8");
    const results = [];
    const stream = Readable.from(csvString);

    const parsePromise = new Promise((resolve, reject) => {
      stream
        .pipe(
          csv({
            headers: ["S/N", "Marca", "Modelo", "Tipo", "Nombre", "Área"],
            skipLines: 0, // Cambia a 1 si la primera fila es encabezado
          }),
        )
        .on("data", (row) => {
          const serialNumber = row["S/N"]?.trim() || "";
          const brand = row["Marca"]?.trim() || "";
          const model = row["Modelo"]?.trim() || "";
          const type = row["Tipo"]?.trim() || "";
          const name = row["Nombre"]?.trim() || ""; // ← Este es el nombre del asignado
          const area = row["Área"]?.trim() || "";

          // Validar campos obligatorios
          if (!serialNumber || !brand || !model || !type || !name || !area) {
            console.warn("Fila incompleta:", row);
            return;
          }

          // 👇 Lógica para asignar estado y asignación
          const assignedTo = name && name !== "" ? name : "N/A";
          const status = name && name !== "" ? "Asignado" : "En Stock";
          const department = area && area !== "" ? area : "N/A";

          results.push({
            serialNumber,
            brand,
            model,
            type,
            status, // ← Ahora dinámico
            assignedTo, // ← El nombre del asignado
            department,
          });
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

    const inserted = await Asset.insertMany(assetsToInsert, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${inserted.length} equipos insertados correctamente de ${assetsToInsert.length} procesados.`,
      data: inserted,
    });
  } catch (error) {
    console.error("Error en /bulk:", error);
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

// ==========================================
// 🗑️ ELIMINAR TODOS LOS ACTIVOS (SOLO ADMIN)
// ==========================================
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "CLAVE_SECRETA_SOPORTE",
    );
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};

app.delete("/api/assets/clear", verificarToken, async (req, res) => {
  // Solo admin puede eliminar todo
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "No tienes permisos para esta acción" });
  }

  try {
    const result = await Asset.deleteMany({});
    res.json({
      success: true,
      message: `Se eliminaron ${result.deletedCount} activos permanentemente.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==========================================
// 🔌 CONEXIÓN Y ARRANQUE
// ==========================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error de conexión:", err));

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`🚀 Servidor AssetTrack en puerto ${PORT}`),
  );
}

app.use((req, res, next) => {
  console.log(`Petición recibida: ${req.method} ${req.url}`);
  next();
});

module.exports = app;

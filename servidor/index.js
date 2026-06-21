const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
require("dotenv").config();

const app = express();

// ==========================================
// 🛡️ CONFIGURACIÓN DE HARDENING Y MITIGACIÓN (Sprint 5)
// ==========================================
app.use(helmet());
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

// Configuramos el Rate Limiter contra Fuerza Bruta / DoS
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
// 🛡️ MIDDLEWARES DE VALIDACIÓN (express-validator)
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
// 🗄️ MODELOS DE DATOS (Mongoose) - MODIFICADO PARA S6
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
// 🔑 RUTAS DE AUTENTICACIÓN - MODIFICADO PARA S6
// ==========================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, role } = req.body; // Desestructuramos email y el nuevo campo role
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      role, // Guardamos el rol de forma local en la BD
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
    const { email, password } = req.body; // Cambiado de username a email
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Firmamos el token inyectando el ID y el ROL del usuario (Indispensable para el futuro Sprint 7)
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "CLAVE_SECRETA_SOPORTE",
        {
          expiresIn: "8h", // Modificado a 8 horas para cubrir una jornada laboral de soporte estándar
        },
      );
      // Respondemos con el token y el rol para que el Frontend de React pueda ocultar/mostrar vistas
      res.json({ token, role: user.role });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ==========================================
// 📊 RUTAS DE ACTIVOS & MÉTRICAS (CRUD)
// ==========================================

// Pipeline de Agregación para el Dashboard
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

// GET general de activos
app.get("/api/assets", async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST con el middleware de validación inyectado
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
// 🔌 CONEXIÓN Y ARRANQUE
// ==========================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error de conexión:", err));

// Exportación para pruebas con Jest (Evita que choquen los puertos en entornos de test)
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`🚀 Servidor AssetTrack en puerto ${PORT}`),
  );
}

module.exports = app;

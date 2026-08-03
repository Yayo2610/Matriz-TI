const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const csv = require("csv-parser");
const { Readable } = require("stream");
require("dotenv").config();

const app = express();

// ==========================================
// 🛡️ CONFIGURACIÓN DE HARDENING
// ==========================================
app.set("trust proxy", 1);
app.use(helmet());
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // Las rutas de verificación periódica (estado de cuenta y solicitudes de
  // sesión) tienen su propio límite, más permisivo, porque el cliente las
  // consulta cada pocos segundos de forma automática.
  skip: (req) =>
    req.path === "/api/auth/me" ||
    req.path.startsWith("/api/auth/solicitud-sesion"),
  message: {
    success: false,
    message: "Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.",
  },
});
app.use(limiter);

const pollingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Demasiadas verificaciones, espera un momento." },
});

// ==========================================
// 🔑 MIDDLEWARE DE VERIFICACIÓN DE TOKEN
// ==========================================
const verificarToken = async (req, res, next) => {
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

    // Se revisa el estado real en la base en cada petición para que una
    // cuenta suspendida pierda el acceso de inmediato, y para que un cambio
    // de rol/permisos hecho por el admin aplique sin esperar a un nuevo login
    // (el token puede traer datos desactualizados si se editó la cuenta después).
    const cuenta = await User.findById(decoded.id).select(
      "role permisos activo nombre apellido sessionId",
    );
    if (!cuenta || cuenta.activo === false) {
      return res.status(403).json({
        error: "Cuenta suspendida. Contacta a un administrador.",
      });
    }

    // Sesión única: si se aprobó un inicio de sesión en otro dispositivo,
    // el sessionId de la cuenta cambió y este token queda invalidado.
    if (cuenta.sessionId && decoded.sid !== cuenta.sessionId) {
      return res.status(401).json({
        error: "Tu sesión se cerró porque se inició sesión en otro dispositivo.",
      });
    }

    req.user = {
      id: decoded.id,
      role: cuenta.role,
      permisos: cuenta.permisos,
      nombre: cuenta.nombre,
      apellido: cuenta.apellido,
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};

// ==========================================
// 🔑 MIDDLEWARE DE VERIFICACIÓN DE ROL
// ==========================================
const verificarRol =
  (...rolesPermitidos) =>
  (req, res, next) => {
    if (!rolesPermitidos.includes(req.user?.role)) {
      return res
        .status(403)
        .json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };

// ==========================================
// 🔑 MIDDLEWARE DE VERIFICACIÓN DE PERMISOS (lectura/escritura/modificación)
// ==========================================
const verificarPermiso = (permiso) => (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.permisos?.[permiso]) {
    return next();
  }
  return res.status(403).json({ error: "No tienes permisos para esta acción" });
};

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
        nombre: { type: String, default: "" },
        apellido: { type: String, default: "" },
        email: { type: String, required: true, unique: true, trim: true },
        password: { type: String, required: true },
        role: {
          type: String,
          required: true,
          enum: ["admin", "tecnico", "coordinador"],
        },
        permisos: {
          lectura: { type: Boolean, default: true },
          escritura: { type: Boolean, default: false },
          modificacion: { type: Boolean, default: false },
        },
        activo: { type: Boolean, default: true },
        // Sesión única: identifica el token vigente. Un login nuevo con una
        // sesión ya activa no reemplaza este valor directamente — primero
        // pasa por pendingSession, a la espera de confirmación del otro lado.
        sessionId: { type: String, default: null },
        // Última vez que el dispositivo con la sesión activa dio señales de
        // vida (se actualiza en cada poll de /solicitud-sesion). Si pasa
        // demasiado tiempo sin actualizarse, se asume que esa sesión ya no
        // existe (pestaña cerrada, sin conexión) y un login nuevo no pide
        // confirmación — la reemplaza directo.
        sessionLastSeen: { type: Date, default: null },
        pendingSession: {
          requestId: { type: String, default: null },
          creadoEn: { type: Date, default: null },
          estado: {
            type: String,
            enum: ["pendiente", "aprobada", "rechazada"],
            default: null,
          },
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

const EmployeeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  area: { type: String, default: "General" },
});

const Employee =
  mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

// ==========================================
// 🔑 RUTAS DE AUTENTICACIÓN
// ==========================================
app.post(
  "/api/auth/register",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    try {
      const { nombre, apellido, email, password, role, permisos } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = new User({
        nombre,
        apellido,
        email,
        password: hashedPassword,
        role,
        permisos,
      });

      await user.save();
      res.status(201).json({ message: "Usuario creado con éxito" });
    } catch (err) {
      res.status(400).json({
        error:
          "Error al registrar usuario (el correo podría ya existir o el rol es inválido)",
      });
    }
  },
);

app.get(
  "/api/auth/users",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    try {
      const users = await User.find({ _id: { $ne: req.user.id } }).select(
        "-password",
      );
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/auth/users/:id",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    try {
      const camposPermitidos = ["nombre", "apellido", "role", "permisos", "activo"];
      const actualizacion = {};
      camposPermitidos.forEach((campo) => {
        if (req.body[campo] !== undefined) actualizacion[campo] = req.body[campo];
      });

      if (req.body.password && req.body.password.trim() !== "") {
        actualizacion.password = await bcrypt.hash(req.body.password, 10);
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        actualizacion,
        { new: true, runValidators: true },
      ).select("-password");
      if (!updatedUser) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json(updatedUser);
    } catch (err) {
      res.status(400).json({ error: "No se pudo actualizar el usuario" });
    }
  },
);

app.delete(
  "/api/auth/users/:id",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    if (req.params.id === req.user.id) {
      return res
        .status(400)
        .json({ error: "No puedes eliminar tu propia cuenta" });
    }
    try {
      await User.findByIdAndDelete(req.params.id);
      res.json({ message: "Usuario eliminado" });
    } catch (err) {
      res.status(400).json({ error: "No se pudo eliminar el usuario" });
    }
  },
);

// Excel en Windows suele guardar el CSV con un BOM de UTF-8 al inicio;
// si no se quita, corrompe el encabezado de la primera columna.
const quitarBOM = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3);
  }
  return buffer;
};

const firmarToken = (user, sessionId) =>
  jwt.sign(
    { id: user._id, sid: sessionId },
    process.env.JWT_SECRET || "CLAVE_SECRETA_SOPORTE",
    { expiresIn: "8h" },
  );

const EXPIRACION_SOLICITUD_MS = 2 * 60 * 1000; // 2 minutos
const ABANDONO_SESION_MS = 20 * 1000; // sin heartbeat en 20s = pestaña cerrada/sin conexión

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      if (user.activo === false) {
        return res.status(403).json({
          error: "Cuenta suspendida. Contacta a un administrador.",
        });
      }

      // Sesión única: si ya hay una sesión activa Y sigue dando señales de
      // vida, no se reemplaza directo — se crea una solicitud pendiente que
      // el otro dispositivo debe aceptar. Si esa sesión lleva demasiado
      // tiempo sin heartbeat (pestaña cerrada, token expirado, sin conexión),
      // se considera abandonada y el login nuevo pasa directo, sin preguntar.
      const ultimoVisto = user.sessionLastSeen
        ? new Date(user.sessionLastSeen).getTime()
        : 0;
      const sesionAbandonada = Date.now() - ultimoVisto > ABANDONO_SESION_MS;

      if (user.sessionId && !sesionAbandonada) {
        const requestId = crypto.randomUUID();
        user.pendingSession = {
          requestId,
          creadoEn: new Date(),
          estado: "pendiente",
        };
        await user.save();
        return res.status(202).json({ pendiente: true, requestId });
      }

      const sessionId = crypto.randomUUID();
      user.sessionId = sessionId;
      user.sessionLastSeen = new Date();
      user.pendingSession = { requestId: null, creadoEn: null, estado: null };
      await user.save();

      res.json({
        token: firmarToken(user, sessionId),
        role: user.role,
        permisos: user.permisos,
        nombre: user.nombre,
        apellido: user.apellido,
      });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Cierre de sesión explícito: libera el sessionId para que un login
// posterior (incluso desde el mismo dispositivo) no quede pidiendo
// confirmación a una sesión que ya nadie va a responder.
app.post("/api/auth/logout", verificarToken, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    sessionId: null,
    sessionLastSeen: null,
  });
  res.json({ ok: true });
});

// Panel de admin: quién tiene una sesión abierta ahora mismo.
app.get(
  "/api/auth/sesiones-activas",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    try {
      const cuentas = await User.find({ sessionId: { $ne: null } }).select(
        "nombre apellido email role sessionLastSeen",
      );
      const sesiones = cuentas.map((c) => ({
        id: c._id,
        nombre: c.nombre,
        apellido: c.apellido,
        email: c.email,
        role: c.role,
        esEsteUsuario: String(c._id) === String(req.user.id),
        activa:
          !!c.sessionLastSeen &&
          Date.now() - new Date(c.sessionLastSeen).getTime() < ABANDONO_SESION_MS,
        ultimaVezVisto: c.sessionLastSeen,
      }));
      res.json(sesiones);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Forzar el cierre de la sesión de otra cuenta (no la propia — para eso
// está /logout). Se reemplaza el sessionId por uno nuevo que nadie tiene,
// igual que cuando se aprueba un cambio de sesión entre dispositivos: el
// token viejo queda inválido en su siguiente petición.
app.post(
  "/api/auth/sesiones-activas/:userId/cerrar",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({
        error: "Para cerrar tu propia sesión usa el botón de Salir",
      });
    }
    try {
      const cuenta = await User.findByIdAndUpdate(req.params.userId, {
        sessionId: crypto.randomUUID(),
        sessionLastSeen: null,
      });
      if (!cuenta) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Endpoint ligero para que el cliente verifique periódicamente que la cuenta
// sigue activa (verificarToken ya rechaza cuentas suspendidas) y para
// refrescar rol/permisos actualizados al cargar o recargar la página.
app.get("/api/auth/me", verificarToken, pollingLimiter, (req, res) => {
  res.json({
    role: req.user.role,
    permisos: req.user.permisos,
    nombre: req.user.nombre,
    apellido: req.user.apellido,
  });
});

// Consultado por el dispositivo con la sesión ya abierta: le avisa si algún
// otro inicio de sesión está esperando su confirmación.
app.get(
  "/api/auth/solicitud-sesion",
  verificarToken,
  pollingLimiter,
  async (req, res) => {
    // Heartbeat: mientras esta ruta se siga consultando, la sesión sigue viva.
    const cuenta = await User.findByIdAndUpdate(
      req.user.id,
      { sessionLastSeen: new Date() },
      { new: true },
    ).select("pendingSession");
    if (cuenta?.pendingSession?.estado === "pendiente") {
      const vencida =
        Date.now() - new Date(cuenta.pendingSession.creadoEn).getTime() >
        EXPIRACION_SOLICITUD_MS;
      if (vencida) {
        cuenta.pendingSession = { requestId: null, creadoEn: null, estado: null };
        await cuenta.save();
        return res.json({ pendiente: false });
      }
      return res.json({
        pendiente: true,
        requestId: cuenta.pendingSession.requestId,
      });
    }
    res.json({ pendiente: false });
  },
);

// El dispositivo con la sesión abierta responde sí/no a la solicitud.
app.post(
  "/api/auth/solicitud-sesion/responder",
  verificarToken,
  pollingLimiter,
  async (req, res) => {
    const { aprobar } = req.body;
    const cuenta = await User.findById(req.user.id);
    if (!cuenta || cuenta.pendingSession?.estado !== "pendiente") {
      return res.status(404).json({ error: "No hay ninguna solicitud pendiente" });
    }

    if (aprobar) {
      // Al cambiar el sessionId, el token de este dispositivo queda
      // invalidado en su siguiente petición (lo cierra automáticamente).
      cuenta.sessionId = cuenta.pendingSession.requestId;
      cuenta.pendingSession.estado = "aprobada";
    } else {
      cuenta.pendingSession.estado = "rechazada";
    }
    await cuenta.save();
    res.json({ ok: true });
  },
);

// Consultado por el dispositivo que intenta iniciar sesión, mientras espera
// la confirmación del otro lado. Sin autenticar: solo identifica con el
// requestId (UUID aleatorio), que nadie más conoce.
app.get(
  "/api/auth/solicitud-sesion/:requestId/estado",
  pollingLimiter,
  async (req, res) => {
    const { requestId } = req.params;
    const cuenta = await User.findOne({
      "pendingSession.requestId": requestId,
    });

    if (!cuenta) {
      return res.json({ estado: "expirada" });
    }

    const vencida =
      Date.now() - new Date(cuenta.pendingSession.creadoEn).getTime() >
      EXPIRACION_SOLICITUD_MS;
    if (cuenta.pendingSession.estado === "pendiente" && vencida) {
      cuenta.pendingSession = { requestId: null, creadoEn: null, estado: null };
      await cuenta.save();
      return res.json({ estado: "expirada" });
    }

    if (cuenta.pendingSession.estado === "aprobada") {
      res.json({
        estado: "aprobada",
        token: firmarToken(cuenta, cuenta.sessionId),
        role: cuenta.role,
        permisos: cuenta.permisos,
        nombre: cuenta.nombre,
        apellido: cuenta.apellido,
      });
      cuenta.pendingSession = { requestId: null, creadoEn: null, estado: null };
      await cuenta.save();
      return;
    }

    if (cuenta.pendingSession.estado === "rechazada") {
      res.json({ estado: "rechazada" });
      cuenta.pendingSession = { requestId: null, creadoEn: null, estado: null };
      await cuenta.save();
      return;
    }

    res.json({ estado: "pendiente" });
  },
);

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ error: "El correo y la nueva contraseña son obligatorios" });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error:
          "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ error: "No existe ninguna cuenta con ese correo" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ==========================================
// 📊 RUTAS DE ACTIVOS & MÉTRICAS
// ==========================================
app.get(
  "/api/assets/metrics",
  verificarToken,
  verificarPermiso("lectura"),
  async (req, res) => {
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
  },
);

app.get(
  "/api/assets",
  verificarToken,
  verificarPermiso("lectura"),
  async (req, res) => {
    try {
      const assets = await Asset.find();
      res.json(assets);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/assets",
  verificarToken,
  verificarPermiso("escritura"),
  validarActivo,
  async (req, res) => {
    try {
      const newAsset = new Asset(req.body);
      await newAsset.save();
      res.status(201).json(newAsset);
    } catch (err) {
      res.status(400).json({ error: "Error: S/N duplicado o inválido" });
    }
  },
);

app.put(
  "/api/assets/:id",
  verificarToken,
  verificarPermiso("modificacion"),
  async (req, res) => {
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
  },
);

// ==========================================
// 🚀 CARGA MASIVA (CSV)
// ==========================================
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post(
  "/api/assets/bulk",
  verificarToken,
  verificarPermiso("escritura"),
  upload.single("file"),
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:
          "No se recibió ningún archivo. Asegúrate de usar el campo 'file'.",
      });
    }

    const csvString = quitarBOM(req.file.buffer).toString("utf8");
    const results = [];
    const omitidas = [];
    let filaIndex = 1; // la fila 1 es el encabezado, que se salta
    const stream = Readable.from(csvString);

    const parsePromise = new Promise((resolve, reject) => {
      stream
        .pipe(
          csv({
            headers: ["S/N", "Marca", "Modelo", "Tipo", "Nombre", "Área"],
            skipLines: 1,
          }),
        )
        .on("data", (row) => {
          filaIndex++;
          const serialNumber = row["S/N"]?.trim() || "";
          const brand = row["Marca"]?.trim() || "";
          const model = row["Modelo"]?.trim() || "";
          const type = row["Tipo"]?.trim() || "";
          const name = row["Nombre"]?.trim() || "";
          const area = row["Área"]?.trim() || "";

          const faltantes = [];
          if (!serialNumber) faltantes.push("S/N");
          if (!brand) faltantes.push("Marca");
          if (!model) faltantes.push("Modelo");
          if (!type) faltantes.push("Tipo");
          if (!name) faltantes.push("Nombre");
          if (!area) faltantes.push("Área");

          if (faltantes.length > 0) {
            omitidas.push({ fila: filaIndex, motivo: `Falta: ${faltantes.join(", ")}` });
            return;
          }

          const assignedTo = name && name !== "" ? name : "N/A";
          const status = name && name !== "" ? "Asignado" : "En Stock";
          const department = area && area !== "" ? area : "N/A";

          results.push({
            serialNumber,
            brand,
            model,
            type,
            status,
            assignedTo,
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
        omitidas,
      });
    }

    const inserted = await Asset.insertMany(assetsToInsert, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${inserted.length} equipos insertados correctamente de ${assetsToInsert.length + omitidas.length} filas procesadas.`,
      inserted: inserted.length,
      omitidas,
      total: assetsToInsert.length + omitidas.length,
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
  },
);

// ==========================================
// 👥 DIRECTORIO DE PERSONAL (NÓMINA)
// ==========================================
app.get(
  "/api/employees",
  verificarToken,
  verificarPermiso("lectura"),
  async (req, res) => {
    try {
      const empleados = await Employee.find();
      res.json(empleados);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Alta individual — para agregar un colaborador suelto sin resubir todo el CSV.
app.post(
  "/api/employees",
  verificarToken,
  verificarPermiso("escritura"),
  async (req, res) => {
    try {
      const { fullName, area } = req.body;
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ error: "El nombre es obligatorio" });
      }
      const nuevo = await Employee.create({
        fullName: fullName.trim(),
        area: area?.trim() || "General",
      });
      res.status(201).json(nuevo);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Edición individual.
app.put(
  "/api/employees/:id",
  verificarToken,
  verificarPermiso("escritura"),
  async (req, res) => {
    try {
      const { fullName, area } = req.body;
      const actualizado = await Employee.findByIdAndUpdate(
        req.params.id,
        { fullName, area },
        { new: true, runValidators: true },
      );
      if (!actualizado) {
        return res.status(404).json({ error: "Colaborador no encontrado" });
      }
      res.json(actualizado);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Borra el directorio de personal completo (solo admin), igual que
// "Eliminar todos" en activos. Va ANTES de /:id para que Express no
// confunda "clear" con un id.
app.delete(
  "/api/employees/clear",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
    try {
      const result = await Employee.deleteMany({});
      res.json({
        success: true,
        message: `Se eliminaron ${result.deletedCount} colaboradores permanentemente.`,
        deletedCount: result.deletedCount,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Baja individual.
app.delete(
  "/api/employees/:id",
  verificarToken,
  verificarPermiso("escritura"),
  async (req, res) => {
    try {
      const eliminado = await Employee.findByIdAndDelete(req.params.id);
      if (!eliminado) {
        return res.status(404).json({ error: "Colaborador no encontrado" });
      }
      res.json({ message: "Colaborador eliminado" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Reemplaza el directorio completo por el contenido del CSV subido, para
// que quede disponible para todos los usuarios (antes solo vivía en la
// memoria del navegador de quien lo subía).
app.post(
  "/api/employees/bulk",
  verificarToken,
  verificarPermiso("escritura"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No se recibió ningún archivo.",
        });
      }

      const csvString = quitarBOM(req.file.buffer).toString("utf8");
      const stream = Readable.from(csvString);
      const empleados = [];
      const omitidas = [];
      let filaIndex = 1; // la fila 1 es el encabezado, que se salta

      // Formato esperado: Nombre,Apellido,Área
      await new Promise((resolve, reject) => {
        stream
          .pipe(
            csv({ headers: ["Nombre", "Apellido", "Área"], skipLines: 1 }),
          )
          .on("data", (row) => {
            filaIndex++;
            const nombre = row["Nombre"]?.trim() || "";
            const apellido = row["Apellido"]?.trim() || "";
            const area = row["Área"]?.trim() || "General";

            if (!nombre || !apellido) {
              const faltantes = [];
              if (!nombre) faltantes.push("Nombre");
              if (!apellido) faltantes.push("Apellido");
              omitidas.push({ fila: filaIndex, motivo: `Falta: ${faltantes.join(", ")}` });
              return;
            }

            empleados.push({ fullName: `${nombre} ${apellido}`, area });
          })
          .on("end", resolve)
          .on("error", reject);
      });

      if (empleados.length === 0) {
        return res.status(400).json({
          success: false,
          error: "El archivo de personal no contiene datos estructurados válidos.",
          omitidas,
        });
      }

      await Employee.deleteMany({});
      const inserted = await Employee.insertMany(empleados);

      res.status(201).json({
        success: true,
        message: `Directorio actualizado: se precargaron ${inserted.length} colaboradores.`,
        inserted: inserted.length,
        omitidas,
        total: empleados.length + omitidas.length,
        data: inserted,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// ==========================================
// 🗑️ RUTAS DELETE (ORDEN CORRECTO)
// ==========================================

// ✅ PRIMERO: Ruta específica /clear (solo admin)
app.delete(
  "/api/assets/clear",
  verificarToken,
  verificarRol("admin"),
  async (req, res) => {
  console.log("🗑️ [DELETE /clear] Petición recibida");
  console.log("👤 [DELETE /clear] Usuario autenticado:", req.user);

  try {
    const result = await Asset.deleteMany({});
    console.log(`✅ [DELETE /clear] Eliminados ${result.deletedCount} activos`);
    res.json({
      success: true,
      message: `Se eliminaron ${result.deletedCount} activos permanentemente.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("❌ [DELETE /clear] Error al eliminar:", err.message);
    res.status(500).json({ error: err.message });
  }
  },
);

// ✅ DESPUÉS: Ruta con parámetro /:id (eliminación individual)
app.delete(
  "/api/assets/:id",
  verificarToken,
  verificarPermiso("modificacion"),
  async (req, res) => {
    console.log(`🗑️ [DELETE /:id] Eliminando activo ${req.params.id}`);
    try {
      await Asset.findByIdAndDelete(req.params.id);
      res.json({ message: "Activo eliminado" });
    } catch (err) {
      res.status(400).json({ error: "No se pudo eliminar el activo" });
    }
  },
);

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

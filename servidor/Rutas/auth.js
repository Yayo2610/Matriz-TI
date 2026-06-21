const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Modelos/User"); // Importa tu modelo actualizado

// @route   POST api/auth/login
// @desc    Autenticar usuario local y obtener token con Rol
// @access  Público
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Verificar si el usuario existe en la base de datos local
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Credenciales incorrectas" });
    }

    // 2. Comparar la contraseña ingresada con el hash de la BD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Credenciales incorrectas" });
    }

    // 3. Crear el payload del JWT incluyendo el ID y el ROL (Clave para S6/S7)
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    // 4. Firmar el token usando tu variable de entorno
    jwt.sign(
      payload,
      process.env.JWT_SECRET || "FirmaSecretaAssetTrack2026", // Clave secreta temporal si no lee el .env
      { expiresIn: "8h" }, // Expira en 8 horas por seguridad
      (err, token) => {
        if (err) throw err;
        // Respondemos al frontend con el token y el rol asignado
        res.json({ token, role: user.role });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

module.exports = router;

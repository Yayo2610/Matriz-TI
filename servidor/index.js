const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. MODELOS DE DATOS ---
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

const Asset = mongoose.model('Asset', new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true },
  brand: String,
  model: String,
  type: { type: String, default: 'Laptop' }
}));

// --- 2. RUTAS DE AUTENTICACIÓN ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "Usuario creado con éxito" });
  } catch (err) { res.status(400).json({ error: "Error al registrar usuario" }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id }, 'CLAVE_SECRETA_SOPORTE', { expiresIn: '2h' });
    res.json({ token, username: user.username });
  } else {
    res.status(401).json({ error: "Credenciales inválidas" });
  }
});

// --- 3. RUTAS DE ACTIVOS (CRUD) ---
app.get('/api/assets', async (req, res) => {
  const assets = await Asset.find();
  res.json(assets);
});

app.post('/api/assets', async (req, res) => {
  try {
    const newAsset = new Asset(req.body);
    await newAsset.save();
    res.status(201).json(newAsset);
  } catch (err) { res.status(400).json({ error: "Error: S/N duplicado o inválido" }); }
});

app.delete('/api/assets/:id', async (req, res) => {
  await Asset.findByIdAndDelete(req.params.id);
  res.json({ message: "Activo eliminado" });
});

// Actualizar un activo (Endpoint para el botón de Editar)
app.put('/api/assets/:id', async (req, res) => {
  try {
    const updatedAsset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedAsset);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar" });
  }
});

// --- 4. CONEXIÓN Y ARRANQUE ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => console.error("❌ Error de conexión:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor AssetTrack en puerto ${PORT}`));
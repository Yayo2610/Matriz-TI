const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index'); // Importamos tu servidor
const mongoose = require('mongoose');

const firmarToken = (role, permisos = {}) =>
  jwt.sign(
    { id: 'test-user-id', role, permisos },
    process.env.JWT_SECRET || 'CLAVE_SECRETA_SOPORTE',
    { expiresIn: '1h' },
  );

const tokenAdmin = firmarToken('admin');
const tokenSoloLectura = firmarToken('coordinador', { lectura: true });
const tokenEscritura = firmarToken('tecnico', { lectura: true, escritura: true });

describe('Pruebas de Integración - API AssetTrack', () => {

  // Limpiar conexión después de las pruebas
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('Debería rechazar la lista de activos sin token (GET /api/assets)', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.statusCode).toEqual(401);
  });

  it('Debería obtener la lista de activos con token válido (GET /api/assets)', async () => {
    const res = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Debería fallar si intentamos registrar un activo vacío', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({}); // Enviamos un objeto vacío
    expect(res.statusCode).toEqual(400); // Esperamos error del servidor
  });

  it('Debería rechazar la creación de activos si el usuario solo tiene permiso de lectura', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${tokenSoloLectura}`)
      .send({ serialNumber: 'ABC123', type: 'Computadora' });
    expect(res.statusCode).toEqual(403);
  });

  it('Debería permitir crear activos a un usuario con permiso de escritura', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${tokenEscritura}`)
      .send({ serialNumber: `ESC${Date.now()}`, brand: 'HP', model: 'X', type: 'Computadora' });
    expect(res.statusCode).toEqual(201);
  });

  it('Debería rechazar editar/eliminar activos a un usuario con permiso de escritura pero sin modificación', async () => {
    const res = await request(app)
      .put('/api/assets/000000000000000000000000')
      .set('Authorization', `Bearer ${tokenEscritura}`)
      .send({ brand: 'Otra' });
    expect(res.statusCode).toEqual(403);
  });
});
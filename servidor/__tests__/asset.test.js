const request = require('supertest');
const app = require('../index'); // Importamos tu servidor
const mongoose = require('mongoose');

describe('Pruebas de Integración - API AssetTrack', () => {

  // Limpiar conexión después de las pruebas
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('Debería obtener la lista de activos (GET /api/assets)', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Debería fallar si intentamos registrar un activo vacío', async () => {
    const res = await request(app)
      .post('/api/assets')
      .send({}); // Enviamos un objeto vacío
    expect(res.statusCode).toEqual(400); // Esperamos error del servidor
  });
});
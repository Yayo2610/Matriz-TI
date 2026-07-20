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

  describe('Carga masiva de activos (POST /api/assets/bulk)', () => {
    it('Debería rechazar la carga masiva sin token', async () => {
      const res = await request(app).post('/api/assets/bulk');
      expect(res.statusCode).toEqual(401);
    });

    it('Debería rechazar la carga masiva a un usuario sin permiso de escritura', async () => {
      const res = await request(app)
        .post('/api/assets/bulk')
        .set('Authorization', `Bearer ${tokenSoloLectura}`)
        .attach('file', Buffer.from('S001,HP,X,Computadora,Juan,TI'), 'activos.csv');
      expect(res.statusCode).toEqual(403);
    });

    it('Debería fallar si no se adjunta ningún archivo', async () => {
      const res = await request(app)
        .post('/api/assets/bulk')
        .set('Authorization', `Bearer ${tokenEscritura}`);
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('Debería insertar los equipos válidos de un CSV bien formado', async () => {
      const csv = `BULK${Date.now()},HP,ProBook,Computadora,Juan Perez,TI\n`;
      const res = await request(app)
        .post('/api/assets/bulk')
        .set('Authorization', `Bearer ${tokenEscritura}`)
        .attach('file', Buffer.from(csv), 'activos.csv');
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toEqual(1);
    });

    it('Debería omitir filas incompletas y devolver error si ninguna fila es válida', async () => {
      const csv = 'SOLOSERIE,,,,,\n';
      const res = await request(app)
        .post('/api/assets/bulk')
        .set('Authorization', `Bearer ${tokenEscritura}`)
        .attach('file', Buffer.from(csv), 'activos.csv');
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Eliminación masiva de activos (DELETE /api/assets/clear)', () => {
    // Nota: solo se prueba la autorización. No se ejecuta el borrado real
    // como admin porque este proyecto no tiene una base de datos de test
    // aislada (MONGO_URI apunta al mismo cluster de Atlas que usa producción),
    // y /clear elimina TODOS los documentos de la colección Asset.
    it('Debería rechazar el borrado masivo sin token', async () => {
      const res = await request(app).delete('/api/assets/clear');
      expect(res.statusCode).toEqual(401);
    });

    it('Debería rechazar el borrado masivo a un usuario que no es admin', async () => {
      const res = await request(app)
        .delete('/api/assets/clear')
        .set('Authorization', `Bearer ${tokenEscritura}`);
      expect(res.statusCode).toEqual(403);
    });
  });
});

describe('Pruebas de Integración - Gestión de Usuarios (API AssetTrack)', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    it('Debería rechazar el registro sin token', async () => {
      const res = await request(app).post('/api/auth/register');
      expect(res.statusCode).toEqual(401);
    });

    it('Debería rechazar el registro si quien lo pide no es admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${tokenEscritura}`)
        .send({
          nombre: 'Prueba',
          apellido: 'QA',
          email: `qa${Date.now()}@empresa.com`,
          password: 'Clave123',
          role: 'tecnico',
        });
      expect(res.statusCode).toEqual(403);
    });

    it('Debería permitir a un admin registrar un nuevo usuario', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Prueba',
          apellido: 'QA',
          email: `qa${Date.now()}@empresa.com`,
          password: 'Clave123',
          role: 'tecnico',
          permisos: { lectura: true, escritura: false, modificacion: false },
        });
      expect(res.statusCode).toEqual(201);
    });
  });

  describe('GET /api/auth/users', () => {
    it('Debería rechazar el listado sin token', async () => {
      const res = await request(app).get('/api/auth/users');
      expect(res.statusCode).toEqual(401);
    });

    it('Debería rechazar el listado si quien lo pide no es admin', async () => {
      const res = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${tokenSoloLectura}`);
      expect(res.statusCode).toEqual(403);
    });

    it('Debería devolver un arreglo de usuarios a un admin, sin exponer la contraseña', async () => {
      const res = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((u) => expect(u.password).toBeUndefined());
    });
  });

  describe('PUT /api/auth/users/:id', () => {
    it('Debería rechazar la edición si quien lo pide no es admin', async () => {
      const res = await request(app)
        .put('/api/auth/users/000000000000000000000000')
        .set('Authorization', `Bearer ${tokenEscritura}`)
        .send({ nombre: 'Otro' });
      expect(res.statusCode).toEqual(403);
    });

    it('Debería devolver 404 si el usuario a editar no existe', async () => {
      const res = await request(app)
        .put('/api/auth/users/000000000000000000000000')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false });
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /api/auth/users/:id', () => {
    it('Debería rechazar la eliminación si quien lo pide no es admin', async () => {
      const res = await request(app)
        .delete('/api/auth/users/000000000000000000000000')
        .set('Authorization', `Bearer ${tokenEscritura}`);
      expect(res.statusCode).toEqual(403);
    });

    it('Debería impedir que un admin se elimine a sí mismo', async () => {
      const res = await request(app)
        .delete('/api/auth/users/test-user-id')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.statusCode).toEqual(400);
    });
  });
});
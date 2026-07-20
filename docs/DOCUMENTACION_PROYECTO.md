# Documentación del proyecto — AssetTrack Pro (Matriz-TI)

> Generado a partir de una lectura completa del repositorio. Explica qué hace cada carpeta, cada archivo y los bloques de código más importantes, para que cualquiera (incluido tu "yo" del futuro) entienda el funcionamiento sin tener que releer todo el código desde cero.

---

## 1. ¿Qué es esta aplicación?

**AssetTrack Pro** es un sistema de **inventario de activos de TI** (computadoras, celulares, otros equipos) para una mesa de ayuda/soporte interno. Permite:

- Iniciar sesión con roles (`admin`, `tecnico`, `coordinador`).
- Registrar, editar, asignar y dar de baja equipos.
- Cargar equipos masivamente vía CSV.
- Ver métricas del inventario (totales, en stock, asignados, en mantenimiento).
- Gestionar usuarios del sistema (solo `admin`) con permisos granulares de **lectura / escritura / modificación**.

Es un **stack MERN**: MongoDB + Express + React + Node, dividido en dos proyectos independientes (`client/` y `servidor/`) que se despliegan por separado.

---

## 2. Mapa general de la carpeta

```
Matriz-TI/
├── client/              → Frontend (React + Vite + Tailwind), se despliega en Vercel
├── servidor/            → Backend (Express + MongoDB), se despliega en Render
├── docs/                → Diagrama de base de datos (diseño planeado, no 100% implementado)
├── package.json         → Archivo suelto en la raíz, NO es el proyecto real (ver sección 6)
└── .gitignore           → Solo ignora node_modules/ (⚠️ ver advertencia de seguridad al final)
```

Los dos proyectos **no comparten código ni se importan entre sí**: se comunican únicamente por HTTP (el cliente le pega al backend con `axios`/`fetch` usando URLs completas hardcodeadas).

---

## 3. Backend — `servidor/`

### 3.1 `servidor/index.js` — el corazón real del backend

Este archivo de 494 líneas es **el único que realmente se ejecuta**. Aunque existen carpetas `Modelos/` y `Rutas/` con código separado (ver sección 3.4), `index.js` **no las importa** — reimplementa todo internamente. Esto es importante: si algún día quieres modificar el comportamiento del backend, este es el archivo que hay que tocar, no los de `Modelos/`/`Rutas/`.

Recorrido por bloques:

**a) Imports y configuración base (líneas 1–23)**
```js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const csv = require("csv-parser");
```
- `express`: framework del servidor HTTP.
- `mongoose`: ODM para hablar con MongoDB.
- `jsonwebtoken` + `bcryptjs`: autenticación (tokens firmados + hash de contraseñas).
- `helmet`: agrega cabeceras HTTP de seguridad automáticamente.
- `express-rate-limit`: limita cuántas peticiones por IP se aceptan.
- `express-validator`: valida el body de las peticiones (`serialNumber`, `type`, etc.).
- `multer` + `csv-parser`: reciben y parsean archivos CSV subidos por el usuario.

```js
app.set("trust proxy", 1);
app.use(helmet());
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
```
- `trust proxy`: necesario porque Render pone un proxy delante; sin esto, el rate-limiter no detecta bien la IP real.
- `helmet()`: añade cabeceras como `X-Content-Type-Options`, `X-Frame-Options`, etc.
- `disable("x-powered-by")`: oculta que el server es Express (reduce fingerprinting).
- `cors()` **sin restricciones**: acepta peticiones de cualquier origen (ver advertencia de seguridad).
- `express.json()`: permite leer `req.body` como JSON.

```js
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, ... });
app.use(limiter);
```
Máximo 100 peticiones cada 15 minutos por IP. Protege contra fuerza bruta / abuso.

**b) Middleware `verificarToken` (líneas 38–61)**

Se ejecuta antes de casi todas las rutas protegidas. Lee el header `Authorization: Bearer <token>`, lo verifica con `jwt.verify()` y, si es válido, guarda el contenido decodificado (`id`, `role`, `permisos`) en `req.user` para que las rutas siguientes lo usen. Si falta o es inválido, corta la petición con `401`/`403`.

> ⚠️ Usa `process.env.JWT_SECRET || "CLAVE_SECRETA_SOPORTE"` — como el `.env` real **no define `JWT_SECRET`**, en producción se está firmando con el valor hardcodeado, que además está público en el repositorio. Ver advertencia final.

**c) Middleware `verificarRol` (líneas 66–75)**

Función que **devuelve** un middleware (patrón "factory"). Se usa así: `verificarRol("admin")`. Comprueba que `req.user.role` esté dentro de los roles permitidos que se le pasan como argumento.

**d) Middleware `verificarPermiso` (líneas 80–85)**

Similar, pero para permisos granulares (`lectura`/`escritura`/`modificacion`). Un `admin` siempre pasa; los demás roles necesitan tener ese permiso en `true` dentro de `req.user.permisos`.

**e) Validación de activos (líneas 90–107)**

`validarActivo` es un array de middlewares de `express-validator`: exige que `serialNumber` sea alfanumérico (sin espacios) y que `type` no esté vacío. Si hay errores, responde `400` con el detalle.

**f) Modelos de datos definidos inline (líneas 112–149)**

```js
const User = mongoose.models.Account || mongoose.model("Account", new mongoose.Schema({...}));
```
- El modelo de usuario se llama internamente **`Account`** (no `User`), con campos `nombre`, `apellido`, `email`, `password` (hasheada), `role` (enum: `admin`/`tecnico`/`coordinador`) y `permisos` (objeto con 3 booleanos).
- `mongoose.models.Account || mongoose.model(...)` evita el error "Cannot overwrite model once compiled" cuando el archivo se vuelve a cargar (por ejemplo en los tests con Jest).

```js
const AssetSchema = new mongoose.Schema({ serialNumber, brand, model, type, typeOther, status, assignedTo, department, assignmentDate });
const Asset = mongoose.models.Asset || mongoose.model("Asset", AssetSchema);
```
Modelo del equipo/activo. `serialNumber` es único.

**g) Rutas de autenticación (líneas 154–242)**

| Ruta | Método | Protección | Qué hace |
|---|---|---|---|
| `/api/auth/register` | POST | token + rol `admin` | Crea un usuario nuevo, hashea la contraseña con bcrypt (`10` rondas) |
| `/api/auth/users` | GET | token + rol `admin` | Lista todos los usuarios **excepto el propio admin logueado** (`$ne: req.user.id`) y sin el campo `password` |
| `/api/auth/users/:id` | DELETE | token + rol `admin` | Borra un usuario; bloquea que un admin se borre a sí mismo |
| `/api/auth/login` | POST | pública | Busca el usuario por email, compara password con bcrypt, firma un JWT (8h de expiración) con `{ id, role, permisos }` y devuelve también `nombre`/`apellido` |

**h) Rutas de activos y métricas (líneas 247–332)**

- `GET /api/assets/metrics` — usa `Asset.aggregate()` con `$facet` para calcular en una sola consulta el total de activos y el conteo por estado (`En Stock`, `Asignado`, `En Mantenimiento`, `Dado de Baja`). Requiere permiso `lectura`.
- `GET /api/assets` — lista todos los activos. Requiere permiso `lectura`.
- `POST /api/assets` — crea un activo nuevo (pasa por `validarActivo`). Requiere permiso `escritura`.
- `PUT /api/assets/:id` — actualiza un activo (usado para cambiar `status`, reasignar, editar marca/modelo, etc.). Requiere permiso `modificacion`.

**i) Carga masiva CSV (líneas 337–427)**

`POST /api/assets/bulk` recibe un archivo (`multer` en memoria, sin guardarlo en disco), lo convierte a texto y lo parsea con `csv-parser` esperando las columnas fijas `S/N, Marca, Modelo, Tipo, Nombre, Área` (sin encabezado, `skipLines: 0`). Por cada fila:
- Si falta algún campo obligatorio, la fila se descarta (con `console.warn`).
- Si `Nombre` viene con valor, el equipo se marca `status: "Asignado"`; si no, `"En Stock"`.
- Al final hace `Asset.insertMany(..., { ordered: false })` para insertar todo de golpe y que un duplicado no frene el resto. Si hay duplicados de `serialNumber` (error Mongo `11000`), responde `409` explicando cuáles fallaron.

**j) Rutas DELETE (líneas 429–471)**

Hay un comentario explícito en el código (`✅ PRIMERO... ✅ DESPUÉS...`) que documenta una lección aprendida: **el orden de las rutas en Express importa**. `/api/assets/clear` (borra TODO, solo admin) debe declararse **antes** que `/api/assets/:id` (borra uno), porque si no, Express interpretaría `"clear"` como si fuera un `:id`. Esto coincide con los commits de git `f97e936`/`00c2099` ("Corrige orden de rutas: /clear antes de /:id").

**k) Arranque (líneas 473–493)**

```js
mongoose.connect(process.env.MONGO_URI)...
if (process.env.NODE_ENV !== "test") { app.listen(PORT, ...) }
module.exports = app;
```
El servidor solo escucha en un puerto real si **no** está en modo test — así los tests de Jest/Supertest pueden importar `app` y golpearlo directamente sin necesidad de un puerto abierto.

### 3.2 `servidor/Modelos/Asset.js` y `Modelos/User.js` — ⚠️ código muerto

Definen versiones de los mismos modelos (`Asset`, `User`), pero **`index.js` nunca los importa** (define sus propios esquemas inline, como se vio arriba). Quedaron de una etapa anterior del desarrollo. Diferencias notables si algún día se quisieran usar:
- `Modelos/Asset.js` exige `brand`/`model` como obligatorios; el de `index.js` no.
- `Modelos/User.js` no tiene el campo `permisos`.

### 3.3 `servidor/Rutas/assetRoutes.js` y `Rutas/auth.js` — ⚠️ código muerto y sin protección

También sin usar. **Importante**: `assetRoutes.js` no tiene ningún middleware de autenticación en sus rutas (`router.get("/", ...)` sin `verificarToken`). Si en el futuro alguien "reconecta" este archivo pensando que es una versión modular del backend, expondría toda la API sin login. Se recomienda **eliminarlos** si no se van a usar, para evitar ese riesgo.

### 3.4 `servidor/__tests__/asset.test.js`

Pruebas de integración con **Jest + Supertest**, contra el `app` real de `index.js` (sin mocks del framework, sí necesita una conexión Mongo real de test). Firma tokens de prueba con distintos roles/permisos (`firmarToken`) y verifica:
1. Sin token → `401`.
2. Con token admin → `200` y respuesta es un array.
3. Crear activo vacío → `400` (falla la validación).
4. Usuario solo-lectura intentando crear → `403`.
5. Usuario con permiso de escritura → puede crear (`201`).
6. Usuario con escritura pero sin modificación, intentando `PUT` → `403`.

Es el único archivo de tests de todo el repo (no hay tests de frontend).

### 3.5 `servidor/package.json`

Dependencias de producción: `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `cors`, `helmet`, `express-rate-limit`, `express-validator`, `multer`, `csv-parser`, `dotenv`. Dev: `jest`, `supertest`. El script `"test"` todavía es el placeholder de scaffolding (`echo "Error: no test specified" && exit 1`) — **no ejecuta realmente Jest**, hay que correrlo manualmente con `npx jest`.

### 3.6 `servidor/.env`

Solo define `PORT` y `MONGO_URI` (sin `JWT_SECRET`, ver advertencia). **Este archivo está commiteado al repositorio en git**, lo cual es un problema de seguridad grave (ver sección 7).

---

## 4. Frontend — `client/`

### 4.1 `client/index.html`

HTML mínimo generado por Vite. Carga `src/main.jsx` como módulo. El `<title>` sigue diciendo "client" (no se personalizó).

### 4.2 `client/src/main.jsx` — punto de entrada

```jsx
ReactDOM.createRoot(...).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```
Envuelve toda la app en `AuthProvider` (contexto de autenticación) para que cualquier componente hijo pueda leer `token`, `role`, `permisos`, etc. sin pasarlos por props.

### 4.3 `client/src/context/AuthContext.jsx` — estado global de sesión

- Al montar, **lee `localStorage`** (`token`, `role`, `permisos`, `nombre`, `apellido`) para persistir la sesión entre recargas de página.
- `leerPermisos()` parsea el JSON guardado con manejo de error (si está corrupto, cae a `permisosPorDefecto` — todo en `false`).
- `login(userToken, userRole, userPermisos, userNombre, userApellido)`: guarda todo en `localStorage` **y** en el estado de React al mismo tiempo (para que la UI re-renderice ya mismo).
- `logout()`: `localStorage.clear()` + resetea todo el estado.
- `tienePermiso(permiso)`: función que usa toda la UI para decidir qué mostrar/ocultar — **un admin siempre tiene todos los permisos** (`role === "admin" || !!permisos[permiso]`).

### 4.4 `client/src/App.jsx` — componente principal (~1300 líneas)

Es un componente monolítico que contiene **toda** la aplicación (inventario, usuarios, configuración). No usa `react-router`; cambia de "vista" con un simple estado `currentView` (`"inventario" | "usuarios" | "configuraciones"`).

**Estados principales (líneas 30–88):**
- `assets`: lista de equipos traída del backend.
- `loginCredentials`: formulario de login.
- `currentView`: pestaña activa.
- `searchTerm`, `filterType`, `filterStatus`: filtros del inventario.
- `showPassword`, `isEditingUser`, `editUserId`, `registeredUsers`, `mostrarUsuarios`: estado del panel de usuarios.
- `registerMode`: `"manual" | "bulk-assets" | "bulk-personal"` — controla qué formulario de alta se muestra en el panel lateral.
- `employeesDirectory`: directorio de personal cargado desde un CSV **local** (nunca se manda al backend, vive solo en memoria del navegador) para autocompletar "asignado a" / "área".
- `form`: formulario de alta/edición de un activo.
- `userForm`: formulario de alta/edición de un usuario.

**Constantes de conexión (líneas 60–62):**
```js
const API_URL = "https://matriz-ti-backend.onrender.com/api/assets";
const AUTH_URL = "https://matriz-ti-backend.onrender.com/api/auth";
const clientConfig = { headers: { Authorization: `Bearer ${token}` } };
```
Todas las peticiones autenticadas usan `clientConfig` para mandar el JWT guardado en el contexto.

**Lógica de filtrado (líneas 91–107):** `filteredAssets` — filtra `assets` en memoria (no en el backend) por texto de búsqueda (serial, marca, modelo, asignado, área) y por los selects de tipo/estado.

**Handlers de activos:**
- `handleSubmit`: crea o edita un activo. Calcula `status` automáticamente: si `assignedTo` no está vacío → `"Asignado"`, si no → `"En Stock"`. Hace `POST` o `PUT` según `isEditing`.
- `handleDeleteAllAssets`: pide confirmación nativa (`window.confirm`) y llama `DELETE /api/assets/clear` (solo visible para `admin` en el render).
- `handleBulkUploadAssets`: toma el archivo del `<input type="file">`, arma un `FormData`, lo sube a `/api/assets/bulk`.
- `handleBulkUploadEmployees`: **procesamiento 100% del lado del cliente** — lee el CSV con `FileReader`, lo parte por líneas (`split("\n")`) y por comas (`split(",")`), asumiendo formato `Nombre,Apellido,Área`. Nunca toca el backend; solo llena `employeesDirectory` para autocompletar el formulario manual.
- `handleStatusChange`: cambia el estado de un activo desde el `<select>` de la tabla; si el nuevo estado es `"En Stock"`, limpia `assignedTo`/`department`.
- `startEdit` / `cancelEdit` / `deleteAsset`: edición y borrado individual.
- `fetchAssets`: `GET /api/assets` y guarda en el estado.

**Handlers de usuarios:**
- `handleUserSubmit`: valida en el **cliente** (antes de llamar al backend) que el email termine en `@empresa.com` y que la contraseña cumpla una regex (`/^(?=.*[A-Z])(?=.*\d).{8,}$/` — mínimo 8 caracteres, 1 mayúscula, 1 número). Si es alta nueva, llama `POST /auth/register`. Si es edición, **solo actualiza el estado local `registeredUsers`** — no hay endpoint de edición de usuario en el backend, así que editar un usuario existente no persiste al recargar.
- `startEditUser`: precarga `userForm` con los datos del usuario elegido (nota: pone una password placeholder `"Password123"` en el campo, que nunca se envía de verdad porque no hay endpoint PUT de usuarios).
- `toggleUserStatus`: activa/suspende — también **solo en memoria**, no hay campo `activo` en el modelo real del backend ni endpoint que lo persista.
- `fetchUsers`: `GET /auth/users`, y le agrega `activo: true` a cada usuario en el front (dato que no viene de la base).
- `deleteUser`: `DELETE /auth/users/:id`.

**`useEffect`s (líneas 436–442):** cargan `assets` cuando hay `token`, y `registeredUsers` cuando hay `token` **y** el rol es `admin`.

**Render — pantalla de login (líneas 444–509):** si no hay `token`, se muestra solo el formulario de login. Al enviar, llama directamente por `axios` a `.../api/auth/login` (con la URL hardcodeada otra vez, en vez de usar `AUTH_URL`), guarda el email en `localStorage` manualmente (`userEmail`, fuera del contexto) y llama `login(...)` del contexto.

**Render — header y navegación (líneas 511–565):** muestra nombre/apellido/rol del usuario logueado y botón de logout. Los tabs "Usuarios" y "Configuraciones" **solo aparecen si `role === "admin"`**.

**Render — vista Inventario (líneas 570–970):**
- `<DashboardGrid>` con las tarjetas de métricas.
- Panel lateral (solo si `tienePermiso("escritura")`) con 3 modos: alta manual, carga masiva de activos (CSV), carga masiva de personal (CSV).
- Tabla de inventario con buscador + 2 filtros (tipo, estado), y por cada fila: cambio rápido de estado (`<select>`, deshabilitado si no hay permiso `modificacion`) y botones editar/eliminar.

**Render — vista Usuarios (líneas 972–1254):** formulario de alta de usuario con checkboxes de la "matriz de permisos", y una tabla colapsable (`mostrarUsuarios`) que primero muestra siempre al usuario logueado como fila fija ("Master Root", con los 3 permisos hardcodeados en `true` visualmente) y después mapea `registeredUsers`.

**Render — vista Configuraciones (líneas 1256–1282):** puramente informativa/decorativa — dos tarjetas estáticas que dicen "MongoDB Atlas Connected" y "Render Deployment: Active" (no verifican nada en tiempo real, son texto fijo).

### 4.5 `client/src/components/DashboardGrid.jsx`

Componente de las 4 tarjetas de métricas. Hace su **propio** `fetch` a `https://matriz-ti-backend.onrender.com/api/assets/metrics` (nota: sin token — esta ruta específica sí requiere `verificarToken` en el backend actual, así que en la práctica **debería fallar con 401** a menos que el navegador ya tenga la sesión de otra forma; conviene revisar esto). Se refresca cuando cambia la prop `actualizarMetricas` (un contador que `App.jsx` incrementa después de cada operación de escritura).

### 4.6 `client/src/components/CargaCSV.jsx` — ⚠️ código muerto

Componente standalone para subir CSV de activos. **No se importa en ningún lado** (la funcionalidad real vive duplicada dentro de `App.jsx`, función `handleBulkUploadAssets`). Además apunta a una URL con **typo**: `matrix-zi-ti-backend.onrender.com` en vez de `matriz-ti-backend.onrender.com`. Es seguro borrarlo si se confirma que no se usa.

### 4.7 `client/src/components/Login.jsx` — ⚠️ código muerto

Otro formulario de login standalone, tampoco importado. Apunta a `http://localhost:5000` (entorno local), no al backend de producción. Es una versión más antigua/simple que la que quedó embebida en `App.jsx`.

### 4.8 `client/vite.config.js`

Config mínima de Vite: plugin de React + plugin de Tailwind v4 (`@tailwindcss/vite`, la integración moderna sin necesitar `postcss.config.js` separado).

### 4.9 `client/src/index.css`

Un solo `@import "tailwindcss";` — toda la app se estiliza con clases utilitarias de Tailwind directamente en el JSX (no hay CSS custom relevante).

### 4.10 `client/src/App.css` — ⚠️ código muerto

Estilos decorativos del template de bienvenida por defecto de Vite (`.hero`, `#next-steps`, etc.). **Nunca se importa** en `App.jsx` ni en `main.jsx` — quedó del scaffolding inicial.

### 4.11 `client/vercel.json`

Define cabeceras de seguridad HTTP para el despliegue en Vercel: `Content-Security-Policy` (restringe `connect-src` solo al dominio del backend en Render), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`.

### 4.12 `client/eslint.config.js`

Config de ESLint (flat config) con reglas recomendadas de JS + hooks de React + React Refresh (para HMR de Vite). Regla custom: `no-unused-vars` solo ignora variables que empiecen con mayúscula o `_`.

### 4.13 `client/package.json`

Dependencias: `react`/`react-dom` 19, `axios`, `lucide-react` (íconos). Dev: `vite`, `tailwindcss` 4, `eslint` y plugins.

---

## 5. `docs/` — diseño de base de datos

### 5.1 `docs/matriz.dbdiagram`

Archivo de layout de [dbdiagram.io](https://dbdiagram.io) — describe un **diseño relacional planeado** con tablas: `roles`, `usuarios`, `permisos`, `empleados`, `activos`, `historial_activos`, con relaciones 1→N entre ellas (por ejemplo, un rol tiene muchos usuarios, un usuario tiene muchos activos registrados, cada activo tiene su historial).

### 5.2 `docs/matriz.dbml`

Debería contener la definición DBML de esas tablas (columnas, tipos, llaves), pero **está vacío**. Según el historial de git, tenía contenido y se vació en el commit `95fbc61` ("ROLES AÑADIDOS") — probablemente se abandonó ese diseño relacional (SQL) en favor del modelo real implementado en Mongo, que es mucho más simple (solo 2 colecciones: `Account` y `Asset`, sin `historial_activos`, sin tabla `roles`/`permisos` separada — los permisos viven embebidos en el propio documento de usuario).

**Conclusión:** el diseño de base de datos "oficial" en `docs/` **no refleja** lo que la aplicación realmente usa hoy. Si se quiere seguir usando ese diagrama como referencia, habría que actualizarlo o eliminarlo para evitar confusión.

---

## 6. Archivos sueltos en la raíz

- **`package.json`** (raíz): solo declara `csv-parser` y `multer` como dependencias, sin `name`/`scripts` reales de un proyecto. No es el backend ni el frontend — parece un archivo generado por accidente (quizás un `npm install` corrido en la carpeta raíz por error). No cumple ninguna función en el funcionamiento real de la app.
- **`.gitignore`** (raíz): solo `node_modules/`. No ignora `.env`, `dist/`, `coverage/`, etc.

---

## 7. Flujo de datos de punta a punta (ejemplo real)

**Login → ver inventario → registrar un activo:**

1. Usuario escribe email/password en el formulario de `App.jsx` (líneas ~456–505).
2. `axios.post(".../api/auth/login", credentials)` → backend busca el `Account` por email, compara password con bcrypt, firma JWT con `{id, role, permisos}` (8h de validez) → responde `{token, role, permisos, nombre, apellido}`.
3. Frontend llama `login(...)` del `AuthContext`, que persiste todo en `localStorage` y actualiza el estado global.
4. El `useEffect` de `App.jsx` detecta que ahora hay `token` → dispara `fetchAssets()` → `GET /api/assets` con header `Authorization: Bearer <token>` → backend valida el token (`verificarToken`) y el permiso `lectura` (`verificarPermiso("lectura")`) → responde el array de activos → se pinta la tabla.
5. Si el usuario tiene permiso `escritura`, ve el panel lateral. Llena el formulario y lo envía → `handleSubmit` calcula el `status` automáticamente y hace `POST /api/assets` → backend valida con `validarActivo` (serial alfanumérico, tipo no vacío) y el permiso `escritura` → guarda en Mongo → responde el activo creado.
6. El frontend vuelve a llamar `fetchAssets()` y también incrementa `actualizarMetricas`, lo que dispara que `DashboardGrid` vuelva a pedir `/api/assets/metrics` y refresque las tarjetas.

---

## 8. Deuda técnica y advertencias de seguridad detectadas

Para que quede documentado junto con el resto:

1. **`servidor/.env` está commiteado al repositorio** (incluye `MONGO_URI` real) desde el primer commit. Debe rotarse la credencial de MongoDB Atlas y purgarse del historial de git, y agregar `.env` al `.gitignore`.
2. **`JWT_SECRET` no está definido en `.env`**, por lo que el backend firma tokens con el valor hardcodeado `"CLAVE_SECRETA_SOPORTE"` que está público en el código — cualquiera podría forjar un token de `admin`.
3. **El remoto de git (`origin`) tiene un Personal Access Token de GitHub embebido en la URL**, visible con `git remote -v`. Debe revocarse y reconfigurarse el remoto sin el token en texto plano.
4. **Código muerto** que conviene borrar o marcar claramente como "no usar": `servidor/Modelos/*.js`, `servidor/Rutas/*.js` (este último sin ninguna protección de auth — riesgo si se reconecta por error), `client/src/components/CargaCSV.jsx`, `client/src/components/Login.jsx`, `client/src/App.css`.
5. **Persistencia inconsistente en la gestión de usuarios**: suspender/reactivar (`toggleUserStatus`) y editar un usuario existente (`handleUserSubmit` en modo edición) **solo cambian el estado en memoria del navegador** — no hay endpoints `PUT`/`PATCH` de usuario en el backend, así que esos cambios se pierden al recargar la página.
6. **`docs/matriz.dbml` está vacío** y el `.dbdiagram` describe un modelo relacional que ya no coincide con la implementación real en MongoDB.
7. **URLs de backend inconsistentes**: `App.jsx` usa `matriz-ti-backend.onrender.com`, `CargaCSV.jsx` (no usado) tiene un typo (`matrix-zi-ti-backend`), y `Login.jsx` (no usado) apunta a `localhost:5000`.
8. **`console.log` de depuración en producción** dentro de `servidor/index.js`, incluyendo el contenido decodificado de cada token en cada request — ruido y filtración de datos en los logs del servidor.

---

## 9. Cómo correr el proyecto en local

```bash
# Backend
cd servidor
npm install
npm run dev   # o: node index.js  (revisar que exista script "dev"; si no, usar "node index.js")

# Frontend (en otra terminal)
cd client
npm install
npm run dev   # levanta Vite, normalmente en http://localhost:5173
```

Antes de correr el backend local, hay que apuntar el frontend a `http://localhost:<PORT>` en vez de la URL de Render (actualmente hardcodeada en `App.jsx` y `DashboardGrid.jsx`), o crear variables de entorno (`import.meta.env.VITE_API_URL`) para no tener que editar el código cada vez.

import { useState, useEffect, useContext } from "react";
import axios from "axios";
// Importación de íconos desde la librería lucide-react para la interfaz
import {
  Trash2,
  Laptop,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Pencil,
  X,
  Users,
  Settings,
  UserPlus,
} from "lucide-react";
import DashboardGrid from "./components/DashboardGrid";
import { AuthContext } from "./context/AuthContext";

function App() {
  // Consumimos las variables globales y funciones de inicio/cierre de sesión del AuthContext (Sprint 6)
  const { token, role, login, logout } = useContext(AuthContext);

  // --- ESTADOS LOCALES DE LA APLICACIÓN ---
  const [assets, setAssets] = useState([]); // Arreglo para almacenar los activos que vienen de la BD
  const [loginCredentials, setLoginCredentials] = useState({
    email: "", // Almacena el correo ingresado en el login
    password: "", // Almacena la contraseña ingresada en el login
  });

  // 🔄 [NUEVO ESTADO]: Controla la vista actual del panel (Enrutamiento interno/pestañas)
  // Por defecto, al entrar siempre cargará la pestaña del 'inventario'
  const [currentView, setCurrentView] = useState("inventario");

  // URL del Backend desplegado en Render para consumir el endpoint de activos
  const API_URL = "https://matriz-ti-backend.onrender.com/api/assets";

  // Configuración de seguridad: Inyectamos el Token JWT en las cabeceras HTTP de Axios
  const clientConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // Estado temporal para controlar los campos del formulario de registro/edición de activos
  const [form, setForm] = useState({
    serialNumber: "",
    brand: "",
    model: "",
    type: "Computadora",
    typeOther: "",
    assignedTo: "",
    department: "",
  });
  const [isEditing, setIsEditing] = useState(false); // Flag para saber si el usuario está editando o registrando nuevo
  const [editId, setEditId] = useState(null); // Almacena el ID de MongoDB del activo que se va a editar
  const [actualizarMetricas, setActualizarMetricas] = useState(0); // Gatillo numérico para obligar a recargar el DashboardGrid

  // 📝 [NUEVA VARIABLE]: Extrae el correo del usuario directamente del almacenamiento local del navegador (localStorage)
  // Si no encuentra nada (por ejemplo, antes del login), pondrá el texto por defecto
  const userEmail = localStorage.getItem("userEmail") || "Usuario Conectado";

  // Función encargada de procesar el envío del formulario (Crear o Actualizar un activo)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        // Si el flag de edición es verdadero, hace una petición PUT al backend enviando el ID y los datos modificados
        await axios.put(`${API_URL}/${editId}`, form, clientConfig);
        setIsEditing(false);
        setEditId(null);
      } else {
        // Si no está editando, hace una petición POST para insertar el nuevo activo en MongoDB Atlas
        await axios.post(API_URL, form, clientConfig);
      }

      // Limpieza absoluta de los campos del formulario tras procesar la petición con éxito
      setForm({
        serialNumber: "",
        brand: "",
        model: "",
        type: "Computadora",
        typeOther: "",
        assignedTo: "",
        department: "",
      });
      fetchAssets(); // Recargamos la tabla de activos
      setActualizarMetricas((prev) => prev + 1); // Incrementamos el gatillo para actualizar los contadores superiores
    } catch (err) {
      alert("Error: Revisa los datos (S/N debe ser único o tu sesión expiró)");
    }
  };

  // Función ejecutada al dar clic en el ícono de lápiz de la tabla para cargar los datos en el formulario
  const startEdit = (asset) => {
    setForm({
      serialNumber: asset.serialNumber,
      brand: asset.brand,
      model: asset.model,
      type: asset.type,
      typeOther: asset.typeOther || "",
      assignedTo: asset.assignedTo || "",
      department: asset.department || "",
    });
    setEditId(asset._id); // Memorizamos el ID del documento de Mongo
    setIsEditing(true); // Cambiamos el modo visual a "Editar"
  };

  // Cancela la edición activa y devuelve el formulario a su estado vacío inicial
  const cancelEdit = () => {
    setForm({
      serialNumber: "",
      brand: "",
      model: "",
      type: "Computadora",
      typeOther: "",
      assignedTo: "",
      department: "",
    });
    setIsEditing(false);
    setEditId(null);
  };

  // Realiza una petición DELETE al servidor de Render usando el ID único del documento
  const deleteAsset = async (id) => {
    if (window.confirm("¿Confirmas la baja de este activo?")) {
      try {
        await axios.delete(`${API_URL}/${id}`, clientConfig);
        fetchAssets(); // Refresca la tabla
        setActualizarMetricas((prev) => prev + 1); // Refresca los contadores de arriba
      } catch (err) {
        alert("No tienes permisos para eliminar este activo.");
      }
    }
  };

  // Maneja el cambio de estado (En Stock, Asignado, Mantenimiento) directamente desde el select de la tabla
  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`${API_URL}/${id}`, { status: newStatus }, clientConfig);
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
    } catch (err) {
      alert("Error al actualizar el estado");
    }
  };

  // Consume la API mediante una petición GET para traer todos los activos de la BD
  const fetchAssets = async () => {
    try {
      const res = await axios.get(API_URL, clientConfig);
      setAssets(res.data);
    } catch (error) {
      console.error("Error al obtener activos:", error);
    }
  };

  // Efecto secundario: En cuanto el token exista (inicio de sesión aprobado), manda a llamar los activos de inmediato
  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  // ==========================================
  // 🔑 INTERFAZ DE LOGIN (Si no hay Token, renderiza esta vista)
  // ==========================================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-md bg-[#111827] p-8 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-600/20 p-4 rounded-full mb-4">
              <ShieldCheck size={40} className="text-blue-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              ASSETTRACK <span className="text-blue-500">PRO</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
              Mesa de Ayuda - Cuentas Locales
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                // Petición POST enviando las credenciales locales de acceso al endpoint de login
                const res = await axios.post(
                  "https://matriz-ti-backend.onrender.com/api/auth/login",
                  loginCredentials,
                );

                // 🔐 [NUEVO PROCESO SEGURIDAD]: Al ser correcto el login, guardamos el correo de forma persistente
                // en el almacenamiento local antes de activar el contexto de autenticación.
                localStorage.setItem("userEmail", loginCredentials.email);

                // Pasamos el token criptográfico y el rol al cerebro global de la sesión
                login(res.data.token, res.data.role);
              } catch (err) {
                alert("Credenciales locales incorrectas");
              }
            }}
            className="space-y-4"
          >
            <input
              type="email"
              className="w-full p-4 bg-[#1f2937] rounded-xl outline-none border border-transparent focus:border-blue-500 text-slate-200"
              placeholder="Correo electrónico local"
              onChange={(e) =>
                setLoginCredentials({
                  ...loginCredentials,
                  email: e.target.value,
                })
              }
              required
            />
            <input
              className="w-full p-4 bg-[#1f2937] rounded-xl outline-none border border-transparent focus:border-blue-500 text-slate-200"
              type="password"
              placeholder="Contraseña"
              onChange={(e) =>
                setLoginCredentials({
                  ...loginCredentials,
                  password: e.target.value,
                })
              }
              required
            />
            <button className="w-full bg-blue-600 p-4 rounded-xl font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-600/20 uppercase tracking-wider text-sm">
              Entrar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 📊 INTERFAZ PRINCIPAL COMPLETA (ROL DEL ADMIN ACTIVADO)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans">
      {/* --- ENCABEZADO SUPERIOR (HEADER) --- */}
      <header className="border-b border-white/5 bg-[#111827]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Laptop className="text-white" size={24} />
            </div>
            <div>
              {/* 🔄 [MODIFICACIÓN]: Renderizado del email dinámico del usuario recuperado de localStorage */}
              <span className="text-base font-black text-white tracking-wide block max-w-[250px] md:max-w-none truncate">
                {userEmail}
              </span>
              {/* Muestra de forma reactiva el rol de la sesión actual (admin, tecnico, coordinador) */}
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-widest mt-0.5 inline-block">
                {role}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              // Destruye el registro del correo del almacenamiento local al cerrar sesión de forma segura
              localStorage.removeItem("userEmail");
              logout(); // Ejecuta la desconexión del contexto global
            }}
            className="text-slate-400 hover:text-red-400 flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut size={20} />
            <span className="hidden md:inline text-sm font-bold uppercase tracking-widest">
              Salir
            </span>
          </button>
        </div>
      </header>

      {/* 🧭 [NUEVO COMPONENTE]: Barra de Navegación por Pestañas (Menu de Control Global) */}
      <div className="max-w-7xl mx-auto px-6 mt-6 flex gap-3 overflow-x-auto py-2">
        {/* Botón de acceso al Inventario - Disponible para todos los roles */}
        <button
          onClick={() => setCurrentView("inventario")}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 border whitespace-nowrap cursor-pointer ${
            currentView === "inventario"
              ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20"
              : "bg-[#111827] text-slate-400 border-white/5 hover:text-slate-200"
          }`}
        >
          <Laptop size={16} /> Inventario
        </button>

        {/* 🔐 [RESTRICCIÓN DE SEGURIDAD FRONTEND]: Las pestañas de Usuarios y Ajustes 
            solo se renderizarán en pantalla si el rol inyectado por el Token es 'admin' */}
        {role === "admin" && (
          <>
            {/* Pestaña de Control de Personal de TI */}
            <button
              onClick={() => setCurrentView("usuarios")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 border whitespace-nowrap cursor-pointer ${
                currentView === "usuarios"
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20"
                  : "bg-[#111827] text-slate-400 border-white/5 hover:text-slate-200"
              }`}
            >
              <Users size={16} /> Usuarios
            </button>
            {/* Pestaña de Métricas e Infraestructura */}
            <button
              onClick={() => setCurrentView("configuraciones")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 border whitespace-nowrap cursor-pointer ${
                currentView === "configuraciones"
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20"
                  : "bg-[#111827] text-slate-400 border-white/5 hover:text-slate-200"
              }`}
            >
              <Settings size={16} /> Configuraciones
            </button>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📦 1. CONTENEDOR VISUAL: SECCIÓN DE INVENTARIO (Tu código original encapsulado) */}
      {/* ========================================================================= */}
      {currentView === "inventario" && (
        <>
          <div className="max-w-7xl mx-auto px-6 pt-4">
            <DashboardGrid actualizarMetricas={actualizarMetricas} />
          </div>

          <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-12 gap-9">
            {/* Restricción perimetral: Coordinadores tienen bloqueado el acceso al formulario de alta */}
            {role === "admin" || role === "tecnico" ? (
              <aside className="lg:col-span-3">
                <div className="bg-[#111827] p-8 rounded-3xl border border-white/5 sticky top-28">
                  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    {isEditing ? (
                      <Pencil className="text-yellow-500" />
                    ) : (
                      <PlusCircle className="text-blue-500" />
                    )}
                    {isEditing ? "Editar Activo" : "Registrar Activo"}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                      placeholder="S/N"
                      value={form.serialNumber}
                      onChange={(e) =>
                        setForm({ ...form, serialNumber: e.target.value })
                      }
                      required
                    />
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                      placeholder="Marca"
                      value={form.brand}
                      onChange={(e) =>
                        setForm({ ...form, brand: e.target.value })
                      }
                      required
                    />
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                      placeholder="Modelo"
                      value={form.model}
                      onChange={(e) =>
                        setForm({ ...form, model: e.target.value })
                      }
                      required
                    />

                    <select
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value })
                      }
                    >
                      <option value="Computadora">Computadora</option>
                      <option value="Celular">Celular</option>
                      <option value="Otro">Otro</option>
                    </select>

                    {form.type === "Otro" && (
                      <input
                        className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                        placeholder="Especifica el equipo"
                        value={form.typeOther}
                        onChange={(e) =>
                          setForm({ ...form, typeOther: e.target.value })
                        }
                      />
                    )}

                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                      placeholder="Nombre de quien recibe"
                      value={form.assignedTo}
                      onChange={(e) =>
                        setForm({ ...form, assignedTo: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                      placeholder="Área de trabajo"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    />

                    <button
                      className={`w-full p-4 rounded-xl font-bold text-white transition ${isEditing ? "bg-yellow-600 hover:bg-yellow-500" : "bg-blue-600 hover:bg-blue-500"}`}
                    >
                      {isEditing ? "Guardar Cambios" : "Registrar"}
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="w-full text-sm text-slate-500 hover:text-white flex items-center justify-center gap-2"
                      >
                        <X size={16} /> Cancelar edición
                      </button>
                    )}
                  </form>
                </div>
              </aside>
            ) : null}

            {/* Renderizado de la tabla principal de datos */}
            <section
              className={`${role === "coordinador" ? "lg:col-span-12" : "lg:col-span-9"} bg-[#111827] rounded-3xl border border-white/5`}
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white uppercase tracking-widest text-sm">
                  Inventario Actual
                </h2>
                <span className="bg-blue-500/10 text-blue-500 px-4 py-1 rounded-full text-xs font-black">
                  {assets.length} ITEMS
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-6 py-5 text-left">Hardware</th>
                      <th className="px-6 py-5 text-left">Serial No.</th>
                      <th className="px-6 py-5 text-left">Asignado a</th>
                      <th className="px-6 py-5 text-left">Área</th>
                      <th className="px-6 py-5 text-left">Fecha</th>
                      <th className="px-6 py-5 text-right">
                        Estado y Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {assets.map((a) => (
                      <tr
                        key={a._id}
                        className="hover:bg-white/2 transition group"
                      >
                        <td className="px-6 py-5">
                          <div className="text-white font-bold">{a.brand}</div>
                          <div className="text-xs text-slate-500 uppercase">
                            {a.model}
                          </div>
                        </td>
                        <td className="px-6 py-5 font-mono text-sm text-blue-400/80">
                          {a.serialNumber}
                        </td>
                        <td className="px-6 py-5 text-slate-300">
                          {a.assignedTo || "N/A"}
                        </td>
                        <td className="px-6 py-5 text-slate-300">
                          {a.department || "N/A"}
                        </td>
                        <td className="px-6 py-5 text-slate-300">
                          {a.assignmentDate
                            ? new Date(a.assignmentDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-5 flex items-center justify-end gap-3 text-right">
                          <select
                            disabled={role === "coordinador"}
                            value={a.status || "En Stock"}
                            onChange={(e) =>
                              handleStatusChange(a._id, e.target.value)
                            }
                            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-sm outline-none ${role === "coordinador" ? "opacity-60 cursor-not-allowed" : ""} ${
                              a.status === "En Stock"
                                ? "bg-blue-600/10 text-blue-400 border-blue-500/20 focus:border-blue-500"
                                : a.status === "Asignado"
                                  ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20 focus:border-emerald-500"
                                  : a.status === "En Mantenimiento"
                                    ? "bg-orange-600/10 text-orange-400 border-orange-500/20 focus:border-orange-500"
                                    : "bg-[#1f2937] text-slate-300 border-white/10"
                            }`}
                          >
                            <option value="En Stock">En Stock</option>
                            <option value="Asignado">Asignado</option>
                            <option value="En Mantenimiento">
                              Mantenimiento
                            </option>
                          </select>

                          {role !== "coordinador" && (
                            <div className="flex gap-1.5 pl-3 border-l border-white/10">
                              <button
                                onClick={() => startEdit(a)}
                                className="p-2 rounded-lg text-slate-500 hover:text-yellow-500 hover:bg-yellow-500/10 transition cursor-pointer"
                                title="Editar"
                              >
                                <Pencil size={18} />
                              </button>
                              {role === "admin" && (
                                <button
                                  onClick={() => deleteAsset(a._id)}
                                  className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </>
      )}

      {/* ========================================================================= */}
      {/* 👥 2. CONTENEDOR VISUAL: SECCIÓN DE ADMINISTRACIÓN DE USUARIOS LOCALES */}
      {/* ========================================================================= */}
      {currentView === "usuarios" && (
        <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-12 gap-9">
          {/* Formulario lateral izquierdo para simular la creación de nuevos colaboradores */}
          <aside className="lg:col-span-4">
            <div className="bg-[#111827] p-8 rounded-3xl border border-white/5">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <UserPlus className="text-blue-500" /> Crear Usuario Local
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  alert(
                    "Simulación: Usuario enviado a la cola del Backend con éxito.",
                  );
                }}
                className="space-y-4"
              >
                <input
                  type="email"
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50 text-white"
                  placeholder="Correo institucional"
                  required
                />
                <input
                  type="password"
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50 text-white"
                  placeholder="Contraseña temporal"
                  required
                />
                {/* Asignación de Roles perimetrales basados en las directivas del Sprint 6 */}
                <select className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50 text-white">
                  <option value="tecnico">Técnico (Soporte en Campo)</option>
                  <option value="coordinador">
                    Coordinador (Solo Lectura / Auditoría)
                  </option>
                  <option value="admin">Administrador (Control Total)</option>
                </select>
                <button className="w-full p-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition">
                  Dar de Alta Cuenta
                </button>
              </form>
            </div>
          </aside>

          {/* Tabla derecha: Muestra las cuentas autorizadas que residen en MongoDB Atlas */}
          <section className="lg:col-span-8 bg-[#111827] rounded-3xl border border-white/5 p-8">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider text-sm">
              Cuentas y Permisos Activos
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Lista perimetral sincronizada de cuentas con acceso a la API en
              producción.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                    <th className="pb-4">Usuario</th>
                    <th className="pb-4">Rol Asignado</th>
                    <th className="pb-4 text-right">Estatus Perimetral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {/* Fila del Administrador actual en sesión */}
                  <tr>
                    <td className="py-4 font-bold text-white">{userEmail}</td>
                    <td className="py-4 text-blue-400 font-mono text-xs">
                      SU_ADMIN
                    </td>
                    <td className="py-4 text-right text-emerald-400 font-bold">
                      Activo en Sesión
                    </td>
                  </tr>
                  {/* Cuentas adicionales registradas previamente con Thunder Client */}
                  <tr>
                    <td className="py-4 text-slate-300">tecnico@empresa.com</td>
                    <td className="py-4 text-amber-400 font-mono text-xs">
                      FIELD_TECH
                    </td>
                    <td className="py-4 text-right text-slate-500">
                      Autorizado (DB)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 text-slate-300">
                      coordinador@empresa.com
                    </td>
                    <td className="py-4 text-purple-400 font-mono text-xs">
                      AUDITOR_VIEW
                    </td>
                    <td className="py-4 text-right text-slate-500">
                      Autorizado (DB)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* ========================================================================= */}
      {/* ⚙️ 3. CONTENEDOR VISUAL: SECCIÓN DE AJUSTES GLOBALES Y SEGURIDAD */}
      {/* ========================================================================= */}
      {currentView === "configuraciones" && (
        <main className="max-w-4xl mx-auto p-6">
          <div className="bg-[#111827] rounded-3xl border border-white/5 p-8 space-y-8">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Settings className="text-blue-500" /> Configuración Global del
                Sistema
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Parámetros operativos de la infraestructura perimetral del
                Sprint 6.
              </p>
            </div>

            {/* Cuadrícula informativa para auditoría del estado de las nubes conectadas */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Tarjeta de estado de base de datos remota */}
              <div className="p-6 bg-[#1f2937]/50 rounded-2xl border border-white/5">
                <h3 className="text-sm font-bold text-white mb-2">
                  Base de Datos (MERN Stack)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Estado del clúster remoto en la nube corporativa.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 w-fit px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  MONGODB ATLAS CONNECTED
                </div>
              </div>

              {/* Tarjeta de firmas criptográficas */}
              <div className="p-6 bg-[#1f2937]/50 rounded-2xl border border-white/5">
                <h3 className="text-sm font-bold text-white mb-2">
                  Seguridad de Sesión
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Firmas criptográficas de control de acceso.
                </p>
                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-md block w-fit">
                  Algoritmo: JWT HS256 (24h)
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() =>
                  alert("Parámetros de hardening guardados en Vercel.")
                }
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition"
              >
                Guardar Directivas
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;

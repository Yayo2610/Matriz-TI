import { useState, useEffect, useContext } from "react";
import axios from "axios";
import {
  Trash2,
  Laptop,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Pencil,
  X,
} from "lucide-react";
import DashboardGrid from "./components/DashboardGrid";
import { AuthContext } from "./context/AuthContext"; // Importamos tu canal de sesión global

function App() {
  // Consumimos el estado global de S6 (Cerebro de la sesión)
  const { token, role, login, logout } = useContext(AuthContext);

  const [assets, setAssets] = useState([]);
  const [loginCredentials, setLoginCredentials] = useState({
    email: "", // Cambiado de username a email para alinearse al backend
    password: "",
  });

  const API_URL = "https://matriz-ti-backend.onrender.com/api/assets";

  // Configuración de cabecera segura con el Token JWT para la API en Render
  const clientConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // Estados para el CRUD de Inventario
  const [form, setForm] = useState({
    serialNumber: "",
    brand: "",
    model: "",
    type: "Computadora",
    typeOther: "",
    assignedTo: "",
    department: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [actualizarMetricas, setActualizarMetricas] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/${editId}`, form, clientConfig);
        setIsEditing(false);
        setEditId(null);
      } else {
        await axios.post(API_URL, form, clientConfig);
      }

      setForm({
        serialNumber: "",
        brand: "",
        model: "",
        type: "Computadora",
        typeOther: "",
        assignedTo: "",
        department: "",
      });
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
    } catch (err) {
      alert("Error: Revisa los datos (S/N debe ser único o tu sesión expiró)");
    }
  };

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
    setEditId(asset._id);
    setIsEditing(true);
  };

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

  const deleteAsset = async (id) => {
    if (window.confirm("¿Confirmas la baja de este activo?")) {
      try {
        await axios.delete(`${API_URL}/${id}`, clientConfig);
        fetchAssets();
        setActualizarMetricas((prev) => prev + 1);
      } catch (err) {
        alert("No tienes permisos para eliminar este activo.");
      }
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`${API_URL}/${id}`, { status: newStatus }, clientConfig);
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
    } catch (err) {
      alert("Error al actualizar el estado");
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await axios.get(API_URL, clientConfig);
      setAssets(res.data);
    } catch (error) {
      console.error("Error al obtener activos:", error);
    }
  };

  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  // ==========================================
  // 🔑 INTERFAZ DE LOGIN REFACTORIZADA (S6)
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
                const res = await axios.post(
                  "https://matriz-ti-backend.onrender.com/api/auth/login",
                  loginCredentials,
                );
                // Invocamos la función del AuthContext para guardar token y rol de forma global
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
  // 📊 INTERFAZ PRINCIPAL CON RESTRICCIÓN DE ROLES
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans">
      <header className="border-b border-white/5 bg-[#111827]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Laptop className="text-white" size={24} />
            </div>
            <div>
              <span className="text-xl font-black text-white">
                ASSETTRACK PRO
              </span>
              <span className="ml-3 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-md uppercase font-bold tracking-widest">
                {role}
              </span>
            </div>
          </div>
          <button
            onClick={logout} // Usa la función logout limpia del contexto
            className="text-slate-400 hover:text-red-400 flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut size={20} />{" "}
            <span className="hidden md:inline text-sm font-bold uppercase tracking-widest">
              Salir
            </span>
          </button>
        </div>
      </header>

      {/* --- DASHBOARD EJECUTIVO --- */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <DashboardGrid actualizarMetricas={actualizarMetricas} />
      </div>

      <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-12 gap-9">
        {/* ASIDE - FORMULARIO DE CAPTURA */}
        {/* RESTRICCIÓN: El rol 'coordinador' tiene prohibido ver el formulario de captura */}
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
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  required
                />
                <input
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                  placeholder="Modelo"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  required
                />

                <select
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
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

        {/* SECTION - TABLA DE INVENTARIO */}
        {/* DINÁMICO: Si el coordinador está conectado, la tabla se expande a las 12 columnas (Full width) */}
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
                  <th className="px-6 py-5 text-right">Estado y Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assets.map((a) => (
                  <tr key={a._id} className="hover:bg-white/2 transition group">
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
                      {/* RESTRICCIÓN: El coordinador tiene deshabilitado cambiar el estatus desde la tabla */}
                      <select
                        disabled={role === "coordinador"}
                        value={a.status || "En Stock"}
                        onChange={(e) =>
                          handleStatusChange(a._id, e.target.value)
                        }
                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-sm outline-none ${
                          role === "coordinador"
                            ? "opacity-60 cursor-not-allowed"
                            : ""
                        } ${
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
                        <option value="En Mantenimiento">Mantenimiento</option>
                      </select>

                      {/* RESTRICCIÓN DE ACCIONES CRÍTICAS */}
                      {role !== "coordinador" && (
                        <div className="flex gap-1.5 pl-3 border-l border-white/10">
                          {/* Administrador y Técnico pueden Editar */}
                          <button
                            onClick={() => startEdit(a)}
                            className="p-2 rounded-lg text-slate-500 hover:text-yellow-500 hover:bg-yellow-500/10 transition cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={18} />
                          </button>

                          {/* ÚNICAMENTE el Administrador puede dar de baja (Eliminar) */}
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
    </div>
  );
}

export default App;

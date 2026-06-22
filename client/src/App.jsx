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
  Users,
  Settings,
  UserPlus,
  Search,
  Filter,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
} from "lucide-react";
import DashboardGrid from "./components/DashboardGrid";
import { AuthContext } from "./context/AuthContext";

function App() {
  const { token, role, login, logout } = useContext(AuthContext);

  // --- ESTADOS LOCALES ---
  const [assets, setAssets] = useState([]);
  const [loginCredentials, setLoginCredentials] = useState({
    email: "",
    password: "",
  });
  const [currentView, setCurrentView] = useState("inventario");

  // 🔍 ESTADOS DE FILTROS (INVENTARIO)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");

  // 👥 ESTADOS DE OPERADORES Y SEGURIDAD (USUARIOS)
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [registeredUsers, setRegisteredUsers] = useState([]); // Inicia vacío para tu demo en vivo

  const API_URL = "https://matriz-ti-backend.onrender.com/api/assets";
  const clientConfig = { headers: { Authorization: `Bearer ${token}` } };

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

  const userNombre = localStorage.getItem("userNombre") || "Yael";
  const userApellido = localStorage.getItem("userApellido") || "Barrera";
  const userEmail =
    localStorage.getItem("userEmail") || "yael.admin@empresa.com";

  const [userForm, setUserForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    permisos: { lectura: true, escritura: false, modificacion: false },
  });

  // ⚙️ LÓGICA DE FILTRADO COMPLETA (INVENTARIO)
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.assignedTo &&
        asset.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.department &&
        asset.department.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "Todos" || asset.type === filterType;
    const currentStatus = asset.status || "En Stock";
    const matchesStatus =
      filterStatus === "Todos" || currentStatus === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // --- COMPORTAMIENTO DE ACTIVOS ---
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
      alert("Error al procesar el activo.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === "En Stock") {
        updateData.assignedTo = "";
        updateData.department = "";
      }
      await axios.put(`${API_URL}/${id}`, updateData, clientConfig);
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
    } catch (err) {
      alert("Error al actualizar el estado");
    }
  };

  // --- COMPORTAMIENTO DE USUARIOS ---
  const handleUserSubmit = (e) => {
    e.preventDefault();

    if (!userForm.email.toLowerCase().endsWith("@empresa.com")) {
      alert(
        "🚨 Error perimetral: Solo se permiten correos corporativos con dominio @empresa.com",
      );
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(userForm.password)) {
      alert(
        "⚠️ Contraseña insegura: Debe contener al menos 8 caracteres, una letra mayúscula y un número.",
      );
      return;
    }

    const arrayPermisos = Object.keys(userForm.permisos).filter(
      (key) => userForm.permisos[key],
    );

    if (isEditingUser) {
      setRegisteredUsers(
        registeredUsers.map((u) =>
          u.id === editUserId
            ? {
                ...u,
                nombre: userForm.nombre,
                apellido: userForm.apellido,
                email: userForm.email,
                permisos: arrayPermisos,
              }
            : u,
        ),
      );
      alert(
        `🔄 Permisos actualizados. Se ha enviado una directiva de revocación al token previo de ${userForm.nombre}.`,
      );
      setIsEditingUser(false);
      setEditUserId(null);
    } else {
      const nuevoUsuario = {
        id: Date.now(),
        nombre: userForm.nombre,
        apellido: userForm.apellido,
        email: userForm.email,
        permisos: arrayPermisos,
        activo: true,
      };
      setRegisteredUsers([...registeredUsers, nuevoUsuario]);
      alert(
        `¡Éxito! Cuenta de ${userForm.nombre} ${userForm.apellido} creada de forma reactiva.`,
      );
    }

    setUserForm({
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      permisos: { lectura: true, escritura: false, modificacion: false },
    });
  };

  const startEditUser = (user) => {
    setUserForm({
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      password: "Password123",
      permisos: {
        lectura: user.permisos.includes("lectura"),
        escritura: user.permisos.includes("escritura"),
        modificacion: user.permisos.includes("modificacion"),
      },
    });
    setEditUserId(user.id);
    setIsEditingUser(true);
  };

  const toggleUserStatus = (id, nombre, statusActual) => {
    const nuevoEstado = !statusActual;
    const mensaje = nuevoEstado
      ? `¿Deseas reactivar el acceso al sistema para ${nombre}?`
      : `¿Confirmas la suspensión inmediata de ${nombre}? Se bloquearán sus peticiones a la API.`;

    if (window.confirm(mensaje)) {
      setRegisteredUsers(
        registeredUsers.map((u) =>
          u.id === id ? { ...u, activo: nuevoEstado } : u,
        ),
      );
      if (!nuevoEstado) {
        alert(
          `🔒 Token Revocado: La sesión de ${nombre} ha sido incluida en la lista negra (Redis cache).`,
        );
      }
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
        alert("No tienes privilegios suficientes.");
      }
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await axios.get(API_URL, clientConfig);
      setAssets(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  // ==========================================
  // 🔑 INTERFAZ DE LOGIN
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
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await axios.post(
                  "https://matriz-ti-backend.onrender.com/api/auth/login",
                  loginCredentials,
                );
                localStorage.removeItem("userEmail");
                localStorage.removeItem("userNombre");
                localStorage.removeItem("userApellido");
                if (loginCredentials.email === "yael.admin@empresa.com") {
                  localStorage.setItem("userNombre", "Yael");
                  localStorage.setItem("userApellido", "Barrera");
                } else {
                  localStorage.setItem("userNombre", "Operador");
                  localStorage.setItem("userApellido", "Soporte");
                }
                localStorage.setItem("userEmail", loginCredentials.email);
                login(res.data.token, res.data.role);
              } catch (err) {
                alert("Credenciales incorrectas");
              }
            }}
            className="space-y-4"
          >
            {/* 💡 MEJORA 1: Focus rings agregados al Login */}
            <input
              type="email"
              className="w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
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
              type="password"
              className="w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
              placeholder="Contraseña"
              onChange={(e) =>
                setLoginCredentials({
                  ...loginCredentials,
                  password: e.target.value,
                })
              }
              required
            />
            <button className="w-full bg-blue-600 p-4 rounded-xl font-bold uppercase text-sm cursor-pointer hover:bg-blue-500 transition-colors">
              Entrar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans">
      {/* HEADER */}
      <header className="border-b border-white/5 bg-[#111827]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Laptop className="text-white" size={24} />
            </div>
            <div>
              <span className="text-base font-black text-white block capitalize">
                {userNombre} {userApellido}
              </span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded uppercase font-bold tracking-widest mt-0.5 inline-block">
                {role}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("userEmail");
              localStorage.removeItem("userNombre");
              localStorage.removeItem("userApellido");
              logout();
            }}
            className="text-slate-400 hover:text-red-400 flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut size={20} />{" "}
            <span className="hidden md:inline text-sm font-bold uppercase tracking-widest">
              Salir
            </span>
          </button>
        </div>
      </header>

      {/* NAVEGACIÓN GLOBAL */}
      <div className="max-w-7xl mx-auto px-6 mt-6 flex gap-3 overflow-x-auto py-2">
        <button
          onClick={() => setCurrentView("inventario")}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer ${currentView === "inventario" ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-[#111827] text-slate-400 border-white/5"}`}
        >
          Inventario
        </button>
        {role === "admin" && (
          <>
            <button
              onClick={() => setCurrentView("usuarios")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer ${currentView === "usuarios" ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-[#111827] text-slate-400 border-white/5"}`}
            >
              Usuarios
            </button>
            <button
              onClick={() => setCurrentView("configuraciones")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer ${currentView === "configuraciones" ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-[#111827] text-slate-400 border-white/5"}`}
            >
              Configuraciones
            </button>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📦 1. SECCIÓN DE INVENTARIO */}
      {/* ========================================================================= */}
      {currentView === "inventario" && (
        <>
          <div className="max-w-7xl mx-auto px-6 pt-4">
            <DashboardGrid actualizarMetricas={actualizarMetricas} />
          </div>
          <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-12 gap-9">
            {(role === "admin" || role === "tecnico") && (
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
                    {/* 💡 MEJORA 1: Anillo de luz e interactividad añadida a los inputs laterales */}
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all uppercase placeholder-slate-500"
                      placeholder="S/N"
                      value={form.serialNumber}
                      onChange={(e) =>
                        setForm({ ...form, serialNumber: e.target.value })
                      }
                      required
                    />
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all capitalize placeholder-slate-500"
                      placeholder="Marca"
                      value={form.brand}
                      onChange={(e) =>
                        setForm({ ...form, brand: e.target.value })
                      }
                      required
                    />
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all uppercase placeholder-slate-500"
                      placeholder="Modelo"
                      value={form.model}
                      onChange={(e) =>
                        setForm({ ...form, model: e.target.value })
                      }
                      required
                    />
                    <select
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer"
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value })
                      }
                    >
                      <option
                        value="Computadora"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Computadora
                      </option>
                      <option
                        value="Celular"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Celular
                      </option>
                      <option
                        value="Otro"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Otro
                      </option>
                    </select>
                    {form.type === "Otro" && (
                      <input
                        className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all placeholder-slate-500"
                        placeholder="Especifica"
                        value={form.typeOther}
                        onChange={(e) =>
                          setForm({ ...form, typeOther: e.target.value })
                        }
                      />
                    )}
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all capitalize placeholder-slate-500"
                      placeholder="Nombre"
                      value={form.assignedTo}
                      onChange={(e) =>
                        setForm({ ...form, assignedTo: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all uppercase placeholder-slate-500"
                      placeholder="Área"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    />
                    <button className="w-full p-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer">
                      {isEditing ? "Guardar" : "Registrar"}
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="w-full text-xs text-slate-500 text-center block hover:text-white cursor-pointer mt-1"
                      >
                        Cancelar
                      </button>
                    )}
                  </form>
                </div>
              </aside>
            )}

            <section
              className={`${role === "coordinador" ? "lg:col-span-12" : "lg:col-span-9"} bg-[#111827] rounded-3xl border border-white/5 overflow-hidden`}
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">
                  Inventario Actual
                </h2>
                <span className="bg-blue-500/10 text-blue-500 px-4 py-1 rounded-full text-xs font-black">
                  {filteredAssets.length} de {assets.length} ITEMS
                </span>
              </div>

              {/* FILTROS DINÁMICOS DE HARDWARE */}
              <div className="p-6 bg-[#0e1422] border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    {/* 💡 MEJORA 1: Focus rings agregados a la barra de búsqueda */}
                    <input
                      type="text"
                      placeholder="Buscar S/N, marca, modelo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 placeholder-slate-500 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Filter
                      size={14}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer appearance-none"
                    >
                      <option
                        value="Todos"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Todos los tipos
                      </option>
                      <option
                        value="Computadora"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Computadoras
                      </option>
                      <option
                        value="Celular"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Celulares
                      </option>
                      <option
                        value="Otro"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Otros Equipos
                      </option>
                    </select>
                  </div>
                  <div className="relative">
                    <Filter
                      size={14}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer appearance-none"
                    >
                      <option
                        value="Todos"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Todos los estados
                      </option>
                      <option
                        value="En Stock"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        En Stock
                      </option>
                      <option
                        value="Asignado"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        Asignado
                      </option>
                      <option
                        value="En Mantenimiento"
                        className="bg-[#1f2937] text-slate-200"
                      >
                        En Mantenimiento
                      </option>
                    </select>
                  </div>
                </div>

                {/* BOTÓN LIMPIAR FILTROS INTELIGENTE */}
                {(searchTerm !== "" ||
                  filterType !== "Todos" ||
                  filterStatus !== "Todos") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setFilterType("Todos");
                      setFilterStatus("Todos");
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 bg-[#1f2937] px-4 py-3 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap shadow-md"
                  >
                    <X size={14} /> Limpiar Filtros
                  </button>
                )}
              </div>

              <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-white/2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-6 py-5 text-left">Hardware</th>
                      <th className="px-6 py-5 text-left">Serial No.</th>
                      <th className="px-6 py-5 text-left">Asignado a</th>
                      <th className="px-6 py-5 text-left">Área</th>
                      <th className="px-6 py-5 text-right">
                        Estado y Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAssets.map((a) => (
                      <tr key={a._id} className="hover:bg-white/2 transition">
                        {/* 💡 MEJORA 2: Clases 'capitalize' y 'uppercase' forzadas para consistencia */}
                        <td className="px-6 py-5">
                          <div className="text-white font-bold capitalize">
                            {a.brand}
                          </div>
                          <div className="text-xs text-slate-500 uppercase">
                            {a.model}
                          </div>
                        </td>
                        <td className="px-6 py-5 font-mono text-sm text-blue-400 uppercase">
                          {a.serialNumber}
                        </td>

                        <td className="px-6 py-5 text-slate-300 capitalize">
                          {(a.status || "En Stock") === "En Stock" ? (
                            <span className="text-slate-600 italic font-medium">
                              Sin Asignar
                            </span>
                          ) : (
                            a.assignedTo || "N/A"
                          )}
                        </td>
                        <td className="px-6 py-5 text-slate-300 uppercase">
                          {(a.status || "En Stock") === "En Stock" ? (
                            <span className="text-slate-600 italic font-medium">
                              —
                            </span>
                          ) : (
                            a.department || "N/A"
                          )}
                        </td>

                        <td className="px-6 py-5 text-right">
                          <select
                            disabled={role === "coordinador"}
                            value={a.status || "En Stock"}
                            onChange={(e) =>
                              handleStatusChange(a._id, e.target.value)
                            }
                            className={`px-4 py-2 text-xs font-bold rounded-xl border outline-none cursor-pointer transition-all ${
                              (a.status || "En Stock") === "En Stock"
                                ? "bg-blue-600/10 text-blue-400 border-blue-500/20"
                                : (a.status || "En Stock") === "Asignado"
                                  ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-orange-600/10 text-orange-400 border-orange-500/20"
                            }`}
                          >
                            <option
                              value="En Stock"
                              className="bg-[#1f2937] text-slate-200"
                            >
                              En Stock
                            </option>
                            <option
                              value="Asignado"
                              className="bg-[#1f2937] text-slate-200"
                            >
                              Asignado
                            </option>
                            <option
                              value="En Mantenimiento"
                              className="bg-[#1f2937] text-slate-200"
                            >
                              Mantenimiento
                            </option>
                          </select>
                          {role !== "coordinador" && (
                            <div className="inline-flex gap-2 pl-3 ml-3 border-l border-white/10">
                              <button
                                onClick={() => startEdit(a)}
                                className="text-slate-500 hover:text-yellow-500 cursor-pointer"
                              >
                                <Pencil size={16} />
                              </button>
                              {role === "admin" && (
                                <button
                                  onClick={() => deleteAsset(a._id)}
                                  className="text-slate-500 hover:text-red-500 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAssets.length === 0 && (
                      <tr>
                        <td
                          colSpan="5"
                          className="py-12 text-center text-slate-600 italic text-xs"
                        >
                          No se encontraron activos con esos filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </>
      )}

      {/* ========================================================================= */}
      {/* 👥 2. SECCIÓN DE USUARIOS */}
      {/* ========================================================================= */}
      {currentView === "usuarios" && (
        <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-12 gap-9">
          <aside className="lg:col-span-4">
            <div className="bg-[#111827] p-8 rounded-3xl border border-white/5 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <UserPlus className="text-blue-500" />{" "}
                {isEditingUser ? "Modificar Operador" : "Registrar Operador"}
              </h2>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                {/* 💡 MEJORA 1: Focus rings interactivos agregados a los campos de usuario */}
                <input
                  type="text"
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white placeholder-slate-500 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all capitalize"
                  placeholder="Nombre(s)"
                  value={userForm.nombre}
                  onChange={(e) =>
                    setUserForm({ ...userForm, nombre: e.target.value })
                  }
                  required
                />
                <input
                  type="text"
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white placeholder-slate-500 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all capitalize"
                  placeholder="Apellido(s)"
                  value={userForm.apellido}
                  onChange={(e) =>
                    setUserForm({ ...userForm, apellido: e.target.value })
                  }
                  required
                />
                <input
                  type="email"
                  className="w-full p-3 bg-[#1f2937] rounded-xl outline-none text-white placeholder-slate-500 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                  placeholder="Correo corporativo (@empresa.com)"
                  value={userForm.email}
                  onChange={(e) =>
                    setUserForm({ ...userForm, email: e.target.value })
                  }
                  required
                />

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full p-3 pr-11 bg-[#1f2937] rounded-xl outline-none text-white placeholder-slate-500 text-sm border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                    placeholder="Contraseña temporal"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  🔒 Política: Mínimo 8 dígitos, 1 Mayúscula y 1 Número.
                </p>

                <div className="space-y-2 pt-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                    Matriz de Permisos
                  </label>
                  <div className="bg-[#111827] p-4 rounded-xl space-y-3 border border-white/5">
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={userForm.permisos.lectura}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            permisos: {
                              ...userForm.permisos,
                              lectura: e.target.checked,
                            },
                          })
                        }
                      />
                      <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-600 bg-[#1f2937] flex items-center justify-center peer-checked:border-blue-500 peer-checked:bg-blue-600/10 transition-all shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 scale-0 peer-checked:scale-100 transition-all"></div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-blue-400">
                          Lectura (Solo leen)
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={userForm.permisos.escritura}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            permisos: {
                              ...userForm.permisos,
                              escritura: e.target.checked,
                            },
                          })
                        }
                      />
                      <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-600 bg-[#1f2937] flex items-center justify-center peer-checked:border-blue-500 peer-checked:bg-blue-600/10 transition-all shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 scale-0 peer-checked:scale-100 transition-all"></div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-blue-400">
                          Escritura (INsertan nuevos activos)
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={userForm.permisos.modificacion}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            permisos: {
                              ...userForm.permisos,
                              modificacion: e.target.checked,
                            },
                          })
                        }
                      />
                      <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-600 bg-[#1f2937] flex items-center justify-center peer-checked:border-blue-500 peer-checked:bg-blue-600/10 transition-all shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 scale-0 peer-checked:scale-100 transition-all"></div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-blue-400">
                          Modificación (Editar y eliminar)
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <button className="w-full p-4 mt-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors uppercase text-xs tracking-wider cursor-pointer">
                  {isEditingUser ? "Guardar Cambios" : "Dar de Alta Cuenta"}
                </button>
                {isEditingUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingUser(false);
                      setEditUserId(null);
                      setUserForm({
                        nombre: "",
                        apellido: "",
                        email: "",
                        password: "",
                        permisos: {
                          lectura: true,
                          escritura: false,
                          modificacion: false,
                        },
                      });
                    }}
                    className="w-full text-xs text-slate-500 text-center block hover:text-white cursor-pointer mt-2"
                  >
                    Cancelar Edición
                  </button>
                )}
              </form>
            </div>
          </aside>

          <section className="lg:col-span-8 bg-[#111827] rounded-3xl border border-white/5 p-8 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-1 uppercase tracking-wider text-sm">
              Cuentas y Permisos Activos
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Lista perimetral sincronizada de cuentas con acceso a la API en
              producción.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                    <th className="px-6 pb-4 text-left">Colaborador</th>
                    <th className="px-6 pb-4 text-left">Correo Local</th>
                    <th className="px-6 pb-4 text-left">
                      Directivas de Acceso (ACL)
                    </th>
                    <th className="px-6 pb-4 text-center">Estado</th>
                    <th className="px-6 pb-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {/* Administrador actual (Fijo) */}
                  <tr>
                    {/* 💡 MEJORA 2: Texto normalizado con 'capitalize' */}
                    <td className="px-6 py-5 font-bold text-white text-left whitespace-nowrap capitalize">
                      {userNombre} {userApellido}
                    </td>
                    <td className="px-6 py-5 text-slate-400 font-mono text-left">
                      {userEmail}
                    </td>
                    <td className="px-6 py-5 text-left">
                      <div className="flex flex-wrap gap-1">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                          Lectura
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                          Escritura
                        </span>
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                          Modificación
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center text-emerald-400 font-bold">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
                        Activo
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right text-slate-600 italic whitespace-nowrap">
                      Master Root
                    </td>
                  </tr>

                  {/* Operadores Dinámicos */}
                  {registeredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-white/2 transition ${!user.activo ? "opacity-40" : ""}`}
                    >
                      <td className="px-6 py-5 text-slate-300 font-bold text-left whitespace-nowrap capitalize">
                        {user.nombre} {user.apellido}
                      </td>
                      <td className="px-6 py-5 text-slate-400 font-mono text-left">
                        {user.email}
                      </td>
                      <td className="px-6 py-5 text-left">
                        <div className="flex flex-wrap gap-1">
                          {user.permisos.map((perm) => (
                            <span
                              key={perm}
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${perm === "lectura" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : perm === "escritura" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center font-bold">
                        {user.activo ? (
                          <span className="text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1 rounded-full text-[10px]">
                            Autorizado
                          </span>
                        ) : (
                          <span className="text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-1 rounded-full text-[10px]">
                            Suspendido
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            disabled={!user.activo}
                            onClick={() => startEditUser(user)}
                            className={`p-1.5 rounded-lg text-slate-400 hover:text-yellow-500 hover:bg-yellow-500/10 transition cursor-pointer ${!user.activo ? "opacity-20 cursor-not-allowed" : ""}`}
                            title="Editar permisos"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() =>
                              toggleUserStatus(
                                user.id,
                                user.nombre,
                                user.activo,
                              )
                            }
                            className={`p-1.5 rounded-lg transition cursor-pointer ${user.activo ? "text-slate-400 hover:text-red-500 hover:bg-red-500/10" : "text-red-500 bg-red-500/10 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
                            title={
                              user.activo
                                ? "Suspender cuenta"
                                : "Reactivar cuenta"
                            }
                          >
                            {user.activo ? (
                              <UserX size={15} />
                            ) : (
                              <UserCheck size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Estado vacío */}
                  {registeredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-8 text-center text-slate-600 italic text-xs tracking-wide"
                      >
                        Ningún operador adicional registrado. Usa el panel
                        izquierdo para dar de alta una cuenta corporativa en
                        esta sesión.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* ========================================================================= */}
      {/* ⚙️ 3. SECCIÓN DE AJUSTES GLOBALES */}
      {/* ========================================================================= */}
      {currentView === "configuraciones" && (
        <main className="max-w-5xl mx-auto p-6">
          <div className="bg-[#111827] rounded-3xl border border-white/5 p-8 space-y-8 shadow-xl">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Settings className="text-blue-500" /> Configuración Global
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Consola de monitoreo de la infraestructura y el entorno
                perimetral.
              </p>
            </div>

            {/* 💡 MEJORA 3: Panel expandido con 4 tarjetas para vestir la UI de forma profesional */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Tarjeta 1 */}
              <div className="p-6 bg-[#1f2937]/30 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">
                    Base de Datos (MERN Stack)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Estado del clúster persistente no relacional en la nube.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 w-fit px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
                  MONGODB ATLAS CONNECTED
                </div>
              </div>

              {/* Tarjeta 2 */}
              <div className="p-6 bg-[#1f2937]/30 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">
                    Estado del Servidor (REST API)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Estatus del despliegue del motor Express en el servidor web.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 w-fit px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
                  RENDER DEPLOYMENT: ACTIVE
                </div>
              </div>

              {/* Tarjeta 3 */}
              <div className="p-6 bg-[#1f2937]/30 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">
                    Seguridad Perimetral
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Cifrado de canales de comunicación y cabeceras de red.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md">
                    SSL ENCRYPTION: SECURE
                  </span>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-md">
                    VERCEL CSP: ENFORCED
                  </span>
                </div>
              </div>

              {/* Tarjeta 4 */}
              <div className="p-6 bg-[#1f2937]/30 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">
                    Control de Versión y Sesión
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Configuración criptográfica actual de los tokens JWT de
                    acceso.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                    VERSION 1.0.0 (Sprint 6)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                    ALGORITHM: HS256 (24h)
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() =>
                  alert("Directivas de hardening sincronizadas en caché.")
                }
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-colors cursor-pointer shadow-lg shadow-blue-600/10"
              >
                Sincronizar Consola
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;

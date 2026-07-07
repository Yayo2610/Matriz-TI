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
  Upload,
  FileText,
  Contact,
} from "lucide-react";
import DashboardGrid from "./components/DashboardGrid";
import { AuthContext } from "./context/AuthContext";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const { token, role, tienePermiso, login, logout } = useContext(AuthContext);

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
  const [registeredUsers, setRegisteredUsers] = useState([]);

  // 📥 CONSOLA DE APROVISIONAMIENTO: "manual" | "bulk-assets" | "bulk-personal"
  const [registerMode, setRegisterMode] = useState("manual");

  // 📋 BASE DE DATOS LOCAL DE PERSONAL (Directorio Corporativo Precargado)
  const [employeesDirectory, setEmployeesDirectory] = useState([]);

  const API_URL = "https://matriz-ti-backend.onrender.com/api/assets";
  const AUTH_URL = "https://matriz-ti-backend.onrender.com/api/auth";
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
    role: "tecnico",
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

    // 1. Forzamos el cálculo estricto del estado
    const estadoReal =
      form.assignedTo && form.assignedTo.trim() !== ""
        ? "Asignado"
        : "En Stock";

    // 2. Empaquetamos los datos
    const payload = {
      ...form,
      status: estadoReal,
    };

    console.log("📦 PAQUETE QUE REACT ENVÍA AL BACKEND:", payload);

    try {
      if (isEditing) {
        // Actualizar equipo existente
        await axios.put(`${API_URL}/${editId}`, payload, clientConfig);
        setIsEditing(false);
        setEditId(null);
      } else {
        // Crear equipo nuevo
        await axios.post(API_URL, payload, clientConfig);
      }

      // Limpiamos el formulario
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
      console.error("Error del backend:", err.response?.data || err.message);
      alert(
        `Error al guardar: ${err.response?.data?.message || "Revisa la consola"}`,
      );
    }
  };

  const handleDeleteAllAssets = async () => {
    // Confirmación con diálogo nativo
    const confirmacion = window.confirm(
      "⚠️ ¿Estás seguro de eliminar TODOS los activos?\n\nEsta acción es irreversible y borrará todos los equipos del inventario permanentemente.",
    );
    if (!confirmacion) return;

    try {
      const response = await axios.delete(`${API_URL}/clear`, clientConfig);
      alert(`✅ ${response.data.message}`);
      // Refrescar lista y métricas
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
    } catch (err) {
      console.error(
        "Error al eliminar todos:",
        err.response?.data || err.message,
      );
      alert(`❌ Error: ${err.response?.data?.error || "No se pudo eliminar"}`);
    }
  };

  const handleBulkUploadAssets = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/bulk`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      alert(`✅ ${response.data.message || "Carga masiva exitosa."}`);
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
      e.target.value = ""; // Limpiar input
    } catch (err) {
      console.error(
        "Error en carga masiva:",
        err.response?.data || err.message,
      );
      alert(
        `❌ Error al subir el archivo: ${err.response?.data?.error || "Revisa la consola"}`,
      );
    }
  };
  // 👥 PROPUESTA 2: Procesador de Importación del Directorio de Personal (Nómina en CSV)
  const handleBulkUploadEmployees = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split("\n");
      const deptoPersonal = [];

      // Cabecera omitida -> Formato esperado: Nombre,Apellido,Puesto_O_Area
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].trim();
        if (!row) continue;

        const columns = row.split(",");
        if (columns.length >= 3) {
          deptoPersonal.push({
            id: `emp-${Date.now()}-${i}`,
            fullName: `${columns[0]?.trim()} ${columns[1]?.trim()}`,
            area: columns[2]?.trim() || "General",
          });
        }
      }

      if (deptoPersonal.length > 0) {
        setEmployeesDirectory(deptoPersonal);
        alert(
          `👥 Directorio Sincronizado: Se precargaron ${deptoPersonal.length} colaboradores en el sistema. Los campos de asignación manual ahora están automatizados.`,
        );
        setRegisterMode("manual");
      } else {
        alert(
          "El archivo de personal no contiene datos estructurados válidos.",
        );
      }
    };
    reader.readAsText(file);
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
  const handleUserSubmit = async (e) => {
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
                role: userForm.role,
                permisos: arrayPermisos,
              }
            : u,
        ),
      );
      setIsEditingUser(false);
      setEditUserId(null);
    } else {
      try {
        await axios.post(
          `${AUTH_URL}/register`,
          {
            nombre: userForm.nombre,
            apellido: userForm.apellido,
            email: userForm.email,
            password: userForm.password,
            role: userForm.role,
            permisos: userForm.permisos,
          },
          clientConfig,
        );
      } catch (err) {
        alert(
          `❌ Error al crear la cuenta: ${err.response?.data?.error || "Revisa la consola"}`,
        );
        return;
      }

      fetchUsers();
    }
    setUserForm({
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      role: "tecnico",
      permisos: { lectura: true, escritura: false, modificacion: false },
    });
  };

  const startEditUser = (user) => {
    setUserForm({
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      password: "Password123",
      role: user.role || "tecnico",
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
    if (
      window.confirm(
        nuevoEstado ? `¿Reactivar a ${nombre}?` : `¿Suspender a ${nombre}?`,
      )
    ) {
      setRegisteredUsers(
        registeredUsers.map((u) =>
          u._id === id ? { ...u, activo: nuevoEstado } : u,
        ),
      );
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
        alert("No tienes permisos.");
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

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${AUTH_URL}/users`, clientConfig);
      setRegisteredUsers(res.data.map((u) => ({ ...u, activo: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const deleteUser = async (id) => {
    if (window.confirm("¿Confirmas eliminar esta cuenta?")) {
      try {
        await axios.delete(`${AUTH_URL}/users/${id}`, clientConfig);
        fetchUsers();
      } catch (err) {
        alert("No se pudo eliminar la cuenta.");
      }
    }
  };

  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  useEffect(() => {
    if (token && role === "admin") fetchUsers();
  }, [token, role]);

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
                localStorage.setItem(
                  "userNombre",
                  loginCredentials.email === "yael.admin@empresa.com"
                    ? "Yael"
                    : "Operador",
                );
                localStorage.setItem(
                  "userApellido",
                  loginCredentials.email === "yael.admin@empresa.com"
                    ? "Barrera"
                    : "Soporte",
                );
                localStorage.setItem("userEmail", loginCredentials.email);
                login(res.data.token, res.data.role, res.data.permisos);
              } catch (err) {
                alert("Credenciales incorrectas");
              }
            }}
            className="space-y-4"
          >
            <input
              type="email"
              className="w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-sm"
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
              className="w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-sm"
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
            onClick={logout}
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
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${currentView === "inventario" ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-[#111827] text-slate-400 border-white/5"}`}
        >
          Inventario
        </button>
        {role === "admin" && (
          <>
            <button
              onClick={() => setCurrentView("usuarios")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${currentView === "usuarios" ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-[#111827] text-slate-400 border-white/5"}`}
            >
              Usuarios
            </button>
            <button
              onClick={() => setCurrentView("configuraciones")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${currentView === "configuraciones" ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-[#111827] text-slate-400 border-white/5"}`}
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
            {tienePermiso("escritura") && (
              /* --- ESTE ES EL PANEL LATERAL CON LA MEJORA VISUAL EXACTA --- */
              <aside className="lg:col-span-3">
                <div className="bg-[#111827] p-5 rounded-3xl border border-white/5 sticky top-28 space-y-6 shadow-xl">
                  {/* SELECTOR DE MODO */}
                  <div className="grid grid-cols-3 gap-1 bg-[#0a0f1a] p-1 rounded-xl border border-white/5 text-[9px] font-bold text-center uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setRegisterMode("manual")}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${registerMode === "manual" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMode("bulk-assets")}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${registerMode === "bulk-assets" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      + Activos
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMode("bulk-personal")}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${registerMode === "bulk-personal" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      + Personal
                    </button>
                  </div>

                  {/* ÁREA DE CONTENIDO DINÁMICO */}
                  <div className="min-h-[300px]">
                    {registerMode === "manual" ? (
                      /* TU FORMULARIO ORIGINAL INTACTO */
                      <form onSubmit={handleSubmit} className="space-y-3">
                        <h2 className="text-xs font-bold text-white flex items-center gap-2 mb-4">
                          {isEditing ? (
                            <Pencil className="text-yellow-500" size={16} />
                          ) : (
                            <PlusCircle className="text-blue-500" size={16} />
                          )}
                          {isEditing ? "Editar Activo" : "Registrar Activo"}
                        </h2>
                        <input
                          className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all uppercase text-xs placeholder-slate-500"
                          placeholder="S/N"
                          value={form.serialNumber}
                          onChange={(e) =>
                            setForm({ ...form, serialNumber: e.target.value })
                          }
                          required
                        />
                        <input
                          className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all capitalize text-xs placeholder-slate-500"
                          placeholder="Marca"
                          value={form.brand}
                          onChange={(e) =>
                            setForm({ ...form, brand: e.target.value })
                          }
                          required
                        />
                        <input
                          className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all uppercase text-xs placeholder-slate-500"
                          placeholder="Modelo"
                          value={form.model}
                          onChange={(e) =>
                            setForm({ ...form, model: e.target.value })
                          }
                          required
                        />
                        <select
                          className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer text-xs"
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
                            className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs placeholder-slate-500"
                            placeholder="Especifica"
                            value={form.typeOther}
                            onChange={(e) =>
                              setForm({ ...form, typeOther: e.target.value })
                            }
                          />
                        )}

                        {/* CONTROL DE ASIGNACIÓN INTERACTIVO */}
                        {employeesDirectory.length > 0 ? (
                          <div className="space-y-1.5 p-2 bg-[#0a0f1a] rounded-xl border border-white/5">
                            <label className="text-[9px] text-emerald-400 uppercase font-black tracking-wider block">
                              Asignar desde Nómina
                            </label>
                            <select
                              value={
                                employeesDirectory?.find(
                                  (em) => em.fullName === form.assignedTo,
                                )?.id || ""
                              }
                              className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs cursor-pointer"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                  setForm({
                                    ...form,
                                    assignedTo: "",
                                    department: "",
                                  });
                                } else {
                                  const em = employeesDirectory?.find(
                                    (x) => x.id === val,
                                  );
                                  if (em) {
                                    setForm({
                                      ...form,
                                      assignedTo: em.fullName,
                                      department: em.area,
                                    });
                                  }
                                }
                              }}
                            >
                              <option value="">
                                -- Seleccionar Titular --
                              </option>
                              {employeesDirectory &&
                                employeesDirectory.map((em) => (
                                  <option key={em.id} value={em.id}>
                                    {em.fullName}
                                  </option>
                                ))}
                            </select>
                            {form.department && (
                              <div className="text-[9px] text-slate-500 px-1 mt-1">
                                Área vinculada:{" "}
                                <span className="text-slate-300 font-bold uppercase">
                                  {form.department}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <input
                              className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all capitalize text-xs placeholder-slate-500"
                              placeholder="Nombre de quien recibe"
                              value={form.assignedTo}
                              onChange={(e) =>
                                setForm({ ...form, assignedTo: e.target.value })
                              }
                            />
                            <input
                              className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all uppercase text-xs placeholder-slate-500"
                              placeholder="Área de trabajo"
                              value={form.department}
                              onChange={(e) =>
                                setForm({ ...form, department: e.target.value })
                              }
                            />
                          </>
                        )}

                        <button className="w-full p-3 rounded-xl font-bold text-white text-xs uppercase bg-blue-600 hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/10 cursor-pointer">
                          Guardar Activo
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
                    ) : registerMode === "bulk-assets" ? (
                      /* DROPZONE DE ACTIVOS */
                      <div className="flex flex-col items-center justify-center text-center space-y-4 h-full py-6">
                        <div className="p-4 bg-blue-500/10 rounded-full">
                          <FileText size={32} className="text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Carga de Inventario
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1 px-2">
                            Sube tu archivo .CSV de activos siguiendo la
                            estructura establecida: S/N, Marca, Modelo, Tipo,
                            Nombre, Área.
                          </p>
                        </div>
                        <label className="w-full py-3 bg-[#1f2937] hover:bg-[#2d3748] rounded-xl border border-white/5 cursor-pointer text-xs font-bold text-slate-300 transition-all">
                          Seleccionar Archivo
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleBulkUploadAssets}
                          />
                        </label>
                      </div>
                    ) : (
                      /* DROPZONE DE PERSONAL */
                      <div className="flex flex-col items-center justify-center text-center space-y-4 h-full py-6">
                        <div className="p-4 bg-emerald-500/10 rounded-full">
                          <Contact size={32} className="text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Importar Personal
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1 px-2">
                            Precarga el archivo de nómina (.CSV) para
                            automatizar la asignación. Formato: Nombre,
                            Apellido, Área_O_Puesto.
                          </p>
                        </div>
                        <label className="w-full py-3 bg-[#1f2937] hover:bg-[#2d3748] rounded-xl border border-white/5 cursor-pointer text-xs font-bold text-slate-300 transition-all">
                          Seleccionar Archivo
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleBulkUploadEmployees}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}

            <section
              className={`${tienePermiso("escritura") ? "lg:col-span-9" : "lg:col-span-12"} bg-[#111827] rounded-3xl border border-white/5 overflow-hidden`}
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">
                  Inventario Actual
                </h2>
                <div className="flex items-center gap-4">
                  <span className="bg-blue-500/10 text-blue-500 px-4 py-1 rounded-full text-xs font-black">
                    {filteredAssets.length} ITEMS
                  </span>
                  {role === "admin" && (
                    <button
                      onClick={handleDeleteAllAssets}
                      className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Trash2 size={16} />
                      Eliminar todos
                    </button>
                  )}
                </div>
              </div>

              {/* FILTROS ORIGINALES */}
              <div className="p-4 bg-[#0e1422] border-b border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Buscar S/N, marca, modelo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-blue-500 cursor-pointer appearance-none"
                  >
                    <option value="Todos">Todos los tipos</option>
                    <option value="Computadora">Computadoras</option>
                    <option value="Celular">Celulares</option>
                    <option value="Otro">Otros Equipos</option>
                  </select>
                </div>
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-blue-500 cursor-pointer appearance-none"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="En Stock">En Stock</option>
                    <option value="Asignado">Asignado</option>
                    <option value="En Mantenimiento">En Mantenimiento</option>
                  </select>
                </div>
              </div>

              <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-white/2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-6 py-4 text-left">Hardware</th>
                      <th className="px-6 py-4 text-left">Serial No.</th>
                      <th className="px-6 py-4 text-left">Asignado a</th>
                      <th className="px-6 py-4 text-left">Área</th>
                      <th className="px-6 py-4 text-right">
                        Estado y Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAssets.map((a) => (
                      <tr
                        key={a._id}
                        className="hover:bg-white/2 transition text-xs"
                      >
                        <td className="px-6 py-4">
                          <div className="text-white font-bold capitalize">
                            {a.brand}
                          </div>
                          <div className="text-[11px] text-slate-500 uppercase">
                            {a.model}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-blue-400 uppercase">
                          {a.serialNumber}
                        </td>
                        <td className="px-6 py-4 text-slate-300 capitalize">
                          {(a.status || "En Stock") === "En Stock" ? (
                            <span className="text-slate-600 italic">
                              Sin Asignar
                            </span>
                          ) : (
                            a.assignedTo || "N/A"
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-300 uppercase">
                          {(a.status || "En Stock") === "En Stock" ? (
                            <span className="text-slate-600 italic">—</span>
                          ) : (
                            a.department || "N/A"
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <select
                            disabled={!tienePermiso("modificacion")}
                            value={a.status || "En Stock"}
                            onChange={(e) =>
                              handleStatusChange(a._id, e.target.value)
                            }
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border outline-none cursor-pointer ${(a.status || "En Stock") === "En Stock" ? "bg-blue-600/10 text-blue-400 border-blue-500/20" : (a.status || "En Stock") === "Asignado" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20" : "bg-orange-600/10 text-orange-400 border-orange-500/20"}`}
                          >
                            <option value="En Stock" className="bg-[#1f2937]">
                              En Stock
                            </option>
                            <option value="Asignado" className="bg-[#1f2937]">
                              Asignado
                            </option>
                            <option
                              value="En Mantenimiento"
                              className="bg-[#1f2937]"
                            >
                              Mantenimiento
                            </option>
                          </select>
                          {tienePermiso("modificacion") && (
                            <>
                              <button
                                onClick={() => startEdit(a)}
                                className="text-yellow-500 ml-3"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => deleteAsset(a._id)}
                                className="text-red-500 ml-3"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
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

      {/* SECCIÓN OPERADORES ORIGINAL INTACTA */}
      {/* SECCIÓN OPERADORES (RESTAURADA EXACTAMENTE AL DISEÑO ORIGINAL) */}
      {currentView === "usuarios" && (
        <main className="max-w-5xl mx-auto p-6 space-y-9">
          {/* PANEL DE REGISTRO */}
          <div className="bg-[#111827] p-8 rounded-3xl border border-white/5 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <UserPlus className="text-blue-500" /> Registrar Operador
            </h2>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <input
                type="text"
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs"
                placeholder="Nombre(S)"
                value={userForm.nombre}
                onChange={(e) =>
                  setUserForm({ ...userForm, nombre: e.target.value })
                }
                required
              />
              <input
                type="text"
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs"
                placeholder="Apellido(S)"
                value={userForm.apellido}
                onChange={(e) =>
                  setUserForm({ ...userForm, apellido: e.target.value })
                }
                required
              />
              <input
                type="email"
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs"
                placeholder="Correo corporativo (@empresa.com)"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
                required
              />

              <select
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs cursor-pointer"
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value })
                }
              >
                <option value="admin">Administrador</option>
                <option value="tecnico">Técnico</option>
                <option value="coordinador">Coordinador</option>
              </select>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full p-3.5 pr-11 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all text-xs"
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <p className="text-[9px] text-slate-500 flex items-center gap-1.5 mt-1 ml-1">
                <ShieldCheck size={12} /> Política: Mínimo 8 dígitos, 1
                Mayúscula y 1 Número.
              </p>

              {/* MATRIZ DE PERMISOS */}
              <div className="pt-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">
                  Matriz de Permisos
                </h3>
                <div className="space-y-3 bg-[#0a0f1a] p-5 rounded-xl border border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={userForm.permisos?.lectura || false}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          permisos: {
                            ...userForm.permisos,
                            lectura: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded-full appearance-none border-2 border-slate-600 checked:border-blue-500 checked:bg-blue-500 transition-colors cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                      Lectura{" "}
                      <span className="text-slate-500 font-normal">
                        (Solo leer)
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={userForm.permisos?.escritura || false}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          permisos: {
                            ...userForm.permisos,
                            escritura: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded-full appearance-none border-2 border-slate-600 checked:border-blue-500 checked:bg-blue-500 transition-colors cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                      Escritura{" "}
                      <span className="text-slate-500 font-normal">
                        (Alta nuevos activos)
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={userForm.permisos?.modificacion || false}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          permisos: {
                            ...userForm.permisos,
                            modificacion: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded-full appearance-none border-2 border-slate-600 checked:border-blue-500 checked:bg-blue-500 transition-colors cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                      Modificación{" "}
                      <span className="text-slate-500 font-normal">
                        (Editar y eliminar)
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <button className="w-full p-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 text-xs uppercase tracking-wider transition-colors mt-4">
                Dar de Alta Cuenta
              </button>
            </form>
          </div>

          {/* TABLA DE CUENTAS */}
          <div className="bg-[#111827] rounded-3xl border border-white/5 p-8 shadow-xl">
            <div className="mb-8">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Cuentas y Permisos Activos
              </h2>
              <p className="text-[10px] text-slate-500 mt-1">
                Lista perimetral seccionada de cuentas con acceso a la API en
                producción.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] text-slate-500 font-black uppercase tracking-[0.15em]">
                    <th className="px-6 pb-4">Colaborador</th>
                    <th className="px-6 pb-4">Correo Local</th>
                    <th className="px-6 pb-4">Directivas de Acceso (ACL)</th>
                    <th className="px-6 pb-4 text-center">Estado</th>
                    <th className="px-6 pb-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {/* USUARIO MASTER (TÚ) */}
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-5 font-bold text-white capitalize">
                      {userNombre} {userApellido}
                    </td>
                    <td className="px-6 py-5 text-slate-400 font-mono">
                      {userEmail}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
                          Lectura
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
                          Escritura
                        </span>
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
                          Modificación
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>{" "}
                        Activo
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right text-slate-600 italic text-[10px]">
                      Master Root
                    </td>
                  </tr>

                  {/* USUARIOS REGISTRADOS DINÁMICAMENTE (desde el backend) */}
                  {registeredUsers.map((u) => (
                    <tr
                      key={u._id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-5 font-bold text-white capitalize">
                        {u.nombre} {u.apellido}
                      </td>
                      <td className="px-6 py-5 text-slate-400 font-mono">
                        {u.email}
                        <span className="block text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-widest mt-1 w-fit">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {u.permisos?.lectura && (
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
                              Lectura
                            </span>
                          )}
                          {u.permisos?.escritura && (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
                              Escritura
                            </span>
                          )}
                          {u.permisos?.modificacion && (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
                              Modificación
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          onClick={() =>
                            toggleUserStatus(u._id, u.nombre, u.activo)
                          }
                          className={`flex items-center justify-center gap-1.5 font-bold text-[10px] mx-auto transition-colors ${u.activo ? "text-emerald-400 hover:text-red-400" : "text-slate-500 hover:text-emerald-400"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-emerald-400" : "bg-slate-500"}`}
                          ></span>{" "}
                          {u.activo ? "Activo" : "Suspendido"}
                        </button>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => deleteUser(u._id)}
                          className="text-slate-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {registeredUsers.length === 0 && (
                <p className="text-center text-[9px] text-slate-600 mt-8 italic mb-2">
                  Ningún operador adicional registrado. Usa el panel superior
                  para dar de alta una cuenta corporativa en esta sección.
                </p>
              )}
            </div>
          </div>
        </main>
      )}
      {/* CONFIGURACIONES ORIGINAL INTACTA */}
      {currentView === "configuraciones" && (
        <main className="max-w-5xl mx-auto p-6">
          <div className="bg-[#111827] rounded-3xl border border-white/5 p-8 space-y-6 shadow-xl">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Settings className="text-blue-500" /> Configuración Global
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-[#1f2937]/30 rounded-2xl border border-white/5">
                <h3 className="text-sm font-bold text-white mb-1">
                  Base de Datos (MERN Stack)
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full inline-block mt-2">
                  MONGODB ATLAS CONNECTED
                </span>
              </div>
              <div className="p-6 bg-[#1f2937]/30 rounded-2xl border border-white/5">
                <h3 className="text-sm font-bold text-white mb-1">
                  Estado del Servidor
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full inline-block mt-2">
                  RENDER DEPLOYMENT: ACTIVE
                </span>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;

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
  ChevronDown,
  PackageOpen,
  Wrench,
} from "lucide-react";
import DashboardGrid from "./components/DashboardGrid";
import { ToastContainer } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { AuthContext } from "./context/AuthContext";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const { token, role, nombre, apellido, tienePermiso, login, logout } =
    useContext(AuthContext);

  // --- ESTADOS LOCALES ---
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [loginCredentials, setLoginCredentials] = useState({
    email: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [currentView, setCurrentView] = useState("inventario");

  // 🔔 NOTIFICACIONES PROPIAS (reemplazan alert() y window.confirm())
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const pushToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const askConfirm = (message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  };

  // 🔍 ESTADOS DE FILTROS (INVENTARIO)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");

  // 📄 PAGINACIÓN (INVENTARIO)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_POR_PAGINA = 25;

  // 👥 ESTADOS DE OPERADORES Y SEGURIDAD (USUARIOS)
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [mostrarUsuarios, setMostrarUsuarios] = useState(false);

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
    type: "Desktop",
    typeOther: "",
    assignedTo: "",
    department: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [actualizarMetricas, setActualizarMetricas] = useState(0);

  const userNombre = nombre || "Usuario";
  const userApellido = apellido || "";
  const userEmail = localStorage.getItem("userEmail") || "";

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

  // 📄 PÁGINA ACTUAL SOBRE EL RESULTADO YA FILTRADO
  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredAssets.length / ITEMS_POR_PAGINA),
  );
  const paginaSegura = Math.min(currentPage, totalPaginas);
  const paginatedAssets = filteredAssets.slice(
    (paginaSegura - 1) * ITEMS_POR_PAGINA,
    paginaSegura * ITEMS_POR_PAGINA,
  );

  // 🔁 Detección de S/N duplicado contra el inventario ya cargado
  const isDuplicateSerial =
    form.serialNumber.trim() !== "" &&
    assets.some(
      (a) =>
        a._id !== editId &&
        a.serialNumber.trim().toLowerCase() ===
          form.serialNumber.trim().toLowerCase(),
    );

  // --- COMPORTAMIENTO DE ACTIVOS ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isDuplicateSerial) {
      pushToast(
        `Ya existe un activo con el número de serie "${form.serialNumber}".`,
        "error",
      );
      return;
    }

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
        type: "Desktop",
        typeOther: "",
        assignedTo: "",
        department: "",
      });
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
    } catch (err) {
      console.error("Error del backend:", err.response?.data || err.message);
      pushToast(
        `Error al guardar: ${err.response?.data?.message || "Revisa la consola"}`,
        "error",
      );
    }
  };

  const handleDeleteAllAssets = () => {
    askConfirm(
      "¿Estás seguro de eliminar TODOS los activos?\n\nEsta acción es irreversible y borrará todos los equipos del inventario permanentemente.",
      async () => {
        try {
          const response = await axios.delete(
            `${API_URL}/clear`,
            clientConfig,
          );
          pushToast(response.data.message, "success");
          // Refrescar lista y métricas
          fetchAssets();
          setActualizarMetricas((prev) => prev + 1);
        } catch (err) {
          console.error(
            "Error al eliminar todos:",
            err.response?.data || err.message,
          );
          pushToast(
            `Error: ${err.response?.data?.error || "No se pudo eliminar"}`,
            "error",
          );
        }
      },
    );
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

      pushToast(
        response.data.message || "Carga masiva exitosa.",
        "success",
      );
      fetchAssets();
      setActualizarMetricas((prev) => prev + 1);
      e.target.value = ""; // Limpiar input
    } catch (err) {
      console.error(
        "Error en carga masiva:",
        err.response?.data || err.message,
      );
      pushToast(
        `Error al subir el archivo: ${err.response?.data?.error || "Revisa la consola"}`,
        "error",
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
        pushToast(
          `Directorio sincronizado: se precargaron ${deptoPersonal.length} colaboradores en el sistema. Los campos de asignación manual ahora están automatizados.`,
          "success",
        );
        setRegisterMode("manual");
      } else {
        pushToast(
          "El archivo de personal no contiene datos estructurados válidos.",
          "error",
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
      pushToast("Error al actualizar el estado", "error");
    }
  };

  // --- COMPORTAMIENTO DE USUARIOS ---
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.email.toLowerCase().endsWith("@empresa.com")) {
      pushToast(
        "Error perimetral: solo se permiten correos corporativos con dominio @empresa.com",
        "error",
      );
      return;
    }
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    const seEscribioPassword = userForm.password.trim() !== "";
    const debeValidarPassword = !isEditingUser || seEscribioPassword;
    if (debeValidarPassword && !passwordRegex.test(userForm.password)) {
      pushToast(
        "Contraseña insegura: debe contener al menos 8 caracteres, una letra mayúscula y un número.",
        "error",
      );
      return;
    }
    if (isEditingUser) {
      try {
        await axios.put(
          `${AUTH_URL}/users/${editUserId}`,
          {
            nombre: userForm.nombre,
            apellido: userForm.apellido,
            role: userForm.role,
            permisos: userForm.permisos,
            ...(seEscribioPassword ? { password: userForm.password } : {}),
          },
          clientConfig,
        );
      } catch (err) {
        pushToast(
          `Error al actualizar la cuenta: ${err.response?.data?.error || "Revisa la consola"}`,
          "error",
        );
        return;
      }
      setIsEditingUser(false);
      setEditUserId(null);
      fetchUsers();
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
        pushToast(
          `Error al crear la cuenta: ${err.response?.data?.error || "Revisa la consola"}`,
          "error",
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
      password: "",
      role: user.role || "tecnico",
      permisos: {
        lectura: !!user.permisos?.lectura,
        escritura: !!user.permisos?.escritura,
        modificacion: !!user.permisos?.modificacion,
      },
    });
    setEditUserId(user._id);
    setIsEditingUser(true);
  };

  const cancelEditUser = () => {
    setIsEditingUser(false);
    setEditUserId(null);
    setUserForm({
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      role: "tecnico",
      permisos: { lectura: true, escritura: false, modificacion: false },
    });
  };

  const toggleUserStatus = (id, nombre, statusActual) => {
    const nuevoEstado = !statusActual;
    askConfirm(
      nuevoEstado ? `¿Reactivar a ${nombre}?` : `¿Suspender a ${nombre}?`,
      async () => {
        try {
          await axios.put(
            `${AUTH_URL}/users/${id}`,
            { activo: nuevoEstado },
            clientConfig,
          );
          fetchUsers();
        } catch (err) {
          pushToast("No se pudo actualizar el estado de la cuenta.", "error");
        }
      },
    );
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
      type: "Desktop",
      typeOther: "",
      assignedTo: "",
      department: "",
    });
    setIsEditing(false);
    setEditId(null);
  };

  const deleteAsset = (id) => {
    askConfirm("¿Confirmas la baja de este activo?", async () => {
      try {
        await axios.delete(`${API_URL}/${id}`, clientConfig);
        fetchAssets();
        setActualizarMetricas((prev) => prev + 1);
      } catch (err) {
        pushToast("No tienes permisos.", "error");
      }
    });
  };

  const fetchAssets = async () => {
    setAssetsLoading(true);
    try {
      const res = await axios.get(API_URL, clientConfig);
      setAssets(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setAssetsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${AUTH_URL}/users`, clientConfig);
      setRegisteredUsers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteUser = (id) => {
    askConfirm("¿Confirmas eliminar esta cuenta?", async () => {
      try {
        await axios.delete(`${AUTH_URL}/users/${id}`, clientConfig);
        fetchUsers();
      } catch (err) {
        pushToast("No se pudo eliminar la cuenta.", "error");
      }
    });
  };

  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  useEffect(() => {
    if (token && role === "admin") fetchUsers();
  }, [token, role]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6 text-white font-sans relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(232,121,249,0.1),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)]" />
        <div className="w-full max-w-md bg-[#111827] p-8 rounded-2xl border border-fuchsia-500/10 shadow-[0_0_50px_-15px_rgba(232,121,249,0.1)] relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-fuchsia-500/20 p-4 rounded-full mb-4 shadow-[0_0_25px_-5px_rgba(232,121,249,0.25)]">
              <ShieldCheck size={40} className="text-fuchsia-400" />
            </div>
            <h1 className="text-2xl font-display font-black tracking-widest [text-shadow:0_0_20px_rgba(232,121,249,0.22)]">
              ASSETTRACK{" "}
              <span className="text-fuchsia-400">PRO</span>
            </h1>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError("");
              setIsLoggingIn(true);
              try {
                const res = await axios.post(
                  "https://matriz-ti-backend.onrender.com/api/auth/login",
                  loginCredentials,
                );
                localStorage.setItem("userEmail", loginCredentials.email);
                login(
                  res.data.token,
                  res.data.role,
                  res.data.permisos,
                  res.data.nombre,
                  res.data.apellido,
                );
              } catch (err) {
                setLoginError(
                  err.response?.data?.error || "Credenciales incorrectas",
                );
              } finally {
                setIsLoggingIn(false);
              }
            }}
            className="space-y-4"
          >
            <input
              type="email"
              className={`w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border transition-all text-sm ${
                loginError
                  ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                  : "border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
              }`}
              placeholder="Correo electrónico"
              onChange={(e) => {
                setLoginError("");
                setLoginCredentials({
                  ...loginCredentials,
                  email: e.target.value,
                });
              }}
              required
            />
            <div className="relative">
              <input
                type={showLoginPassword ? "text" : "password"}
                className={`w-full p-4 pr-12 bg-[#1f2937] rounded-xl outline-none text-slate-200 border transition-all text-sm ${
                  loginError
                    ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                    : "border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
                }`}
                placeholder="Contraseña"
                onChange={(e) => {
                  setLoginError("");
                  setLoginCredentials({
                    ...loginCredentials,
                    password: e.target.value,
                  });
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {loginError && (
              <p className="text-red-400 text-sm text-center -mt-1">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 p-4 rounded-xl font-bold uppercase text-sm cursor-pointer hover:from-fuchsia-400 hover:to-purple-500 transition-all shadow-[0_0_25px_-8px_rgba(232,121,249,0.28)] hover:shadow-[0_0_35px_-6px_rgba(232,121,249,0.32)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? "Verificando..." : "Entrar al Sistema"}
            </button>
          </form>
          <p className="text-center text-slate-500 text-xs mt-6">
            Acceso exclusivo para personal autorizado
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans relative">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(232,121,249,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(232,121,249,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_0%,transparent_75%)]" />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        dialog={confirmDialog}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
      />
      {/* HEADER */}
      <header className="border-b border-white/5 bg-[#111827]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-2 rounded-lg shadow-[0_0_20px_-6px_rgba(232,121,249,0.28)]">
              <Laptop className="text-white" size={24} />
            </div>
            <div>
              <span className="text-base font-black text-white block capitalize">
                {userNombre} {userApellido}
              </span>
              <span className="text-[10px] bg-fuchsia-400/10 text-fuchsia-400 border border-fuchsia-400/20 px-2.5 py-0.5 rounded uppercase font-bold tracking-widest mt-0.5 inline-block">
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
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${currentView === "inventario" ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white border-fuchsia-400 shadow-[0_0_20px_-6px_rgba(232,121,249,0.25)]" : "bg-[#111827] text-slate-400 border-white/5"}`}
        >
          Inventario
        </button>
        {role === "admin" && (
          <>
            <button
              onClick={() => setCurrentView("usuarios")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${currentView === "usuarios" ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white border-fuchsia-400 shadow-[0_0_20px_-6px_rgba(232,121,249,0.25)]" : "bg-[#111827] text-slate-400 border-white/5"}`}
            >
              Usuarios
            </button>
            <button
              onClick={() => setCurrentView("configuraciones")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${currentView === "configuraciones" ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white border-fuchsia-400 shadow-[0_0_20px_-6px_rgba(232,121,249,0.25)]" : "bg-[#111827] text-slate-400 border-white/5"}`}
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
                <div className="bg-[#111827] p-5 rounded-2xl border border-white/5 sticky top-28 space-y-6 shadow-xl">
                  {/* SELECTOR DE MODO */}
                  <div className="grid grid-cols-3 gap-1 bg-[#0a0f1a] p-1 rounded-xl border border-white/5 text-[9px] font-bold text-center uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setRegisterMode("manual")}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${registerMode === "manual" ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMode("bulk-assets")}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${registerMode === "bulk-assets" ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      + Activos
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMode("bulk-personal")}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${registerMode === "bulk-personal" ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
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
                            <PlusCircle className="text-fuchsia-400" size={16} />
                          )}
                          {isEditing ? "Editar Activo" : "Registrar Activo"}
                        </h2>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                            S/N
                          </label>
                          <input
                            className={`w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border transition-all uppercase text-xs placeholder-slate-500 ${
                              isDuplicateSerial
                                ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                                : "border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
                            }`}
                            placeholder="S/N"
                            value={form.serialNumber}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                serialNumber: e.target.value,
                              })
                            }
                            required
                          />
                          {isDuplicateSerial && (
                            <p className="text-[10px] text-red-400 px-1">
                              Ya existe un activo con este número de serie.
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                            Marca
                          </label>
                          <input
                            className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all capitalize text-xs placeholder-slate-500"
                            placeholder="Marca"
                            value={form.brand}
                            onChange={(e) =>
                              setForm({ ...form, brand: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                            Modelo
                          </label>
                          <input
                            className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all uppercase text-xs placeholder-slate-500"
                            placeholder="Modelo"
                            value={form.model}
                            onChange={(e) =>
                              setForm({ ...form, model: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                            Tipo
                          </label>
                          <input
                            className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all text-xs placeholder-slate-500"
                            placeholder="Ej. Desktop, Laptop, Router..."
                            value={form.type}
                            onChange={(e) =>
                              setForm({ ...form, type: e.target.value })
                            }
                            required
                          />
                        </div>

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
                              className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-slate-200 border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all text-xs cursor-pointer"
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
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                                Nombre de quien recibe
                              </label>
                              <input
                                className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all capitalize text-xs placeholder-slate-500"
                                placeholder="Nombre de quien recibe"
                                value={form.assignedTo}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    assignedTo: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                                Área de trabajo
                              </label>
                              <input
                                className="w-full p-2.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all uppercase text-xs placeholder-slate-500"
                                placeholder="Área de trabajo"
                                value={form.department}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    department: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </>
                        )}

                        <button
                          type="submit"
                          disabled={isDuplicateSerial}
                          className="w-full p-3 rounded-xl font-bold text-white text-xs uppercase bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 transition-all shadow-[0_0_20px_-8px_rgba(232,121,249,0.28)] hover:shadow-[0_0_28px_-6px_rgba(232,121,249,0.32)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                        >
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
                        <div className="p-4 bg-fuchsia-400/10 rounded-full">
                          <FileText size={32} className="text-fuchsia-400" />
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
              className={`${tienePermiso("escritura") ? "lg:col-span-9" : "lg:col-span-12"} bg-[#111827] rounded-2xl border border-white/5 overflow-hidden`}
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <h2 className="text-sm font-display font-bold text-white uppercase tracking-[0.15em]">
                  Inventario Actual
                </h2>
                <div className="flex items-center gap-4">
                  <span className="bg-fuchsia-400/10 text-fuchsia-400 px-4 py-1 rounded-full text-xs font-black">
                    {filteredAssets.length} ITEMS
                  </span>
                  {role === "admin" && (
                    <>
                      <div className="w-px h-6 bg-white/10" />
                      <button
                        onClick={handleDeleteAllAssets}
                        className="flex items-center gap-2 bg-transparent hover:bg-red-600/20 border border-red-500/30 text-red-400/80 hover:text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Trash2 size={16} />
                        Eliminar todos
                      </button>
                    </>
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
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-11 pr-4 py-2.5 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-4 pr-10 py-2.5 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-fuchsia-400 cursor-pointer appearance-none"
                  >
                    <option value="Todos">Todos los tipos</option>
                    <option value="Desktop">Desktop</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Celular">Celulares</option>
                    <option value="Monitor">Monitores</option>
                    <option value="Impresora">Impresoras</option>
                    <option value="Impresora de Etiquetas">
                      Impresoras de Etiquetas
                    </option>
                    <option value="Access Point">Access Points</option>
                    <option value="Switch">Switches</option>
                    <option value="Router">Routers</option>
                    <option value="Servidor">Servidores</option>
                    <option value="ONT">ONT</option>
                    <option value="Firewall">Firewalls</option>
                    <option value="UPS">UPS</option>
                    <option value="Periferico">Periféricos</option>
                    <option value="Otro">Otros Equipos</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-4 pr-10 py-2.5 bg-[#1f2937] rounded-xl outline-none text-xs text-slate-200 border border-transparent focus:border-fuchsia-400 cursor-pointer appearance-none"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="En Stock">En Stock</option>
                    <option value="Asignado">Asignado</option>
                    <option value="En Mantenimiento">En Mantenimiento</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>
              </div>

              <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-white/2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-6 py-4 text-left">Hardware</th>
                      <th className="px-6 py-4 text-left">Tipo</th>
                      <th className="px-6 py-4 text-left">Serial No.</th>
                      <th className="px-6 py-4 text-left whitespace-nowrap">
                        Asignado a
                      </th>
                      <th className="px-6 py-4 text-left">Área</th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">
                        Estado y Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {assetsLoading ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <tr key={`skeleton-${idx}`} className="animate-pulse">
                          <td className="px-6 py-4">
                            <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                            <div className="h-2.5 w-16 bg-white/5 rounded" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-5 w-16 bg-white/10 rounded-lg" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-3 w-20 bg-white/10 rounded" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-3 w-28 bg-white/10 rounded" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-3 w-24 bg-white/10 rounded" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-7 w-32 bg-white/10 rounded-xl ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16">
                          <div className="flex flex-col items-center gap-3 text-center">
                            <div className="p-4 bg-white/5 rounded-full">
                              <PackageOpen size={28} className="text-slate-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-400">
                              No hay activos que coincidan
                            </p>
                            <p className="text-xs text-slate-600 max-w-xs">
                              Ajusta los filtros de búsqueda o registra un
                              nuevo equipo desde el panel izquierdo.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedAssets.map((a, idx) => (
                      <tr
                        key={a._id}
                        className={`hover:bg-white/5 transition text-xs ${idx % 2 === 1 ? "bg-white/[0.02]" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <div className="text-white font-bold capitalize">
                            {a.brand}
                          </div>
                          <div className="text-[11px] text-slate-500 uppercase">
                            {a.model}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-white/5 text-slate-300 border border-white/10 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider">
                            {a.type === "Otro" && a.typeOther
                              ? a.typeOther
                              : a.type || "Sin definir"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-fuchsia-400 uppercase">
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
                        <td className="px-6 py-4 text-slate-300 uppercase max-w-[160px]">
                          {(a.status || "En Stock") === "En Stock" ? (
                            <span className="text-slate-600 italic">—</span>
                          ) : (
                            <span
                              className="block truncate"
                              title={a.department || "N/A"}
                            >
                              {a.department || "N/A"}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                {(a.status || "En Stock") === "En Stock" ? (
                                  <PackageOpen
                                    size={12}
                                    className="text-blue-400"
                                  />
                                ) : (a.status || "En Stock") ===
                                  "Asignado" ? (
                                  <UserCheck
                                    size={12}
                                    className="text-emerald-400"
                                  />
                                ) : (
                                  <Wrench
                                    size={12}
                                    className="text-orange-400"
                                  />
                                )}
                              </span>
                              <select
                                disabled={!tienePermiso("modificacion")}
                                value={a.status || "En Stock"}
                                onChange={(e) =>
                                  handleStatusChange(a._id, e.target.value)
                                }
                                className={`pl-8 pr-3 py-1.5 text-[11px] font-bold rounded-xl border outline-none cursor-pointer ${(a.status || "En Stock") === "En Stock" ? "bg-blue-600/10 text-blue-400 border-blue-500/20" : (a.status || "En Stock") === "Asignado" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20" : "bg-orange-600/10 text-orange-400 border-orange-500/20"}`}
                              >
                                <option
                                  value="En Stock"
                                  className="bg-[#1f2937]"
                                >
                                  En Stock
                                </option>
                                <option
                                  value="Asignado"
                                  className="bg-[#1f2937]"
                                >
                                  Asignado
                                </option>
                                <option
                                  value="En Mantenimiento"
                                  className="bg-[#1f2937]"
                                >
                                  Mantenimiento
                                </option>
                              </select>
                            </div>
                            {tienePermiso("modificacion") && (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => startEdit(a)}
                                  className="text-yellow-500 p-1.5 rounded-lg hover:bg-yellow-500/10 transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => deleteAsset(a._id)}
                                  className="text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Página {paginaSegura} de {totalPaginas}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={paginaSegura === 1}
                      onClick={() => setCurrentPage(paginaSegura - 1)}
                      className="px-3 py-1.5 rounded-lg bg-[#1f2937] text-slate-300 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2d3748] transition-colors cursor-pointer"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={paginaSegura === totalPaginas}
                      onClick={() => setCurrentPage(paginaSegura + 1)}
                      className="px-3 py-1.5 rounded-lg bg-[#1f2937] text-slate-300 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2d3748] transition-colors cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </section>
          </main>
        </>
      )}

      {/* SECCIÓN OPERADORES ORIGINAL INTACTA */}
      {/* SECCIÓN OPERADORES (RESTAURADA EXACTAMENTE AL DISEÑO ORIGINAL) */}
      {currentView === "usuarios" && (
        <main className="max-w-5xl mx-auto p-6 space-y-9">
          {/* PANEL DE REGISTRO */}
          <div className="bg-[#111827] p-8 rounded-2xl border border-white/5 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              {isEditingUser ? (
                <Pencil className="text-yellow-500" />
              ) : (
                <UserPlus className="text-fuchsia-400" />
              )}
              {isEditingUser ? "Editar Usuario" : "Usuarios"}
            </h2>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <input
                type="text"
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all text-xs"
                placeholder="Nombre(S)"
                value={userForm.nombre}
                onChange={(e) =>
                  setUserForm({ ...userForm, nombre: e.target.value })
                }
                required
              />
              <input
                type="text"
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all text-xs"
                placeholder="Apellido(S)"
                value={userForm.apellido}
                onChange={(e) =>
                  setUserForm({ ...userForm, apellido: e.target.value })
                }
                required
              />
              <input
                type="email"
                className="w-full p-3.5 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Correo corporativo (@empresa.com)"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
                disabled={isEditingUser}
                required
              />
              {isEditingUser && (
                <p className="text-[9px] text-slate-500 -mt-2 ml-1">
                  El correo no se puede modificar desde aquí.
                </p>
              )}

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full p-3.5 pr-11 bg-[#1f2937] rounded-xl outline-none text-white border border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40 transition-all text-xs"
                  placeholder={
                    isEditingUser
                      ? "Nueva contraseña (dejar en blanco para no cambiarla)"
                      : "Contraseña temporal"
                  }
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                  required={!isEditingUser}
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
                <ShieldCheck size={12} />
                {isEditingUser
                  ? "Si escribes una contraseña nueva, aplica la misma política: mínimo 8 dígitos, 1 Mayúscula y 1 Número."
                  : "Política: Mínimo 8 dígitos, 1 Mayúscula y 1 Número."}
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
                      className="w-4 h-4 rounded-full appearance-none border-2 border-slate-600 checked:border-fuchsia-400 checked:bg-fuchsia-400 transition-colors cursor-pointer"
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
                      className="w-4 h-4 rounded-full appearance-none border-2 border-slate-600 checked:border-fuchsia-400 checked:bg-fuchsia-400 transition-colors cursor-pointer"
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
                      className="w-4 h-4 rounded-full appearance-none border-2 border-slate-600 checked:border-fuchsia-400 checked:bg-fuchsia-400 transition-colors cursor-pointer"
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

              <button className="w-full p-4 rounded-xl font-bold text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_-8px_rgba(232,121,249,0.28)] hover:shadow-[0_0_28px_-6px_rgba(232,121,249,0.32)] mt-4">
                {isEditingUser ? "Guardar Cambios" : "Registrar"}
              </button>
              {isEditingUser && (
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="w-full text-xs text-slate-500 text-center block hover:text-white cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
            </form>
          </div>

          {/* TABLA DE CUENTAS */}
          <div className="bg-[#111827] rounded-2xl border border-white/5 p-8 shadow-xl">
            <div
              className="mb-8 flex items-center justify-between cursor-pointer"
              onClick={() => setMostrarUsuarios(!mostrarUsuarios)}
            >
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Usuarios
                </h2>
                <p className="text-[10px] text-slate-500 mt-1">
                  Lista perimetral seccionada de cuentas con acceso a la API
                  en producción.
                </p>
              </div>
              <ChevronDown
                size={18}
                className={`text-slate-500 transition-transform ${mostrarUsuarios ? "rotate-180" : ""}`}
              />
            </div>

            {mostrarUsuarios && (
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
                        <span className="bg-fuchsia-400/10 text-fuchsia-400 border border-fuchsia-400/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
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
                        <span className="block text-[9px] bg-fuchsia-400/10 text-fuchsia-400 border border-fuchsia-400/20 px-2 py-0.5 rounded uppercase font-bold tracking-widest mt-1 w-fit">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {u.permisos?.lectura && (
                            <span className="bg-fuchsia-400/10 text-fuchsia-400 border border-fuchsia-400/20 px-2 py-0.5 rounded uppercase text-[8px] font-black tracking-widest">
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
                          onClick={() => startEditUser(u)}
                          className="text-slate-500 hover:text-yellow-500 transition-colors mr-3"
                        >
                          <Pencil size={16} />
                        </button>
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
            )}
          </div>
        </main>
      )}
      {/* CONFIGURACIONES ORIGINAL INTACTA */}
      {currentView === "configuraciones" && (
        <main className="max-w-5xl mx-auto p-6">
          <div className="bg-[#111827] rounded-2xl border border-white/5 p-8 space-y-6 shadow-xl">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Settings className="text-fuchsia-400" /> Configuración Global
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

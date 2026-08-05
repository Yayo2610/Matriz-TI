import { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import {
  Trash2,
  Laptop,
  LogOut,
  ShieldCheck,
  Pencil,
  X,
  Users,
  Settings,
  Search,
  Filter,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Upload,
  FileText,
  ChevronDown,
  PackageOpen,
  Wrench,
  KeyRound,
  ArrowLeft,
  Crosshair,
} from "lucide-react";
import DashboardGrid from "./components/DashboardGrid";
import { ToastContainer } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { AuthContext } from "./context/AuthContext";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const {
    token,
    role,
    nombre,
    apellido,
    tienePermiso,
    login,
    logout,
    sesionExpirada,
    limpiarSesionExpirada,
    cuentaSuspendida,
    limpiarCuentaSuspendida,
    sesionCerradaOtroDispositivo,
    limpiarSesionCerradaOtroDispositivo,
    solicitudSesion,
    responderSolicitudSesion,
  } = useContext(AuthContext);

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

  // 🔐 SESIÓN ÚNICA: espera de confirmación en el otro dispositivo al iniciar sesión
  const [esperandoOtraSesion, setEsperandoOtraSesion] = useState(false);
  const [solicitudSesionRechazada, setSolicitudSesionRechazada] = useState(false);
  const pollSolicitudLoginRef = useRef(null);

  // 🔑 RECUPERACIÓN DE CONTRASEÑA
  const [authView, setAuthView] = useState("login"); // "login" | "forgot"
  const [forgotForm, setForgotForm] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  const askConfirm = (message, onConfirm, onCancel) => {
    setConfirmDialog({ message, onConfirm, onCancel });
  };

  // 🔐 SESIÓN ÚNICA: alguien está iniciando sesión con esta misma cuenta en
  // otro dispositivo — se le pregunta al usuario si quiere cederla.
  const solicitudSesionMostradaRef = useRef(null);

  useEffect(() => {
    if (!solicitudSesion) {
      solicitudSesionMostradaRef.current = null;
      return;
    }
    if (solicitudSesionMostradaRef.current === solicitudSesion.requestId) {
      return;
    }
    solicitudSesionMostradaRef.current = solicitudSesion.requestId;

    askConfirm(
      "Se está iniciando sesión con tu cuenta en otro dispositivo.\n¿Quieres cerrar tu sesión aquí y continuar allá?",
      () => {
        pushToast("Sesión cerrada aquí. Continuando en el otro dispositivo.", "success");
        responderSolicitudSesion(true);
      },
      () => {
        pushToast("Solicitud rechazada. Tu sesión sigue activa aquí.", "success");
        responderSolicitudSesion(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudSesion]);

  // 🔍 ESTADOS DE FILTROS (INVENTARIO)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");

  // 📄 PAGINACIÓN (INVENTARIO)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(25);
  const OPCIONES_TAMANO_PAGINA = [5, 10, 30, 50, 100];
  const itemsPorPaginaSelectRef = useRef(null);

  // 👥 ESTADOS DE OPERADORES Y SEGURIDAD (USUARIOS)
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [registeredUsers, setRegisteredUsers] = useState([]);

  // 🕓 ÚLTIMA SINCRONIZACIÓN (cajetín de título)
  const [lastSyncAt, setLastSyncAt] = useState(null);
  // Su valor no se lee; solo fuerza un re-render cada segundo para que
  // "hace N s" se mantenga actualizado en el cajetín de título.
  const [_reloj, setReloj] = useState(0);

  // 🔐 SESIONES ACTIVAS (solo admin)
  const [sesionesActivas, setSesionesActivas] = useState([]);
  // 👥 DIRECTORIO DE PERSONAL — CRUD individual (solo admin)
  const [personForm, setPersonForm] = useState({ fullName: "", area: "" });
  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [editPersonId, setEditPersonId] = useState(null);
  const [personSearch, setPersonSearch] = useState("");
  const [mostrarFormPersona, setMostrarFormPersona] = useState(false);
  const [personPage, setPersonPage] = useState(1);
  const [personPageSize, setPersonPageSize] = useState(10);
  const personPageSizeSelectRef = useRef(null);
  const personFileInputRef = useRef(null);

  // 📥 CONSOLA DE APROVISIONAMIENTO: "manual" | "bulk-assets"
  // (la carga de personal vive únicamente en la pestaña "Personal")
  const [registerMode, setRegisterMode] = useState("manual");

  // 📋 BASE DE DATOS LOCAL DE PERSONAL (Directorio Corporativo Precargado)
  const [employeesDirectory, setEmployeesDirectory] = useState([]);

  const API_URL = "https://matriz-ti-backend.onrender.com/api/assets";
  const AUTH_URL = "https://matriz-ti-backend.onrender.com/api/auth";
  const EMPLOYEES_URL = "https://matriz-ti-backend.onrender.com/api/employees";
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
    role: "Técnico",
    permisos: { lectura: true, escritura: false, modificacion: false },
  });
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("todos");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const userPageSizeSelectRef = useRef(null);

  const ROLE_STYLES = {
    admin: {
      label: "Admin",
      pill: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10",
      dot: "bg-fuchsia-400",
    },
    tecnico: {
      label: "Técnico",
      pill: "text-violet-300 border-violet-400/40 bg-violet-400/10",
      dot: "bg-violet-400",
    },
    coordinador: {
      label: "Coordinador",
      pill: "text-amber-300 border-amber-400/40 bg-amber-400/10",
      dot: "bg-amber-400",
    },
  };

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
    Math.ceil(filteredAssets.length / itemsPorPagina),
  );
  const paginaSegura = Math.min(currentPage, totalPaginas);
  const paginatedAssets = filteredAssets.slice(
    (paginaSegura - 1) * itemsPorPagina,
    paginaSegura * itemsPorPagina,
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

  // Arma un mensaje corto con las filas que el backend descartó (y por qué),
  // en vez de dejar ese detalle solo en la consola del servidor.
  const describirOmitidas = (omitidas) => {
    if (!omitidas || omitidas.length === 0) return "";
    const detalle = omitidas
      .slice(0, 5)
      .map((o) => `fila ${o.fila} (${o.motivo})`)
      .join(", ");
    const extra = omitidas.length > 5 ? ` y ${omitidas.length - 5} más` : "";
    return `${omitidas.length} fila(s) omitida(s): ${detalle}${extra}.`;
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
      const detalleOmitidas = describirOmitidas(response.data.omitidas);
      if (detalleOmitidas) pushToast(detalleOmitidas, "error");
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
  // 👥 Directorio de Personal (Nómina en CSV) — se guarda en el backend para
  // que quede disponible para todos los usuarios, no solo quien lo sube.
  const fetchEmployees = async () => {
    try {
      const res = await axios.get(EMPLOYEES_URL, clientConfig);
      setEmployeesDirectory(
        res.data.map((emp) => ({ ...emp, id: emp._id })),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkUploadEmployees = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const subir = async () => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await axios.post(`${EMPLOYEES_URL}/bulk`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        });
        pushToast(
          response.data.message || "Directorio de personal actualizado.",
          "success",
        );
        const detalleOmitidas = describirOmitidas(response.data.omitidas);
        if (detalleOmitidas) pushToast(detalleOmitidas, "error");
        fetchEmployees();
        setRegisterMode("manual");
      } catch (err) {
        console.error(
          "Error al subir el directorio de personal:",
          err.response?.data || err.message,
        );
        pushToast(
          `Error al subir el archivo: ${err.response?.data?.error || "Revisa la consola"}`,
          "error",
        );
      } finally {
        e.target.value = "";
      }
    };

    if (employeesDirectory.length > 0) {
      askConfirm(
        `Esto reemplazará los ${employeesDirectory.length} colaborador(es) actuales por el contenido de este archivo. ¿Continuar?`,
        subir,
        () => {
          e.target.value = "";
        },
      );
    } else {
      subir();
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
      pushToast("Error al actualizar el estado", "error");
    }
  };

  // --- COMPORTAMIENTO DE USUARIOS ---
  const handleUserSubmit = async (e) => {
    e.preventDefault();
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
    const rolNormalizado = userForm.role.trim().toLowerCase() || "tecnico";
    if (isEditingUser) {
      try {
        await axios.put(
          `${AUTH_URL}/users/${editUserId}`,
          {
            nombre: userForm.nombre,
            apellido: userForm.apellido,
            role: rolNormalizado,
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
            role: rolNormalizado,
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
      role: "Técnico",
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
      role: "Técnico",
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
      setLastSyncAt(Date.now());
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

  const fetchSesionesActivas = async () => {
    try {
      const res = await axios.get(`${AUTH_URL}/sesiones-activas`, clientConfig);
      setSesionesActivas(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const cerrarSesionAjena = (sesion) => {
    askConfirm(
      `¿Cerrar la sesión de ${sesion.nombre} ${sesion.apellido}? Perderá el acceso de inmediato.`,
      async () => {
        try {
          await axios.post(
            `${AUTH_URL}/sesiones-activas/${sesion.id}/cerrar`,
            {},
            clientConfig,
          );
          pushToast(`Sesión de ${sesion.nombre} cerrada.`, "success");
          fetchSesionesActivas();
        } catch (err) {
          pushToast(
            err.response?.data?.error || "No se pudo cerrar la sesión.",
            "error",
          );
        }
      },
    );
  };

  const handlePersonSubmit = async (e) => {
    e.preventDefault();
    if (!personForm.fullName.trim()) {
      pushToast("El nombre es obligatorio.", "error");
      return;
    }
    try {
      if (isEditingPerson) {
        await axios.put(
          `${EMPLOYEES_URL}/${editPersonId}`,
          personForm,
          clientConfig,
        );
        pushToast("Colaborador actualizado.", "success");
      } else {
        await axios.post(EMPLOYEES_URL, personForm, clientConfig);
        pushToast("Colaborador agregado.", "success");
      }
      setPersonForm({ fullName: "", area: "" });
      setIsEditingPerson(false);
      setEditPersonId(null);
      setMostrarFormPersona(false);
      fetchEmployees();
    } catch (err) {
      pushToast(
        err.response?.data?.error || "No se pudo guardar el colaborador.",
        "error",
      );
    }
  };

  const startEditPerson = (persona) => {
    setPersonForm({ fullName: persona.fullName, area: persona.area || "" });
    setEditPersonId(persona.id);
    setIsEditingPerson(true);
    setMostrarFormPersona(true);
  };

  const cancelEditPerson = () => {
    setPersonForm({ fullName: "", area: "" });
    setIsEditingPerson(false);
    setEditPersonId(null);
    setMostrarFormPersona(false);
  };

  const deletePerson = (persona) => {
    askConfirm(`¿Eliminar a ${persona.fullName} del directorio?`, async () => {
      try {
        await axios.delete(`${EMPLOYEES_URL}/${persona.id}`, clientConfig);
        pushToast("Colaborador eliminado.", "success");
        fetchEmployees();
      } catch (err) {
        pushToast("No se pudo eliminar al colaborador.", "error");
      }
    });
  };

  const handleDeleteAllEmployees = () => {
    askConfirm(
      "¿Estás seguro de eliminar TODO el directorio de personal?\n\nEsta acción es irreversible y borrará a todos los colaboradores permanentemente.",
      async () => {
        try {
          const response = await axios.delete(
            `${EMPLOYEES_URL}/clear`,
            clientConfig,
          );
          pushToast(response.data.message, "success");
          fetchEmployees();
        } catch (err) {
          pushToast(
            `Error: ${err.response?.data?.error || "No se pudo eliminar"}`,
            "error",
          );
        }
      },
    );
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      setForgotError("Las contraseñas no coinciden");
      return;
    }

    setIsSendingForgot(true);
    try {
      const res = await axios.post(`${AUTH_URL}/forgot-password`, {
        email: forgotForm.email,
        newPassword: forgotForm.newPassword,
      });
      setForgotSuccess(
        res.data.message || "Contraseña actualizada correctamente",
      );
      setForgotForm({ email: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setForgotError(
        err.response?.data?.error || "No se pudo restablecer la contraseña",
      );
    } finally {
      setIsSendingForgot(false);
    }
  };

  const volverALogin = () => {
    setAuthView("login");
    setForgotError("");
    setForgotSuccess("");
    setForgotForm({ email: "", newPassword: "", confirmPassword: "" });
  };

  // 🔐 SESIÓN ÚNICA: mientras se espera que el otro dispositivo confirme o
  // rechace el cambio de sesión, se consulta el resultado cada pocos segundos.
  const detenerPollSolicitudLogin = () => {
    if (pollSolicitudLoginRef.current) {
      clearInterval(pollSolicitudLoginRef.current);
      pollSolicitudLoginRef.current = null;
    }
  };

  const iniciarPollSolicitudLogin = (requestId) => {
    detenerPollSolicitudLogin();
    pollSolicitudLoginRef.current = setInterval(async () => {
      try {
        const res = await axios.get(
          `${AUTH_URL}/solicitud-sesion/${requestId}/estado`,
        );
        if (res.data.estado === "aprobada") {
          detenerPollSolicitudLogin();
          setEsperandoOtraSesion(false);
          localStorage.setItem("userEmail", loginCredentials.email);
          login(
            res.data.token,
            res.data.role,
            res.data.permisos,
            res.data.nombre,
            res.data.apellido,
          );
        } else if (res.data.estado === "rechazada") {
          detenerPollSolicitudLogin();
          setEsperandoOtraSesion(false);
          setSolicitudSesionRechazada(true);
        } else if (res.data.estado === "expirada") {
          detenerPollSolicitudLogin();
          setEsperandoOtraSesion(false);
          setLoginError("La solicitud expiró. Intenta iniciar sesión de nuevo.");
        }
      } catch {
        // red transitoria: se reintenta en el siguiente ciclo
      }
    }, 2500);
  };

  const cancelarEsperaOtraSesion = () => {
    detenerPollSolicitudLogin();
    setEsperandoOtraSesion(false);
  };

  useEffect(() => {
    return () => detenerPollSolicitudLogin();
  }, []);

  // Chrome/Firefox restauran el <select> visualmente al valor elegido antes de
  // un F5, sin pasar por onChange: el DOM puede mostrar "5" mientras el estado
  // de React sigue en su valor inicial. Al montar, se toma como fuente de
  // verdad lo que el navegador realmente está mostrando.
  useEffect(() => {
    const domVal = Number(itemsPorPaginaSelectRef.current?.value);
    if (OPCIONES_TAMANO_PAGINA.includes(domVal) && domVal !== itemsPorPagina) {
      setItemsPorPagina(domVal);
    }
    const domValPersonal = Number(personPageSizeSelectRef.current?.value);
    if (
      OPCIONES_TAMANO_PAGINA.includes(domValPersonal) &&
      domValPersonal !== personPageSize
    ) {
      setPersonPageSize(domValPersonal);
    }
    const domValUsers = Number(userPageSizeSelectRef.current?.value);
    if (
      OPCIONES_TAMANO_PAGINA.includes(domValUsers) &&
      domValUsers !== userPageSize
    ) {
      setUserPageSize(domValUsers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const intervalId = setInterval(() => setReloj((r) => r + 1), 1000);
    return () => clearInterval(intervalId);
  }, [token]);

  const formatoUltimaSincronizacion = () => {
    if (!lastSyncAt) return "—";
    const segundos = Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000));
    if (segundos < 60) return `hace ${segundos} s`;
    const minutos = Math.round(segundos / 60);
    return `hace ${minutos} min`;
  };

  useEffect(() => {
    if (token) fetchEmployees();
  }, [token]);

  useEffect(() => {
    if (token && role === "admin") fetchUsers();
  }, [token, role]);

  useEffect(() => {
    if (token && role === "admin") fetchSesionesActivas();
  }, [token, role]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6 text-white font-sans relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(232,121,249,0.1),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)]" />
        <div className="w-full max-w-md bg-[#111827] p-8 rounded-2xl border border-fuchsia-500/10 shadow-[0_0_50px_-15px_rgba(232,121,249,0.1)] relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-fuchsia-500/20 p-4 rounded-full mb-4 shadow-[0_0_25px_-5px_rgba(232,121,249,0.25)]">
              {authView === "login" ? (
                <ShieldCheck size={40} className="text-fuchsia-400" />
              ) : (
                <KeyRound size={40} className="text-fuchsia-400" />
              )}
            </div>
            <h1 className="text-2xl font-display font-black tracking-widest [text-shadow:0_0_20px_rgba(232,121,249,0.22)]">
              ASSETTRACK{" "}
              <span className="text-fuchsia-400">PRO</span>
            </h1>
            {authView === "forgot" && (
              <p className="mt-2 text-xs text-slate-500 text-center">
                Recuperación de contraseña
              </p>
            )}
          </div>

          {authView === "login" && (
            <>
              {cuentaSuspendida ? (
                <div className="mb-6 text-center">
                  <p className="text-xl font-black text-red-400">
                    Tu cuenta fue suspendida
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Contacta a un administrador para más información
                  </p>
                </div>
              ) : sesionCerradaOtroDispositivo ? (
                <div className="mb-6 text-center">
                  <p className="text-xl font-black text-amber-400">
                    Tu sesión se cerró
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Se inició sesión con esta cuenta en otro dispositivo
                  </p>
                </div>
              ) : solicitudSesionRechazada ? (
                <div className="mb-6 text-center">
                  <p className="text-xl font-black text-red-400">
                    Inicio de sesión rechazado
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    El dispositivo con la sesión activa no autorizó el cambio
                  </p>
                </div>
              ) : (
                sesionExpirada && (
                  <div className="mb-6 text-center">
                    <p className="text-xl font-black text-amber-400">
                      Tu sesión se cerró por inactividad
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Vuelve a iniciar sesión para continuar
                    </p>
                  </div>
                )
              )}
            </>
          )}

          {authView === "login" ? (
            <>
              {esperandoOtraSesion ? (
                <div className="text-center space-y-4 py-2">
                  <div className="flex justify-center">
                    <div className="h-10 w-10 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
                  </div>
                  <p className="text-sm font-bold text-slate-200">
                    Esperando confirmación en el otro dispositivo...
                  </p>
                  <p className="text-xs text-slate-500 px-2">
                    Ya hay una sesión activa con esta cuenta. Confírmalo ahí
                    para continuar aquí.
                  </p>
                  <button
                    type="button"
                    onClick={cancelarEsperaOtraSesion}
                    className="text-xs text-slate-500 hover:text-slate-300 font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoginError("");
                  setSolicitudSesionRechazada(false);
                  setIsLoggingIn(true);
                  try {
                    const res = await axios.post(
                      `${AUTH_URL}/login`,
                      loginCredentials,
                    );
                    if (res.status === 202) {
                      setEsperandoOtraSesion(true);
                      iniciarPollSolicitudLogin(res.data.requestId);
                    } else {
                      localStorage.setItem("userEmail", loginCredentials.email);
                      login(
                        res.data.token,
                        res.data.role,
                        res.data.permisos,
                        res.data.nombre,
                        res.data.apellido,
                      );
                    }
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
                  value={loginCredentials.email}
                  onChange={(e) => {
                    setLoginError("");
                    limpiarSesionExpirada();
                    limpiarCuentaSuspendida();
                    limpiarSesionCerradaOtroDispositivo();
                    setSolicitudSesionRechazada(false);
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
                    value={loginCredentials.password}
                    onChange={(e) => {
                      setLoginError("");
                      limpiarSesionExpirada();
                      limpiarCuentaSuspendida();
                      limpiarSesionCerradaOtroDispositivo();
                      setSolicitudSesionRechazada(false);
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
                    {showLoginPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
                {loginError && !cuentaSuspendida && (
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
                <button
                  type="button"
                  onClick={() => {
                    setAuthView("forgot");
                    setLoginError("");
                  }}
                  className="w-full text-center text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold cursor-pointer transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
              )}
              <p className="text-center text-slate-500 text-xs mt-6">
                Acceso exclusivo para personal autorizado
              </p>
            </>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                className={`w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border transition-all text-sm ${
                  forgotError
                    ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                    : "border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
                }`}
                placeholder="Correo empresarial"
                value={forgotForm.email}
                onChange={(e) => {
                  setForgotError("");
                  setForgotForm({ ...forgotForm, email: e.target.value });
                }}
                required
              />
              <div className="relative">
                <input
                  type={showForgotPassword ? "text" : "password"}
                  className={`w-full p-4 pr-12 bg-[#1f2937] rounded-xl outline-none text-slate-200 border transition-all text-sm ${
                    forgotError
                      ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                      : "border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
                  }`}
                  placeholder="Nueva contraseña"
                  value={forgotForm.newPassword}
                  onChange={(e) => {
                    setForgotError("");
                    setForgotForm({
                      ...forgotForm,
                      newPassword: e.target.value,
                    });
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(!showForgotPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showForgotPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              <input
                type={showForgotPassword ? "text" : "password"}
                className={`w-full p-4 bg-[#1f2937] rounded-xl outline-none text-slate-200 border transition-all text-sm ${
                  forgotError
                    ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                    : "border-transparent focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
                }`}
                placeholder="Confirmar nueva contraseña"
                value={forgotForm.confirmPassword}
                onChange={(e) => {
                  setForgotError("");
                  setForgotForm({
                    ...forgotForm,
                    confirmPassword: e.target.value,
                  });
                }}
                required
              />
              <p className="text-[10px] text-slate-500 -mt-1 px-1">
                Mínimo 8 caracteres, una mayúscula y un número.
              </p>
              {forgotError && (
                <p className="text-red-400 text-sm text-center -mt-1">
                  {forgotError}
                </p>
              )}
              {forgotSuccess && (
                <p className="text-emerald-400 text-sm text-center -mt-1">
                  {forgotSuccess}
                </p>
              )}
              <button
                type="submit"
                disabled={isSendingForgot}
                className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 p-4 rounded-xl font-bold uppercase text-sm cursor-pointer hover:from-fuchsia-400 hover:to-purple-500 transition-all shadow-[0_0_25px_-8px_rgba(232,121,249,0.28)] hover:shadow-[0_0_35px_-6px_rgba(232,121,249,0.32)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSendingForgot ? "Actualizando..." : "Restablecer contraseña"}
              </button>
              <button
                type="button"
                onClick={volverALogin}
                className="w-full flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 hover:text-slate-300 font-semibold cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} />
                Volver a iniciar sesión
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans relative">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(232,121,249,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(232,121,249,0.14)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        dialog={confirmDialog}
        onCancel={() => {
          confirmDialog?.onCancel?.();
          setConfirmDialog(null);
        }}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
      />
      {/* CAJETÍN DE TÍTULO (identidad "plano técnico / manifiesto") */}
      <header className="max-w-[1800px] mx-auto px-6 pt-6">
        <div className="grid md:grid-cols-[auto_1fr_auto] border border-fuchsia-400/25 bg-[#111827] divide-y md:divide-y-0 md:divide-x divide-dashed divide-fuchsia-400/20">
          <div className="flex items-center gap-3 px-5 py-4">
            <Crosshair className="text-fuchsia-400" size={30} strokeWidth={1.5} />
            <div>
              <div className="font-display font-black text-sm tracking-widest uppercase">
                Asset<span className="text-fuchsia-400">Track</span>
              </div>
              <div className="font-mono-data text-[9px] text-slate-500 tracking-wider">
                REGISTRO DE EQUIPO · REV. 04
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3">
            <div className="px-5 py-3 border-r border-dashed border-fuchsia-400/15 flex flex-col justify-center">
              <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Estado del sistema
              </div>
              <div className="font-mono-data text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.18)]" />
                Operativo
              </div>
            </div>
            {role === "admin" ? (
              <button
                type="button"
                onClick={() => setCurrentView("sesiones")}
                className="px-5 py-3 flex flex-col justify-center text-left cursor-pointer hover:bg-white/[0.02] transition-colors border-r border-dashed border-fuchsia-400/15"
              >
                <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Sesiones activas
                </div>
                <div className="font-mono-data text-sm font-semibold text-emerald-400">
                  {sesionesActivas.length.toString().padStart(2, "0")} dispositivos →
                </div>
              </button>
            ) : (
              <div className="px-5 py-3 flex flex-col justify-center border-r border-dashed border-fuchsia-400/15">
                <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Rol
                </div>
                <div className="font-mono-data text-sm font-semibold text-fuchsia-400 uppercase">
                  {role}
                </div>
              </div>
            )}
            <div className="hidden sm:flex px-5 py-3 flex-col justify-center">
              <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Última sincronización
              </div>
              <div className="font-mono-data text-sm font-semibold">
                {formatoUltimaSincronizacion()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3">
            <div className="w-9 h-9 border border-fuchsia-400/25 flex items-center justify-center font-mono-data text-[11px] font-bold text-fuchsia-400 shrink-0">
              {`${userNombre?.[0] || ""}${userApellido?.[0] || ""}`.toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold capitalize whitespace-nowrap">
                {userNombre} {userApellido}
              </div>
              <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-fuchsia-400">
                {role}
              </div>
            </div>
            <button
              onClick={logout}
              title="Salir"
              className="ml-2 w-9 h-9 flex items-center justify-center border border-fuchsia-400/20 text-slate-400 hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* NAVEGACIÓN GLOBAL */}
      <div className="max-w-[1800px] mx-auto px-6 mt-0 flex gap-0 overflow-x-auto border border-t-0 border-fuchsia-400/25">
        <button
          onClick={() => setCurrentView("inventario")}
          className={`px-5 py-2.5 font-mono-data font-bold text-[11px] uppercase tracking-wider border-r border-dashed border-fuchsia-400/15 cursor-pointer whitespace-nowrap ${currentView === "inventario" ? "bg-fuchsia-500 text-white" : "bg-[#111827] text-slate-400 hover:text-white"}`}
        >
          Inventario
        </button>
        {role === "admin" && (
          <>
            <button
              onClick={() => setCurrentView("personal")}
              className={`px-5 py-2.5 font-mono-data font-bold text-[11px] uppercase tracking-wider border-r border-dashed border-fuchsia-400/15 cursor-pointer whitespace-nowrap ${currentView === "personal" ? "bg-fuchsia-500 text-white" : "bg-[#111827] text-slate-400 hover:text-white"}`}
            >
              Personal <span className="opacity-75">{employeesDirectory.length}</span>
            </button>
            <button
              onClick={() => setCurrentView("sesiones")}
              className={`px-5 py-2.5 font-mono-data font-bold text-[11px] uppercase tracking-wider border-r border-dashed border-fuchsia-400/15 cursor-pointer whitespace-nowrap ${currentView === "sesiones" ? "bg-fuchsia-500 text-white" : "bg-[#111827] text-slate-400 hover:text-white"}`}
            >
              Sesiones <span className="opacity-75">{sesionesActivas.length.toString().padStart(2, "0")}</span>
            </button>
            <button
              onClick={() => setCurrentView("usuarios")}
              className={`px-5 py-2.5 font-mono-data font-bold text-[11px] uppercase tracking-wider border-r border-dashed border-fuchsia-400/15 cursor-pointer whitespace-nowrap ${currentView === "usuarios" ? "bg-fuchsia-500 text-white" : "bg-[#111827] text-slate-400 hover:text-white"}`}
            >
              Usuarios
            </button>
            <button
              onClick={() => setCurrentView("configuraciones")}
              className={`px-5 py-2.5 font-mono-data font-bold text-[11px] uppercase tracking-wider cursor-pointer whitespace-nowrap ${currentView === "configuraciones" ? "bg-fuchsia-500 text-white" : "bg-[#111827] text-slate-400 hover:text-white"}`}
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
          <div className="max-w-[1800px] mx-auto px-6 pt-4">
            <DashboardGrid actualizarMetricas={actualizarMetricas} />
          </div>
          <main className="max-w-[1800px] mx-auto p-6 grid lg:grid-cols-12 gap-9">
            <section
              className={`${tienePermiso("escritura") ? "lg:col-span-9" : "lg:col-span-12"} relative bg-[#111827] border border-fuchsia-400/25 overflow-hidden`}
            >
              <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-fuchsia-400 pointer-events-none z-10" />
              <span className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-fuchsia-400 pointer-events-none z-10" />
              <div className="px-6 py-4 border-b border-dashed border-fuchsia-400/20 flex justify-between items-center bg-white/[0.01]">
                <h2 className="font-mono-data text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1 h-3.5 bg-fuchsia-400 inline-block" />
                  Manifiesto de inventario
                </h2>
                <div className="flex items-center gap-4">
                  <span className="font-mono-data text-fuchsia-400 text-xs font-bold">
                    {filteredAssets.length} registros
                  </span>
                  {role === "admin" && (
                    <>
                      <div className="w-px h-6 bg-fuchsia-400/15" />
                      <button
                        onClick={handleDeleteAllAssets}
                        className="flex items-center gap-2 bg-transparent hover:bg-red-600/10 border border-red-500/30 text-red-400/80 hover:text-red-400 px-3 py-1.5 font-mono-data text-[11px] font-bold uppercase tracking-wider transition-colors"
                      >
                        <Trash2 size={14} />
                        Eliminar todos
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* FILTROS ORIGINALES */}
              <div className="p-4 bg-[#0a0f1a] border-b border-dashed border-fuchsia-400/20 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="BUSCAR S/N · MARCA · MODELO"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#111827] font-mono-data outline-none text-xs text-slate-200 border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-4 pr-10 py-2.5 bg-[#111827] outline-none text-xs text-slate-300 border border-fuchsia-400/20 focus:border-fuchsia-400 cursor-pointer appearance-none transition-colors"
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
                    className="w-full pl-4 pr-10 py-2.5 bg-[#111827] outline-none text-xs text-slate-300 border border-fuchsia-400/20 focus:border-fuchsia-400 cursor-pointer appearance-none transition-colors"
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
                  <thead className="text-slate-500 text-[9px] font-mono-data font-bold uppercase tracking-[0.15em] border-b border-fuchsia-400/20">
                    <tr>
                      <th className="px-6 py-3 text-left">Equipo</th>
                      <th className="px-6 py-3 text-left">Tipo</th>
                      <th className="px-6 py-3 text-left">Serial</th>
                      <th className="px-6 py-3 text-left whitespace-nowrap">
                        Titular
                      </th>
                      <th className="px-6 py-3 text-left">Área</th>
                      <th className="px-6 py-3 text-right whitespace-nowrap">
                        Estado
                      </th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-fuchsia-400/10">
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
                            <div className="h-7 w-24 bg-white/10 rounded-xl ml-auto" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-6 w-14 bg-white/10 rounded-xl ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16">
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
                      paginatedAssets.map((a) => (
                      <tr
                        key={a._id}
                        className="hover:bg-white/[0.03] transition text-xs"
                      >
                        <td className="px-6 py-3.5">
                          <div className="text-white font-bold capitalize">
                            {a.brand}
                          </div>
                          <div className="text-[10.5px] text-slate-500 uppercase">
                            {a.model}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="border border-fuchsia-400/20 text-slate-300 px-2.5 py-1 font-mono-data text-[9.5px] font-bold uppercase tracking-wider">
                            {a.type === "Otro" && a.typeOther
                              ? a.typeOther
                              : a.type || "Sin definir"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-2 font-mono-data text-[11px] text-fuchsia-300">
                            <span
                              className="inline-block w-4 h-3 opacity-70"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(90deg, currentColor 0 1.5px, transparent 1.5px 3.5px)",
                              }}
                            />
                            {a.serialNumber}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-300 capitalize font-mono-data">
                          {(a.status || "En Stock") === "En Stock" ? (
                            <span className="text-slate-600 italic font-sans">
                              Sin Asignar
                            </span>
                          ) : (
                            a.assignedTo || "N/A"
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-slate-300 uppercase max-w-[160px]">
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
                        <td className="px-6 py-3.5 text-right">
                          <div className="relative inline-block">
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
                              className={`pl-8 pr-3 py-1.5 font-mono-data text-[10.5px] font-bold border outline-none cursor-pointer ${(a.status || "En Stock") === "En Stock" ? "bg-blue-600/10 text-blue-400 border-blue-500/30" : (a.status || "En Stock") === "Asignado" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-orange-600/10 text-orange-400 border-orange-500/30"}`}
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
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {tienePermiso("modificacion") && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              <button
                                onClick={() => startEdit(a)}
                                className="text-slate-500 p-1.5 hover:text-white transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => deleteAsset(a._id)}
                                className="text-slate-500 p-1.5 hover:text-red-400 transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-dashed border-fuchsia-400/20 flex flex-wrap items-center justify-between gap-3 font-mono-data text-[11px]">
                <div className="flex items-center gap-3 text-slate-500">
                  <span>
                    MOSTRANDO {String(filteredAssets.length === 0 ? 0 : (paginaSegura - 1) * itemsPorPagina + 1).padStart(3, "0")}–
                    {String(Math.min(paginaSegura * itemsPorPagina, filteredAssets.length)).padStart(3, "0")} DE {filteredAssets.length}
                  </span>
                  <span className="flex items-center gap-2">
                    MOSTRAR
                    <select
                      ref={itemsPorPaginaSelectRef}
                      value={itemsPorPagina}
                      autoComplete="off"
                      onChange={(e) => {
                        setItemsPorPagina(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-[#0a0f1a] border border-fuchsia-400/20 text-slate-300 px-2 py-1 outline-none cursor-pointer focus:border-fuchsia-400 transition-colors"
                    >
                      {OPCIONES_TAMANO_PAGINA.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">
                    PÁGINA {String(paginaSegura).padStart(2, "0")} / {String(totalPaginas).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    disabled={paginaSegura === 1}
                    onClick={() => setCurrentPage(paginaSegura - 1)}
                    className="px-3 py-1.5 border border-fuchsia-400/20 text-slate-300 font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 transition-colors cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={paginaSegura === totalPaginas}
                    onClick={() => setCurrentPage(paginaSegura + 1)}
                    className="px-3 py-1.5 border border-fuchsia-400/20 text-slate-300 font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 transition-colors cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>

            {tienePermiso("escritura") && (
              /* --- ESTE ES EL PANEL LATERAL CON LA MEJORA VISUAL EXACTA --- */
              <aside className="lg:col-span-3">
                <div className="relative bg-[#111827] p-5 border border-fuchsia-400/25 sticky top-28 space-y-6">
                  <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-fuchsia-400 pointer-events-none" />
                  <span className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-fuchsia-400 pointer-events-none" />
                  {/* SELECTOR DE MODO */}
                  <div className="grid grid-cols-2 gap-1 bg-[#0a0f1a] p-1 border border-fuchsia-400/15 text-[9px] font-mono-data font-bold text-center uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setRegisterMode("manual")}
                      className={`py-2 cursor-pointer transition-all ${registerMode === "manual" ? "bg-fuchsia-500 text-white" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMode("bulk-assets")}
                      className={`py-2 cursor-pointer transition-all ${registerMode === "bulk-assets" ? "bg-fuchsia-500 text-white" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      + Activos
                    </button>
                  </div>

                  {/* ÁREA DE CONTENIDO DINÁMICO */}
                  <div className="min-h-[300px]">
                    {registerMode === "manual" ? (
                      /* TU FORMULARIO ORIGINAL INTACTO */
                      <form onSubmit={handleSubmit} className="space-y-3">
                        <h2 className="font-mono-data text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
                          <span className="w-1 h-3.5 bg-fuchsia-400 inline-block" />
                          {isEditing ? "Editar Activo" : "Alta Rápida"}
                        </h2>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                            S/N
                          </label>
                          <input
                            className={`w-full p-3.5 bg-[#1f2937] outline-none text-white border transition-all uppercase text-sm placeholder-slate-500 ${
                              isDuplicateSerial
                                ? "border-red-500/60 focus:border-red-500"
                                : "border-fuchsia-400/20 focus:border-fuchsia-400"
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
                            className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-all capitalize text-sm placeholder-slate-500"
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
                            className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-all uppercase text-sm placeholder-slate-500"
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
                            className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-all text-sm placeholder-slate-500"
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
                          <div className="space-y-1.5 p-3 bg-[#0a0f1a] border border-fuchsia-400/10">
                            <label className="text-[9px] text-emerald-400 uppercase font-black tracking-wider block">
                              Asignar desde Nómina
                            </label>
                            <select
                              value={
                                employeesDirectory?.find(
                                  (em) => em.fullName === form.assignedTo,
                                )?.id || ""
                              }
                              className="w-full p-3.5 bg-[#1f2937] outline-none text-slate-200 border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors text-sm cursor-pointer"
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
                                className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-all capitalize text-sm placeholder-slate-500"
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
                                className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-all uppercase text-sm placeholder-slate-500"
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
                          className="w-full p-3.5 font-bold text-white text-sm uppercase bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 transition-all shadow-[0_0_20px_-8px_rgba(232,121,249,0.28)] hover:shadow-[0_0_28px_-6px_rgba(232,121,249,0.32)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
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
                    ) : (
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
                            Sube tu archivo .CSV de activos con una primera
                            fila de encabezado y columnas en este orden:
                            S/N, Marca, Modelo, Tipo, Nombre, Área.
                          </p>
                        </div>
                        <label className="w-full py-3.5 bg-[#1f2937] hover:bg-[#2d3748] border border-fuchsia-400/20 cursor-pointer text-sm font-bold text-slate-300 transition-all">
                          Seleccionar Archivo
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleBulkUploadAssets}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </main>
        </>
      )}

      {/* SECCIÓN OPERADORES ORIGINAL INTACTA */}
      {/* SECCIÓN OPERADORES (RESTAURADA EXACTAMENTE AL DISEÑO ORIGINAL) */}
      {currentView === "usuarios" &&
        (() => {
          const listaUsuarios = [
            {
              _id: "self",
              nombre: userNombre,
              apellido: userApellido,
              email: userEmail,
              role,
              permisos: { lectura: true, escritura: true, modificacion: true },
              activo: true,
              esActual: true,
            },
            ...registeredUsers.map((u) => ({ ...u, esActual: false })),
          ];

          const usuariosFiltrados = listaUsuarios.filter((u) => {
            const coincideTexto = `${u.nombre} ${u.apellido} ${u.email}`
              .toLowerCase()
              .includes(userSearch.toLowerCase());
            const coincideRol =
              userRoleFilter === "todos" || u.role === userRoleFilter;
            return coincideTexto && coincideRol;
          });

          const totalPaginasUsuarios = Math.max(
            1,
            Math.ceil(usuariosFiltrados.length / userPageSize),
          );
          const userPageSegura = Math.min(userPage, totalPaginasUsuarios);
          const usuariosPaginados = usuariosFiltrados.slice(
            (userPageSegura - 1) * userPageSize,
            userPageSegura * userPageSize,
          );

          return (
            <main className="max-w-[1800px] mx-auto p-6">
              <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
                {/* LISTA DE CUENTAS */}
                <div className="relative bg-[#111827] border border-fuchsia-400/25">
                  <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-fuchsia-400 pointer-events-none" />
                  <span className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-fuchsia-400 pointer-events-none" />

                  <div className="flex items-center justify-between p-4 border-b border-dashed border-fuchsia-400/20">
                    <h2 className="font-mono-data text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1 h-3.5 bg-fuchsia-400 inline-block" />
                      Cuentas del sistema
                    </h2>
                    <span className="font-mono-data text-[10px] text-slate-500">
                      {String(usuariosFiltrados.length).padStart(2, "0")}{" "}
                      registros
                    </span>
                  </div>

                  <div className="flex gap-2 p-3 border-b border-dashed border-fuchsia-400/20">
                    <div className="flex-1 flex items-center gap-2 bg-[#0a0f1a] border border-fuchsia-400/20 px-3">
                      <Search size={13} className="text-slate-500 shrink-0" />
                      <input
                        className="w-full bg-transparent outline-none text-slate-200 font-mono-data text-xs py-2.5 placeholder-slate-500"
                        placeholder="BUSCAR NOMBRE O CORREO"
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          setUserPage(1);
                        }}
                      />
                    </div>
                    <select
                      className="bg-[#0a0f1a] border border-fuchsia-400/20 text-slate-300 px-2 text-xs outline-none cursor-pointer focus:border-fuchsia-400 transition-colors"
                      value={userRoleFilter}
                      onChange={(e) => {
                        setUserRoleFilter(e.target.value);
                        setUserPage(1);
                      }}
                    >
                      <option value="todos">Todos los roles</option>
                      <option value="admin">Admin</option>
                      <option value="tecnico">Técnico</option>
                      <option value="coordinador">Coordinador</option>
                    </select>
                  </div>

                  <div className="divide-y divide-dashed divide-fuchsia-400/10">
                    {usuariosPaginados.map((u) => {
                      const rs = ROLE_STYLES[u.role] || {
                        label: u.role || "Técnico",
                        pill: "text-slate-300 border-slate-400/40 bg-slate-400/10",
                        dot: "bg-slate-400",
                      };
                      return (
                        <div
                          key={u._id}
                          className="grid grid-cols-[32px_1fr_204px_98px_60px] items-center gap-3 px-4 py-3"
                        >
                          <div className="w-8 h-8 border border-fuchsia-400/20 flex items-center justify-center font-mono-data text-[10px] font-bold text-cyan-300 shrink-0">
                            {(u.nombre?.[0] || "") + (u.apellido?.[0] || "")}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold capitalize truncate">
                              {u.nombre} {u.apellido}
                            </div>
                            <div className="font-mono-data text-[10px] text-slate-500 truncate">
                              {u.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              title={rs.label}
                              className={`inline-flex items-center gap-1.5 font-mono-data text-[9px] font-bold uppercase tracking-widest px-2 py-1 border max-w-[104px] shrink-0 ${rs.pill}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${rs.dot}`}
                              />
                              <span className="truncate">{rs.label}</span>
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <span
                                title="Lectura"
                                className={`w-5 h-5 flex items-center justify-center border font-mono-data text-[9px] ${
                                  u.permisos?.lectura
                                    ? "border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-300 font-bold"
                                    : "border-white/10 text-slate-600"
                                }`}
                              >
                                L
                              </span>
                              <span
                                title="Escritura"
                                className={`w-5 h-5 flex items-center justify-center border font-mono-data text-[9px] ${
                                  u.permisos?.escritura
                                    ? "border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-300 font-bold"
                                    : "border-white/10 text-slate-600"
                                }`}
                              >
                                E
                              </span>
                              <span
                                title="Modificación"
                                className={`w-5 h-5 flex items-center justify-center border font-mono-data text-[9px] ${
                                  u.permisos?.modificacion
                                    ? "border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-300 font-bold"
                                    : "border-white/10 text-slate-600"
                                }`}
                              >
                                M
                              </span>
                            </div>
                          </div>
                          {u.esActual ? (
                            <span className="flex items-center gap-1.5 font-mono-data text-[9px] font-bold uppercase text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Activo
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                toggleUserStatus(u._id, u.nombre, u.activo)
                              }
                              className={`flex items-center gap-1.5 font-mono-data text-[9px] font-bold uppercase transition-colors cursor-pointer ${
                                u.activo
                                  ? "text-emerald-400 hover:text-red-400"
                                  : "text-slate-500 hover:text-emerald-400"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-emerald-400" : "bg-slate-500"}`}
                              />
                              {u.activo ? "Activo" : "Suspendido"}
                            </button>
                          )}
                          {u.esActual ? (
                            <span className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-600 text-right">
                              Tú
                            </span>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => startEditUser(u)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-fuchsia-400 transition-colors cursor-pointer"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => deleteUser(u._id)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {usuariosPaginados.length === 0 && (
                      <p className="text-center font-mono-data text-[10px] text-slate-600 py-10">
                        Ningún operador coincide con la búsqueda.
                      </p>
                    )}
                  </div>

                  <div className="p-4 border-t border-dashed border-fuchsia-400/20 flex flex-wrap items-center justify-between gap-3 font-mono-data text-[11px]">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>
                        MOSTRANDO{" "}
                        {String(
                          usuariosFiltrados.length === 0
                            ? 0
                            : (userPageSegura - 1) * userPageSize + 1,
                        ).padStart(3, "0")}
                        –
                        {String(
                          Math.min(
                            userPageSegura * userPageSize,
                            usuariosFiltrados.length,
                          ),
                        ).padStart(3, "0")}{" "}
                        DE {usuariosFiltrados.length}
                      </span>
                      <span className="flex items-center gap-2">
                        MOSTRAR
                        <select
                          ref={userPageSizeSelectRef}
                          value={userPageSize}
                          autoComplete="off"
                          onChange={(e) => {
                            setUserPageSize(Number(e.target.value));
                            setUserPage(1);
                          }}
                          className="bg-[#0a0f1a] border border-fuchsia-400/20 text-slate-300 px-2 py-1 outline-none cursor-pointer focus:border-fuchsia-400 transition-colors"
                        >
                          {OPCIONES_TAMANO_PAGINA.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        PÁGINA {String(userPageSegura).padStart(2, "0")} /{" "}
                        {String(totalPaginasUsuarios).padStart(2, "0")}
                      </span>
                      <button
                        type="button"
                        disabled={userPageSegura === 1}
                        onClick={() => setUserPage(userPageSegura - 1)}
                        className="px-3 py-1.5 border border-fuchsia-400/20 text-slate-300 font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 transition-colors cursor-pointer"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={userPageSegura === totalPaginasUsuarios}
                        onClick={() => setUserPage(userPageSegura + 1)}
                        className="px-3 py-1.5 border border-fuchsia-400/20 text-slate-300 font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 transition-colors cursor-pointer"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>

                {/* NUEVA CUENTA / EDITAR */}
                <div className="relative bg-[#111827] p-5 border border-fuchsia-400/25 sticky top-28 space-y-4">
                  <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-fuchsia-400 pointer-events-none" />
                  <span className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-fuchsia-400 pointer-events-none" />

                  <h2 className="font-mono-data text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-fuchsia-400 inline-block" />
                    {isEditingUser ? "Editar Usuario" : "Nueva Cuenta"}
                  </h2>

                  <form onSubmit={handleUserSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                        Nombre(s)
                      </label>
                      <input
                        type="text"
                        className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors text-sm placeholder-slate-500"
                        placeholder="Nombre(s)"
                        value={userForm.nombre}
                        onChange={(e) =>
                          setUserForm({ ...userForm, nombre: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                        Apellido(s)
                      </label>
                      <input
                        type="text"
                        className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors text-sm placeholder-slate-500"
                        placeholder="Apellido(s)"
                        value={userForm.apellido}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            apellido: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                        Correo
                      </label>
                      <input
                        type="email"
                        className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors text-sm placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="juan.perez@empresa.com"
                        value={userForm.email}
                        onChange={(e) =>
                          setUserForm({ ...userForm, email: e.target.value })
                        }
                        disabled={isEditingUser}
                        required
                      />
                      {isEditingUser && (
                        <p className="text-[9px] text-slate-500 px-1">
                          El correo no se puede modificar desde aquí.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                        Contraseña temporal
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          className="w-full p-3.5 pr-11 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors text-sm placeholder-slate-500"
                          placeholder={
                            isEditingUser
                              ? "Dejar en blanco para no cambiarla"
                              : "Contraseña temporal"
                          }
                          value={userForm.password}
                          onChange={(e) =>
                            setUserForm({
                              ...userForm,
                              password: e.target.value,
                            })
                          }
                          required={!isEditingUser}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                        </button>
                      </div>
                      <p className="font-mono-data text-[9px] text-slate-500 flex items-center gap-1.5 px-1">
                        <ShieldCheck size={11} />
                        Mínimo 8 dígitos, 1 Mayúscula y 1 Número.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block px-1">
                        Rol
                      </label>
                      <input
                        type="text"
                        className="w-full p-3.5 bg-[#1f2937] outline-none text-white border border-fuchsia-400/20 focus:border-fuchsia-400 transition-colors text-sm placeholder-slate-500"
                        placeholder="Técnico"
                        value={userForm.role}
                        onChange={(e) =>
                          setUserForm({ ...userForm, role: e.target.value })
                        }
                        required
                      />
                      <p className="text-[9px] text-slate-500 px-1">
                        Por defecto: Técnico. Escribe el rol exacto (Admin, Coordinador, etc.).
                      </p>
                    </div>

                    <div className="pt-1">
                      <h3 className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
                        Matriz de Permisos
                      </h3>
                      <div className="border border-fuchsia-400/20 bg-[#0a0f1a]">
                        {[
                          {
                            key: "lectura",
                            label: "Lectura",
                            desc: "Ver inventario y personal",
                          },
                          {
                            key: "escritura",
                            label: "Escritura",
                            desc: "Alta de activos y personal",
                          },
                          {
                            key: "modificacion",
                            label: "Modificación",
                            desc: "Editar y eliminar registros",
                          },
                        ].map((perm, i) => {
                          const activo = userForm.permisos?.[perm.key] || false;
                          return (
                            <div
                              key={perm.key}
                              className={`flex items-center justify-between p-3 ${
                                i < 2
                                  ? "border-b border-dashed border-fuchsia-400/10"
                                  : ""
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-200">
                                  {perm.label}
                                </div>
                                <div className="font-mono-data text-[9px] text-slate-500">
                                  {perm.desc}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setUserForm({
                                    ...userForm,
                                    permisos: {
                                      ...userForm.permisos,
                                      [perm.key]: !activo,
                                    },
                                  })
                                }
                                className={`relative w-9 h-5 border transition-colors shrink-0 cursor-pointer ${
                                  activo
                                    ? "border-fuchsia-400 bg-fuchsia-400/10"
                                    : "border-white/15 bg-[#20233a]"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 transition-transform ${
                                    activo
                                      ? "translate-x-4 bg-fuchsia-400"
                                      : "bg-slate-500"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full p-3.5 font-bold text-white text-sm uppercase bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 transition-all shadow-[0_0_20px_-8px_rgba(232,121,249,0.28)] hover:shadow-[0_0_28px_-6px_rgba(232,121,249,0.32)] cursor-pointer"
                    >
                      {isEditingUser ? "Guardar Cambios" : "Registrar Cuenta"}
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
              </div>
            </main>
          );
        })()}
      {/* ========================================================================= */}
      {/* 👥 DIRECTORIO DE PERSONAL — CRUD individual (solo admin) */}
      {/* ========================================================================= */}
      {currentView === "personal" && role === "admin" && (() => {
        const personasFiltradas = employeesDirectory.filter((p) =>
          `${p.fullName} ${p.area}`
            .toLowerCase()
            .includes(personSearch.toLowerCase()),
        );
        const totalPaginasPersonal = Math.max(
          1,
          Math.ceil(personasFiltradas.length / personPageSize),
        );
        const personaPageSegura = Math.min(personPage, totalPaginasPersonal);
        const personasPaginadas = personasFiltradas.slice(
          (personaPageSegura - 1) * personPageSize,
          personaPageSegura * personPageSize,
        );

        return (
          <main className="max-w-[1800px] mx-auto p-6">
            <div className="relative border border-fuchsia-400/25 bg-[#111827]">
              <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-fuchsia-400 pointer-events-none" />
              <span className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-fuchsia-400 pointer-events-none" />

              <div className="flex items-center justify-between px-5 py-3 border-b border-dashed border-fuchsia-400/20">
                <h2 className="font-mono-data text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1 h-3.5 bg-fuchsia-400 inline-block" />
                  Directorio de personal
                </h2>
                <div className="flex items-center gap-4">
                  <span className="font-mono-data text-[10px] text-slate-500">
                    {personasFiltradas.length} registros
                  </span>
                  {employeesDirectory.length > 0 && (
                    <>
                      <div className="w-px h-6 bg-fuchsia-400/15" />
                      <button
                        onClick={handleDeleteAllEmployees}
                        className="flex items-center gap-2 bg-transparent hover:bg-red-600/10 border border-red-500/30 text-red-400/80 hover:text-red-400 px-3 py-1.5 font-mono-data text-[11px] font-bold uppercase tracking-wider transition-colors"
                      >
                        <Trash2 size={14} />
                        Eliminar todos
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-dashed border-fuchsia-400/20">
                <input
                  className="flex-1 min-w-[200px] p-2 bg-[#0a0f1a] border border-fuchsia-400/20 outline-none font-mono-data text-xs focus:border-fuchsia-400 transition-colors"
                  placeholder="Buscar colaborador o área…"
                  value={personSearch}
                  onChange={(e) => {
                    setPersonSearch(e.target.value);
                    setPersonPage(1);
                  }}
                />
                <input
                  type="file"
                  accept=".csv"
                  ref={personFileInputRef}
                  onChange={handleBulkUploadEmployees}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => personFileInputRef.current?.click()}
                  className="px-4 py-2 border border-fuchsia-400/20 text-slate-300 hover:text-white hover:border-fuchsia-400 font-mono-data text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-colors"
                >
                  Cargar CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mostrarFormPersona) {
                      cancelEditPerson();
                    } else {
                      setMostrarFormPersona(true);
                    }
                  }}
                  className="px-4 py-2 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-mono-data text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-colors"
                >
                  {mostrarFormPersona ? "Cancelar" : "+ Agregar"}
                </button>
              </div>

              {mostrarFormPersona && (
                <form
                  onSubmit={handlePersonSubmit}
                  className="p-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end border-b border-dashed border-fuchsia-400/20 bg-white/[0.01]"
                >
                  <div>
                    <label className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      className="w-full p-2.5 bg-[#0a0f1a] border border-fuchsia-400/20 outline-none font-mono-data text-sm focus:border-fuchsia-400 transition-colors"
                      placeholder="Juan Pérez"
                      value={personForm.fullName}
                      onChange={(e) =>
                        setPersonForm({ ...personForm, fullName: e.target.value })
                      }
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                      Área
                    </label>
                    <input
                      className="w-full p-2.5 bg-[#0a0f1a] border border-fuchsia-400/20 outline-none font-mono-data text-sm focus:border-fuchsia-400 transition-colors"
                      placeholder="TI"
                      value={personForm.area}
                      onChange={(e) =>
                        setPersonForm({ ...personForm, area: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-mono-data text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors"
                  >
                    {isEditingPerson ? "Guardar" : "Agregar"}
                  </button>
                </form>
              )}

              <div className="divide-y divide-dashed divide-fuchsia-400/10">
                {personasPaginadas.map((persona) => (
                  <div
                    key={persona.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-8 h-8 border border-fuchsia-400/20 flex items-center justify-center font-mono-data text-[10px] font-bold text-fuchsia-400 shrink-0">
                      {persona.fullName
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 text-sm font-semibold">
                      {persona.fullName}
                    </div>
                    <div className="font-mono-data text-[10px] text-slate-400 border border-white/10 px-2 py-0.5 uppercase">
                      {persona.area || "General"}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditPerson(persona)}
                        className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deletePerson(persona)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {personasFiltradas.length === 0 && (
                  <div className="px-5 py-10 text-center font-mono-data text-xs text-slate-500">
                    Sin colaboradores registrados todavía.
                  </div>
                )}
              </div>

              {personasFiltradas.length > 0 && (
                <div className="p-4 border-t border-dashed border-fuchsia-400/20 flex flex-wrap items-center justify-between gap-3 font-mono-data text-[11px]">
                  <div className="flex items-center gap-3 text-slate-500">
                    <span>
                      MOSTRANDO {String((personaPageSegura - 1) * personPageSize + 1).padStart(3, "0")}–
                      {String(Math.min(personaPageSegura * personPageSize, personasFiltradas.length)).padStart(3, "0")} DE {personasFiltradas.length}
                    </span>
                    <span className="flex items-center gap-2">
                      MOSTRAR
                      <select
                        ref={personPageSizeSelectRef}
                        value={personPageSize}
                        autoComplete="off"
                        onChange={(e) => {
                          setPersonPageSize(Number(e.target.value));
                          setPersonPage(1);
                        }}
                        className="bg-[#0a0f1a] border border-fuchsia-400/20 text-slate-300 px-2 py-1 outline-none cursor-pointer focus:border-fuchsia-400 transition-colors"
                      >
                        {OPCIONES_TAMANO_PAGINA.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">
                      PÁGINA {String(personaPageSegura).padStart(2, "0")} / {String(totalPaginasPersonal).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      disabled={personaPageSegura === 1}
                      onClick={() => setPersonPage(personaPageSegura - 1)}
                      className="px-3 py-1.5 border border-fuchsia-400/20 text-slate-300 font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 transition-colors cursor-pointer"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={personaPageSegura === totalPaginasPersonal}
                      onClick={() => setPersonPage(personaPageSegura + 1)}
                      className="px-3 py-1.5 border border-fuchsia-400/20 text-slate-300 font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 transition-colors cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        );
      })()}

      {/* ========================================================================= */}
      {/* 🔐 SESIONES ACTIVAS (solo admin) */}
      {/* ========================================================================= */}
      {currentView === "sesiones" && role === "admin" && (
        <main className="max-w-[1800px] mx-auto p-6">
          <div className="border border-fuchsia-400/25 bg-[#111827]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-dashed border-fuchsia-400/20">
              <h2 className="font-mono-data text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-3.5 bg-fuchsia-400 inline-block" />
                Sesiones activas
              </h2>
              <span className="font-mono-data text-[10px] text-slate-500">
                Cierra la sesión de alguien más si hace falta
              </span>
            </div>
            <div className="divide-y divide-dashed divide-fuchsia-400/10">
              {sesionesActivas.map((sesion) => (
                <div
                  key={sesion.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${sesion.activa ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.18)]" : "bg-slate-600"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold capitalize truncate">
                      {sesion.nombre} {sesion.apellido}{" "}
                      <span className="text-slate-500 font-normal">
                        — {sesion.role}
                      </span>
                    </div>
                    <div className="font-mono-data text-[10px] text-slate-500 mt-0.5">
                      {sesion.esEsteUsuario
                        ? "Este dispositivo · activa ahora"
                        : sesion.activa
                          ? "Activa ahora"
                          : "Sin actividad reciente"}
                    </div>
                  </div>
                  {sesion.esEsteUsuario ? (
                    <span className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3 py-1.5 border border-white/10">
                      Tú
                    </span>
                  ) : (
                    <button
                      onClick={() => cerrarSesionAjena(sesion)}
                      className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-400 hover:border-red-400/40 px-3 py-1.5 border border-fuchsia-400/20 transition-colors cursor-pointer"
                    >
                      Cerrar sesión
                    </button>
                  )}
                </div>
              ))}
              {sesionesActivas.length === 0 && (
                <div className="px-5 py-10 text-center font-mono-data text-xs text-slate-500">
                  No hay sesiones activas en este momento.
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* CONFIGURACIONES ORIGINAL INTACTA */}
      {currentView === "configuraciones" && (
        <main className="max-w-[1800px] mx-auto p-6">
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

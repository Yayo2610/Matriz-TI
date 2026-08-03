import { createContext, useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

export const AuthContext = createContext();

const permisosPorDefecto = { lectura: false, escritura: false, modificacion: false };
const LIMITE_INACTIVIDAD_MS = 10 * 60 * 1000; // 10 minutos
const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
const AUTH_URL = "https://matriz-ti-backend.onrender.com/api/auth";
const INTERVALO_VERIFICACION_CUENTA_MS = 30 * 1000; // 30 segundos

const leerPermisos = () => {
  try {
    return JSON.parse(localStorage.getItem("permisos")) || permisosPorDefecto;
  } catch {
    return permisosPorDefecto;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [role, setRole] = useState(localStorage.getItem("role") || null);
  const [permisos, setPermisos] = useState(leerPermisos());
  const [nombre, setNombre] = useState(localStorage.getItem("nombre") || "");
  const [apellido, setApellido] = useState(
    localStorage.getItem("apellido") || "",
  );

  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [cuentaSuspendida, setCuentaSuspendida] = useState(false);

  const login = (
    userToken,
    userRole,
    userPermisos = permisosPorDefecto,
    userNombre = "",
    userApellido = "",
  ) => {
    localStorage.setItem("token", userToken);
    localStorage.setItem("role", userRole);
    localStorage.setItem("permisos", JSON.stringify(userPermisos));
    localStorage.setItem("nombre", userNombre);
    localStorage.setItem("apellido", userApellido);
    setToken(userToken);
    setRole(userRole);
    setPermisos(userPermisos);
    setNombre(userNombre);
    setApellido(userApellido);
    setSesionExpirada(false);
    setCuentaSuspendida(false);
  };

  const logout = useCallback(() => {
    localStorage.clear();
    setToken(null);
    setRole(null);
    setPermisos(permisosPorDefecto);
    setNombre("");
    setApellido("");
  }, []);

  const limpiarSesionExpirada = useCallback(() => {
    setSesionExpirada(false);
  }, []);

  const limpiarCuentaSuspendida = useCallback(() => {
    setCuentaSuspendida(false);
  }, []);

  // 🚫 CIERRE DE SESIÓN INSTANTÁNEO SI EL ADMIN SUSPENDE LA CUENTA
  // Cualquier respuesta del backend marcada como "Cuenta suspendida" cierra
  // la sesión de inmediato, sin esperar a que expire el token.
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const mensaje = error.response?.data?.error || "";
        if (
          (status === 401 || status === 403) &&
          mensaje.toLowerCase().includes("suspendida")
        ) {
          setCuentaSuspendida(true);
          logout();
        }
        return Promise.reject(error);
      },
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, [logout]);

  // Sincroniza rol/permisos/nombre con la base de datos: se ejecuta al
  // cargar/recargar la página y luego cada 30s, para que un cambio hecho
  // por el admin (rol, permisos, suspensión) se aplique sin re-loguearse.
  useEffect(() => {
    if (!token) return;

    const sincronizarPerfil = () => {
      axios
        .get(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          const { role: rolActual, permisos: permisosActuales, nombre: nombreActual, apellido: apellidoActual } = res.data;
          localStorage.setItem("role", rolActual);
          localStorage.setItem("permisos", JSON.stringify(permisosActuales));
          localStorage.setItem("nombre", nombreActual || "");
          localStorage.setItem("apellido", apellidoActual || "");
          setRole(rolActual);
          setPermisos(permisosActuales);
          setNombre(nombreActual || "");
          setApellido(apellidoActual || "");
        })
        .catch(() => {}); // el interceptor de arriba ya maneja el caso de suspensión
    };

    sincronizarPerfil();
    const intervalId = setInterval(
      sincronizarPerfil,
      INTERVALO_VERIFICACION_CUENTA_MS,
    );
    return () => clearInterval(intervalId);
  }, [token]);

  // 🕒 CIERRE DE SESIÓN AUTOMÁTICO POR INACTIVIDAD
  const temporizadorInactividad = useRef(null);

  useEffect(() => {
    if (!token) return;

    const reiniciarTemporizador = () => {
      if (temporizadorInactividad.current) {
        clearTimeout(temporizadorInactividad.current);
      }
      temporizadorInactividad.current = setTimeout(() => {
        setSesionExpirada(true);
        logout();
      }, LIMITE_INACTIVIDAD_MS);
    };

    EVENTOS_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, reiniciarTemporizador),
    );
    reiniciarTemporizador();

    return () => {
      EVENTOS_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, reiniciarTemporizador),
      );
      if (temporizadorInactividad.current) {
        clearTimeout(temporizadorInactividad.current);
      }
    };
  }, [token, logout]);

  const tienePermiso = (permiso) => role === "admin" || !!permisos[permiso];

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        permisos,
        nombre,
        apellido,
        tienePermiso,
        login,
        logout,
        sesionExpirada,
        limpiarSesionExpirada,
        cuentaSuspendida,
        limpiarCuentaSuspendida,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

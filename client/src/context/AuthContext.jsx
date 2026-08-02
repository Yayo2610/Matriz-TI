import { createContext, useState, useEffect, useRef, useCallback } from "react";

export const AuthContext = createContext();

const permisosPorDefecto = { lectura: false, escritura: false, modificacion: false };
const LIMITE_INACTIVIDAD_MS = 10 * 60 * 1000; // 10 minutos
const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

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
  };

  const logout = useCallback(() => {
    localStorage.clear();
    setToken(null);
    setRole(null);
    setPermisos(permisosPorDefecto);
    setNombre("");
    setApellido("");
  }, []);

  // 🕒 CIERRE DE SESIÓN AUTOMÁTICO POR INACTIVIDAD
  const temporizadorInactividad = useRef(null);

  useEffect(() => {
    if (!token) return;

    const reiniciarTemporizador = () => {
      if (temporizadorInactividad.current) {
        clearTimeout(temporizadorInactividad.current);
      }
      temporizadorInactividad.current = setTimeout(() => {
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

import { createContext, useState } from "react";

export const AuthContext = createContext();

const permisosPorDefecto = { lectura: false, escritura: false, modificacion: false };

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

  const login = (userToken, userRole, userPermisos = permisosPorDefecto) => {
    localStorage.setItem("token", userToken);
    localStorage.setItem("role", userRole);
    localStorage.setItem("permisos", JSON.stringify(userPermisos));
    setToken(userToken);
    setRole(userRole);
    setPermisos(userPermisos);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
    setPermisos(permisosPorDefecto);
  };

  const tienePermiso = (permiso) => role === "admin" || !!permisos[permiso];

  return (
    <AuthContext.Provider
      value={{ token, role, permisos, tienePermiso, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

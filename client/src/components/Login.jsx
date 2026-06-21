import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext"; // Asegura que la ruta a tu contexto sea correcta

export const Login = () => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Petición local al puerto 5000 de tu servidor Express
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        // Ejecuta la función global de S6 guardando Token y Rol
        login(data.token, data.role);
        alert(`Inicio de sesión exitoso. Rol: ${data.role}`);
        window.location.href = "/dashboard"; // Redirección automática tras autenticarse
      } else {
        setError(data.error || "Credenciales inválidas");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor local");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-lg border border-slate-200">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-800">
            AssetTrack Pro
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Mesa de Ayuda - Control de Inventario
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Correo Electrónico
            </label>
            <input
              name="email"
              type="email"
              required
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              required
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 p-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-md"
          >
            Ingresar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
};

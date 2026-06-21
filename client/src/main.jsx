import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; // Importa tu componente principal
import { AuthProvider } from "./context/AuthContext";
import "./index.css"; // Tus estilos de Tailwind

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />{" "}
      {/* Envolvemos App para que todo el proyecto tenga acceso al token */}
    </AuthProvider>
  </React.StrictMode>,
);

import React, { useState } from "react";
import axios from "axios";

const CargaCSV = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setMessage({ text: "", type: "" });
    } else {
      setFile(null);
      setMessage({
        text: "Por favor selecciona un archivo CSV válido.",
        type: "error",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage({ text: "Selecciona un archivo CSV primero.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "Subiendo archivo...", type: "info" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "https://matrix-zi-ti-backend.onrender.com/api/assets/bulk",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setMessage({ text: `✅ ${response.data.message}`, type: "success" });
      setFile(null);
      // Limpiar el input file
      document.getElementById("csvFileInput").value = "";
      // Llamar al callback para refrescar datos
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error("Error al subir archivo:", error);
      const errorMsg =
        error.response?.data?.error || "Error desconocido al subir el archivo.";
      setMessage({ text: `❌ ${errorMsg}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="carga-csv-container">
      <h3>Carga de Inventario</h3>
      <p>
        Sube tu archivo CSV de activos siguiendo la estructura establecida:{" "}
        <strong>S/N, Marca, Modelo, Tipo, Nombre, Área</strong>.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="file-input-wrapper">
          <input
            id="csvFileInput"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !file}>
            {loading ? "Subiendo..." : "Subir Archivo"}
          </button>
        </div>
      </form>
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}
    </div>
  );
};

export default CargaCSV;

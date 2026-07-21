import React, { useState, useEffect, useContext } from "react";
import { Boxes, PackageOpen, UserCheck, Wrench } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const DashboardGrid = ({ actualizarMetricas }) => {
  const { token } = useContext(AuthContext);
  const [metrics, setMetrics] = useState({
    total: 0,
    status: { enStock: 0, asignado: 0, enMantenimiento: 0, dadoDeBaja: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    // Apuntando a tu backend en Render
    fetch("https://matriz-ti-backend.onrender.com/api/assets/metrics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setMetrics(resData.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando métricas:", err);
        setLoading(false);
      });
  }, [actualizarMetricas, token]);

  if (loading)
    return (
      <div className="text-slate-400 p-4 font-semibold animate-pulse">
        Cargando métricas del sistema...
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-2">
      {/* Tarjeta Totales */}
      <div className="bg-[#111827] p-6 rounded-xl border border-white/5 border-l-4 border-l-fuchsia-400 shadow-lg">
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Activos Totales
          </span>
          <div className="p-2 rounded-lg bg-fuchsia-400/10">
            <Boxes size={16} className="text-fuchsia-400" />
          </div>
        </div>
        <h3 className="text-3xl font-mono font-black text-white mt-2 [text-shadow:0_0_16px_rgba(232,121,249,0.2)]">
          {metrics.total}
        </h3>
      </div>

      {/* Tarjeta Stock */}
      <div className="bg-[#111827] p-6 rounded-xl border border-white/5 border-l-4 border-l-blue-500 shadow-lg">
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            En Stock
          </span>
          <div className="p-2 rounded-lg bg-blue-500/10">
            <PackageOpen size={16} className="text-blue-400" />
          </div>
        </div>
        <h3 className="text-3xl font-mono font-black text-blue-400 mt-2 [text-shadow:0_0_16px_rgba(96,165,250,0.45)]">
          {metrics.status.enStock}
        </h3>
      </div>

      {/* Tarjeta Asignados */}
      <div className="bg-[#111827] p-6 rounded-xl border border-white/5 border-l-4 border-l-emerald-500 shadow-lg">
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Asignados
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <UserCheck size={16} className="text-emerald-400" />
          </div>
        </div>
        <h3 className="text-3xl font-mono font-black text-emerald-400 mt-2 [text-shadow:0_0_16px_rgba(52,211,153,0.45)]">
          {metrics.status.asignado}
        </h3>
      </div>

      {/* Tarjeta Mantenimiento */}
      <div className="bg-[#111827] p-6 rounded-xl border border-white/5 border-l-4 border-l-orange-500 shadow-lg">
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            En Mantenimiento
          </span>
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Wrench size={16} className="text-orange-400" />
          </div>
        </div>
        <h3 className="text-3xl font-mono font-black text-orange-400 mt-2 [text-shadow:0_0_16px_rgba(251,146,60,0.45)]">
          {metrics.status.enMantenimiento}
        </h3>
      </div>
    </div>
  );
};

export default DashboardGrid;

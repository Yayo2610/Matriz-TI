import React, { useState, useEffect, useContext } from "react";
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
      <div className="text-slate-400 p-4 font-mono-data text-xs animate-pulse">
        Cargando métricas del sistema…
      </div>
    );

  const total = metrics.total || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="border border-fuchsia-400/25 bg-[#111827] mb-2 grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-dashed divide-fuchsia-400/15">
      {/* Totales + barra de distribución */}
      <div className="p-4">
        <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Activos totales
        </div>
        <div className="font-mono-data text-3xl font-black text-white tabular-nums">
          {total}
        </div>
        <div className="flex h-1.5 mt-3 bg-[#0a0f1a] overflow-hidden">
          <span
            className="bg-emerald-400"
            style={{ width: `${pct(metrics.status.asignado)}%` }}
          />
          <span
            className="bg-blue-400"
            style={{ width: `${pct(metrics.status.enStock)}%` }}
          />
          <span
            className="bg-orange-400"
            style={{ width: `${pct(metrics.status.enMantenimiento)}%` }}
          />
          <span
            className="bg-red-400"
            style={{ width: `${pct(metrics.status.dadoDeBaja)}%` }}
          />
        </div>
      </div>

      {/* En Stock */}
      <div className="p-4">
        <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          En stock
        </div>
        <div className="font-mono-data text-3xl font-black text-blue-400 tabular-nums">
          {metrics.status.enStock}
        </div>
        <div className="font-mono-data text-[10px] text-slate-500 mt-1">
          {pct(metrics.status.enStock)}% del total
        </div>
      </div>

      {/* Asignados */}
      <div className="p-4">
        <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Asignados
        </div>
        <div className="font-mono-data text-3xl font-black text-emerald-400 tabular-nums">
          {metrics.status.asignado}
        </div>
        <div className="font-mono-data text-[10px] text-slate-500 mt-1">
          {pct(metrics.status.asignado)}% del total
        </div>
      </div>

      {/* Mantenimiento / Baja */}
      <div className="p-4">
        <div className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Mant. / Baja
        </div>
        <div className="font-mono-data text-3xl font-black tabular-nums">
          <span className="text-orange-400">{metrics.status.enMantenimiento}</span>
          <span className="text-slate-600 text-lg"> / </span>
          <span className="text-red-400">{metrics.status.dadoDeBaja}</span>
        </div>
        <div className="font-mono-data text-[10px] text-slate-500 mt-1">
          equipos que requieren atención
        </div>
      </div>
    </div>
  );
};

export default DashboardGrid;

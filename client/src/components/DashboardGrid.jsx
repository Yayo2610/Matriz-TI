import React, { useState, useEffect } from "react";

const DashboardGrid = ({ actualizarMetricas }) => {
  const [metrics, setMetrics] = useState({
    total: 0,
    status: { enStock: 0, asignado: 0, enMantenimiento: 0, dadoDeBaja: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apuntando a tu backend en Render
    fetch("https://matriz-ti-backend.onrender.com/api/assets/metrics")
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
  }, [actualizarMetricas]);

  if (loading)
    return (
      <div className="text-slate-400 p-4 font-semibold animate-pulse">
        Cargando métricas del sistema...
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-2">
      {/* Tarjeta Totales */}
      <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 border-l-4 border-l-indigo-500 shadow-lg">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Activos Totales
        </span>
        <h3 className="text-3xl font-black text-white mt-2">{metrics.total}</h3>
      </div>

      {/* Tarjeta Stock */}
      <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 border-l-4 border-l-blue-500 shadow-lg">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          En Stock
        </span>
        <h3 className="text-3xl font-black text-blue-400 mt-2">
          {metrics.status.enStock}
        </h3>
      </div>

      {/* Tarjeta Asignados */}
      <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 border-l-4 border-l-emerald-500 shadow-lg">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Asignados
        </span>
        <h3 className="text-3xl font-black text-emerald-400 mt-2">
          {metrics.status.asignado}
        </h3>
      </div>

      {/* Tarjeta Mantenimiento */}
      <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 border-l-4 border-l-orange-500 shadow-lg">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          En Mantenimiento
        </span>
        <h3 className="text-3xl font-black text-orange-400 mt-2">
          {metrics.status.enMantenimiento}
        </h3>
      </div>
    </div>
  );
};

export default DashboardGrid;

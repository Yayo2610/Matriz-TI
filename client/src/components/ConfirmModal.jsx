import { AlertTriangle } from "lucide-react";

export function ConfirmModal({ dialog, onConfirm, onCancel }) {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60">
      <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-3xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-500/10 p-2.5 rounded-full shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Confirmar acción</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-6 whitespace-pre-line">
          {dialog.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 p-3 rounded-xl font-bold text-slate-300 text-xs uppercase bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 p-3 rounded-xl font-bold text-white text-xs uppercase bg-red-600 hover:bg-red-500 transition-colors cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

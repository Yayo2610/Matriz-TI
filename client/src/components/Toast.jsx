import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const STYLES = {
  success: {
    border: "border-l-emerald-500",
    icon: <CheckCircle2 size={18} className="text-emerald-400" />,
  },
  error: {
    border: "border-l-red-500",
    icon: <XCircle size={18} className="text-red-400" />,
  },
  info: {
    border: "border-l-blue-500",
    icon: <Info size={18} className="text-blue-400" />,
  },
};

export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm">
      {toasts.map((toast) => {
        const style = STYLES[toast.type] || STYLES.info;
        return (
          <div
            key={toast.id}
            className={`bg-[#111827] border border-white/10 border-l-4 ${style.border} rounded-xl shadow-2xl p-4 flex items-start gap-3`}
          >
            <div className="mt-0.5 shrink-0">{style.icon}</div>
            <p className="text-xs text-slate-200 flex-1 leading-relaxed">
              {toast.message}
            </p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

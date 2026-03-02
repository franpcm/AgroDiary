"use client";

import { useEffect, useState } from "react";

interface Alerta {
  tipo: "warning" | "info" | "danger" | "success";
  icono: string;
  titulo: string;
  detalle: string;
  parcela?: string;
  dias?: number;
}

const TIPO_STYLES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  danger: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
  },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
};

export default function AlertsPanel() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(setAlertas)
      .catch(() => setAlertas([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-16 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  const visibleAlertas = alertas.filter((_, i) => !dismissed.has(i));
  const dangerCount = visibleAlertas.filter((a) => a.tipo === "danger").length;
  const warningCount = visibleAlertas.filter(
    (a) => a.tipo === "warning",
  ).length;

  if (visibleAlertas.length === 0) {
    return (
      <div className="card p-4 bg-green-50 border border-green-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800">Todo en orden</p>
            <p className="text-sm text-green-600">No hay alertas pendientes</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <h2 className="font-bold text-gray-800">Alertas y Recordatorios</h2>
          <div className="flex gap-2">
            {dangerCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {dangerCount} urgente{dangerCount > 1 ? "s" : ""}
              </span>
            )}
            {warningCount > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {warningCount} aviso{warningCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-sm">{collapsed ? "▼" : "▲"}</span>
      </button>

      {/* Alerts list */}
      {!collapsed && (
        <div className="border-t divide-y">
          {visibleAlertas.map((alerta, i) => {
            const originalIdx = alertas.indexOf(alerta);
            const style = TIPO_STYLES[alerta.tipo] || TIPO_STYLES.info;
            return (
              <div
                key={originalIdx}
                className={`${style.bg} border-l-4 ${style.border} p-3 sm:p-4 flex items-start gap-3 group`}
              >
                <span className="text-xl shrink-0 mt-0.5">{alerta.icono}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${style.text}`}>
                    {alerta.titulo}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {alerta.detalle}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(originalIdx))
                  }
                  className="text-gray-300 hover:text-gray-500 text-sm opacity-0 group-hover:opacity-100 transition shrink-0"
                  title="Descartar"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

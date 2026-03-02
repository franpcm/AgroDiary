"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ACTIVIDAD_LABELS,
  CULTIVO_LABELS,
  type EntradaDiario,
  type TipoActividad,
  type TipoCultivo,
} from "@/types";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIPO_COLORS: Record<string, string> = {
  riego: "#3B82F6",
  tratamiento_fitosanitario: "#8B5CF6",
  poda: "#EC4899",
  abonado: "#22C55E",
  cosecha: "#F59E0B",
  laboreo: "#F97316",
  siembra_plantacion: "#10B981",
  injerto: "#6366F1",
  analisis_suelo: "#0EA5E9",
  analisis_foliar: "#14B8A6",
  observacion: "#64748B",
  mantenimiento_infraestructura: "#78716C",
  otro: "#9CA3AF",
};

interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  entries: EntradaDiario[];
}

export default function CalendarioPage() {
  const [entries, setEntries] = useState<EntradaDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [filterCultivo, setFilterCultivo] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEntries = useCallback(async () => {
    // Fetch entries for the current month (and a bit of padding)
    const desde = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const hasta = new Date(year, month + 2, 0).toISOString().split("T")[0];
    const params = new URLSearchParams({ desde, hasta, limit: "500" });
    const res = await fetch(`/api/entries?${params}`);
    const data = await res.json();
    setEntries(data.entries || []);
  }, [year, month]);

  useEffect(() => {
    setLoading(true);
    fetchEntries().finally(() => setLoading(false));
  }, [fetchEntries]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1; // Monday = 0
  if (startDow < 0) startDow = 6;

  const today = new Date().toISOString().split("T")[0];

  const filteredEntries = filterCultivo
    ? entries.filter((e) => e.cultivo === filterCultivo)
    : entries;

  const entriesByDate = filteredEntries.reduce(
    (acc, e) => {
      if (!acc[e.fecha]) acc[e.fecha] = [];
      acc[e.fecha].push(e);
      return acc;
    },
    {} as Record<string, EntradaDiario[]>,
  );

  const calendarDays: CalendarDay[] = [];

  // Previous month padding
  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay - i;
    const date = new Date(year, month - 1, d).toISOString().split("T")[0];
    calendarDays.push({
      date,
      day: d,
      isCurrentMonth: false,
      isToday: false,
      entries: entriesByDate[date] || [],
    });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d).toISOString().split("T")[0];
    calendarDays.push({
      date,
      day: d,
      isCurrentMonth: true,
      isToday: date === today,
      entries: entriesByDate[date] || [],
    });
  }

  // Next month padding
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d).toISOString().split("T")[0];
    calendarDays.push({
      date,
      day: d,
      isCurrentMonth: false,
      isToday: false,
      entries: entriesByDate[date] || [],
    });
  }

  const monthName = currentDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const goToPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Stats for the month
  const monthEntries = entries.filter((e) => {
    const d = new Date(e.fecha);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const totalMonth = monthEntries.length;
  const diasConActividad = new Set(monthEntries.map((e) => e.fecha)).size;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            📅 Calendario de Actividades
          </h1>
          <p className="text-gray-500 mt-1">
            Vista mensual de todas las tareas de la finca
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCultivo}
            onChange={(e) => setFilterCultivo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los cultivos</option>
            {Object.entries(CULTIVO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{totalMonth}</p>
          <p className="text-xs text-gray-500">Actividades del mes</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{diasConActividad}</p>
          <p className="text-xs text-gray-500">Días con actividad</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">
            {lastDay.getDate()}
          </p>
          <p className="text-xs text-gray-500">Días del mes</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">
            {diasConActividad > 0
              ? Math.round((diasConActividad / lastDay.getDate()) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-gray-500">Cobertura</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="card overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center justify-between p-4 bg-green-800 text-white">
          <button
            onClick={goToPrev}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              />
            </svg>
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold capitalize">{monthName}</h2>
            <button
              onClick={goToToday}
              className="text-xs text-green-200 hover:text-white transition"
            >
              Ir a hoy
            </button>
          </div>
          <button
            onClick={goToNext}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="p-2 text-center text-xs font-semibold text-gray-500"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl animate-spin-slow">📅</div>
            <p className="mt-2">Cargando...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => (
              <button
                key={i}
                onClick={() =>
                  day.entries.length > 0 ? setSelectedDay(day) : null
                }
                className={`
                  min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r text-left transition relative
                  ${!day.isCurrentMonth ? "bg-gray-50 text-gray-300" : "hover:bg-green-50"}
                  ${day.isToday ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""}
                  ${day.entries.length > 0 ? "cursor-pointer" : "cursor-default"}
                `}
              >
                <span
                  className={`
                  text-sm font-medium
                  ${day.isToday ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center" : ""}
                `}
                >
                  {day.day}
                </span>
                {/* Entry dots */}
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {day.entries.slice(0, 4).map((entry, j) => (
                    <div
                      key={j}
                      className="hidden sm:block"
                      title={`${ACTIVIDAD_LABELS[entry.tipo_actividad as TipoActividad] || entry.tipo_actividad}: ${entry.descripcion}`}
                    >
                      <div
                        className="text-[9px] px-1 py-0.5 rounded truncate max-w-[90px] text-white font-medium"
                        style={{
                          backgroundColor:
                            TIPO_COLORS[entry.tipo_actividad] || "#9CA3AF",
                        }}
                      >
                        {(
                          ACTIVIDAD_LABELS[
                            entry.tipo_actividad as TipoActividad
                          ] || entry.tipo_actividad
                        )
                          .split(" ")
                          .slice(1)
                          .join(" ")
                          .substring(0, 12)}
                      </div>
                    </div>
                  ))}
                  {/* Mobile: show dots only */}
                  <div className="flex gap-0.5 sm:hidden">
                    {day.entries.slice(0, 5).map((entry, j) => (
                      <div
                        key={j}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            TIPO_COLORS[entry.tipo_actividad] || "#9CA3AF",
                        }}
                      />
                    ))}
                  </div>
                  {day.entries.length > 4 && (
                    <span className="text-[9px] text-gray-400 hidden sm:inline">
                      +{day.entries.length - 4}
                    </span>
                  )}
                </div>
                {day.entries.length > 0 && (
                  <div className="absolute bottom-1 right-1 text-[10px] text-gray-400 font-medium">
                    {day.entries.length}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4 mt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Leyenda de actividades
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TIPO_COLORS).map(([tipo, color]) => (
            <div key={tipo} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">
                {(ACTIVIDAD_LABELS[tipo as TipoActividad] || tipo).replace(
                  /^[^\s]+\s/,
                  "",
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    📅{" "}
                    {new Date(
                      selectedDay.date + "T00:00:00",
                    ).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedDay.entries.length} actividad
                    {selectedDay.entries.length !== 1 ? "es" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {selectedDay.entries.map((entry, i) => (
                <div
                  key={i}
                  className="border rounded-xl p-4 hover:shadow-sm transition"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                      style={{
                        backgroundColor:
                          TIPO_COLORS[entry.tipo_actividad] || "#9CA3AF",
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">
                          {ACTIVIDAD_LABELS[
                            entry.tipo_actividad as TipoActividad
                          ] || entry.tipo_actividad}
                        </span>
                        <span
                          className={`badge badge-${entry.cultivo} text-xs`}
                        >
                          {entry.parcela_nombre}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {entry.descripcion}
                      </p>
                      {entry.productos_usados && (
                        <p className="text-xs text-gray-500 mt-1">
                          🧪 {entry.productos_usados}
                          {entry.dosis ? ` — ${entry.dosis}` : ""}
                        </p>
                      )}
                      {entry.condiciones_meteo && (
                        <p className="text-xs text-gray-400 mt-1">
                          🌤️ {entry.condiciones_meteo}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        👤 {entry.realizado_por}
                      </p>
                    </div>
                    {entry.valoracion ? (
                      <div className="text-yellow-500 text-xs shrink-0">
                        {"★".repeat(entry.valoracion as number)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

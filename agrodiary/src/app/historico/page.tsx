"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ACTIVIDAD_LABELS,
  CULTIVO_LABELS,
  type EntradaDiario,
  type Parcela,
  type TipoActividad,
  type TipoCultivo,
} from "@/types";

export default function HistoricoPage() {
  const [entries, setEntries] = useState<EntradaDiario[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [parcela, setParcela] = useState("");
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [vistaComparativa, setVistaComparativa] = useState(false);

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (parcela) params.set("parcela_id", parcela);
    if (tipo) params.set("tipo", tipo);
    params.set("limit", "500");

    const res = await fetch(`/api/entries?${params}`);
    const data = await res.json();
    setEntries(data.entries || []);
  }, [desde, hasta, parcela, tipo]);

  useEffect(() => {
    Promise.all([fetch("/api/parcelas").then((r) => r.json()), fetchEntries()])
      .then(([p]) => {
        setParcelas(p);
      })
      .finally(() => setLoading(false));
  }, [fetchEntries]);

  useEffect(() => {
    if (!loading) fetchEntries();
  }, [desde, hasta, parcela, tipo, fetchEntries, loading]);

  const filteredEntries = busqueda
    ? entries.filter((e) =>
        (
          e.descripcion +
          " " +
          e.resultado +
          " " +
          e.productos_usados +
          " " +
          e.notas +
          " " +
          e.parcela_nombre
        )
          .toLowerCase()
          .includes(busqueda.toLowerCase()),
      )
    : entries;

  // Group entries by month for timeline view
  const grouped = filteredEntries.reduce(
    (acc, entry) => {
      const month = entry.fecha.substring(0, 7); // YYYY-MM
      if (!acc[month]) acc[month] = [];
      acc[month].push(entry);
      return acc;
    },
    {} as Record<string, EntradaDiario[]>,
  );

  // Stats calculation
  const stats = {
    total: filteredEntries.length,
    avgRating:
      filteredEntries.filter((e) => e.valoracion).length > 0
        ? (
            filteredEntries.reduce((sum, e) => sum + (e.valoracion || 0), 0) /
            filteredEntries.filter((e) => e.valoracion).length
          ).toFixed(1)
        : "N/A",
    topActivities: Object.entries(
      filteredEntries.reduce(
        (acc, e) => {
          acc[e.tipo_actividad] = (acc[e.tipo_actividad] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topProducts: Object.entries(
      filteredEntries
        .filter((e) => e.productos_usados)
        .reduce(
          (acc, e) => {
            // Split comma-separated products to count each individually
            const products = (e.productos_usados || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            for (const p of products) {
              acc[p] = (acc[p] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>,
        ),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    bestRated: filteredEntries
      .filter((e) => e.valoracion && e.valoracion >= 4)
      .slice(0, 5),
    worstRated: filteredEntries
      .filter((e) => e.valoracion && e.valoracion <= 2)
      .slice(0, 5),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-6xl animate-spin-slow">🌿</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            📈 Histórico y Comparativas
          </h1>
          <p className="text-gray-500 mt-1">
            Analiza actividades pasadas y compara resultados
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVistaComparativa(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              !vistaComparativa
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📋 Cronología
          </button>
          <button
            onClick={() => setVistaComparativa(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              vistaComparativa
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📊 Análisis
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Parcela</label>
            <select
              value={parcela}
              onChange={(e) => setParcela(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {parcelas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(ACTIVIDAD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en descripciones, resultados, productos..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {(desde || hasta || parcela || tipo || busqueda) && (
            <button
              onClick={() => {
                setDesde("");
                setHasta("");
                setParcela("");
                setTipo("");
                setBusqueda("");
              }}
              className="text-sm text-red-500 hover:text-red-700 pb-2"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {!vistaComparativa ? (
        /* Timeline View */
        <>
          <div className="text-sm text-gray-500 mb-4">
            {filteredEntries.length} entradas encontradas
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-xl">
                No hay entradas en el periodo seleccionado
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([month, monthEntries]) => {
                const [year, monthNum] = month.split("-");
                const monthName = new Date(
                  parseInt(year),
                  parseInt(monthNum) - 1,
                ).toLocaleDateString("es-ES", {
                  month: "long",
                  year: "numeric",
                });

                return (
                  <div key={month}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-green-600 text-white px-4 py-1 rounded-full text-sm font-bold capitalize">
                        {monthName}
                      </div>
                      <div className="text-sm text-gray-400">
                        {monthEntries.length} entradas
                      </div>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="space-y-3 ml-4 border-l-2 border-green-200 pl-6">
                      {monthEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="card p-4 animate-fade-in relative"
                        >
                          {/* Timeline dot */}
                          <div className="absolute -left-[31px] top-5 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />

                          <div className="flex items-start gap-3">
                            <div className="text-2xl">
                              {ACTIVIDAD_LABELS[
                                entry.tipo_actividad as TipoActividad
                              ]?.split(" ")[0] || "📝"}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                <span className="font-bold text-gray-700">
                                  {entry.fecha}
                                </span>
                                <span
                                  className={`badge badge-${entry.cultivo}`}
                                >
                                  {entry.parcela_nombre}
                                </span>
                                <span>👤 {entry.realizado_por}</span>
                              </div>
                              <p className="font-medium text-gray-800">
                                {ACTIVIDAD_LABELS[
                                  entry.tipo_actividad as TipoActividad
                                ] || entry.tipo_actividad}
                              </p>
                              <p className="text-gray-600 text-sm mt-1">
                                {entry.descripcion}
                              </p>
                              {entry.productos_usados && (
                                <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                  🧪 {entry.productos_usados}{" "}
                                  {entry.dosis ? `(${entry.dosis})` : ""}
                                </span>
                              )}
                              {entry.resultado && (
                                <p className="mt-1 text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                  📊 {entry.resultado}
                                </p>
                              )}
                              {entry.valoracion ? (
                                <div className="mt-1 text-yellow-500 text-sm">
                                  {"★".repeat(entry.valoracion)}
                                  {"☆".repeat(5 - entry.valoracion)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Analysis View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overview */}
          <div className="card p-6">
            <h3 className="font-bold text-lg mb-4">📊 Resumen del Periodo</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-700">
                  {stats.total}
                </div>
                <div className="text-sm text-blue-600">Entradas totales</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-700">
                  {stats.avgRating}
                </div>
                <div className="text-sm text-yellow-600">Valoración media</div>
              </div>
            </div>
          </div>

          {/* Top Activities */}
          <div className="card p-6">
            <h3 className="font-bold text-lg mb-4">
              🏆 Actividades más frecuentes
            </h3>
            {stats.topActivities.length > 0 ? (
              <div className="space-y-3">
                {stats.topActivities.map(([tipo, count], i) => (
                  <div key={tipo} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <span className="flex-1 text-sm">
                      {ACTIVIDAD_LABELS[tipo as TipoActividad] || tipo}
                    </span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center">Sin datos</p>
            )}
          </div>

          {/* Products Used */}
          <div className="card p-6">
            <h3 className="font-bold text-lg mb-4">🧪 Productos más usados</h3>
            {stats.topProducts.length > 0 ? (
              <div className="space-y-2">
                {stats.topProducts.map(([prod, count]) => (
                  <div
                    key={prod}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm">{prod}</span>
                    <span className="text-xs font-bold text-gray-500">
                      {count}x
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center">Sin datos</p>
            )}
          </div>

          {/* Best Rated */}
          <div className="card p-6">
            <h3 className="font-bold text-lg mb-4">
              ✅ Mejores resultados (4-5★)
            </h3>
            {stats.bestRated.length > 0 ? (
              <div className="space-y-3">
                {stats.bestRated.map((entry) => (
                  <div key={entry.id} className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-800">
                      {entry.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{entry.fecha}</span>
                      <span>{entry.parcela_nombre}</span>
                      <span className="text-yellow-500">
                        {"★".repeat(entry.valoracion || 0)}
                      </span>
                    </div>
                    {entry.resultado && (
                      <p className="text-xs text-green-700 mt-1">
                        → {entry.resultado}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center text-sm">
                Sin entradas con 4-5 estrellas
              </p>
            )}
          </div>

          {/* Worst Rated */}
          <div className="card p-6 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4">
              ⚠️ Resultados a mejorar (1-2★)
            </h3>
            {stats.worstRated.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stats.worstRated.map((entry) => (
                  <div key={entry.id} className="p-3 bg-red-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-800">
                      {entry.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{entry.fecha}</span>
                      <span>{entry.parcela_nombre}</span>
                      <span className="text-yellow-500">
                        {"★".repeat(entry.valoracion || 0)}
                        {"☆".repeat(5 - (entry.valoracion || 0))}
                      </span>
                    </div>
                    {entry.resultado && (
                      <p className="text-xs text-red-700 mt-1">
                        → {entry.resultado}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center text-sm">
                🎉 ¡No hay entradas con valoración baja! Buen trabajo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

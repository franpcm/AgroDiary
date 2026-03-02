"use client";

import { useState, useEffect } from "react";
import { CULTIVO_LABELS, type Parcela, type TipoCultivo } from "@/types";

export default function ExportarPage() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [parcela, setParcela] = useState("");
  const [cultivo, setCultivo] = useState("");

  useEffect(() => {
    fetch("/api/parcelas")
      .then((r) => r.json())
      .then(setParcelas);
    // Default: last 3 months
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    setDesde(threeMonthsAgo.toISOString().split("T")[0]);
    setHasta(now.toISOString().split("T")[0]);
  }, []);

  const generateUrl = () => {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (parcela) params.set("parcela_id", parcela);
    if (cultivo) params.set("cultivo", cultivo);
    return `/api/export/cuaderno?${params}`;
  };

  const openCuaderno = () => {
    window.open(generateUrl(), "_blank");
  };

  // Preset buttons
  const setPreset = (months: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
    setDesde(start.toISOString().split("T")[0]);
    setHasta(now.toISOString().split("T")[0]);
  };

  const setAno = (year: number) => {
    setDesde(`${year}-01-01`);
    setHasta(`${year}-12-31`);
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          📋 Cuaderno de Campo
        </h1>
        <p className="text-gray-500 mt-1">
          Genera el cuaderno de campo oficial para inspecciones y registros
          legales
        </p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">Configurar exportación</h2>

        {/* Quick presets */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-600 mb-2">
            Periodos rápidos
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreset(1)}
              className="text-sm px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition"
            >
              Último mes
            </button>
            <button
              onClick={() => setPreset(3)}
              className="text-sm px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition"
            >
              Últimos 3 meses
            </button>
            <button
              onClick={() => setPreset(6)}
              className="text-sm px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition"
            >
              Últimos 6 meses
            </button>
            <button
              onClick={() => setPreset(12)}
              className="text-sm px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition"
            >
              Último año
            </button>
            <button
              onClick={() => setAno(new Date().getFullYear())}
              className="text-sm px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
            >
              Año {new Date().getFullYear()}
            </button>
            <button
              onClick={() => setAno(new Date().getFullYear() - 1)}
              className="text-sm px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
            >
              Año {new Date().getFullYear() - 1}
            </button>
          </div>
        </div>

        {/* Custom range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cultivo
            </label>
            <select
              value={cultivo}
              onChange={(e) => setCultivo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Todos los cultivos</option>
              {Object.entries(CULTIVO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parcela
            </label>
            <select
              value={parcela}
              onChange={(e) => setParcela(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Todas las parcelas</option>
              {parcelas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.variedad})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={openCuaderno}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200 flex items-center justify-center gap-2 text-lg"
        >
          🖨️ Generar Cuaderno de Campo
        </button>
        <p className="text-xs text-gray-400 mt-2">
          Se abrirá en una nueva pestaña. Usa Ctrl+P para guardar como PDF.
        </p>
      </div>

      {/* Info card */}
      <div className="card p-6 bg-amber-50 border border-amber-200">
        <h3 className="font-bold text-amber-800 mb-2">
          📜 ¿Qué es el Cuaderno de Campo?
        </h3>
        <div className="text-sm text-amber-700 space-y-2">
          <p>
            El <strong>Cuaderno de Campo</strong> (o Cuaderno de Explotación) es
            un documento obligatorio para los agricultores en España según el
            Real Decreto 1311/2012. Debe incluir:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Identificación de la explotación y parcelas</li>
            <li>
              <strong>Registro detallado de tratamientos fitosanitarios</strong>
              : fecha, producto, dosis, parcela, quien aplicó
            </li>
            <li>Condiciones meteorológicas durante los tratamientos</li>
            <li>Registro de todas las actividades agrícolas</li>
          </ul>
          <p>
            AgroDiary genera automáticamente este documento con todos los datos
            registrados en el diario, con especial detalle en los{" "}
            <strong>tratamientos fitosanitarios</strong> que son los más
            fiscalizados.
          </p>
        </div>
      </div>
    </div>
  );
}

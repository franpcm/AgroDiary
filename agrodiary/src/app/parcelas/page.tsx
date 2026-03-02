"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  CULTIVO_LABELS,
  type Parcela,
  type TipoCultivo,
  type FarmMapData,
} from "@/types";

// Dynamic import for Leaflet (no SSR)
const FarmMap = dynamic(() => import("@/components/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-gray-100 rounded-xl flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl animate-spin-slow">🗺️</div>
        <p className="mt-2 text-gray-500">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function ParcelasPage() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [mapData, setMapData] = useState<FarmMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCultivo, setSelectedCultivo] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/parcelas").then((r) => r.json()),
      fetch("/data/farm-map.json").then((r) => r.json()),
    ])
      .then(([p, m]) => {
        setParcelas(p);
        setMapData(m);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredParcelas = selectedCultivo
    ? parcelas.filter((p) => p.cultivo === selectedCultivo)
    : parcelas;

  // Group by crop type
  const grouped = parcelas.reduce(
    (acc, p) => {
      if (!acc[p.cultivo]) acc[p.cultivo] = { count: 0, ha: 0 };
      acc[p.cultivo].count++;
      acc[p.cultivo].ha += p.superficie_ha;
      return acc;
    },
    {} as Record<string, { count: number; ha: number }>,
  );

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
            🗺️ Parcelas y Mapa
          </h1>
          <p className="text-gray-500 mt-1">
            Vista general de la Finca del Imperio
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200"
        >
          ➕ Nueva Parcela
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(grouped).map(([cultivo, data]) => (
          <button
            key={cultivo}
            onClick={() =>
              setSelectedCultivo(selectedCultivo === cultivo ? "" : cultivo)
            }
            className={`stat-card cursor-pointer transition ${
              selectedCultivo === cultivo ? "ring-2 ring-green-500" : ""
            }`}
          >
            <div className="text-2xl mb-1">
              {CULTIVO_LABELS[cultivo as TipoCultivo]?.split(" ")[0]}
            </div>
            <div className="font-bold text-lg">{data.count} parcelas</div>
            <div className="text-sm text-gray-500">
              {data.ha.toFixed(1)} ha totales
            </div>
          </button>
        ))}
        <div className="stat-card">
          <div className="text-2xl mb-1">📐</div>
          <div className="font-bold text-lg">
            {Object.values(grouped)
              .reduce((sum, g) => sum + g.ha, 0)
              .toFixed(1)}{" "}
            ha
          </div>
          <div className="text-sm text-gray-500">Superficie total</div>
        </div>
      </div>

      {/* Map */}
      <div className="card overflow-hidden mb-6" style={{ height: "550px" }}>
        {mapData && <FarmMap mapData={mapData} />}
      </div>

      {/* Parcelas List */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          📋 Lista de Parcelas
          {selectedCultivo && (
            <button
              onClick={() => setSelectedCultivo("")}
              className="ml-3 text-sm text-red-500 font-normal hover:underline"
            >
              ✕ Quitar filtro
            </button>
          )}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 pr-4">Nombre</th>
                <th className="pb-3 pr-4">Cultivo</th>
                <th className="pb-3 pr-4">Variedad</th>
                <th className="pb-3 pr-4">Sector</th>
                <th className="pb-3 pr-4">Superficie</th>
              </tr>
            </thead>
            <tbody>
              {filteredParcelas.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="py-3 pr-4 font-medium">{p.nombre}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge badge-${p.cultivo}`}>
                      {CULTIVO_LABELS[p.cultivo as TipoCultivo]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{p.variedad}</td>
                  <td className="py-3 pr-4 text-gray-600">{p.sector}</td>
                  <td className="py-3 pr-4 text-gray-600">
                    {p.superficie_ha} ha
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Parcela Form */}
      {showAddForm && (
        <AddParcelaForm
          onSave={async (data) => {
            await fetch("/api/parcelas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            const res = await fetch("/api/parcelas");
            setParcelas(await res.json());
            setShowAddForm(false);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

function AddParcelaForm({
  onSave,
  onClose,
}: {
  onSave: (data: Partial<Parcela>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nombre: "",
    cultivo: "" as TipoCultivo | "",
    variedad: "",
    superficie_ha: 0,
    sector: "",
    notas: "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <h2 className="text-xl font-bold mb-4">➕ Nueva Parcela</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...form, cultivo: form.cultivo || undefined });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cultivo</label>
              <select
                value={form.cultivo}
                onChange={(e) =>
                  setForm({ ...form, cultivo: e.target.value as TipoCultivo })
                }
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Seleccionar...</option>
                {Object.entries(CULTIVO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Variedad</label>
              <input
                value={form.variedad}
                onChange={(e) => setForm({ ...form, variedad: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Superficie (ha)
              </label>
              <input
                type="number"
                step="0.1"
                value={form.superficie_ha}
                onChange={(e) =>
                  setForm({
                    ...form,
                    superficie_ha: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sector</label>
              <input
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-semibold"
            >
              💾 Guardar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border rounded-xl text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

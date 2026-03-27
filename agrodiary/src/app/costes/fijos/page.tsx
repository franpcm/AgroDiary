"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  CosteFijo,
  Parcela,
  CategoriaCosteFijo,
  TipoCosteFijo,
  Periodicidad,
} from "@/types";
import { CATEGORIA_COSTE_LABELS, PERIODICIDAD_LABELS } from "@/types";

type ResumenCostes = {
  costes_fijos: {
    total_costes: number;
    total_ingresos: number;
    balance: number;
    costes_anualizados: number;
    coste_medio_ha: number;
    total_hectareas: number;
    num_registros: number;
    por_categoria: {
      categoria: string;
      tipo: string;
      count: number;
      total: number;
    }[];
  };
  precios: {
    num_registros: number;
    por_categoria: { categoria: string; count: number; precio_medio: number }[];
  };
};

const EMPTY_FORM: Omit<
  CosteFijo,
  "id" | "created_at" | "updated_at" | "parcela_nombres"
> = {
  nombre: "",
  tipo: "coste",
  categoria: "otro",
  fecha: new Date().toISOString().split("T")[0],
  importe: 0,
  parcela_ids: "[]",
  amortizacion_inicio: undefined,
  amortizacion_fin: undefined,
  periodicidad: "anual",
  notas: "",
};

export default function CostesFijosPage() {
  const [costes, setCostes] = useState<CosteFijo[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [resumen, setResumen] = useState<ResumenCostes | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedParcelas, setSelectedParcelas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [costesRes, parcelasRes, resumenRes] = await Promise.all([
        fetch("/api/costes/fijos").then((r) => r.json()),
        fetch("/api/parcelas").then((r) => r.json()),
        fetch("/api/costes/resumen").then((r) => r.json()),
      ]);
      setCostes(costesRes);
      setParcelas(parcelasRes);
      setResumen(resumenRes);
    } catch (err) {
      console.error("Error loading costes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCostes = costes.filter((c) => {
    const matchSearch =
      !search ||
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.parcela_nombres || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategoria || c.categoria === filterCategoria;
    const matchTipo = !filterTipo || c.tipo === filterTipo;
    return matchSearch && matchCat && matchTipo;
  });

  const handleEdit = (coste: CosteFijo) => {
    setEditingId(coste.id);
    let parcelaIds: string[] = [];
    try {
      parcelaIds = JSON.parse(coste.parcela_ids || "[]");
    } catch {
      parcelaIds = [];
    }
    setSelectedParcelas(parcelaIds);
    setForm({
      nombre: coste.nombre,
      tipo: coste.tipo,
      categoria: coste.categoria,
      fecha: coste.fecha,
      importe: coste.importe,
      parcela_ids: coste.parcela_ids,
      amortizacion_inicio: coste.amortizacion_inicio,
      amortizacion_fin: coste.amortizacion_fin,
      periodicidad: coste.periodicidad,
      notas: coste.notas || "",
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSelectedParcelas([]);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        parcela_ids: selectedParcelas,
        ...(editingId ? { id: editingId } : {}),
      };

      const res = await fetch("/api/costes/fijos", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setSelectedParcelas([]);
        await fetchData();
      }
    } catch (err) {
      console.error("Error saving coste:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este coste fijo?")) return;
    try {
      await fetch(`/api/costes/fijos?id=${id}`, { method: "DELETE" });
      await fetchData();
    } catch (err) {
      console.error("Error deleting coste:", err);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  const toggleParcela = (id: string) => {
    setSelectedParcelas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-6xl animate-spin-slow">💰</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🏦 Costes Fijos</h1>
          <p className="text-gray-500 mt-1">
            Seguros, arrendamientos, subvenciones, amortizaciones...
          </p>
        </div>
        <button
          onClick={handleNew}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200"
        >
          ➕ Nuevo Coste
        </button>
      </div>

      {/* Summary Cards */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="text-2xl mb-1">💸</div>
            <div className="text-sm text-gray-500">Total Costes</div>
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(resumen.costes_fijos.total_costes)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-sm text-gray-500">Total Ingresos</div>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(resumen.costes_fijos.total_ingresos)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-sm text-gray-500">Coste Anualizado</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(resumen.costes_fijos.costes_anualizados)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-2xl mb-1">🌾</div>
            <div className="text-sm text-gray-500">
              Coste Medio / ha (
              {resumen.costes_fijos.total_hectareas.toFixed(0)} ha)
            </div>
            <div className="text-xl font-bold text-purple-600">
              {formatCurrency(resumen.costes_fijos.coste_medio_ha)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre o parcela..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIA_COSTE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="">Costes e Ingresos</option>
            <option value="coste">Solo costes</option>
            <option value="ingreso">Solo ingresos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Dónde se imputa
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Periodicidad
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Amortización
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCostes.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {costes.length === 0
                      ? "No hay costes fijos registrados. ¡Añade el primero!"
                      : "No se encontraron resultados con los filtros actuales."}
                  </td>
                </tr>
              ) : (
                filteredCostes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">
                        {c.nombre}
                      </div>
                      {c.notas && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                          {c.notas}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {CATEGORIA_COSTE_LABELS[
                          c.categoria as CategoriaCosteFijo
                        ] || c.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.tipo === "ingreso"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {c.tipo === "ingreso" ? "Ingreso" : "Coste"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(c.fecha).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      <span
                        className={
                          c.tipo === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {formatCurrency(c.importe)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px]">
                      <div className="truncate">
                        {c.parcela_nombres || (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {PERIODICIDAD_LABELS[c.periodicidad as Periodicidad] ||
                        c.periodicidad}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.amortizacion_inicio && c.amortizacion_fin ? (
                        `${c.amortizacion_inicio} - ${c.amortizacion_fin}`
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals row */}
        {filteredCostes.length > 0 && (
          <div className="bg-gray-50 border-t px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {filteredCostes.length} registro
              {filteredCostes.length !== 1 && "s"}
            </span>
            <div className="text-sm font-semibold">
              Total visible:{" "}
              <span className="text-gray-800">
                {formatCurrency(
                  filteredCostes.reduce((sum, c) => {
                    return c.tipo === "ingreso"
                      ? sum - c.importe
                      : sum + c.importe;
                  }, 0),
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? "✏️ Editar Coste Fijo" : "➕ Nuevo Coste Fijo"}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Seguro de explotación agrícola"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Tipo + Categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tipo: e.target.value as TipoCosteFijo,
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="coste">Coste</option>
                    <option value="ingreso">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={form.categoria}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        categoria: e.target.value as CategoriaCosteFijo,
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {Object.entries(CATEGORIA_COSTE_LABELS).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {/* Fecha + Importe + Periodicidad */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) =>
                      setForm({ ...form, fecha: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importe (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.importe || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        importe: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periodicidad
                  </label>
                  <select
                    value={form.periodicidad}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        periodicidad: e.target.value as Periodicidad,
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {Object.entries(PERIODICIDAD_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amortización */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amortización desde (año)
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.amortizacion_inicio || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        amortizacion_inicio:
                          parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="2021"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amortización hasta (año)
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.amortizacion_fin || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        amortizacion_fin: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="2035"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Parcelas (donde se imputa) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dónde se imputa (parcelas)
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {parcelas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleParcela(p.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          selectedParcelas.includes(p.id)
                            ? "bg-green-100 text-green-700 ring-1 ring-green-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {selectedParcelas.includes(p.id) && "✓ "}
                        {p.nombre}
                      </button>
                    ))}
                  </div>
                  {selectedParcelas.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      {selectedParcelas.length} parcela
                      {selectedParcelas.length !== 1 && "s"} seleccionada
                      {selectedParcelas.length !== 1 && "s"}
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={form.notas || ""}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  placeholder="Notas adicionales..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-200 transition text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nombre.trim()}
                className="px-6 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition text-sm font-semibold shadow-lg shadow-green-200"
              >
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Guardar Cambios"
                    : "Crear Coste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

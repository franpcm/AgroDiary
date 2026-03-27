"use client";

import { useEffect, useState, useCallback } from "react";
import type { Precio, CategoriaPrecio } from "@/types";
import { CATEGORIA_PRECIO_LABELS, UNIDADES_PRECIO } from "@/types";

const EMPTY_FORM: Omit<Precio, "id" | "created_at" | "updated_at"> = {
  nombre: "",
  categoria: "otro",
  unidad: "€/hora",
  precio_unitario: 0,
  notas: "",
};

export default function PreciosPage() {
  const [precios, setPrecios] = useState<Precio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/costes/precios");
      const data = await res.json();
      setPrecios(data);
    } catch (err) {
      console.error("Error loading precios:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPrecios = precios.filter((p) => {
    const matchSearch =
      !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.notas || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategoria || p.categoria === filterCategoria;
    return matchSearch && matchCat;
  });

  // Group by category for summary
  const grouped = precios.reduce(
    (acc, p) => {
      if (!acc[p.categoria]) acc[p.categoria] = { count: 0, total: 0 };
      acc[p.categoria].count++;
      acc[p.categoria].total += p.precio_unitario;
      return acc;
    },
    {} as Record<string, { count: number; total: number }>,
  );

  const handleEdit = (precio: Precio) => {
    setEditingId(precio.id);
    setForm({
      nombre: precio.nombre,
      categoria: precio.categoria,
      unidad: precio.unidad,
      precio_unitario: precio.precio_unitario,
      notas: precio.notas || "",
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        ...(editingId ? { id: editingId } : {}),
      };

      const res = await fetch("/api/costes/precios", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        await fetchData();
      }
    } catch (err) {
      console.error("Error saving precio:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este precio?")) return;
    try {
      await fetch(`/api/costes/precios?id=${id}`, { method: "DELETE" });
      await fetchData();
    } catch (err) {
      console.error("Error deleting precio:", err);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-6xl animate-spin-slow">💶</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🏷️ Precios</h1>
          <p className="text-gray-500 mt-1">
            Personal, maquinaria, productos, servicios...
          </p>
        </div>
        <button
          onClick={handleNew}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200"
        >
          ➕ Nuevo Precio
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(CATEGORIA_PRECIO_LABELS).map(([key, label]) => {
          const data = grouped[key];
          return (
            <button
              key={key}
              onClick={() =>
                setFilterCategoria(filterCategoria === key ? "" : key)
              }
              className={`stat-card cursor-pointer transition text-left ${
                filterCategoria === key ? "ring-2 ring-green-500" : ""
              }`}
            >
              <div className="text-2xl mb-1">{label.split(" ")[0]}</div>
              <div className="text-sm text-gray-500">
                {label.split(" ").slice(1).join(" ")}
              </div>
              <div className="text-lg font-bold text-gray-800">
                {data ? data.count : 0}
              </div>
              {data && data.count > 0 && (
                <div className="text-xs text-gray-400">
                  Media: {formatCurrency(data.total / data.count)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre..."
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
            {Object.entries(CATEGORIA_PRECIO_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Precio unitario
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Unidad
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Notas
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPrecios.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {precios.length === 0
                      ? "No hay precios registrados. ¡Añade el primero!"
                      : "No se encontraron resultados con los filtros actuales."}
                  </td>
                </tr>
              ) : (
                filteredPrecios.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">
                        {p.nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {CATEGORIA_PRECIO_LABELS[
                          p.categoria as CategoriaPrecio
                        ] || p.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-800">
                      {formatCurrency(p.precio_unitario)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.unidad}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                      <div className="truncate">
                        {p.notas || <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
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

        {/* Totals */}
        {filteredPrecios.length > 0 && (
          <div className="bg-gray-50 border-t px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {filteredPrecios.length} precio
              {filteredPrecios.length !== 1 && "s"}
            </span>
            <div className="text-sm font-semibold text-gray-600">
              Precio medio:{" "}
              <span className="text-gray-800">
                {formatCurrency(
                  filteredPrecios.reduce((s, p) => s + p.precio_unitario, 0) /
                    filteredPrecios.length,
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? "✏️ Editar Precio" : "➕ Nuevo Precio"}
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
                  placeholder="Ej: Jornalero, Tractor John Deere, Azufre..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categoria: e.target.value as CategoriaPrecio,
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                >
                  {Object.entries(CATEGORIA_PRECIO_LABELS).map(
                    ([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* Precio + Unidad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio unitario (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio_unitario || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_unitario: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidad
                  </label>
                  <select
                    value={form.unidad}
                    onChange={(e) =>
                      setForm({ ...form, unidad: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {UNIDADES_PRECIO.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
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
                    : "Crear Precio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

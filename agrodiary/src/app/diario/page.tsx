"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ACTIVIDAD_LABELS,
  CULTIVO_LABELS,
  type EntradaDiario,
  type Parcela,
  type TipoActividad,
  type TipoCultivo,
  type Comentario,
  type HistorialEdicion,
  type ArchivoMedia,
} from "@/types";
import { useUser } from "@/context/UserContext";
import AudioRecorder from "@/components/AudioRecorder";
import MediaUpload from "@/components/MediaUpload";

const TODAY = new Date().toISOString().split("T")[0];

export default function DiarioPage() {
  const { currentUser } = useUser();
  const [entries, setEntries] = useState<EntradaDiario[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<EntradaDiario | null>(null);
  const [detailEntry, setDetailEntry] = useState<EntradaDiario | null>(null);
  const [filterFecha, setFilterFecha] = useState("");
  const [filterParcela, setFilterParcela] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterFecha) params.set("fecha", filterFecha);
    if (filterParcela) params.set("parcela_id", filterParcela);
    if (filterTipo) params.set("tipo", filterTipo);
    params.set("limit", "50");

    const res = await fetch(`/api/entries?${params}`);
    const data = await res.json();
    setEntries(data.entries || []);
  }, [filterFecha, filterParcela, filterTipo]);

  useEffect(() => {
    Promise.all([fetch("/api/parcelas").then((r) => r.json()), fetchEntries()])
      .then(([p]) => {
        setParcelas(p);
      })
      .finally(() => setLoading(false));
  }, [fetchEntries]);

  useEffect(() => {
    if (!loading) fetchEntries();
  }, [filterFecha, filterParcela, filterTipo, fetchEntries, loading]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta entrada?")) return;
    await fetch(`/api/entries?id=${id}`, { method: "DELETE" });
    fetchEntries();
  };

  const handleSave = async (entry: Partial<EntradaDiario>) => {
    const method = entry.id ? "PUT" : "POST";
    const payload = {
      ...entry,
      usuario_id: currentUser?.id || "",
      edit_usuario_id: currentUser?.id || "",
    };
    await fetch("/api/entries", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowForm(false);
    setEditEntry(null);
    fetchEntries();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-6xl animate-spin-slow">🌿</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            📝 Diario de Actividades
          </h1>
          <p className="text-gray-500 mt-1">
            Registra y consulta las tareas realizadas en la finca
            {currentUser && (
              <span className="ml-2 text-sm">
                — Conectado como{" "}
                <span
                  className="font-semibold"
                  style={{ color: currentUser.avatar_color }}
                >
                  {currentUser.nombre}
                </span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            setEditEntry(null);
            setShowForm(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200 flex items-center gap-2"
        >
          ➕ Nueva Entrada
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={filterFecha}
              onChange={(e) => setFilterFecha(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Parcela</label>
            <select
              value={filterParcela}
              onChange={(e) => setFilterParcela(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {parcelas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.variedad})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(ACTIVIDAD_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {(filterFecha || filterParcela || filterTipo) && (
            <button
              onClick={() => {
                setFilterFecha("");
                setFilterParcela("");
                setFilterTipo("");
              }}
              className="text-sm text-red-500 hover:text-red-700 mt-5"
            >
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Entry Form Modal */}
      {showForm && (
        <EntryForm
          parcelas={parcelas}
          entry={editEntry}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditEntry(null);
          }}
        />
      )}

      {/* Entry Detail Modal */}
      {detailEntry && (
        <EntryDetail
          entry={detailEntry}
          currentUser={currentUser}
          onClose={() => setDetailEntry(null)}
          onEdit={(e) => {
            setDetailEntry(null);
            setEditEntry(e);
            setShowForm(true);
          }}
        />
      )}

      {/* Entries List */}
      {entries.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-xl">
            No hay entradas
            {filterFecha || filterParcela || filterTipo
              ? " con estos filtros"
              : " todavía"}
          </p>
          <p className="mt-2">
            Pulsa &quot;Nueva Entrada&quot; para registrar la primera actividad
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="card p-5 animate-fade-in cursor-pointer hover:shadow-lg transition"
              onClick={() => setDetailEntry(entry)}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">
                  {ACTIVIDAD_LABELS[
                    entry.tipo_actividad as TipoActividad
                  ]?.split(" ")[0] || "📝"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge badge-${entry.cultivo}`}>
                      {CULTIVO_LABELS[entry.cultivo as TipoCultivo] ||
                        entry.cultivo}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-sm font-medium text-gray-700">
                      {entry.parcela_nombre}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    {ACTIVIDAD_LABELS[entry.tipo_actividad as TipoActividad] ||
                      entry.tipo_actividad}
                  </h3>
                  <p className="text-gray-600 mt-1">{entry.descripcion}</p>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-500">
                    <span>📅 {entry.fecha}</span>
                    {/* User avatar */}
                    {entry.usuario_nombre ? (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block w-5 h-5 rounded-full text-white text-xs font-bold text-center leading-5"
                          style={{
                            backgroundColor: entry.usuario_color || "#888",
                          }}
                        >
                          {entry.usuario_nombre.charAt(0)}
                        </span>
                        {entry.usuario_nombre}
                      </span>
                    ) : (
                      <span>👤 {entry.realizado_por}</span>
                    )}
                    {entry.productos_usados && (
                      <span>🧪 {entry.productos_usados}</span>
                    )}
                    {entry.dosis && <span>💊 {entry.dosis}</span>}
                    {entry.condiciones_meteo && (
                      <span>🌤️ {entry.condiciones_meteo}</span>
                    )}
                  </div>

                  {entry.resultado && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-800">
                      <strong>Resultado:</strong> {entry.resultado}
                    </div>
                  )}

                  {entry.notas && (
                    <div className="mt-2 text-sm text-gray-500 italic">
                      📌 {entry.notas}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2">
                    {entry.valoracion ? (
                      <div className="text-yellow-500">
                        {"★".repeat(entry.valoracion)}
                        {"☆".repeat(5 - entry.valoracion)}
                      </div>
                    ) : null}
                    {(entry.comentarios_count ?? 0) > 0 && (
                      <span className="text-xs text-gray-400">
                        💬 {entry.comentarios_count} comentario
                        {(entry.comentarios_count ?? 0) > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditEntry(entry);
                      setShowForm(true);
                    }}
                    className="text-blue-500 hover:text-blue-700 p-2"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-red-400 hover:text-red-600 p-2"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Entry Form Component (with audio recorder)
// ==========================================
function EntryForm({
  parcelas,
  entry,
  currentUser,
  onSave,
  onClose,
}: {
  parcelas: Parcela[];
  entry: EntradaDiario | null;
  currentUser: { id: string; nombre: string } | null;
  onSave: (entry: Partial<EntradaDiario>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string | number>>({
    id: entry?.id || "",
    fecha: entry?.fecha || TODAY,
    parcela_id: entry?.parcela_id || "",
    tipo_actividad: entry?.tipo_actividad || "",
    descripcion: entry?.descripcion || "",
    realizado_por: entry?.realizado_por || currentUser?.nombre || "",
    productos_usados: entry?.productos_usados || "",
    dosis: entry?.dosis || "",
    condiciones_meteo: entry?.condiciones_meteo || "",
    resultado: entry?.resultado || "",
    valoracion: entry?.valoracion || 0,
    notas: entry?.notas || "",
  });

  const [saving, setSaving] = useState(false);
  const [activeAudioField, setActiveAudioField] = useState<string | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Auto-fill weather on new entries
  const fetchWeather = async () => {
    setLoadingWeather(true);
    try {
      const res = await fetch("/api/weather");
      if (!res.ok) throw new Error();
      const w = await res.json();
      const meteoStr = `${w.descripcion} | ${w.temperatura}°C (${w.temperatura_min}-${w.temperatura_max}°C) | Humedad: ${w.humedad}% | Viento: ${w.viento_kmh} km/h ${w.direccion_viento}${w.precipitacion_mm > 0 ? ` | Lluvia: ${w.precipitacion_mm} mm` : ""}`;
      setForm((prev) => ({ ...prev, condiciones_meteo: meteoStr }));
    } catch {
      /* silently fail */
    }
    setLoadingWeather(false);
  };

  const handleTranscription = (text: string) => {
    if (activeAudioField && activeAudioField in form) {
      setForm((prev) => ({
        ...prev,
        [activeAudioField]: prev[activeAudioField as keyof typeof prev]
          ? `${prev[activeAudioField as keyof typeof prev]} ${text}`
          : text,
      }));
    }
    setActiveAudioField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parcela_id || !form.tipo_actividad || !form.descripcion) {
      alert("Rellena al menos la parcela, tipo de actividad y descripción");
      return;
    }
    setSaving(true);
    await onSave(form as unknown as Partial<EntradaDiario>);
    setSaving(false);
  };

  // Group parcelas by crop type
  const grouped = parcelas.reduce(
    (acc, p) => {
      if (!acc[p.cultivo]) acc[p.cultivo] = [];
      acc[p.cultivo].push(p);
      return acc;
    },
    {} as Record<string, Parcela[]>,
  );

  const audioFields = [
    { key: "descripcion", label: "Descripción" },
    { key: "resultado", label: "Resultado" },
    { key: "notas", label: "Notas" },
    { key: "condiciones_meteo", label: "Meteo" },
    { key: "productos_usados", label: "Productos" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {entry ? "✏️ Editar Entrada" : "➕ Nueva Entrada"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>
          {/* Audio Recorder */}
          <div className="mt-3 p-3 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-800">
                🎙️ Dictado por voz
              </span>
              <span className="text-xs text-blue-600">
                — Selecciona campo y dicta
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {audioFields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveAudioField(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${
                    activeAudioField === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {activeAudioField && (
              <AudioRecorder onTranscription={handleTranscription} />
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Fecha *
              </label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            {/* Person */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                👤 Realizado por
              </label>
              <input
                type="text"
                value={form.realizado_por}
                onChange={(e) =>
                  setForm({ ...form, realizado_por: e.target.value })
                }
                placeholder="Nombre de quien realizó la tarea"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Parcela */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🌱 Parcela *
            </label>
            <select
              value={form.parcela_id}
              onChange={(e) => setForm({ ...form, parcela_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="">Seleccionar parcela...</option>
              {Object.entries(grouped).map(([cultivo, parcelas]) => (
                <optgroup
                  key={cultivo}
                  label={CULTIVO_LABELS[cultivo as TipoCultivo] || cultivo}
                >
                  {parcelas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {p.variedad} ({p.superficie_ha} ha)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📋 Tipo de Actividad *
            </label>
            <select
              value={form.tipo_actividad}
              onChange={(e) =>
                setForm({ ...form, tipo_actividad: e.target.value })
              }
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="">Seleccionar tipo...</option>
              {Object.entries(ACTIVIDAD_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📝 Descripción *
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              placeholder="Describe la actividad realizada..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Products and Dose */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🧪 Productos usados
              </label>
              <input
                type="text"
                value={form.productos_usados}
                onChange={(e) =>
                  setForm({ ...form, productos_usados: e.target.value })
                }
                placeholder="ej: Cobre, Azufre..."
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💊 Dosis
              </label>
              <input
                type="text"
                value={form.dosis}
                onChange={(e) => setForm({ ...form, dosis: e.target.value })}
                placeholder="ej: 2 L/ha"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Weather */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                🌤️ Condiciones meteorológicas
              </label>
              <button
                type="button"
                onClick={fetchWeather}
                disabled={loadingWeather}
                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-full transition flex items-center gap-1 disabled:opacity-50"
              >
                {loadingWeather
                  ? "⏳ Obteniendo..."
                  : "🌡️ Auto-rellenar clima actual"}
              </button>
            </div>
            <input
              type="text"
              value={form.condiciones_meteo}
              onChange={(e) =>
                setForm({ ...form, condiciones_meteo: e.target.value })
              }
              placeholder="ej: Soleado, 28°C, viento suave — o pulsa 'Auto-rellenar'"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Result */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📊 Resultado / Observaciones
            </label>
            <textarea
              value={form.resultado}
              onChange={(e) => setForm({ ...form, resultado: e.target.value })}
              placeholder="¿Cómo fue? ¿Qué se observó?"
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ⭐ Valoración
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, valoracion: star as 1 | 2 | 3 | 4 | 5 })
                  }
                  className="star"
                >
                  {star <= Number(form.valoracion || 0) ? "★" : "☆"}
                </button>
              ))}
              {Number(form.valoracion || 0) > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, valoracion: 0 as unknown as 1 })
                  }
                  className="text-sm text-gray-400 ml-2"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📌 Notas adicionales
            </label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Cualquier nota relevante..."
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 rounded-xl font-semibold transition"
            >
              {saving
                ? "💾 Guardando..."
                : entry
                  ? "💾 Actualizar"
                  : "💾 Guardar Entrada"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border rounded-xl text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Entry Detail Component (comments, history, media)
// ==========================================
function EntryDetail({
  entry,
  currentUser,
  onClose,
  onEdit,
}: {
  entry: EntradaDiario;
  currentUser: { id: string; nombre: string } | null;
  onClose: () => void;
  onEdit: (entry: EntradaDiario) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "detail" | "comments" | "history" | "media"
  >("detail");
  const [comments, setComments] = useState<Comentario[]>([]);
  const [history, setHistory] = useState<HistorialEdicion[]>([]);
  const [archivos, setArchivos] = useState<ArchivoMedia[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingTab, setLoadingTab] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingTab(true);
    try {
      const res = await fetch(`/api/comments?entrada_id=${entry.id}`);
      setComments(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTab(false);
    }
  }, [entry.id]);

  const loadHistory = useCallback(async () => {
    setLoadingTab(true);
    try {
      const res = await fetch(`/api/history?entrada_id=${entry.id}`);
      setHistory(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTab(false);
    }
  }, [entry.id]);

  const loadMedia = useCallback(async () => {
    setLoadingTab(true);
    try {
      const res = await fetch(`/api/upload?entrada_id=${entry.id}`);
      setArchivos(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTab(false);
    }
  }, [entry.id]);

  useEffect(() => {
    if (activeTab === "comments") loadComments();
    if (activeTab === "history") loadHistory();
    if (activeTab === "media") loadMedia();
  }, [activeTab, loadComments, loadHistory, loadMedia]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entrada_id: entry.id,
          usuario_id: currentUser.id,
          texto: newComment.trim(),
        }),
      });
      if (res.ok) {
        setNewComment("");
        loadComments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm("¿Eliminar comentario?")) return;
    await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    loadComments();
  };

  const tabs = [
    { key: "detail" as const, label: "📋 Detalle" },
    { key: "comments" as const, label: `💬 Comentarios` },
    { key: "media" as const, label: "📎 Archivos" },
    { key: "history" as const, label: "📜 Historial" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {ACTIVIDAD_LABELS[entry.tipo_actividad as TipoActividad]?.split(
                  " ",
                )[0] || "📝"}
              </span>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {ACTIVIDAD_LABELS[entry.tipo_actividad as TipoActividad] ||
                    entry.tipo_actividad}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{entry.fecha}</span>
                  <span>·</span>
                  <span className={`badge badge-${entry.cultivo}`}>
                    {entry.parcela_nombre}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(entry)}
                className="text-blue-500 hover:text-blue-700 p-2 text-lg"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Created by */}
          {entry.usuario_nombre && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
                style={{ backgroundColor: entry.usuario_color || "#888" }}
              >
                {entry.usuario_nombre.charAt(0)}
              </span>
              <span>
                Creado por <strong>{entry.usuario_nombre}</strong>
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-sm py-2 px-3 rounded-md transition font-medium ${
                  activeTab === tab.key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "detail" && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <p className="text-gray-700">{entry.descripcion}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {entry.realizado_por && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">👤 Realizado por</span>
                    <p className="font-medium mt-1">{entry.realizado_por}</p>
                  </div>
                )}
                {entry.productos_usados && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">🧪 Productos</span>
                    <p className="font-medium mt-1">{entry.productos_usados}</p>
                  </div>
                )}
                {entry.dosis && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">💊 Dosis</span>
                    <p className="font-medium mt-1">{entry.dosis}</p>
                  </div>
                )}
                {entry.condiciones_meteo && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">🌤️ Meteorología</span>
                    <p className="font-medium mt-1">
                      {entry.condiciones_meteo}
                    </p>
                  </div>
                )}
              </div>
              {entry.resultado && (
                <div className="p-3 bg-blue-50 rounded-lg text-blue-800">
                  <strong>📊 Resultado:</strong>
                  <p className="mt-1">{entry.resultado}</p>
                </div>
              )}
              {entry.notas && (
                <div className="p-3 bg-amber-50 rounded-lg text-amber-800">
                  <strong>📌 Notas:</strong>
                  <p className="mt-1">{entry.notas}</p>
                </div>
              )}
              {entry.valoracion ? (
                <div className="text-yellow-500 text-xl">
                  {"★".repeat(entry.valoracion)}
                  {"☆".repeat(5 - entry.valoracion)}
                </div>
              ) : null}
              <div className="text-xs text-gray-400 pt-2 border-t">
                Creado: {entry.created_at} · Actualizado: {entry.updated_at}
              </div>
            </div>
          )}

          {activeTab === "comments" && (
            <div className="animate-fade-in">
              {loadingTab ? (
                <div className="text-center py-8 text-gray-400">
                  Cargando...
                </div>
              ) : (
                <>
                  {/* Comments list */}
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-4xl mb-2">💬</div>
                        <p>No hay comentarios todavía</p>
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="flex gap-3 group">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5"
                            style={{
                              backgroundColor: c.usuario_color || "#888",
                            }}
                          >
                            {(c.usuario_nombre || "?").charAt(0)}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-700">
                                {c.usuario_nombre || "Anónimo"}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(c.created_at).toLocaleString("es-ES")}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{c.texto}</p>
                          </div>
                          {currentUser?.id === c.usuario_id && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-sm"
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* New comment form */}
                  {currentUser ? (
                    <div className="flex gap-3 pt-3 border-t">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{
                          backgroundColor: currentUser ? "#16a34a" : "#888",
                        }}
                      >
                        {currentUser?.nombre?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddComment()
                          }
                          placeholder="Escribe un comentario..."
                          className="flex-1 border rounded-xl px-4 py-2 text-sm"
                        />
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-gray-400 pt-3 border-t">
                      Selecciona un usuario para comentar
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="animate-fade-in">
              {loadingTab ? (
                <div className="text-center py-8 text-gray-400">
                  Cargando...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📜</div>
                  <p>No hay ediciones registradas</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: h.usuario_color || "#888" }}
                        >
                          {(h.usuario_nombre || "?").charAt(0)}
                        </div>
                        <div className="w-px flex-1 bg-gray-200 mt-1" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-700">
                            {h.usuario_nombre || "Sistema"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(h.created_at).toLocaleString("es-ES")}
                          </span>
                        </div>
                        <p className="text-gray-600">
                          Cambió <strong>{h.campo}</strong>
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-red-50 rounded-lg text-red-700 line-through">
                            {h.valor_anterior || "(vacío)"}
                          </div>
                          <div className="p-2 bg-green-50 rounded-lg text-green-700">
                            {h.valor_nuevo || "(vacío)"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "media" && (
            <div className="animate-fade-in">
              {loadingTab ? (
                <div className="text-center py-8 text-gray-400">
                  Cargando...
                </div>
              ) : (
                <MediaUpload
                  entradaId={entry.id}
                  usuarioId={currentUser?.id || ""}
                  archivos={archivos}
                  onUpload={(a) => setArchivos((prev) => [...prev, a])}
                  onDelete={(id) =>
                    setArchivos((prev) => prev.filter((a) => a.id !== id))
                  }
                  readOnly={!currentUser}
                />
              )}
              {!currentUser && archivos.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📎</div>
                  <p>No hay archivos adjuntos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

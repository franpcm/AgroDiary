"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ACTIVIDAD_LABELS,
  CULTIVO_LABELS,
  CATEGORIA_PRODUCTO_LABELS,
  AVATAR_COLORS,
  type EntradaDiario,
  type Parcela,
  type TipoActividad,
  type TipoCultivo,
  type Comentario,
  type HistorialEdicion,
  type ArchivoMedia,
  type ProductoMaquinaria,
  type CategoriaProducto,
} from "@/types";
import { useUser } from "@/context/UserContext";
import AudioRecorder, { type AutoFillFields } from "@/components/AudioRecorder";
import MediaUpload from "@/components/MediaUpload";
import MediaLightbox from "@/components/MediaLightbox";

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

export default function DiarioPage() {
  const { currentUser, users, refreshUsers } = useUser();
  const [entries, setEntries] = useState<EntradaDiario[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<EntradaDiario | null>(null);
  const [detailEntry, setDetailEntry] = useState<EntradaDiario | null>(null);
  const [filterFecha, setFilterFecha] = useState("");
  const [filterParcela, setFilterParcela] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCultivo, setFilterCultivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const ENTRIES_PER_PAGE = 20;

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterFecha) params.set("fecha", filterFecha);
    if (filterParcela) params.set("parcela_id", filterParcela);
    if (filterTipo) params.set("tipo", filterTipo);
    if (filterCultivo) params.set("cultivo", filterCultivo);
    params.set("limit", "500");

    const res = await fetch(`/api/entries?${params}`);
    const data = await res.json();
    setEntries(data.entries || []);
    setPage(1);
  }, [filterFecha, filterParcela, filterTipo, filterCultivo]);

  useEffect(() => {
    Promise.all([fetch("/api/parcelas").then((r) => r.json()), fetchEntries()])
      .then(([p]) => {
        setParcelas(p);
      })
      .finally(() => setLoading(false));
  }, [fetchEntries]);

  useEffect(() => {
    if (!loading) fetchEntries();
  }, [
    filterFecha,
    filterParcela,
    filterTipo,
    filterCultivo,
    fetchEntries,
    loading,
  ]);

  // Filtro local por búsqueda de texto
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
          e.parcela_nombre +
          " " +
          (e.tipo_actividad
            ? ACTIVIDAD_LABELS[e.tipo_actividad as TipoActividad] ||
              e.tipo_actividad
            : "")
        )
          .toLowerCase()
          .includes(busqueda.toLowerCase()),
      )
    : entries;

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta entrada?")) return;
    await fetch(`/api/entries?id=${id}`, { method: "DELETE" });
    fetchEntries();
  };

  const handleSave = async (
    entry: Partial<EntradaDiario>,
    extraParcelaIds?: string[],
    pendingFiles?: File[],
  ) => {
    const method = entry.id ? "PUT" : "POST";
    const payload = {
      ...entry,
      usuario_id: currentUser?.id || "",
      edit_usuario_id: currentUser?.id || "",
    };

    const createdEntryIds: string[] = [];

    if (!entry.id && extraParcelaIds && extraParcelaIds.length > 0) {
      // Multi-parcela: crear una entrada por cada parcela seleccionada
      const allParcelaIds = [entry.parcela_id, ...extraParcelaIds].filter(
        Boolean,
      );
      const results = await Promise.all(
        allParcelaIds.map((pid) =>
          fetch("/api/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, parcela_id: pid }),
          }).then((r) => r.json()),
        ),
      );
      results.forEach((r) => {
        if (r?.id) createdEntryIds.push(r.id);
      });
    } else {
      const res = await fetch("/api/entries", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result?.id) createdEntryIds.push(result.id);
    }

    // Upload pending files to all created entries
    if (pendingFiles && pendingFiles.length > 0 && createdEntryIds.length > 0) {
      for (const entryId of createdEntryIds) {
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entrada_id", entryId);
          formData.append("usuario_id", currentUser?.id || "");
          try {
            await fetch("/api/upload", { method: "POST", body: formData });
          } catch (err) {
            console.error("Error uploading file:", err);
          }
        }
      }
    }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            📝 Diario de Actividades
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
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
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200 flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          ➕ Nueva Entrada
        </button>
      </div>

      {/* Search + Filters */}
      <div className="card p-4 mb-6 space-y-3">
        {/* Buscador */}
        <div className="relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar en descripción, productos, notas, parcela..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm focus:border-green-400 focus:ring-2 focus:ring-green-300 focus:outline-none"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        {/* Filtros */}
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
            <label className="text-xs text-gray-500 block mb-1">Cultivo</label>
            <select
              value={filterCultivo}
              onChange={(e) => setFilterCultivo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(CULTIVO_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
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
          {(filterFecha ||
            filterParcela ||
            filterTipo ||
            filterCultivo ||
            busqueda) && (
            <button
              onClick={() => {
                setFilterFecha("");
                setFilterParcela("");
                setFilterTipo("");
                setFilterCultivo("");
                setBusqueda("");
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
          users={users}
          refreshUsers={refreshUsers}
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
      {filteredEntries.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-xl">
            No hay entradas
            {filterFecha ||
            filterParcela ||
            filterTipo ||
            filterCultivo ||
            busqueda
              ? " con estos filtros"
              : " todavía"}
          </p>
          <p className="mt-2">
            Pulsa &quot;Nueva Entrada&quot; para registrar la primera actividad
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries
            .slice((page - 1) * ENTRIES_PER_PAGE, page * ENTRIES_PER_PAGE)
            .map((entry) => (
              <div
                key={entry.id}
                className="card p-5 animate-fade-in cursor-pointer hover:shadow-lg transition"
                onClick={() => setDetailEntry(entry)}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail or activity icon */}
                  {entry.primera_foto ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                      <img
                        src={entry.primera_foto}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {(entry.archivos_count ?? 0) > 1 && (
                        <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
                          +{(entry.archivos_count ?? 1) - 1}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-3xl">
                      {ACTIVIDAD_LABELS[
                        entry.tipo_actividad as TipoActividad
                      ]?.split(" ")[0] || "📝"}
                    </div>
                  )}
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
                      {ACTIVIDAD_LABELS[
                        entry.tipo_actividad as TipoActividad
                      ] || entry.tipo_actividad}
                    </h3>
                    <p className="text-gray-600 mt-1">{entry.descripcion}</p>

                    {/* Details */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-500">
                      <span>📅 {entry.fecha}</span>
                      {entry.hora_inicio && (
                        <span>
                          🕐 {entry.hora_inicio}
                          {entry.hora_fin ? ` → ${entry.hora_fin}` : ""}
                        </span>
                      )}
                      {entry.gps_lat && (
                        <span className="text-emerald-600">📍 GPS</span>
                      )}
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
                      {(entry.archivos_count ?? 0) > 0 && (
                        <span className="text-xs text-gray-400">
                          📎 {entry.archivos_count} archivo
                          {(entry.archivos_count ?? 0) > 1 ? "s" : ""}
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

          {/* Paginación */}
          {filteredEntries.length > ENTRIES_PER_PAGE && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-30 hover:bg-gray-100 transition"
              >
                ← Anterior
              </button>
              {Array.from(
                {
                  length: Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE),
                },
                (_, i) => i + 1,
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                    p === page
                      ? "bg-green-600 text-white shadow"
                      : "border hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() =>
                  setPage((p) =>
                    Math.min(
                      Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE),
                      p + 1,
                    ),
                  )
                }
                disabled={
                  page >= Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE)
                }
                className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-30 hover:bg-gray-100 transition"
              >
                Siguiente →
              </button>
              <span className="text-sm text-gray-400 ml-4">
                {filteredEntries.length} entradas
              </span>
            </div>
          )}
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
  users,
  refreshUsers,
  onSave,
  onClose,
}: {
  parcelas: Parcela[];
  entry: EntradaDiario | null;
  currentUser: { id: string; nombre: string } | null;
  users: { id: string; nombre: string; avatar_color: string }[];
  refreshUsers: () => Promise<unknown>;
  onSave: (
    entry: Partial<EntradaDiario>,
    extraParcelaIds?: string[],
    pendingFiles?: File[],
  ) => void;
  onClose: () => void;
}) {
  const isEditing = !!entry?.id;

  // --- Parte de Trabajo: auto-captura de hora y GPS ---
  const [horaInicio] = useState(() => {
    if (entry?.hora_inicio) return entry.hora_inicio;
    if (!isEditing) {
      const now = new Date();
      return now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return "";
  });
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(
    entry?.gps_lat && entry?.gps_lng
      ? {
          lat: entry.gps_lat,
          lng: entry.gps_lng,
          accuracy: entry.gps_accuracy || 0,
        }
      : null,
  );
  const [gpsStatus, setGpsStatus] = useState<
    "loading" | "success" | "error" | "denied"
  >(entry?.gps_lat ? "success" : "loading");
  const gpsWatchRef = useRef<number | null>(null);

  const GPS_TARGET_ACCURACY = 10; // metros — objetivo de precisión

  // Helper to request GPS (used on mount and for retry)
  const requestGps = useCallback(() => {
    // Check secure context (geolocation requires HTTPS or localhost)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      console.warn(
        "GPS: no está en contexto seguro (HTTPS). La geolocalización no funcionará.",
      );
      setGpsStatus("error");
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");

    // Clear any previous watcher
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
    }

    // Use watchPosition — keeps refining until ≤ GPS_TARGET_ACCURACY m
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newAccuracy = Math.round(pos.coords.accuracy);
        setGpsLocation((prev) => {
          // Only update if this reading is better (lower accuracy number)
          if (prev && prev.accuracy <= newAccuracy) return prev;
          return {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: newAccuracy,
          };
        });
        setGpsStatus("success");
        // Stop watching only when we reach target precision
        if (
          newAccuracy <= GPS_TARGET_ACCURACY &&
          gpsWatchRef.current !== null
        ) {
          navigator.geolocation.clearWatch(gpsWatchRef.current);
          gpsWatchRef.current = null;
        }
      },
      (err) => {
        console.warn("GPS error:", err.code, err.message);
        // Only set error if we don't already have a location
        setGpsLocation((prev) => {
          if (prev) return prev; // keep existing location
          setGpsStatus(err.code === 1 ? "denied" : "error");
          return null;
        });
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    );

    // Fallback: quick low-accuracy fix while high-accuracy warms up
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation((prev) => {
          if (prev && prev.accuracy <= pos.coords.accuracy) return prev;
          return {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          };
        });
        setGpsStatus("success");
      },
      () => {
        /* watchPosition handles errors */
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  // Auto-request GPS on form open (new entries only)
  useEffect(() => {
    if (isEditing && entry?.gps_lat) return; // already has GPS
    requestGps();
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [isEditing, entry?.gps_lat, requestGps]);

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

  // Multi-parcela selection (only for new entries)
  const [selectedParcelas, setSelectedParcelas] = useState<string[]>(
    entry?.parcela_id ? [entry.parcela_id] : [],
  );

  const toggleParcela = (id: string) => {
    setSelectedParcelas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const [saving, setSaving] = useState(false);
  const [activeAudioField, setActiveAudioField] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<"field" | "autofill">("autofill");
  const [autoFillResult, setAutoFillResult] = useState<string | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [showParcelaSelector, setShowParcelaSelector] = useState(false);

  // --- Crear nuevo usuario inline ---
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserColor, setNewUserColor] = useState(
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  );
  const [creatingUser, setCreatingUser] = useState(false);

  const handleCreateUser = async () => {
    if (!newUserName.trim()) return;
    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newUserName.trim(),
          avatar_color: newUserColor,
          rol: "editor",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        await refreshUsers();
        // Auto-select the new user in realizado_por
        const current = (form.realizado_por as string)
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);
        setForm({
          ...form,
          realizado_por: [...current, created.nombre].join(", "),
        });
        setNewUserName("");
        setNewUserColor(
          AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        );
        setShowNewUserForm(false);
      }
    } catch (err) {
      console.error("Error creating user:", err);
    } finally {
      setCreatingUser(false);
    }
  };

  // --- Media: pending files for new entries, existing for edits ---
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<
    { file: File; url: string; type: "imagen" | "video" }[]
  >([]);
  const [existingMedia, setExistingMedia] = useState<ArchivoMedia[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Load existing media for edit mode
  useEffect(() => {
    if (isEditing && entry?.id) {
      fetch(`/api/upload?entrada_id=${entry.id}`)
        .then((r) => r.json())
        .then((data) => setExistingMedia(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isEditing, entry?.id]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [pendingPreviews]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setMediaError("");
    const newFiles: File[] = [];
    const newPreviews: { file: File; url: string; type: "imagen" | "video" }[] =
      [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        setMediaError(`${file.name}: Máximo 50MB`);
        continue;
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setMediaError(`${file.name}: Solo imágenes y vídeos`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" : "imagen",
      });
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
    setPendingPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePendingFile = (index: number) => {
    URL.revokeObjectURL(pendingPreviews[index].url);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingMedia = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await fetch(`/api/upload?id=${id}`, { method: "DELETE" });
      setExistingMedia((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const uploadFilesToEntry = async (entryId: string, files: File[]) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entrada_id", entryId);
      formData.append("usuario_id", currentUser?.id || "");
      await fetch("/api/upload", { method: "POST", body: formData });
    }
  };

  // Products catalog
  const [productCatalog, setProductCatalog] = useState<ProductoMaquinaria[]>(
    [],
  );
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    entry?.productos_usados
      ? entry.productos_usados
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] =
    useState<CategoriaProducto>("otro");

  // Fetch product catalog
  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductCatalog(Array.isArray(data) ? data : []))
      .catch(() => setProductCatalog([]));
  }, []);

  // Sync selected products to form field
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      productos_usados: selectedProducts.join(", "),
    }));
  }, [selectedProducts]);

  const toggleProduct = (name: string) => {
    setSelectedProducts((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  };

  const createAndAddProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newProductName.trim(),
          categoria: newProductCategory,
        }),
      });
      const prod = await res.json();
      if (prod.nombre) {
        setProductCatalog((prev) =>
          prev.some((p) => p.nombre === prod.nombre) ? prev : [...prev, prod],
        );
        setSelectedProducts((prev) =>
          prev.includes(prod.nombre) ? prev : [...prev, prod.nombre],
        );
        setNewProductName("");
        setShowNewProductForm(false);
      }
    } catch (e) {
      console.error("Error creando producto:", e);
    }
  };

  const filteredProducts = productCatalog.filter((p) =>
    p.nombre.toLowerCase().includes(productSearch.toLowerCase()),
  );

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

  const handleAutoFill = (fields: AutoFillFields, rawText: string) => {
    setForm((prev) => {
      const updated = { ...prev };
      const fieldKeys: (keyof AutoFillFields)[] = [
        "tipo_actividad",
        "descripcion",
        "productos_usados",
        "resultado",
        "notas",
        "condiciones_meteo",
      ];
      for (const key of fieldKeys) {
        const value = fields[key];
        if (value && value.trim()) {
          // Append to existing content or set new
          updated[key] = prev[key] ? `${prev[key]} ${value}` : value;
        }
      }
      return updated;
    });
    setAutoFillResult(rawText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing && selectedParcelas.length === 0) {
      alert("Selecciona al menos una parcela");
      return;
    }
    if (isEditing && !form.parcela_id) {
      alert("Selecciona una parcela");
      return;
    }
    if (!form.tipo_actividad || !form.descripcion) {
      alert("Rellena al menos el tipo de actividad y descripción");
      return;
    }

    // Warn if GPS not captured
    if (!gpsLocation && gpsStatus !== "denied") {
      const continuar = confirm(
        "⚠️ La ubicación GPS aún no se ha capturado.\n\n¿Deseas guardar sin ubicación?",
      );
      if (!continuar) return;
    }

    setSaving(true);

    // Capturar hora de fin al guardar
    const horaFin = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Añadir datos del Parte de Trabajo
    const parteTrabajoData = {
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      gps_lat: gpsLocation?.lat ?? null,
      gps_lng: gpsLocation?.lng ?? null,
      gps_accuracy: gpsLocation?.accuracy ?? null,
    };

    if (isEditing) {
      // For edits, upload new pending files directly
      if (pendingFiles.length > 0 && entry?.id) {
        setUploadingMedia(true);
        await uploadFilesToEntry(entry.id, pendingFiles);
        setUploadingMedia(false);
      }
      await onSave({
        ...form,
        ...parteTrabajoData,
      } as unknown as Partial<EntradaDiario>);
    } else {
      // Multi-parcela: first parcela goes in form, rest as extra
      const [firstParcela, ...restParcelas] = selectedParcelas;
      const formData = {
        ...form,
        parcela_id: firstParcela,
        ...parteTrabajoData,
      };
      await onSave(
        formData as unknown as Partial<EntradaDiario>,
        restParcelas,
        pendingFiles,
      );
    }
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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold">
              {entry ? "✏️ Editar Entrada" : "➕ Nueva Entrada"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl p-1"
            >
              ✕
            </button>
          </div>
          {/* Audio Recorder */}
          <div className="mt-2 sm:mt-3 rounded-xl overflow-hidden border border-blue-200">
            {/* Tabs */}
            <div className="flex">
              <button
                type="button"
                onClick={() => setAudioMode("field")}
                className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  audioMode === "field"
                    ? "bg-blue-500 text-white"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                🎙️ Dictar campo
              </button>
              <button
                type="button"
                onClick={() => setAudioMode("autofill")}
                className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  audioMode === "autofill"
                    ? "bg-purple-500 text-white"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                }`}
              >
                🪄 Auto-rellenar
              </button>
            </div>

            {audioMode === "field" ? (
              <div className="p-3 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-blue-600">
                    Selecciona un campo y graba o adjunta audio para rellenarlo
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
                  <AudioRecorder
                    onTranscription={handleTranscription}
                    mode="field"
                  />
                )}
              </div>
            ) : (
              <div className="p-3 bg-purple-50">
                <div className="mb-2">
                  <span className="text-xs text-purple-600">
                    Graba o adjunta un audio describiendo toda la actividad. La
                    IA extraerá automáticamente: tipo de actividad, descripción,
                    productos, resultado, notas y condiciones meteorológicas.
                  </span>
                </div>
                {autoFillResult && (
                  <div className="mb-3 p-2 bg-white rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-purple-800">
                        ✅ Campos detectados y rellenados
                      </span>
                      <button
                        type="button"
                        onClick={() => setAutoFillResult(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 italic mb-1">
                      &quot;
                      {autoFillResult.length > 120
                        ? autoFillResult.slice(0, 120) + "..."
                        : autoFillResult}
                      &quot;
                    </div>
                    <div className="text-xs text-purple-600">
                      Revisa los campos del formulario y ajusta lo que
                      necesites.
                    </div>
                  </div>
                )}
                <AudioRecorder
                  onTranscription={handleTranscription}
                  onAutoFill={handleAutoFill}
                  mode="autofill"
                />
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Parte de Trabajo: Auto-captura Info Bar */}
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="text-lg">📋</span>
              <h3 className="text-xs sm:text-sm font-bold text-emerald-800">
                Parte de Trabajo — Datos automáticos
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Hora de inicio */}
              <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">
                  🕐 Inicio
                </div>
                <div className="font-bold text-emerald-700 text-base sm:text-lg">
                  {horaInicio}
                </div>
              </div>
              {/* Técnico */}
              <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">👤 Técnico</div>
                <div className="font-bold text-emerald-700 flex items-center gap-2">
                  {currentUser ? (
                    <>
                      <span
                        className="inline-block w-6 h-6 rounded-full text-white text-xs font-bold text-center leading-6"
                        style={{
                          backgroundColor:
                            (
                              currentUser as unknown as {
                                avatar_color?: string;
                              }
                            ).avatar_color || "#16a34a",
                        }}
                      >
                        {currentUser.nombre.charAt(0)}
                      </span>
                      {currentUser.nombre}
                    </>
                  ) : (
                    <span className="text-gray-400">Sin usuario</span>
                  )}
                </div>
              </div>
              {/* GPS */}
              <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-gray-500">
                    📍 GPS
                  </span>
                  {gpsStatus !== "loading" && (
                    <button
                      type="button"
                      onClick={() => requestGps()}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      🔄
                    </button>
                  )}
                </div>
                {gpsStatus === "loading" && !gpsLocation && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <span className="animate-spin">⏳</span> Obteniendo
                    ubicación...
                  </div>
                )}
                {gpsLocation && (
                  <div>
                    <div className="font-mono text-xs text-emerald-700">
                      {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Precision indicator bar */}
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            gpsLocation.accuracy <= GPS_TARGET_ACCURACY
                              ? "bg-emerald-500"
                              : gpsLocation.accuracy <= 30
                                ? "bg-yellow-500"
                                : gpsLocation.accuracy <= 100
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.max(5, Math.min(100, (GPS_TARGET_ACCURACY / gpsLocation.accuracy) * 100))}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          gpsLocation.accuracy <= GPS_TARGET_ACCURACY
                            ? "text-emerald-600"
                            : gpsLocation.accuracy <= 30
                              ? "text-yellow-600"
                              : "text-red-500"
                        }`}
                      >
                        ±{gpsLocation.accuracy}m
                      </span>
                    </div>
                    <div className="text-xs mt-0.5">
                      {gpsLocation.accuracy <= GPS_TARGET_ACCURACY ? (
                        <span className="text-emerald-600 font-medium">
                          ✅ Precisión óptima
                        </span>
                      ) : gpsWatchRef.current !== null ? (
                        <span className="text-blue-500 flex items-center gap-1">
                          <span className="animate-pulse">📡</span> Refinando
                          precisión... (objetivo: ≤{GPS_TARGET_ACCURACY}m)
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          Precisión aceptable
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {gpsStatus === "denied" && !gpsLocation && (
                  <div className="text-xs text-amber-600">
                    <div className="flex items-center gap-1">
                      <span>⚠️</span> Permiso GPS denegado
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Activa la ubicación en los ajustes del navegador y pulsa
                      Reintentar
                    </div>
                  </div>
                )}
                {gpsStatus === "error" && !gpsLocation && (
                  <div className="text-xs text-red-500">
                    <div className="flex items-center gap-1">
                      <span>❌</span> GPS no disponible
                    </div>
                    {typeof window !== "undefined" &&
                      !window.isSecureContext && (
                        <div className="text-xs text-orange-600 mt-1 bg-orange-50 p-2 rounded">
                          La geolocalización requiere HTTPS. Si accedes por IP
                          de red local, usa <strong>https://</strong> o accede
                          desde <strong>localhost</strong>.
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                {/* Selected users as chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[36px] border rounded-lg px-2 py-1.5 bg-white">
                  {(form.realizado_por as string)
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full"
                      >
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{
                            backgroundColor:
                              users.find((u) => u.nombre === name)
                                ?.avatar_color || "#6b7280",
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </span>
                        {name}
                        <button
                          type="button"
                          onClick={() => {
                            const current = (form.realizado_por as string)
                              .split(",")
                              .map((n) => n.trim())
                              .filter((n) => n && n !== name);
                            setForm({
                              ...form,
                              realizado_por: current.join(", "),
                            });
                          }}
                          className="hover:text-red-600 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  {!(form.realizado_por as string).trim() && (
                    <span className="text-gray-400 text-sm py-0.5">
                      Seleccionar usuarios...
                    </span>
                  )}
                </div>
                {/* User buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {users.map((user) => {
                    const selected = (form.realizado_por as string)
                      .split(",")
                      .map((n) => n.trim())
                      .includes(user.nombre);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          const current = (form.realizado_por as string)
                            .split(",")
                            .map((n) => n.trim())
                            .filter(Boolean);
                          if (selected) {
                            setForm({
                              ...form,
                              realizado_por: current
                                .filter((n) => n !== user.nombre)
                                .join(", "),
                            });
                          } else {
                            setForm({
                              ...form,
                              realizado_por: [...current, user.nombre].join(
                                ", ",
                              ),
                            });
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                          selected
                            ? "bg-green-600 text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: user.avatar_color }}
                        >
                          {user.nombre.charAt(0).toUpperCase()}
                        </span>
                        {user.nombre}
                      </button>
                    );
                  })}
                  {/* Botón crear nuevo usuario */}
                  <button
                    type="button"
                    onClick={() => setShowNewUserForm(!showNewUserForm)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50"
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-gray-200 text-gray-500 text-sm font-bold">
                      +
                    </span>
                    Nuevo
                  </button>
                </div>
                {/* Formulario inline crear usuario */}
                {showNewUserForm && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex gap-1">
                      {AVATAR_COLORS.slice(0, 6).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewUserColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition ${newUserColor === color ? "border-gray-800 scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleCreateUser())
                      }
                      placeholder="Nombre..."
                      className="flex-1 border rounded-lg px-2 py-1 text-sm min-w-0"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      disabled={!newUserName.trim() || creatingUser}
                      className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingUser ? "..." : "Crear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewUserForm(false);
                        setNewUserName("");
                      }}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parcela */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🌱 Parcela{!isEditing ? "(s)" : ""} *
              {!isEditing && selectedParcelas.length > 1 && (
                <span className="ml-2 text-xs text-green-600 font-normal">
                  {selectedParcelas.length} parcelas seleccionadas — se creará
                  una entrada por cada una
                </span>
              )}
            </label>
            {isEditing ? (
              /* Editing: single select */
              <select
                value={form.parcela_id}
                onChange={(e) =>
                  setForm({ ...form, parcela_id: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Seleccionar parcela...</option>
                {Object.entries(grouped).map(([cultivo, parcelasList]) => (
                  <optgroup
                    key={cultivo}
                    label={CULTIVO_LABELS[cultivo as TipoCultivo] || cultivo}
                  >
                    {parcelasList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — {p.variedad} ({p.superficie_ha} ha)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              /* New entry: multi-select with checkboxes */
              <div>
                <button
                  type="button"
                  onClick={() => setShowParcelaSelector(!showParcelaSelector)}
                  className="w-full border rounded-lg px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span
                    className={
                      selectedParcelas.length === 0
                        ? "text-gray-400"
                        : "text-gray-800"
                    }
                  >
                    {selectedParcelas.length === 0
                      ? "Seleccionar parcela(s)..."
                      : selectedParcelas
                          .map(
                            (id) => parcelas.find((p) => p.id === id)?.nombre,
                          )
                          .filter(Boolean)
                          .join(", ")}
                  </span>
                  <span className="text-gray-400">
                    {showParcelaSelector ? "▲" : "▼"}
                  </span>
                </button>
                {showParcelaSelector && (
                  <div className="border rounded-lg mt-1 max-h-60 overflow-y-auto bg-white shadow-lg">
                    {/* Quick actions */}
                    <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedParcelas(parcelas.map((p) => p.id))
                        }
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Seleccionar todas
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedParcelas([])}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Limpiar
                      </button>
                    </div>
                    {Object.entries(grouped).map(([cultivo, parcelasList]) => {
                      // Sub-agrupar por variedad dentro de cada cultivo
                      const byVariedad = parcelasList.reduce(
                        (acc, p) => {
                          const v = p.variedad || "Sin variedad";
                          if (!acc[v]) acc[v] = [];
                          acc[v].push(p);
                          return acc;
                        },
                        {} as Record<string, Parcela[]>,
                      );
                      const variedades = Object.keys(byVariedad);
                      const hasMultipleVariedades = variedades.length > 1;

                      return (
                        <div key={cultivo}>
                          <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 flex items-center justify-between">
                            <span>
                              {CULTIVO_LABELS[cultivo as TipoCultivo] ||
                                cultivo}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = parcelasList.map((p) => p.id);
                                const allSelected = ids.every((id) =>
                                  selectedParcelas.includes(id),
                                );
                                if (allSelected) {
                                  setSelectedParcelas((prev) =>
                                    prev.filter((id) => !ids.includes(id)),
                                  );
                                } else {
                                  setSelectedParcelas((prev) => [
                                    ...new Set([...prev, ...ids]),
                                  ]);
                                }
                              }}
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {parcelasList.every((p) =>
                                selectedParcelas.includes(p.id),
                              )
                                ? "Deseleccionar todo"
                                : "Seleccionar todo"}
                            </button>
                          </div>
                          {/* Botones rápidos por variedad */}
                          {hasMultipleVariedades && (
                            <div className="px-3 py-1.5 bg-white border-b flex flex-wrap gap-1.5">
                              {variedades.map((variedad) => {
                                const vIds = byVariedad[variedad].map(
                                  (p) => p.id,
                                );
                                const allVSelected = vIds.every((id) =>
                                  selectedParcelas.includes(id),
                                );
                                return (
                                  <button
                                    key={variedad}
                                    type="button"
                                    onClick={() => {
                                      if (allVSelected) {
                                        setSelectedParcelas((prev) =>
                                          prev.filter(
                                            (id) => !vIds.includes(id),
                                          ),
                                        );
                                      } else {
                                        setSelectedParcelas((prev) => [
                                          ...new Set([...prev, ...vIds]),
                                        ]);
                                      }
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition border ${
                                      allVSelected
                                        ? "bg-green-600 text-white border-green-600"
                                        : "bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-700"
                                    }`}
                                  >
                                    {allVSelected ? "✓ " : ""}
                                    {variedad} ({byVariedad[variedad].length})
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {parcelasList.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedParcelas.includes(p.id)}
                                onChange={() => toggleParcela(p.id)}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="text-sm">
                                {p.nombre} — {p.variedad}
                                {p.superficie_ha > 0
                                  ? ` (${p.superficie_ha} ha)`
                                  : ""}
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🧪 Productos / Maquinaria
                {selectedProducts.length > 0 && (
                  <span className="ml-2 text-xs text-green-600 font-normal">
                    {selectedProducts.length} seleccionado
                    {selectedProducts.length > 1 ? "s" : ""}
                  </span>
                )}
              </label>
              {/* Selected products tags */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedProducts.map((name) => {
                    const prod = productCatalog.find((p) => p.nombre === name);
                    return (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-800 px-2 py-1 rounded-full border border-green-200"
                      >
                        {CATEGORIA_PRODUCTO_LABELS[
                          prod?.categoria as CategoriaProducto
                        ]?.split(" ")[0] || "📦"}{" "}
                        {name}
                        <button
                          type="button"
                          onClick={() => toggleProduct(name)}
                          className="text-green-500 hover:text-red-500 ml-0.5"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Selector button */}
              <button
                type="button"
                onClick={() => setShowProductSelector(!showProductSelector)}
                className="w-full border rounded-lg px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 text-sm"
              >
                <span className="text-gray-400">
                  Buscar o añadir producto/maquinaria...
                </span>
                <span className="text-gray-400">
                  {showProductSelector ? "▲" : "▼"}
                </span>
              </button>
              {showProductSelector && (
                <div className="border rounded-lg mt-1 bg-white shadow-lg z-20 relative">
                  {/* Search */}
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto o máquina..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm"
                      autoFocus
                    />
                  </div>
                  {/* Product list */}
                  <div className="max-h-48 overflow-y-auto">
                    {Object.entries(
                      filteredProducts.reduce(
                        (acc, p) => {
                          const cat = p.categoria || "otro";
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(p);
                          return acc;
                        },
                        {} as Record<string, ProductoMaquinaria[]>,
                      ),
                    ).map(([cat, prods]) => (
                      <div key={cat}>
                        <div className="px-3 py-1 bg-gray-50 text-xs font-semibold text-gray-500">
                          {CATEGORIA_PRODUCTO_LABELS[
                            cat as CategoriaProducto
                          ] || cat}
                        </div>
                        {prods.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-green-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(p.nombre)}
                              onChange={() => toggleProduct(p.nombre)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm">{p.nombre}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                    {filteredProducts.length === 0 && productSearch && (
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">
                        No se encontró &quot;{productSearch}&quot;
                      </div>
                    )}
                  </div>
                  {/* Create new product */}
                  <div className="border-t p-2">
                    {!showNewProductForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewProductForm(true);
                          setNewProductName(productSearch);
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-800 py-1 flex items-center justify-center gap-1"
                      >
                        ➕ Crear nuevo producto/maquinaria
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="Nombre del producto o máquina..."
                          className="w-full border rounded-lg px-3 py-1.5 text-sm"
                          autoFocus
                        />
                        <select
                          value={newProductCategory}
                          onChange={(e) =>
                            setNewProductCategory(
                              e.target.value as CategoriaProducto,
                            )
                          }
                          className="w-full border rounded-lg px-3 py-1.5 text-sm"
                        >
                          {Object.entries(CATEGORIA_PRODUCTO_LABELS).map(
                            ([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ),
                          )}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={createAndAddProduct}
                            disabled={!newProductName.trim()}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm py-1.5 rounded-lg"
                          >
                            ✓ Crear y añadir
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewProductForm(false);
                              setNewProductName("");
                            }}
                            className="px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                🌤️ Condiciones meteorológicas
              </label>
              <button
                type="button"
                onClick={fetchWeather}
                disabled={loadingWeather}
                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-full transition flex items-center gap-1 disabled:opacity-50 self-start sm:self-auto"
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

          {/* Media: Photos & Videos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📸 Fotos y Vídeos
            </label>

            {/* Existing media (edit mode) */}
            {existingMedia.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {existingMedia.map((a) => (
                  <div
                    key={a.id}
                    className="relative group rounded-lg overflow-hidden border bg-gray-50"
                  >
                    {a.tipo === "imagen" ? (
                      <img
                        src={a.url}
                        alt={a.nombre}
                        className="w-full h-24 object-cover"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-gray-900">
                        <video
                          src={a.url}
                          className="max-h-full max-w-full"
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-2xl">
                          ▶
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingMedia(a.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending files preview */}
            {pendingPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {pendingPreviews.map((p, i) => (
                  <div
                    key={i}
                    className="relative group rounded-lg overflow-hidden border-2 border-dashed border-green-300 bg-green-50"
                  >
                    {p.type === "imagen" ? (
                      <img
                        src={p.url}
                        alt={p.file.name}
                        className="w-full h-24 object-cover"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-gray-900">
                        <video
                          src={p.url}
                          className="max-h-full max-w-full"
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-2xl">
                          ▶
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 py-0.5 truncate">
                      {p.file.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                    >
                      ✕
                    </button>
                    <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      Nuevo
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition border border-blue-200"
              >
                📷 Hacer foto
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-2 rounded-lg transition border border-purple-200"
              >
                🎥 Grabar vídeo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg transition border border-gray-200"
              >
                📎 Adjuntar archivo
              </button>
              {(pendingPreviews.length > 0 || existingMedia.length > 0) && (
                <span className="text-xs text-gray-400 self-center ml-auto">
                  {existingMedia.length + pendingPreviews.length} archivo
                  {existingMedia.length + pendingPreviews.length !== 1
                    ? "s"
                    : ""}
                  {pendingPreviews.length > 0 &&
                    ` (${pendingPreviews.length} nuevo${pendingPreviews.length !== 1 ? "s" : ""})`}
                </span>
              )}
            </div>
            {mediaError && (
              <p className="text-red-500 text-xs mt-1">{mediaError}</p>
            )}
            {uploadingMedia && (
              <p className="text-blue-600 text-xs mt-1 flex items-center gap-1">
                <span className="animate-spin">⏳</span> Subiendo archivos...
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 rounded-xl font-semibold transition"
            >
              {saving
                ? uploadingMedia
                  ? "📤 Subiendo archivos..."
                  : "💾 Guardando..."
                : entry
                  ? "💾 Actualizar"
                  : pendingFiles.length > 0
                    ? `💾 Guardar con ${pendingFiles.length} archivo${pendingFiles.length !== 1 ? "s" : ""}`
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
    // Always load media on mount for detail view
    loadMedia();
  }, [loadMedia]);

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
              {/* Parte de Trabajo Info */}
              {(entry.hora_inicio || entry.gps_lat) && (
                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">📋</span>
                    <h4 className="text-sm font-bold text-emerald-800">
                      Parte de Trabajo
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {entry.hora_inicio && (
                      <div className="bg-white rounded-lg p-2.5 shadow-sm">
                        <div className="text-xs text-gray-500">🕐 Inicio</div>
                        <div className="font-bold text-emerald-700">
                          {entry.hora_inicio}
                        </div>
                      </div>
                    )}
                    {entry.hora_fin && (
                      <div className="bg-white rounded-lg p-2.5 shadow-sm">
                        <div className="text-xs text-gray-500">🕑 Fin</div>
                        <div className="font-bold text-emerald-700">
                          {entry.hora_fin}
                        </div>
                      </div>
                    )}
                    {entry.hora_inicio && entry.hora_fin && (
                      <div className="bg-white rounded-lg p-2.5 shadow-sm">
                        <div className="text-xs text-gray-500">⏱️ Duración</div>
                        <div className="font-bold text-emerald-700">
                          {(() => {
                            try {
                              const [h1, m1, s1] = entry.hora_inicio
                                .split(":")
                                .map(Number);
                              const [h2, m2, s2] = entry.hora_fin
                                .split(":")
                                .map(Number);
                              const diffSec =
                                h2 * 3600 +
                                m2 * 60 +
                                (s2 || 0) -
                                (h1 * 3600 + m1 * 60 + (s1 || 0));
                              if (diffSec < 0) return "—";
                              const hours = Math.floor(diffSec / 3600);
                              const mins = Math.floor((diffSec % 3600) / 60);
                              return hours > 0
                                ? `${hours}h ${mins}min`
                                : `${mins}min`;
                            } catch {
                              return "—";
                            }
                          })()}
                        </div>
                      </div>
                    )}
                    {entry.gps_lat && entry.gps_lng && (
                      <div className="bg-white rounded-lg p-2.5 shadow-sm">
                        <div className="text-xs text-gray-500">
                          📍 Localización
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${entry.gps_lat},${entry.gps_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-600 hover:underline"
                        >
                          {entry.gps_lat.toFixed(5)}, {entry.gps_lng.toFixed(5)}
                        </a>
                        {entry.gps_accuracy && (
                          <div className="text-xs text-gray-400">
                            ±{entry.gps_accuracy}m
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

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

              {/* Photos / Videos Gallery in Detail View */}
              {archivos.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    📸 Fotos y Vídeos ({archivos.length})
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {archivos.map((a, index) => (
                      <div
                        key={a.id}
                        className="relative group rounded-lg overflow-hidden border bg-gray-50 cursor-pointer"
                        onClick={() => setLightboxIndex(index)}
                      >
                        {a.tipo === "imagen" ? (
                          <img
                            src={a.url}
                            alt={a.nombre}
                            className="w-full h-24 object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center bg-gray-900 relative">
                            <video
                              src={a.url}
                              className="max-h-full max-w-full"
                              preload="metadata"
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-white text-2xl bg-black/30">
                              ▶
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                          <span className="text-white text-lg opacity-0 group-hover:opacity-100 transition drop-shadow-lg">
                            🔍
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* Lightbox for full-screen media viewing */}
      {lightboxIndex !== null && archivos.length > 0 && (
        <MediaLightbox
          archivos={archivos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

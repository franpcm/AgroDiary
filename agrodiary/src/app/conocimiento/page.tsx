"use client";

import { useEffect, useState, useCallback } from "react";

interface RagDocumento {
  id: string;
  nombre_archivo: string;
  tipo_archivo: string;
  titulo: string;
  tipo: string;
  cultivo: string;
  contexto_adicional: string;
  tamano: number;
  num_chunks: number;
  estado: "procesando" | "listo" | "error";
  error_msg: string;
  created_at: string;
}

interface LegacyDoc {
  id: string;
  titulo: string;
  tipo: string;
  cultivo: string;
  created_at: string;
}

interface RAGStats {
  total_documentos: number;
  total_chunks: number;
  chunks_con_embedding: number;
  entradas_indexadas: number;
  documentos_ia_indexados: number;
}

const TIPO_LABELS: Record<string, string> = {
  manual: "📖 Manual",
  calendario: "📅 Calendario",
  tratamiento: "💊 Tratamiento",
  analisis: "🔬 Análisis",
  otro: "📝 Otro",
};

const CULTIVO_LABELS: Record<string, string> = {
  pistacho: "🌰 Pistacho",
  viñedo: "🍇 Viñedo",
  olivo: "🫒 Olivo",
  "": "🌿 General",
};

export default function ConocimientoPage() {
  const [documentos, setDocumentos] = useState<RagDocumento[]>([]);
  const [legacy, setLegacy] = useState<LegacyDoc[]>([]);
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showTextForm, setShowTextForm] = useState(false);
  const [reindexing, setReindexing] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitulo, setUploadTitulo] = useState("");
  const [uploadTipo, setUploadTipo] = useState("manual");
  const [uploadCultivo, setUploadCultivo] = useState("");
  const [uploadContexto, setUploadContexto] = useState("");

  // Text form state
  const [textTitulo, setTextTitulo] = useState("");
  const [textContenido, setTextContenido] = useState("");
  const [textTipo, setTextTipo] = useState("manual");
  const [textCultivo, setTextCultivo] = useState("");
  const [textContexto, setTextContexto] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      setDocumentos(data.documentos || []);
      setLegacy(data.legacy || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Subir archivo
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("titulo", uploadTitulo || uploadFile.name);
      formData.append("tipo", uploadTipo);
      formData.append("cultivo", uploadCultivo);
      formData.append("contexto", uploadContexto);

      const res = await fetch("/api/knowledge", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        showMsg(
          "success",
          `Documento procesado: ${data.chunks} fragmentos creados`,
        );
        setShowUploadForm(false);
        setUploadFile(null);
        setUploadTitulo("");
        setUploadContexto("");
        loadData();
      } else {
        showMsg("error", data.error || "Error al procesar archivo");
      }
    } catch {
      showMsg("error", "Error de conexión");
    } finally {
      setUploading(false);
    }
  };

  // Añadir texto manual
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: textTitulo,
          contenido: textContenido,
          tipo: textTipo,
          cultivo: textCultivo,
          contexto: textContexto,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        showMsg(
          "success",
          `Documento añadido: ${data.chunks} fragmentos creados`,
        );
        setShowTextForm(false);
        setTextTitulo("");
        setTextContenido("");
        setTextContexto("");
        loadData();
      } else {
        showMsg("error", data.error || "Error al guardar");
      }
    } catch {
      showMsg("error", "Error de conexión");
    } finally {
      setUploading(false);
    }
  };

  // Eliminar documento
  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este documento y todos sus fragmentos?")) return;

    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showMsg("success", "Documento eliminado");
        loadData();
      }
    } catch {
      showMsg("error", "Error al eliminar");
    }
  };

  // Reindexar
  const handleReindex = async (action: string) => {
    setReindexing(action);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showMsg("success", data.message);
        loadData();
      } else {
        showMsg("error", data.error || "Error");
      }
    } catch {
      showMsg("error", "Error de conexión");
    } finally {
      setReindexing("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl animate-spin-slow">📚</div>
          <p className="mt-4 text-gray-500">Cargando base de conocimiento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            📚 Base de Conocimiento
          </h1>
          <p className="text-gray-500 mt-1">
            Sube documentos para que el asistente IA los use como referencia
            (RAG)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowUploadForm(true);
              setShowTextForm(false);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold transition flex items-center gap-2"
          >
            📄 Subir Archivo
          </button>
          <button
            onClick={() => {
              setShowTextForm(true);
              setShowUploadForm(false);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold transition flex items-center gap-2"
          >
            ✏️ Añadir Texto
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-xl ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Documentos"
            value={stats.total_documentos}
            icon="📄"
            color="blue"
          />
          <StatCard
            label="Fragmentos"
            value={stats.total_chunks}
            icon="🧩"
            color="purple"
          />
          <StatCard
            label="Con Embedding"
            value={stats.chunks_con_embedding}
            icon="🧠"
            color="green"
          />
          <StatCard
            label="Entradas Diario"
            value={stats.entradas_indexadas}
            icon="📋"
            color="orange"
          />
          <StatCard
            label="Docs IA Legacy"
            value={stats.documentos_ia_indexados}
            icon="📚"
            color="teal"
          />
        </div>
      )}

      {/* Reindex Actions */}
      <div className="mb-8 p-4 bg-gray-50 rounded-xl border">
        <h3 className="font-semibold text-gray-700 mb-3">
          ⚙️ Acciones de indexación
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleReindex("reindex-entries")}
            disabled={!!reindexing}
            className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {reindexing === "reindex-entries"
              ? "⏳ Indexando..."
              : "📋 Indexar entradas del diario"}
          </button>
          <button
            onClick={() => handleReindex("reindex-legacy")}
            disabled={!!reindexing}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {reindexing === "reindex-legacy"
              ? "⏳ Indexando..."
              : "📚 Reindexar docs IA legacy"}
          </button>
          <p className="text-gray-400 text-xs self-center">
            Las nuevas entradas de diario se indexan automáticamente al crearlas
            o editarlas.
          </p>
        </div>
      </div>

      {/* Documentos RAG */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          📄 Documentos subidos
        </h2>
        {documentos.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
            <div className="text-5xl mb-3">📁</div>
            <p className="text-gray-500 mb-2">No hay documentos todavía</p>
            <p className="text-gray-400 text-sm">
              Sube PDFs, Word, Excel, TXTs o pega texto para ampliar la base de
              conocimiento del asistente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border p-4 flex items-center gap-4 hover:shadow-md transition"
              >
                <div className="text-3xl">
                  {doc.tipo_archivo === "pdf"
                    ? "📕"
                    : doc.tipo_archivo === "txt"
                      ? "📝"
                      : doc.tipo_archivo === "xlsx" ||
                          doc.tipo_archivo === "xls"
                        ? "📊"
                        : doc.tipo_archivo === "doc" ||
                            doc.tipo_archivo === "docx"
                          ? "📃"
                          : "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {doc.titulo}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <span>{doc.nombre_archivo}</span>
                    <span>•</span>
                    <span>{formatSize(doc.tamano)}</span>
                    <span>•</span>
                    <span>{doc.num_chunks} fragmentos</span>
                    {doc.cultivo && (
                      <>
                        <span>•</span>
                        <span>
                          {CULTIVO_LABELS[doc.cultivo] || doc.cultivo}
                        </span>
                      </>
                    )}
                  </div>
                  {doc.contexto_adicional && (
                    <p
                      className="text-xs text-amber-600 mt-1 truncate"
                      title={doc.contexto_adicional}
                    >
                      💡 {doc.contexto_adicional}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      doc.estado === "listo"
                        ? "bg-green-100 text-green-700"
                        : doc.estado === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {doc.estado === "listo"
                      ? "✅ Listo"
                      : doc.estado === "error"
                        ? `❌ ${doc.error_msg || "Error"}`
                        : "⏳ Procesando"}
                  </span>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentos legacy */}
      {legacy.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📚 Documentos IA (legacy)
          </h2>
          <p className="text-gray-400 text-sm mb-3">
            Estos son los documentos del sistema anterior. Usa &quot;Reindexar
            docs IA legacy&quot; para generar embeddings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {legacy.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-700">{doc.titulo}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                  <span>{TIPO_LABELS[doc.tipo] || doc.tipo}</span>
                  {doc.cultivo && (
                    <span>• {CULTIVO_LABELS[doc.cultivo] || doc.cultivo}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cómo funciona */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          🧠 ¿Cómo funciona el RAG?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Step
            num={1}
            title="Subes un documento"
            desc="PDF, Word, Excel, TXT o texto manual con información agrícola"
          />
          <Step
            num={2}
            title="Se fragmenta"
            desc="El texto se divide en fragmentos manejables (chunks)"
          />
          <Step
            num={3}
            title="Se genera embedding"
            desc="Cada fragmento se convierte en un vector numérico (OpenAI)"
          />
          <Step
            num={4}
            title="Búsqueda inteligente"
            desc="Cuando preguntas algo, se buscan los fragmentos más relevantes"
          />
        </div>
        <p className="text-gray-500 text-sm mt-4">
          Además, cada vez que registras una actividad en el diario, se indexa
          automáticamente. Así el asistente puede consultar todo el historial de
          la finca.
        </p>
      </div>

      {/* Upload File Modal */}
      {showUploadForm && (
        <Modal onClose={() => setShowUploadForm(false)}>
          <h2 className="text-xl font-bold mb-4">📄 Subir Archivo</h2>
          <p className="text-gray-500 text-sm mb-4">
            Sube un PDF, archivo de texto, Word o Excel. El contenido se
            extraerá automáticamente.
          </p>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Archivo (PDF, DOC, DOCX, TXT, MD, CSV, XLSX)
              </label>
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.xlsx,.xls,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setUploadFile(f);
                  if (f && !uploadTitulo)
                    setUploadTitulo(f.name.replace(/\.[^.]+$/, ""));
                }}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input
                value={uploadTitulo}
                onChange={(e) => setUploadTitulo(e.target.value)}
                placeholder="ej: Manual de riego pistacho"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={uploadTipo}
                  onChange={(e) => setUploadTipo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="manual">Manual / Guía</option>
                  <option value="calendario">Calendario de tareas</option>
                  <option value="tratamiento">Tratamiento</option>
                  <option value="analisis">Análisis</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cultivo
                </label>
                <select
                  value={uploadCultivo}
                  onChange={(e) => setUploadCultivo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">General</option>
                  <option value="pistacho">Pistacho</option>
                  <option value="viñedo">Viñedo</option>
                  <option value="olivo">Olivo</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Información adicional{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={uploadContexto}
                onChange={(e) => setUploadContexto(e.target.value)}
                placeholder="ej: Análisis de suelo de la parcela 3 (zona norte), realizado en enero 2026"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Añade contexto que no aparezca en el archivo: zona, fecha,
                parcela, observaciones...
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2.5 rounded-xl font-semibold"
              >
                {uploading ? "⏳ Procesando..." : "📤 Subir y Procesar"}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-6 py-2 border rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Text Input Modal */}
      {showTextForm && (
        <Modal onClose={() => setShowTextForm(false)}>
          <h2 className="text-xl font-bold mb-4">
            ✏️ Añadir Documento de Texto
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Pega el contenido de un manual, guía o informe directamente.
          </p>
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input
                value={textTitulo}
                onChange={(e) => setTextTitulo(e.target.value)}
                placeholder="ej: Guía de tratamientos fitosanitarios"
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={textTipo}
                  onChange={(e) => setTextTipo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="manual">Manual / Guía</option>
                  <option value="calendario">Calendario de tareas</option>
                  <option value="tratamiento">Tratamiento</option>
                  <option value="analisis">Análisis</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cultivo
                </label>
                <select
                  value={textCultivo}
                  onChange={(e) => setTextCultivo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">General</option>
                  <option value="pistacho">Pistacho</option>
                  <option value="viñedo">Viñedo</option>
                  <option value="olivo">Olivo</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Contenido
              </label>
              <textarea
                value={textContenido}
                onChange={(e) => setTextContenido(e.target.value)}
                placeholder="Pega aquí el contenido del documento..."
                rows={12}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Información adicional{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={textContexto}
                onChange={(e) => setTextContexto(e.target.value)}
                placeholder="ej: Protocolo para parcelas del sector sur, aplicar solo en primavera"
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Añade contexto adicional: zona, parcela, circunstancias
                relevantes...
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading || !textTitulo || !textContenido}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2.5 rounded-xl font-semibold"
              >
                {uploading ? "⏳ Procesando..." : "💾 Guardar y Procesar"}
              </button>
              <button
                type="button"
                onClick={() => setShowTextForm(false)}
                className="px-6 py-2 border rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---- Componentes auxiliares ----

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    green: "bg-green-50 border-green-200 text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    teal: "bg-teal-50 border-teal-200 text-teal-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{label}</div>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto mb-2 font-bold">
        {num}
      </div>
      <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      <p className="text-gray-500 text-xs mt-1">{desc}</p>
    </div>
  );
}

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

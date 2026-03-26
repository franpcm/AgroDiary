// ==========================================
// AgroDiary - Sistema RAG (Retrieval-Augmented Generation)
// ==========================================
// Chunking, embeddings, y búsqueda semántica
// ==========================================

import { getDb } from "./db";
import { v4 as uuid } from "uuid";
import OpenAI from "openai";

// ---- Configuración ----
const CHUNK_SIZE = 800; // ~800 caracteres por chunk
const CHUNK_OVERLAP = 150; // solapamiento entre chunks
const EMBEDDING_MODEL = "text-embedding-3-small";
const TOP_K = 8; // número de chunks relevantes a devolver

// ---- Tipos ----
export interface RagDocumento {
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

export interface RagChunk {
  id: string;
  documento_id: string;
  fuente_tipo: "documento" | "entrada_diario" | "documento_ia";
  fuente_id: string;
  contenido: string;
  chunk_index: number;
  embedding: string; // JSON array of numbers
  created_at: string;
}

export interface SearchResult {
  contenido: string;
  fuente_tipo: string;
  fuente_id: string;
  titulo?: string;
  similarity: number;
}

// ---- Funciones de OpenAI ----
function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "tu-api-key-aqui") return null;
  return new OpenAI({ apiKey });
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // Limitar a 8K chars
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generando embedding:", error);
    return null;
  }
}

async function generateEmbeddings(
  texts: string[],
): Promise<(number[] | null)[]> {
  const openai = getOpenAI();
  if (!openai) return texts.map(() => null);

  try {
    // Procesar en lotes de 100
    const results: (number[] | null)[] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100).map((t) => t.slice(0, 8000));
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });
      for (const item of response.data) {
        results.push(item.embedding);
      }
    }
    return results;
  } catch (error) {
    console.error("Error generando embeddings en lote:", error);
    return texts.map(() => null);
  }
}

// ---- Chunking ----
export function splitIntoChunks(text: string): string[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);

    // Intentar cortar en un salto de párrafo
    if (end < cleaned.length) {
      const paragraphBreak = cleaned.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + CHUNK_SIZE / 2) {
        end = paragraphBreak + 2;
      } else {
        // Intentar cortar en un punto
        const sentenceBreak = cleaned.lastIndexOf(". ", end);
        if (sentenceBreak > start + CHUNK_SIZE / 2) {
          end = sentenceBreak + 2;
        } else {
          // Cortar en un espacio
          const spaceBreak = cleaned.lastIndexOf(" ", end);
          if (spaceBreak > start + CHUNK_SIZE / 2) {
            end = spaceBreak + 1;
          }
        }
      }
    }

    chunks.push(cleaned.slice(start, end).trim());
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks.filter((c) => c.length > 20); // Filtrar chunks muy pequeños
}

// ---- Similitud coseno ----
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---- Extracción de texto de archivos ----
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (ext === "txt" || ext === "md" || ext === "csv") {
    return buffer.toString("utf-8");
  }

  if (ext === "xlsx" || ext === "xls") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (workbook.SheetNames.length > 1) {
        lines.push(`--- Hoja: ${sheetName} ---`);
      }
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });
      for (const row of rows) {
        const text = row
          .map((c: unknown) => String(c ?? "").trim())
          .filter(Boolean)
          .join(" | ");
        if (text) lines.push(text);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  if (ext === "docx") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (ext === "doc") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WordExtractor = require("word-extractor");
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return doc.getBody() || "";
  }

  throw new Error(
    `Formato de archivo no soportado: .${ext}. Usa PDF, DOC, DOCX, TXT, MD, CSV o XLSX.`,
  );
}

// ---- Procesar y almacenar documento ----
export async function processDocument(
  documentId: string,
  text: string,
  fuenteTipo: "documento" | "entrada_diario" | "documento_ia" = "documento",
  fuenteId?: string,
): Promise<{ chunks: number; error?: string }> {
  const db = getDb();

  try {
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) {
      throw new Error("No se pudo extraer texto del documento");
    }

    // Generar embeddings
    const embeddings = await generateEmbeddings(chunks);

    // Insertar chunks
    const stmt = db.prepare(`
      INSERT INTO rag_chunks (id, documento_id, fuente_tipo, fuente_id, contenido, chunk_index, embedding)
      VALUES (@id, @documento_id, @fuente_tipo, @fuente_id, @contenido, @chunk_index, @embedding)
    `);

    const insertAll = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        stmt.run({
          id: uuid(),
          documento_id: documentId,
          fuente_tipo: fuenteTipo,
          fuente_id: fuenteId || documentId,
          contenido: chunks[i],
          chunk_index: i,
          embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : "",
        });
      }
    });

    insertAll();

    // Actualizar estado del documento
    if (fuenteTipo === "documento") {
      db.prepare(
        `
        UPDATE rag_documentos SET estado = 'listo', num_chunks = ? WHERE id = ?
      `,
      ).run(chunks.length, documentId);
    }

    return { chunks: chunks.length };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Error desconocido";
    if (fuenteTipo === "documento") {
      db.prepare(
        `
        UPDATE rag_documentos SET estado = 'error', error_msg = ? WHERE id = ?
      `,
      ).run(errorMsg, documentId);
    }
    return { chunks: 0, error: errorMsg };
  }
}

// ---- Indexar entrada de diario ----
export async function indexDiaryEntry(entryId: string): Promise<void> {
  const db = getDb();

  try {
    // Obtener la entrada con datos de parcela
    const entry = db
      .prepare(
        `
      SELECT e.*, p.nombre as parcela_nombre, p.cultivo, p.variedad
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      WHERE e.id = ?
    `,
      )
      .get(entryId) as Record<string, string> | undefined;

    if (!entry) return;

    // Crear texto descriptivo de la entrada
    const text = [
      `ACTIVIDAD REGISTRADA - ${entry.fecha}`,
      `Parcela: ${entry.parcela_nombre || "Sin parcela"} (${entry.cultivo || ""} ${entry.variedad || ""})`,
      `Tipo: ${entry.tipo_actividad}`,
      `Descripción: ${entry.descripcion}`,
      entry.productos_usados ? `Productos: ${entry.productos_usados}` : "",
      entry.dosis ? `Dosis: ${entry.dosis}` : "",
      entry.condiciones_meteo ? `Meteo: ${entry.condiciones_meteo}` : "",
      entry.resultado ? `Resultado: ${entry.resultado}` : "",
      entry.notas ? `Notas: ${entry.notas}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Eliminar chunks anteriores de esta entrada (si se edita)
    db.prepare(
      `
      DELETE FROM rag_chunks WHERE fuente_tipo = 'entrada_diario' AND fuente_id = ?
    `,
    ).run(entryId);

    // Para entradas lo almacenamos como un "documento virtual"
    // Ensure the virtual document exists for the FK constraint
    db.prepare(
      `
      INSERT OR IGNORE INTO rag_documentos (id, nombre_archivo, tipo_archivo, titulo, tipo, estado)
      VALUES ('diary-entries', 'diary-entries', 'virtual', 'Entradas del Diario', 'diario', 'listo')
    `,
    ).run();

    const embedding = await generateEmbedding(text);

    db.prepare(
      `
      INSERT INTO rag_chunks (id, documento_id, fuente_tipo, fuente_id, contenido, chunk_index, embedding)
      VALUES (@id, @documento_id, @fuente_tipo, @fuente_id, @contenido, @chunk_index, @embedding)
    `,
    ).run({
      id: uuid(),
      documento_id: "diary-entries", // documento virtual
      fuente_tipo: "entrada_diario",
      fuente_id: entryId,
      contenido: text,
      chunk_index: 0,
      embedding: embedding ? JSON.stringify(embedding) : "",
    });
  } catch (error) {
    console.error("Error indexando entrada de diario:", error);
  }
}

// ---- Indexar documentos_ia existentes ----
export async function indexExistingDocuments(): Promise<number> {
  const db = getDb();

  try {
    const docs = db
      .prepare("SELECT id, titulo, contenido FROM documentos_ia")
      .all() as {
      id: string;
      titulo: string;
      contenido: string;
    }[];

    let indexed = 0;
    for (const doc of docs) {
      // Verificar si ya está indexado
      const existing = db
        .prepare(
          `SELECT COUNT(*) as count FROM rag_chunks WHERE fuente_tipo = 'documento_ia' AND fuente_id = ?`,
        )
        .get(doc.id) as { count: number };

      if (existing.count === 0) {
        const text = `${doc.titulo}\n\n${doc.contenido}`;
        const chunks = splitIntoChunks(text);
        const embeddings = await generateEmbeddings(chunks);

        // Ensure the virtual document exists for the FK constraint
        db.prepare(
          `
          INSERT OR IGNORE INTO rag_documentos (id, nombre_archivo, tipo_archivo, titulo, tipo, estado)
          VALUES ('documentos-ia', 'documentos-ia', 'virtual', 'Documentos IA Legacy', 'legacy', 'listo')
        `,
        ).run();

        const stmt = db.prepare(`
          INSERT INTO rag_chunks (id, documento_id, fuente_tipo, fuente_id, contenido, chunk_index, embedding)
          VALUES (@id, @documento_id, @fuente_tipo, @fuente_id, @contenido, @chunk_index, @embedding)
        `);

        const insertAll = db.transaction(() => {
          for (let i = 0; i < chunks.length; i++) {
            stmt.run({
              id: uuid(),
              documento_id: "documentos-ia",
              fuente_tipo: "documento_ia",
              fuente_id: doc.id,
              contenido: chunks[i],
              chunk_index: i,
              embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : "",
            });
          }
        });
        insertAll();
        indexed++;
      }
    }

    return indexed;
  } catch (error) {
    console.error("Error indexando documentos existentes:", error);
    return 0;
  }
}

// ---- Búsqueda semántica ----
export async function searchKnowledgeBase(
  query: string,
  topK: number = TOP_K,
): Promise<SearchResult[]> {
  const db = getDb();

  // Generar embedding de la consulta
  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    // Fallback: búsqueda por texto simple
    return fallbackTextSearch(query, topK);
  }

  // Obtener todos los chunks con embeddings
  const chunks = db
    .prepare(
      `
    SELECT c.contenido, c.fuente_tipo, c.fuente_id, c.embedding,
           d.titulo
    FROM rag_chunks c
    LEFT JOIN rag_documentos d ON c.documento_id = d.id
    WHERE c.embedding != ''
  `,
    )
    .all() as (RagChunk & { titulo?: string })[];

  // Calcular similitud
  const scored: SearchResult[] = [];
  for (const chunk of chunks) {
    try {
      const chunkEmbedding = JSON.parse(chunk.embedding);
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
      scored.push({
        contenido: chunk.contenido,
        fuente_tipo: chunk.fuente_tipo,
        fuente_id: chunk.fuente_id,
        titulo: chunk.titulo || undefined,
        similarity,
      });
    } catch {
      // Skip chunks con embeddings inválidos
    }
  }

  // Ordenar por similitud y devolver top-K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK).filter((s) => s.similarity > 0.2); // Umbral mínimo
}

// Búsqueda de texto simple como fallback (sin API key)
function fallbackTextSearch(query: string, topK: number): SearchResult[] {
  const db = getDb();
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (words.length === 0) return [];

  // Buscar en chunks
  const allChunks = db
    .prepare(
      `
    SELECT c.contenido, c.fuente_tipo, c.fuente_id,
           d.titulo
    FROM rag_chunks c
    LEFT JOIN rag_documentos d ON c.documento_id = d.id
  `,
    )
    .all() as (RagChunk & { titulo?: string })[];

  // También buscar en documentos_ia legacy
  const legacyDocs = db
    .prepare("SELECT titulo, contenido FROM documentos_ia")
    .all() as {
    titulo: string;
    contenido: string;
  }[];

  const results: SearchResult[] = [];

  // Puntuar chunks por coincidencia de palabras
  for (const chunk of allChunks) {
    const text = chunk.contenido.toLowerCase();
    const matches = words.filter((w) => text.includes(w)).length;
    if (matches > 0) {
      results.push({
        contenido: chunk.contenido,
        fuente_tipo: chunk.fuente_tipo,
        fuente_id: chunk.fuente_id,
        titulo: chunk.titulo || undefined,
        similarity: matches / words.length,
      });
    }
  }

  // También buscar en documentos_ia legacy (por compatibilidad)
  for (const doc of legacyDocs) {
    const text = (doc.titulo + " " + doc.contenido).toLowerCase();
    const matches = words.filter((w) => text.includes(w)).length;
    if (matches > 0) {
      results.push({
        contenido: doc.contenido,
        fuente_tipo: "documento_ia",
        fuente_id: "",
        titulo: doc.titulo,
        similarity: matches / words.length,
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

// ---- Estadísticas ----
export function getRAGStats(): {
  total_documentos: number;
  total_chunks: number;
  chunks_con_embedding: number;
  entradas_indexadas: number;
  documentos_ia_indexados: number;
} {
  const db = getDb();

  const totalDocs = (
    db.prepare("SELECT COUNT(*) as c FROM rag_documentos").get() as {
      c: number;
    }
  ).c;
  const totalChunks = (
    db.prepare("SELECT COUNT(*) as c FROM rag_chunks").get() as { c: number }
  ).c;
  const withEmbedding = (
    db
      .prepare("SELECT COUNT(*) as c FROM rag_chunks WHERE embedding != ''")
      .get() as { c: number }
  ).c;
  const diaryIndexed = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT fuente_id) as c FROM rag_chunks WHERE fuente_tipo = 'entrada_diario'",
      )
      .get() as { c: number }
  ).c;
  const docsIaIndexed = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT fuente_id) as c FROM rag_chunks WHERE fuente_tipo = 'documento_ia'",
      )
      .get() as { c: number }
  ).c;

  return {
    total_documentos: totalDocs,
    total_chunks: totalChunks,
    chunks_con_embedding: withEmbedding,
    entradas_indexadas: diaryIndexed,
    documentos_ia_indexados: docsIaIndexed,
  };
}

// ==========================================
// API: Base de Conocimiento (RAG)
// ==========================================
// Gestión de documentos: subida, listado, eliminación
// Reindexación de entradas de diario y documentos legacy
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import {
  extractTextFromFile,
  processDocument,
  indexExistingDocuments,
  indexDiaryEntry,
  getRAGStats,
  type RagDocumento,
} from "@/lib/rag";

// GET: Listar documentos + estadísticas
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "stats") {
      const stats = getRAGStats();
      return NextResponse.json(stats);
    }

    // Listar documentos RAG
    const documentos = db
      .prepare(
        `
      SELECT * FROM rag_documentos ORDER BY created_at DESC
    `,
      )
      .all() as RagDocumento[];

    // También listar documentos legacy
    const legacy = db
      .prepare(
        `
      SELECT id, titulo, tipo, cultivo, created_at FROM documentos_ia ORDER BY created_at DESC
    `,
      )
      .all();

    const stats = getRAGStats();

    return NextResponse.json({ documentos, legacy, stats });
  } catch (error) {
    console.error("Error en knowledge base GET:", error);
    return NextResponse.json(
      { error: "Error al obtener documentos" },
      { status: 500 },
    );
  }
}

// POST: Subir documento (PDF/TXT) o reindexar
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Acción de reindexación
    if (contentType.includes("application/json")) {
      const body = await req.json();

      if (body.action === "reindex-legacy") {
        const count = await indexExistingDocuments();
        return NextResponse.json({
          success: true,
          message: `${count} documentos legacy reindexados con embeddings`,
        });
      }

      if (body.action === "reindex-entries") {
        const db = getDb();
        const entries = db.prepare("SELECT id FROM entradas_diario").all() as {
          id: string;
        }[];

        let indexed = 0;
        for (const entry of entries) {
          await indexDiaryEntry(entry.id);
          indexed++;
        }

        return NextResponse.json({
          success: true,
          message: `${indexed} entradas del diario indexadas`,
        });
      }

      // Añadir documento de texto manual (como el antiguo sistema)
      if (body.titulo && body.contenido) {
        const docId = uuid();
        const db = getDb();

        db.prepare(
          `
          INSERT INTO rag_documentos (id, nombre_archivo, tipo_archivo, titulo, tipo, cultivo, contexto_adicional, tamano, estado)
          VALUES (@id, @nombre_archivo, @tipo_archivo, @titulo, @tipo, @cultivo, @contexto_adicional, @tamano, 'procesando')
        `,
        ).run({
          id: docId,
          nombre_archivo: "texto-manual.txt",
          tipo_archivo: "txt",
          titulo: body.titulo,
          tipo: body.tipo || "manual",
          cultivo: body.cultivo || "",
          contexto_adicional: body.contexto || "",
          tamano: body.contenido.length,
        });

        // También guardar en documentos_ia legacy para compatibilidad
        db.prepare(
          `
          INSERT INTO documentos_ia (id, titulo, contenido, tipo, cultivo)
          VALUES (@id, @titulo, @contenido, @tipo, @cultivo)
        `,
        ).run({
          id: uuid(),
          titulo: body.titulo,
          contenido: body.contenido,
          tipo: body.tipo || "manual",
          cultivo: body.cultivo || "",
        });

        const contextPrefix = body.contexto
          ? `[Contexto adicional: ${body.contexto}]\n\n`
          : "";
        const result = await processDocument(
          docId,
          `${body.titulo}\n\n${contextPrefix}${body.contenido}`,
        );

        return NextResponse.json({
          success: true,
          documento_id: docId,
          chunks: result.chunks,
          error: result.error,
        });
      }

      return NextResponse.json(
        { error: "Acción no reconocida" },
        { status: 400 },
      );
    }

    // Subida de archivo
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const titulo = (formData.get("titulo") as string) || "";
    const tipo = (formData.get("tipo") as string) || "manual";
    const cultivo = (formData.get("cultivo") as string) || "";
    const contexto = (formData.get("contexto") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó archivo" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const docId = uuid();
    const db = getDb();

    // Crear registro del documento
    db.prepare(
      `
      INSERT INTO rag_documentos (id, nombre_archivo, tipo_archivo, titulo, tipo, cultivo, contexto_adicional, tamano, estado)
      VALUES (@id, @nombre_archivo, @tipo_archivo, @titulo, @tipo, @cultivo, @contexto_adicional, @tamano, 'procesando')
    `,
    ).run({
      id: docId,
      nombre_archivo: file.name,
      tipo_archivo: file.name.split(".").pop()?.toLowerCase() || "pdf",
      titulo: titulo || file.name.replace(/\.[^.]+$/, ""),
      tipo,
      cultivo,
      contexto_adicional: contexto,
      tamano: file.size,
    });

    // Extraer texto
    let text: string;
    try {
      text = await extractTextFromFile(buffer, file.name);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Error extrayendo texto";
      db.prepare(
        `UPDATE rag_documentos SET estado = 'error', error_msg = ? WHERE id = ?`,
      ).run(errorMsg, docId);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Prepend context if provided
    if (contexto) {
      text = `[Contexto adicional: ${contexto}]\n\n${text}`;
    }

    if (!text.trim()) {
      db.prepare(
        `UPDATE rag_documentos SET estado = 'error', error_msg = 'Archivo vacío o sin texto extraíble' WHERE id = ?`,
      ).run(docId);
      return NextResponse.json(
        { error: "No se pudo extraer texto del archivo" },
        { status: 400 },
      );
    }

    // Procesar: chunking + embeddings
    const result = await processDocument(docId, text);

    return NextResponse.json({
      success: true,
      documento_id: docId,
      nombre: file.name,
      chunks: result.chunks,
      texto_length: text.length,
      error: result.error,
    });
  } catch (error) {
    console.error("Error en knowledge base POST:", error);
    return NextResponse.json(
      {
        error: "Error al procesar documento",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}

// DELETE: Eliminar documento
export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Eliminar chunks asociados
    db.prepare("DELETE FROM rag_chunks WHERE documento_id = ?").run(id);
    // Eliminar documento
    db.prepare("DELETE FROM rag_documentos WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando documento:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

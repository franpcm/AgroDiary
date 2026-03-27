// ==========================================
// API: Subida de archivos (fotos y vídeos)
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Ensure upload directory exists
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureUploadDir();
    const db = getDb();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entrada_id = formData.get("entrada_id") as string;
    const usuario_id = formData.get("usuario_id") as string;

    if (!file || !entrada_id) {
      return NextResponse.json(
        { error: "Archivo y entrada_id requeridos" },
        { status: 400 },
      );
    }

    // Determine file type
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");

    if (!isVideo && !isImage && !isAudio) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes, vídeos y audios" },
        { status: 400 },
      );
    }

    // Max file size: 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande (máx 50MB)" },
        { status: 400 },
      );
    }

    const id = uuid();
    const ext =
      file.name.split(".").pop() || (isVideo ? "mp4" : isAudio ? "ogg" : "jpg");
    const fileName = `${id}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Write file
    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const url = `/uploads/${fileName}`;

    // Save to database
    db.prepare(
      `
      INSERT INTO archivos_media (id, entrada_id, usuario_id, tipo, nombre, url, tamano)
      VALUES (@id, @entrada_id, @usuario_id, @tipo, @nombre, @url, @tamano)
    `,
    ).run({
      id,
      entrada_id,
      usuario_id: usuario_id || "",
      tipo: isVideo ? "video" : isAudio ? "audio" : "imagen",
      nombre: file.name,
      url,
      tamano: file.size,
    });

    const media = db
      .prepare("SELECT * FROM archivos_media WHERE id = ?")
      .get(id);
    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Error al subir archivo" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const entrada_id = url.searchParams.get("entrada_id");

    if (!entrada_id) {
      return NextResponse.json(
        { error: "entrada_id requerido" },
        { status: 400 },
      );
    }

    const files = db
      .prepare(
        "SELECT * FROM archivos_media WHERE entrada_id = ? ORDER BY created_at ASC",
      )
      .all(entrada_id);

    return NextResponse.json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Error al obtener archivos" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Get file info to delete from disk
    const file = db
      .prepare("SELECT * FROM archivos_media WHERE id = ?")
      .get(id) as { url: string } | undefined;
    if (file) {
      const filePath = path.join(process.cwd(), "public", file.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare("DELETE FROM archivos_media WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Error al eliminar archivo" },
      { status: 500 },
    );
  }
}

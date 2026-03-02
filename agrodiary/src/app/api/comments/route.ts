// ==========================================
// API: Comentarios en entradas
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

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

    const comments = db
      .prepare(
        `
      SELECT c.*, u.nombre as usuario_nombre, u.avatar_color as usuario_color
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.entrada_id = @entrada_id
      ORDER BY c.created_at ASC
    `,
      )
      .all({ entrada_id });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Error al obtener comentarios" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.entrada_id || !body.usuario_id || !body.texto) {
      return NextResponse.json(
        { error: "entrada_id, usuario_id y texto requeridos" },
        { status: 400 },
      );
    }

    const id = uuid();
    db.prepare(
      `
      INSERT INTO comentarios (id, entrada_id, usuario_id, texto)
      VALUES (@id, @entrada_id, @usuario_id, @texto)
    `,
    ).run({
      id,
      entrada_id: body.entrada_id,
      usuario_id: body.usuario_id,
      texto: body.texto,
    });

    const comment = db
      .prepare(
        `
      SELECT c.*, u.nombre as usuario_nombre, u.avatar_color as usuario_color
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = ?
    `,
      )
      .get(id);

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Error al crear comentario" },
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

    db.prepare("DELETE FROM comentarios WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Error al eliminar comentario" },
      { status: 500 },
    );
  }
}

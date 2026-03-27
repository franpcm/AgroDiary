// ==========================================
// API: Precios (Personal, Maquinaria, Productos, Servicios)
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");

    let query = "SELECT * FROM precios";
    const params: string[] = [];

    if (categoria) {
      query += " WHERE categoria = ?";
      params.push(categoria);
    }
    query += " ORDER BY categoria, nombre";

    const precios = db.prepare(query).all(...params);
    return NextResponse.json(precios);
  } catch (error) {
    console.error("Error fetching precios:", error);
    return NextResponse.json(
      { error: "Error al obtener precios" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.nombre || !body.nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 },
      );
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO precios (id, nombre, categoria, unidad, precio_unitario, notas)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.nombre.trim(),
      body.categoria || "otro",
      body.unidad || "€/hora",
      body.precio_unitario || 0,
      body.notas || "",
    );

    const precio = db.prepare("SELECT * FROM precios WHERE id = ?").get(id);
    return NextResponse.json(precio, { status: 201 });
  } catch (error) {
    console.error("Error creating precio:", error);
    return NextResponse.json(
      { error: "Error al crear precio" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID es obligatorio" }, { status: 400 });
    }

    db.prepare(
      `UPDATE precios SET
        nombre = ?, categoria = ?, unidad = ?, precio_unitario = ?,
        notas = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      body.nombre?.trim() || "",
      body.categoria || "otro",
      body.unidad || "€/hora",
      body.precio_unitario || 0,
      body.notas || "",
      body.id,
    );

    const precio = db
      .prepare("SELECT * FROM precios WHERE id = ?")
      .get(body.id);
    return NextResponse.json(precio);
  } catch (error) {
    console.error("Error updating precio:", error);
    return NextResponse.json(
      { error: "Error al actualizar precio" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID es obligatorio" }, { status: 400 });
    }

    db.prepare("DELETE FROM precios WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting precio:", error);
    return NextResponse.json(
      { error: "Error al eliminar precio" },
      { status: 500 },
    );
  }
}

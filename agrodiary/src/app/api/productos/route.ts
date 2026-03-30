// ==========================================
// API: Productos y Maquinaria (catálogo)
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET() {
  try {
    const db = getDb();
    const productos = db
      .prepare("SELECT * FROM productos_maquinaria ORDER BY categoria, nombre")
      .all();
    return NextResponse.json(productos);
  } catch (error) {
    console.error("Error fetching productos:", error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
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

    const nombre = body.nombre.trim();

    // Check if already exists (case-insensitive)
    const existing = db
      .prepare(
        "SELECT * FROM productos_maquinaria WHERE LOWER(nombre) = LOWER(?)",
      )
      .get(nombre);

    if (existing) {
      return NextResponse.json(existing);
    }

    const id = uuid();
    db.prepare(
      "INSERT INTO productos_maquinaria (id, nombre, categoria, notas) VALUES (?, ?, ?, ?)",
    ).run(id, nombre, body.categoria || "otro", body.notas || "");

    const producto = db
      .prepare("SELECT * FROM productos_maquinaria WHERE id = ?")
      .get(id);
    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    console.error("Error creating producto:", error);
    return NextResponse.json(
      { error: "Error al crear producto" },
      { status: 500 },
    );
  }
}

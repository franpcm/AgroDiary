// ==========================================
// API: Historial de ediciones
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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

    const history = db
      .prepare(
        `
      SELECT h.*, u.nombre as usuario_nombre, u.avatar_color as usuario_color
      FROM historial_ediciones h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.entrada_id = @entrada_id
      ORDER BY h.created_at DESC
    `,
      )
      .all({ entrada_id });

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Error al obtener historial" },
      { status: 500 },
    );
  }
}

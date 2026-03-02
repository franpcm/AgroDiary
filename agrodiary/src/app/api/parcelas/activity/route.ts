import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Get recent entries for a parcela by name (for map popup)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nombre = searchParams.get("nombre");
  const limit = parseInt(searchParams.get("limit") || "5");

  if (!nombre) {
    return NextResponse.json({ entries: [], stats: null });
  }

  const db = getDb();

  // Find parcela by name (fuzzy match)
  const parcela = db
    .prepare(
      `
    SELECT id, nombre, cultivo, variedad, superficie_ha
    FROM parcelas 
    WHERE nombre LIKE ? OR variedad LIKE ?
    LIMIT 1
  `,
    )
    .get(`%${nombre}%`, `%${nombre}%`) as
    | {
        id: string;
        nombre: string;
        cultivo: string;
        variedad: string;
        superficie_ha: number;
      }
    | undefined;

  if (!parcela) {
    return NextResponse.json({ entries: [], stats: null, parcela: null });
  }

  // Get recent entries
  const entries = db
    .prepare(
      `
    SELECT e.*, p.nombre as parcela_nombre
    FROM entradas_diario e
    JOIN parcelas p ON e.parcela_id = p.id
    WHERE e.parcela_id = ?
    ORDER BY e.fecha DESC
    LIMIT ?
  `,
    )
    .all(parcela.id, limit);

  // Get stats
  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total_entradas,
      MAX(fecha) as ultima_actividad,
      CAST(julianday('now') - julianday(MAX(fecha)) AS INTEGER) as dias_sin_actividad
    FROM entradas_diario 
    WHERE parcela_id = ?
  `,
    )
    .get(parcela.id) as {
    total_entradas: number;
    ultima_actividad: string | null;
    dias_sin_actividad: number | null;
  };

  // Get activity type breakdown
  const actividades = db
    .prepare(
      `
    SELECT tipo_actividad, COUNT(*) as count
    FROM entradas_diario
    WHERE parcela_id = ?
    GROUP BY tipo_actividad
    ORDER BY count DESC
    LIMIT 5
  `,
    )
    .all(parcela.id);

  return NextResponse.json({
    entries,
    stats,
    actividades,
    parcela,
  });
}

// ==========================================
// API: Resumen de Costes
// ==========================================
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    // Total costes fijos
    const totalCostes = db
      .prepare(
        "SELECT COALESCE(SUM(importe), 0) as total FROM costes_fijos WHERE tipo = 'coste'",
      )
      .get() as { total: number };

    // Total ingresos (subvenciones, etc.)
    const totalIngresos = db
      .prepare(
        "SELECT COALESCE(SUM(importe), 0) as total FROM costes_fijos WHERE tipo = 'ingreso'",
      )
      .get() as { total: number };

    // Costes por categoría
    const costesPorCategoria = db
      .prepare(
        `SELECT categoria, tipo, COUNT(*) as count, COALESCE(SUM(importe), 0) as total
         FROM costes_fijos GROUP BY categoria, tipo ORDER BY total DESC`,
      )
      .all();

    // Costes anualizados (considerando periodicidad)
    const costesAnualizados = db
      .prepare(
        `SELECT
          COALESCE(SUM(
            CASE periodicidad
              WHEN 'mensual' THEN importe * 12
              WHEN 'trimestral' THEN importe * 4
              WHEN 'anual' THEN importe
              WHEN 'unico' THEN importe
              ELSE importe
            END
          ), 0) as total
         FROM costes_fijos WHERE tipo = 'coste'`,
      )
      .get() as { total: number };

    // Total hectáreas
    const totalHa = db
      .prepare(
        "SELECT COALESCE(SUM(superficie_ha), 0) as total FROM parcelas WHERE superficie_ha > 0",
      )
      .get() as { total: number };

    // Coste medio por hectárea
    const costeMedioHa =
      totalHa.total > 0 ? costesAnualizados.total / totalHa.total : 0;

    // Precios por categoría
    const preciosPorCategoria = db
      .prepare(
        `SELECT categoria, COUNT(*) as count, COALESCE(AVG(precio_unitario), 0) as precio_medio
         FROM precios GROUP BY categoria ORDER BY categoria`,
      )
      .all();

    // Total precios registrados
    const totalPrecios = db
      .prepare("SELECT COUNT(*) as count FROM precios")
      .get() as { count: number };

    // Número de costes fijos
    const numCostes = db
      .prepare("SELECT COUNT(*) as count FROM costes_fijos")
      .get() as { count: number };

    return NextResponse.json({
      costes_fijos: {
        total_costes: totalCostes.total,
        total_ingresos: totalIngresos.total,
        balance: totalIngresos.total - totalCostes.total,
        costes_anualizados: costesAnualizados.total,
        coste_medio_ha: costeMedioHa,
        total_hectareas: totalHa.total,
        num_registros: numCostes.count,
        por_categoria: costesPorCategoria,
      },
      precios: {
        num_registros: totalPrecios.count,
        por_categoria: preciosPorCategoria,
      },
    });
  } catch (error) {
    console.error("Error fetching resumen costes:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de costes" },
      { status: 500 },
    );
  }
}

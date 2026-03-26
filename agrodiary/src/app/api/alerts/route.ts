import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface Alerta {
  tipo: "warning" | "info" | "danger" | "success";
  icono: string;
  titulo: string;
  detalle: string;
  parcela?: string;
  dias?: number;
}

export async function GET() {
  try {
    const db = getDb();
    const alertas: Alerta[] = [];
    const _now = new Date();
    const hoy = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

    // 1. Tratamientos recientes para recordar seguimiento
    const ultimosTratamientos = db
      .prepare(
        `
      SELECT e.fecha, p.nombre as parcela, e.productos_usados, e.descripcion,
             CAST(julianday(?) - julianday(e.fecha) AS INTEGER) as dias
      FROM entradas_diario e
      JOIN parcelas p ON e.parcela_id = p.id
      WHERE e.tipo_actividad = 'tratamiento_fitosanitario'
        AND julianday(?) - julianday(e.fecha) BETWEEN 5 AND 15
      ORDER BY e.fecha DESC
      LIMIT 5
    `,
      )
      .all(hoy, hoy) as {
      fecha: string;
      parcela: string;
      productos_usados: string;
      descripcion: string;
      dias: number;
    }[];

    for (const t of ultimosTratamientos) {
      alertas.push({
        tipo: "info",
        icono: "🧪",
        titulo: `Revisar tratamiento en ${t.parcela}`,
        detalle: `Hace ${t.dias} días se aplicó "${t.productos_usados || t.descripcion}". ¿Verificar eficacia?`,
        parcela: t.parcela,
        dias: t.dias,
      });
    }

    // 3. Calendario estacional de tareas según mes y cultivo
    const mes = new Date().getMonth() + 1; // 1-12
    const tareasEstacionales: Alerta[] = [];

    // Pistachos
    if (mes >= 1 && mes <= 2) {
      tareasEstacionales.push({
        tipo: "info",
        icono: "✂️",
        titulo: "Poda de invierno — Pistachos",
        detalle:
          "Enero-Febrero es época de poda de formación y mantenimiento en pistachos.",
      });
    }
    if (mes === 3) {
      tareasEstacionales.push({
        tipo: "info",
        icono: "🌱",
        titulo: "Inicio brotación — Pistachos",
        detalle:
          "Marzo: vigilar brotación, preparar tratamientos preventivos contra botryosphaeria.",
      });
    }
    if (mes >= 4 && mes <= 5) {
      tareasEstacionales.push({
        tipo: "warning",
        icono: "🧪",
        titulo: "Tratamientos preventivos — Pistachos",
        detalle:
          "Abril-Mayo: aplicar fungicidas preventivos. Vigilar plagas como psila y clytra.",
      });
    }
    if (mes >= 8 && mes <= 9) {
      tareasEstacionales.push({
        tipo: "success",
        icono: "🌰",
        titulo: "Cosecha pistachos",
        detalle:
          "Agosto-Septiembre es época de recolección del pistacho. Vigilar maduración.",
      });
    }

    // Viñedo
    if (mes >= 1 && mes <= 2) {
      tareasEstacionales.push({
        tipo: "info",
        icono: "✂️",
        titulo: "Poda de invierno — Viñedo",
        detalle:
          "Enero-Febrero: poda en seco del viñedo (Tempranillo, Cabernet, Sauvignon Blanc).",
      });
    }
    if (mes === 3 || mes === 4) {
      tareasEstacionales.push({
        tipo: "warning",
        icono: "🍇",
        titulo: "Brotación viñedo — Vigilar heladas",
        detalle:
          "Marzo-Abril: inicio de brotación. Riesgo de heladas tardías en Castilla-La Mancha.",
      });
    }
    if (mes >= 5 && mes <= 7) {
      tareasEstacionales.push({
        tipo: "info",
        icono: "🧪",
        titulo: "Tratamientos viñedo — Mildiu/Oidio",
        detalle:
          "Mayo-Julio: tratamientos preventivos contra mildiu y oidio. Control de envero.",
      });
    }
    if (mes >= 9 && mes <= 10) {
      tareasEstacionales.push({
        tipo: "success",
        icono: "🍇",
        titulo: "Vendimia",
        detalle:
          "Septiembre-Octubre: época de vendimia. Control de grado alcohólico y acidez.",
      });
    }

    // Olivos
    if (mes >= 11 || mes <= 1) {
      tareasEstacionales.push({
        tipo: "success",
        icono: "🫒",
        titulo: "Cosecha de aceituna",
        detalle:
          "Noviembre-Enero: recolección de aceituna. Controlar índice de madurez.",
      });
    }
    if (mes >= 2 && mes <= 3) {
      tareasEstacionales.push({
        tipo: "info",
        icono: "✂️",
        titulo: "Poda olivos",
        detalle:
          "Febrero-Marzo: poda de formación y rejuvenecimiento del olivar.",
      });
    }

    // Check which seasonal tasks have NOT been done yet this month
    const mesActual = hoy.substring(0, 7); // YYYY-MM
    const actividadesMes = db
      .prepare(
        `
      SELECT DISTINCT tipo_actividad FROM entradas_diario 
      WHERE fecha LIKE ? || '%'
    `,
      )
      .all(mesActual) as { tipo_actividad: string }[];
    const tiposMes = new Set(actividadesMes.map((a) => a.tipo_actividad));

    // Add seasonal alerts
    alertas.push(...tareasEstacionales);

    // 4. Summary stats
    const resumenSemana = db
      .prepare(
        `
      SELECT COUNT(*) as total FROM entradas_diario
      WHERE julianday(?) - julianday(fecha) <= 7
    `,
      )
      .get(hoy) as { total: number };

    if (resumenSemana.total === 0) {
      alertas.push({
        tipo: "warning",
        icono: "📝",
        titulo: "Sin registros esta semana",
        detalle:
          "No se ha registrado ninguna actividad en los últimos 7 días. ¿Quieres añadir algo?",
      });
    }

    return NextResponse.json(alertas);
  } catch (error) {
    console.error("Alerts error:", error);
    return NextResponse.json([]);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Generate Cuaderno de Campo HTML for print/PDF export
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";
  const parcela_id = searchParams.get("parcela_id") || "";
  const cultivo = searchParams.get("cultivo") || "";

  const db = getDb();

  let query = `
    SELECT e.*, p.nombre as parcela_nombre, p.cultivo, p.variedad, p.superficie_ha, p.sector,
           u.nombre as usuario_nombre
    FROM entradas_diario e
    JOIN parcelas p ON e.parcela_id = p.id
    LEFT JOIN usuarios u ON e.usuario_id = u.id
    WHERE 1=1
  `;
  const params: Record<string, string> = {};

  if (desde) {
    query += ` AND e.fecha >= @desde`;
    params.desde = desde;
  }
  if (hasta) {
    query += ` AND e.fecha <= @hasta`;
    params.hasta = hasta;
  }
  if (parcela_id) {
    query += ` AND e.parcela_id = @parcela_id`;
    params.parcela_id = parcela_id;
  }
  if (cultivo) {
    query += ` AND p.cultivo = @cultivo`;
    params.cultivo = cultivo;
  }

  query += ` ORDER BY e.fecha ASC, e.created_at ASC`;

  const entries = db.prepare(query).all(params) as {
    fecha: string;
    parcela_nombre: string;
    cultivo: string;
    variedad: string;
    superficie_ha: number;
    sector: string;
    tipo_actividad: string;
    descripcion: string;
    realizado_por: string;
    productos_usados: string;
    dosis: string;
    condiciones_meteo: string;
    resultado: string;
    notas: string;
    usuario_nombre: string;
    hora_inicio: string;
    hora_fin: string;
    gps_lat: number | null;
    gps_lng: number | null;
  }[];

  // Get farm info
  const parcelas = db
    .prepare(`SELECT * FROM parcelas ORDER BY cultivo, nombre`)
    .all() as {
    nombre: string;
    cultivo: string;
    variedad: string;
    superficie_ha: number;
    sector: string;
  }[];

  const totalHa = parcelas.reduce((s, p) => s + p.superficie_ha, 0);
  const periodoStr =
    desde && hasta
      ? `${desde} a ${hasta}`
      : desde
        ? `Desde ${desde}`
        : hasta
          ? `Hasta ${hasta}`
          : "Todo el historial";

  const ACTIVIDAD_LABELS: Record<string, string> = {
    riego: "Riego",
    tratamiento_fitosanitario: "Tratamiento Fitosanitario",
    poda: "Poda",
    abonado: "Abonado/Fertilización",
    cosecha: "Cosecha/Recolección",
    laboreo: "Laboreo",
    siembra_plantacion: "Siembra/Plantación",
    injerto: "Injerto",
    analisis_suelo: "Análisis de Suelo",
    analisis_foliar: "Análisis Foliar",
    observacion: "Observación",
    mantenimiento_infraestructura: "Mantenimiento",
    otro: "Otro",
  };

  // Group entries by month
  const grouped: Record<string, typeof entries> = {};
  for (const e of entries) {
    const month = e.fecha.substring(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(e);
  }

  // Generate treatments summary (required for Cuaderno de Campo)
  const treatments = entries.filter(
    (e) =>
      e.tipo_actividad === "tratamiento_fitosanitario" && e.productos_usados,
  );

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cuaderno de Campo — Finca del Imperio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #333; font-size: 11pt; line-height: 1.4; }
    @page { size: A4 landscape; margin: 15mm; }
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      table { page-break-inside: avoid; }
      tr { page-break-inside: avoid; }
    }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #166534; }
    .header h1 { font-size: 22pt; color: #166534; margin-bottom: 4px; }
    .header h2 { font-size: 14pt; color: #555; font-weight: normal; }
    .header p { font-size: 10pt; color: #888; margin-top: 6px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .info-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; }
    .info-box h3 { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-box p { font-size: 11pt; font-weight: 600; }
    .section { margin-bottom: 25px; }
    .section h2 { font-size: 14pt; color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { background: #166534; color: white; padding: 6px 8px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) { background: #f9fafb; }
    tr:hover { background: #f0fdf4; }
    .month-header { background: #dcfce7; color: #166534; font-weight: 700; font-size: 10pt; text-transform: capitalize; }
    .month-header td { padding: 8px; border-bottom: 2px solid #86efac; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 8pt; font-weight: 600; }
    .badge-pistacho { background: #dcfce7; color: #166534; }
    .badge-viñedo { background: #f3e8ff; color: #7c3aed; }
    .badge-olivo { background: #fef9c3; color: #854d0e; }
    .badge-otro { background: #f3f4f6; color: #374151; }
    .footer { text-align: center; font-size: 8pt; color: #aaa; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; }
    .firma { margin-top: 40px; display: flex; justify-content: space-between; }
    .firma-box { text-align: center; width: 250px; }
    .firma-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; font-size: 10pt; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #166534; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 100; }
    .print-btn:hover { background: #14532d; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: 15px; }
    .summary-item { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; }
    .summary-item strong { color: #166534; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

  <div class="header">
    <h1>CUADERNO DE CAMPO</h1>
    <h2>Finca del Imperio — AgroDiary</h2>
    <p>Periodo: ${periodoStr} · Generado: ${new Date().toLocaleDateString("es-ES", { dateStyle: "long" })}</p>
  </div>

  <!-- Finca Info -->
  <div class="info-grid">
    <div class="info-box">
      <h3>Explotación</h3>
      <p>Finca del Imperio</p>
      <p style="font-weight:normal; font-size:9pt; color:#666;">Castilla-La Mancha</p>
    </div>
    <div class="info-box">
      <h3>Superficie Total</h3>
      <p>${totalHa.toFixed(1)} hectáreas</p>
      <p style="font-weight:normal; font-size:9pt; color:#666;">${parcelas.length} parcelas</p>
    </div>
    <div class="info-box">
      <h3>Registros en periodo</h3>
      <p>${entries.length} entradas</p>
      <p style="font-weight:normal; font-size:9pt; color:#666;">${treatments.length} tratamientos fitosanitarios</p>
    </div>
  </div>

  <!-- Parcelas Summary -->
  <div class="section">
    <h2>Parcelas de la explotación</h2>
    <div class="summary-grid">
      ${parcelas
        .map(
          (p) => `
        <div class="summary-item">
          <strong>${p.nombre}</strong><br>
          <span class="badge badge-${p.cultivo}">${p.cultivo}</span> · ${p.variedad} · ${p.superficie_ha} ha
          ${p.sector ? `<br><span style="font-size:8pt;color:#888;">Sector: ${p.sector}</span>` : ""}
        </div>
      `,
        )
        .join("")}
    </div>
  </div>

  <!-- Treatments Summary (Legal requirement) -->
  ${
    treatments.length > 0
      ? `
  <div class="section">
    <h2>Registro de Tratamientos Fitosanitarios</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Parcela</th>
          <th>Cultivo</th>
          <th>Producto</th>
          <th>Dosis</th>
          <th>Motivo</th>
          <th>Condiciones</th>
          <th>Aplicador</th>
        </tr>
      </thead>
      <tbody>
        ${treatments
          .map(
            (t) => `
          <tr>
            <td>${t.fecha}</td>
            <td>${t.parcela_nombre}</td>
            <td><span class="badge badge-${t.cultivo}">${t.variedad}</span></td>
            <td><strong>${t.productos_usados}</strong></td>
            <td>${t.dosis || "—"}</td>
            <td>${t.descripcion.substring(0, 80)}${t.descripcion.length > 80 ? "..." : ""}</td>
            <td>${t.condiciones_meteo || "—"}</td>
            <td>${t.realizado_por || "—"}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>
  <div class="page-break"></div>
  `
      : ""
  }

  <!-- Full Activity Log -->
  <div class="section">
    <h2>Registro completo de actividades</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Horario</th>
          <th>Parcela</th>
          <th>Cultivo</th>
          <th>Actividad</th>
          <th>Descripción</th>
          <th>Productos</th>
          <th>Dosis</th>
          <th>Meteo</th>
          <th>Resultado</th>
          <th>Realizado por</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(grouped)
          .map(
            ([month, monthEntries]) => `
          <tr class="month-header">
            <td colspan="11">${new Date(month + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric" })} — ${monthEntries.length} registros</td>
          </tr>
          ${monthEntries
            .map(
              (e) => `
            <tr>
              <td style="white-space:nowrap;">${e.fecha}</td>
              <td style="white-space:nowrap; font-size:8pt;">${e.hora_inicio ? `${e.hora_inicio}${e.hora_fin ? ` → ${e.hora_fin}` : ""}` : "—"}</td>
              <td>${e.parcela_nombre}</td>
              <td><span class="badge badge-${e.cultivo}">${e.variedad}</span></td>
              <td>${ACTIVIDAD_LABELS[e.tipo_actividad] || e.tipo_actividad}</td>
              <td>${e.descripcion.substring(0, 100)}${e.descripcion.length > 100 ? "..." : ""}</td>
              <td>${e.productos_usados || "—"}</td>
              <td>${e.dosis || "—"}</td>
              <td style="font-size:8pt;">${e.condiciones_meteo || "—"}</td>
              <td>${e.resultado ? e.resultado.substring(0, 60) : "—"}</td>
              <td>${e.realizado_por || "—"}</td>
            </tr>
          `,
            )
            .join("")}
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <!-- Signatures -->
  <div class="firma no-print-optional">
    <div class="firma-box">
      <div class="firma-line">Titular de la explotación</div>
    </div>
    <div class="firma-box">
      <div class="firma-line">Técnico responsable</div>
    </div>
  </div>

  <div class="footer">
    AgroDiary — Cuaderno de Campo Digital · Finca del Imperio · Generado automáticamente el ${new Date().toLocaleString("es-ES")}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

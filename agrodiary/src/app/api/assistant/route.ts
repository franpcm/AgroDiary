// ==========================================
// API: Asistente IA Agrícola (con RAG)
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { searchKnowledgeBase } from "@/lib/rag";
import OpenAI from "openai";

// Coordenadas de la Finca del Imperio (mismas que usa la API de clima)
const FARM_LAT = 39.568;
const FARM_LNG = -2.94;
const FARM_LOCATION_NAME = "Finca del Imperio, Castilla-La Mancha, España";

// Cache para datos meteorológicos del asistente (1 hora)
let weatherCache: { data: string; timestamp: number } | null = null;
const WEATHER_CACHE_TTL = 60 * 60 * 1000; // 1 hora

// WMO Weather interpretation codes
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna ligera",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  71: "Nevada ligera",
  73: "Nevada moderada",
  75: "Nevada intensa",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
  95: "Tormenta",
  96: "Tormenta con granizo ligero",
  99: "Tormenta con granizo intenso",
};

/**
 * Obtiene datos meteorológicos: actual, pronóstico 7 días e historial 90 días
 */
async function fetchWeatherContext(): Promise<string> {
  // Usar caché si disponible
  if (weatherCache && Date.now() - weatherCache.timestamp < WEATHER_CACHE_TTL) {
    return weatherCache.data;
  }

  try {
    // 1) Clima actual + pronóstico 7 días + historial últimos 92 días
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", FARM_LAT.toString());
    url.searchParams.set("longitude", FARM_LNG.toString());
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,et0_fao_evapotranspiration",
    );
    url.searchParams.set("timezone", "Europe/Madrid");
    url.searchParams.set("past_days", "92");
    url.searchParams.set("forecast_days", "7");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
    const api = await res.json();

    const current = api.current;
    const daily = api.daily;

    // Formatear clima actual
    const currentDesc = WMO_DESCRIPTIONS[current.weather_code] || "Desconocido";
    let weatherText = `\n\nUBICACIÓN Y CLIMA DE LA FINCA:
📍 Ubicación: ${FARM_LOCATION_NAME} (Lat: ${FARM_LAT}, Lng: ${FARM_LNG})

🌡️ CLIMA ACTUAL (ahora mismo):
- Temperatura: ${current.temperature_2m}°C
- Humedad: ${current.relative_humidity_2m}%
- Viento: ${current.wind_speed_10m} km/h
- Precipitación: ${current.precipitation} mm
- Condición: ${currentDesc}

📅 PRONÓSTICO PRÓXIMOS 7 DÍAS:`;

    // Pronóstico 7 días (últimos 7 registros del array)
    const totalDays = daily.time.length;
    const forecastStart = totalDays - 7;
    for (let i = forecastStart; i < totalDays; i++) {
      const desc = WMO_DESCRIPTIONS[daily.weather_code[i]] || "Desconocido";
      weatherText += `\n- ${daily.time[i]}: ${daily.temperature_2m_min[i]}°C / ${daily.temperature_2m_max[i]}°C | Lluvia: ${daily.precipitation_sum[i]} mm | ${desc}`;
    }

    // Historial de temperaturas: resumen semanal de los últimos 90 días
    weatherText += `\n\n📊 HISTORIAL METEOROLÓGICO (últimos ~90 días):`;
    weatherText += `\nFecha | T.Mín | T.Máx | Lluvia(mm) | ET0(mm)`;

    // Agrupar por semanas para no enviar demasiados datos
    const historyEnd = forecastStart; // donde termina el historial y empieza el pronóstico
    const weekSize = 7;
    for (let weekStart = 0; weekStart < historyEnd; weekStart += weekSize) {
      const weekEnd = Math.min(weekStart + weekSize, historyEnd);
      let minTemp = Infinity,
        maxTemp = -Infinity,
        totalRain = 0,
        totalEt0 = 0;
      for (let j = weekStart; j < weekEnd; j++) {
        if (daily.temperature_2m_min[j] < minTemp)
          minTemp = daily.temperature_2m_min[j];
        if (daily.temperature_2m_max[j] > maxTemp)
          maxTemp = daily.temperature_2m_max[j];
        totalRain += daily.precipitation_sum[j] || 0;
        totalEt0 += daily.et0_fao_evapotranspiration?.[j] || 0;
      }
      const startDate = daily.time[weekStart];
      const endDate = daily.time[weekEnd - 1];
      weatherText += `\n${startDate} a ${endDate}: ${minTemp.toFixed(1)}°C / ${maxTemp.toFixed(1)}°C | ${totalRain.toFixed(1)} mm lluvia | ET0: ${totalEt0.toFixed(1)} mm`;
    }

    // Añadir también detalle diario de los últimos 14 días para preguntas específicas sobre fechas recientes
    weatherText += `\n\nDETALLE DIARIO ÚLTIMAS 2 SEMANAS:`;
    const detailStart = Math.max(0, historyEnd - 14);
    for (let i = detailStart; i < historyEnd; i++) {
      const desc = WMO_DESCRIPTIONS[daily.weather_code[i]] || "";
      weatherText += `\n- ${daily.time[i]}: Mín ${daily.temperature_2m_min[i]}°C / Máx ${daily.temperature_2m_max[i]}°C | Lluvia: ${daily.precipitation_sum[i]} mm | ${desc}`;
    }

    // Estadísticas resumen
    let allMin = Infinity,
      allMax = -Infinity,
      totalPrecip = 0;
    let frostDays = 0,
      hotDays = 0;
    for (let i = 0; i < historyEnd; i++) {
      if (daily.temperature_2m_min[i] < allMin)
        allMin = daily.temperature_2m_min[i];
      if (daily.temperature_2m_max[i] > allMax)
        allMax = daily.temperature_2m_max[i];
      totalPrecip += daily.precipitation_sum[i] || 0;
      if (daily.temperature_2m_min[i] <= 0) frostDays++;
      if (daily.temperature_2m_max[i] >= 35) hotDays++;
    }
    weatherText += `\n\n📈 RESUMEN DEL PERIODO (~90 días):`;
    weatherText += `\n- Temp. mínima absoluta: ${allMin.toFixed(1)}°C`;
    weatherText += `\n- Temp. máxima absoluta: ${allMax.toFixed(1)}°C`;
    weatherText += `\n- Precipitación total acumulada: ${totalPrecip.toFixed(1)} mm`;
    weatherText += `\n- Días con helada (Tmin ≤ 0°C): ${frostDays}`;
    weatherText += `\n- Días de calor extremo (Tmax ≥ 35°C): ${hotDays}`;

    weatherCache = { data: weatherText, timestamp: Date.now() };
    return weatherText;
  } catch (error) {
    console.error("Error fetching weather for assistant:", error);
    return `\n\nUBICACIÓN DE LA FINCA:
📍 ${FARM_LOCATION_NAME} (Lat: ${FARM_LAT}, Lng: ${FARM_LNG})
⚠️ No se pudieron obtener datos meteorológicos en este momento.`;
  }
}

/**
 * Obtiene datos de costes fijos y precios para contexto del asistente
 */
function fetchCostesContext(): string {
  try {
    const db = getDb();

    // Costes fijos
    const costes = db
      .prepare(
        `SELECT cf.nombre, cf.tipo, cf.categoria, cf.fecha, cf.importe, cf.periodicidad,
                cf.amortizacion_inicio, cf.amortizacion_fin, cf.parcela_ids, cf.notas
         FROM costes_fijos cf ORDER BY cf.fecha DESC`,
      )
      .all() as Array<{
      nombre: string;
      tipo: string;
      categoria: string;
      fecha: string;
      importe: number;
      periodicidad: string;
      amortizacion_inicio: number | null;
      amortizacion_fin: number | null;
      parcela_ids: string;
      notas: string;
    }>;

    // Precios
    const precios = db
      .prepare(
        `SELECT nombre, categoria, unidad, precio_unitario, notas
         FROM precios ORDER BY categoria, nombre`,
      )
      .all() as Array<{
      nombre: string;
      categoria: string;
      unidad: string;
      precio_unitario: number;
      notas: string;
    }>;

    // Parcela map for resolving names
    const parcelas = db.prepare("SELECT id, nombre FROM parcelas").all() as {
      id: string;
      nombre: string;
    }[];
    const parcelaMap = new Map(parcelas.map((p) => [p.id, p.nombre]));

    if (costes.length === 0 && precios.length === 0) return "";

    let text = "\n\nDATOS ECONÓMICOS DE LA FINCA:";

    // Costes fijos
    if (costes.length > 0) {
      text += "\n\n💸 COSTES FIJOS E INGRESOS:";
      text +=
        "\nNombre | Tipo | Categoría | Importe | Periodicidad | Amortización | Parcelas | Notas";

      let totalCostes = 0;
      let totalIngresos = 0;
      let totalAnualizado = 0;

      for (const c of costes) {
        let parcelaNames = "—";
        try {
          const ids = JSON.parse(c.parcela_ids || "[]");
          const names = ids
            .map((id: string) => parcelaMap.get(id))
            .filter(Boolean);
          if (names.length > 0) parcelaNames = names.join(", ");
        } catch {
          /* ignore */
        }

        const amort =
          c.amortizacion_inicio && c.amortizacion_fin
            ? `${c.amortizacion_inicio}-${c.amortizacion_fin}`
            : "—";

        text += `\n- ${c.nombre} | ${c.tipo} | ${c.categoria} | ${c.importe.toFixed(2)}€ | ${c.periodicidad} | ${amort} | ${parcelaNames}${c.notas ? " | " + c.notas : ""}`;

        if (c.tipo === "coste") {
          totalCostes += c.importe;
          switch (c.periodicidad) {
            case "mensual":
              totalAnualizado += c.importe * 12;
              break;
            case "trimestral":
              totalAnualizado += c.importe * 4;
              break;
            default:
              totalAnualizado += c.importe;
          }
        } else {
          totalIngresos += c.importe;
        }
      }

      // Total hectáreas
      const totalHaRow = db
        .prepare(
          "SELECT COALESCE(SUM(superficie_ha), 0) as total FROM parcelas WHERE superficie_ha > 0",
        )
        .get() as { total: number };
      const totalHa = totalHaRow.total;
      const costeMedioHa = totalHa > 0 ? totalAnualizado / totalHa : 0;

      text += `\n\n📊 RESUMEN COSTES:`;
      text += `\n- Total costes fijos: ${totalCostes.toFixed(2)}€`;
      text += `\n- Total ingresos/subvenciones: ${totalIngresos.toFixed(2)}€`;
      text += `\n- Balance: ${(totalIngresos - totalCostes).toFixed(2)}€`;
      text += `\n- Costes anualizados (ajustando periodicidad): ${totalAnualizado.toFixed(2)}€`;
      text += `\n- Superficie total: ${totalHa.toFixed(1)} ha`;
      text += `\n- Coste medio por hectárea (anualizado): ${costeMedioHa.toFixed(2)}€/ha`;
    }

    // Precios
    if (precios.length > 0) {
      text +=
        "\n\n🏷️ PRECIOS UNITARIOS (Personal, Maquinaria, Productos, Servicios):";
      text += "\nNombre | Categoría | Precio | Unidad | Notas";

      const categorias: Record<string, { count: number; total: number }> = {};
      for (const p of precios) {
        text += `\n- ${p.nombre} | ${p.categoria} | ${p.precio_unitario.toFixed(2)}€ | ${p.unidad}${p.notas ? " | " + p.notas : ""}`;
        if (!categorias[p.categoria])
          categorias[p.categoria] = { count: 0, total: 0 };
        categorias[p.categoria].count++;
        categorias[p.categoria].total += p.precio_unitario;
      }

      text += `\n\n📊 RESUMEN PRECIOS:`;
      for (const [cat, data] of Object.entries(categorias)) {
        text += `\n- ${cat}: ${data.count} registros, precio medio ${(data.total / data.count).toFixed(2)}€`;
      }
    }

    return text;
  } catch (error) {
    console.error("Error fetching costes context:", error);
    return "";
  }
}

const SYSTEM_PROMPT = `Eres un asistente agrícola experto especializado en cultivos de Castilla-La Mancha, España.
La finca que asesoras se llama "Finca del Imperio" y tiene las siguientes plantaciones:

VIÑEDO (~80 hectáreas):
- Tempranillo (Cencibel): Sectores 1-4 y 9-11
- Cabernet Sauvignon: Sectores 5-8 y 12-15
- Airén: Sectores 16-24
- Sauvignon Blanc: Parcela dedicada + nueva plantación 2024

PISTACHOS (~68 hectáreas):
- Parcela grande: 45 HA (variedad Kerman/Peter)
- Parcela pequeña: 13 HA (variedad Kerman/Peter)
- Parcela Monte: ~10 HA

OLIVOS (próxima plantación):
- En fase de planificación

INFRAESTRUCTURA:
- 4 pozos de agua
- 8 reservorios
- Sistema de riego por goteo con generales, ramales y peines
- Microtubos en algunos sectores

Tu rol es:
1. Responder preguntas sobre manejo de estos cultivos
2. Recomendar tratamientos fitosanitarios y fechas
3. Ayudar a identificar plagas y enfermedades
4. Sugerir mejores prácticas para cada cultivo
5. Analizar el historial de actividades cuando se proporcione
6. Dar recomendaciones basadas en la época del año actual
7. Consultar y analizar el historial de temperaturas y datos meteorológicos de la finca
8. Utilizar la ubicación GPS de la finca y de los trabajos registrados para dar contexto geográfico
9. Analizar costes fijos, ingresos, subvenciones y calcular costes medios por hectárea, amortizaciones, etc.
10. Consultar precios unitarios de personal, maquinaria, productos y servicios para estimar costes de operaciones

IMPORTANTE: Tienes acceso a datos meteorológicos reales de la finca, incluyendo historial de temperaturas de los últimos 90 días, clima actual y pronóstico a 7 días. Usa estos datos para responder preguntas sobre clima, heladas, temperaturas, precipitaciones, etc. No digas que no tienes acceso a datos de temperatura — SÍ los tienes.

IMPORTANTE: También tienes acceso a los datos económicos de la finca: costes fijos (seguros, arrendamientos, amortizaciones, subvenciones, etc.) y tabla de precios unitarios (personal, maquinaria, productos, servicios). Puedes calcular costes medios por hectárea, estimar costes de operaciones concretas, analizar la rentabilidad, comparar gastos entre periodos, y dar recomendaciones de ahorro. No digas que no tienes datos económicos — SÍ los tienes.

Responde siempre en español. Sé práctico y específico. Si no estás seguro, indícalo.
Fecha actual: ${new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });
    }

    // Get context from DB
    const db = getDb();

    // RAG: Buscar documentos relevantes semánticamente
    const ragResults = await searchKnowledgeBase(message, 8);

    let ragContext = "";
    if (ragResults.length > 0) {
      ragContext =
        "\n\nINFORMACIÓN RELEVANTE DE LA BASE DE CONOCIMIENTO:\n" +
        ragResults
          .map((r, i) => {
            const source =
              r.fuente_tipo === "entrada_diario"
                ? "📋 Diario"
                : r.fuente_tipo === "documento"
                  ? "📄 Documento"
                  : "📚 Base de conocimiento";
            const title = r.titulo ? ` (${r.titulo})` : "";
            return `[${source}${title} - Relevancia: ${(r.similarity * 100).toFixed(0)}%]\n${r.contenido}`;
          })
          .join("\n\n---\n\n");
    }

    // También obtener los documentos legacy por compatibilidad
    const docs = db
      .prepare("SELECT titulo, contenido FROM documentos_ia")
      .all() as { titulo: string; contenido: string }[];

    // Si RAG no encontró nada, usar los docs legacy como fallback
    let legacyContext = "";
    if (ragResults.length === 0 && docs.length > 0) {
      legacyContext =
        "\n\nBASE DE CONOCIMIENTO:\n" +
        docs.map((d) => `--- ${d.titulo} ---\n${d.contenido}`).join("\n\n");
    }

    // Get recent diary entries for context (including GPS data)
    const recentEntries = db
      .prepare(
        `
      SELECT e.fecha, e.tipo_actividad, e.descripcion, e.resultado, e.valoracion, 
             p.nombre as parcela, p.cultivo, p.variedad,
             e.gps_lat, e.gps_lng, e.condiciones_meteo
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      ORDER BY e.fecha DESC LIMIT 20
    `,
      )
      .all() as Array<{
      fecha: string;
      tipo_actividad: string;
      descripcion: string;
      resultado: string;
      valoracion: number;
      parcela: string;
      cultivo: string;
      variedad: string;
      gps_lat: number | null;
      gps_lng: number | null;
      condiciones_meteo: string;
    }>;

    let recentContext = "";
    if (recentEntries.length > 0) {
      recentContext =
        "\n\nÚLTIMAS ACTIVIDADES REGISTRADAS EN EL DIARIO:\n" +
        recentEntries
          .map(
            (e) =>
              `- ${e.fecha} | ${e.parcela} (${e.cultivo}/${e.variedad}) | ${e.tipo_actividad}: ${e.descripcion}${e.resultado ? ` → ${e.resultado}` : ""}${e.valoracion ? ` [${e.valoracion}/5]` : ""}${e.gps_lat ? ` 📍(${e.gps_lat.toFixed(4)}, ${e.gps_lng?.toFixed(4)})` : ""}${e.condiciones_meteo ? ` 🌤️${e.condiciones_meteo}` : ""}`,
          )
          .join("\n");
    }

    // Obtener contexto meteorológico: clima actual, pronóstico e historial de temperaturas
    const weatherContext = await fetchWeatherContext();

    // Obtener contexto de costes y precios
    const costesContext = fetchCostesContext();

    const fullSystemPrompt =
      SYSTEM_PROMPT +
      weatherContext +
      costesContext +
      ragContext +
      legacyContext +
      recentContext;

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === "tu-api-key-aqui") {
      // Provide a helpful response without AI
      return NextResponse.json({
        response: await generateLocalResponse(
          message,
          ragResults,
          docs,
          recentEntries,
          weatherContext,
          costesContext,
        ),
        source: "local",
      });
    }

    const openai = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: fullSystemPrompt },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    return NextResponse.json({
      response: completion.choices[0].message.content,
      source: "openai",
    });
  } catch (error) {
    console.error("Error in assistant:", error);
    return NextResponse.json(
      {
        error: "Error en el asistente",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function generateLocalResponse(
  message: string,
  ragResults: {
    contenido: string;
    fuente_tipo: string;
    titulo?: string;
    similarity: number;
  }[],
  docs: { titulo: string; contenido: string }[],
  recentEntries: Array<{
    fecha: string;
    tipo_actividad: string;
    descripcion: string;
    parcela: string;
    cultivo: string;
    variedad: string;
  }>,
  weatherContext: string,
  costesContext: string,
): Promise<string> {
  const msgLower = message.toLowerCase();

  // Check if asking about costs, prices, expenses, budget
  if (
    msgLower.includes("coste") ||
    msgLower.includes("costo") ||
    msgLower.includes("precio") ||
    msgLower.includes("gasto") ||
    msgLower.includes("presupuesto") ||
    msgLower.includes("amortizaci") ||
    msgLower.includes("seguro") ||
    msgLower.includes("arrendamiento") ||
    msgLower.includes("subvenci") ||
    msgLower.includes("rentabil") ||
    msgLower.includes("hectárea") ||
    msgLower.includes("/ha") ||
    msgLower.includes("económic") ||
    msgLower.includes("financ") ||
    msgLower.includes("factur")
  ) {
    if (costesContext) {
      return `💰 **Datos económicos de la finca:**\n\n${costesContext}\n\n---\n*⚠️ Configura tu API key de OpenAI en \`.env.local\` para análisis más detallados y cálculos personalizados.*`;
    }
    return "💰 No hay datos económicos registrados todavía. Puedes añadir costes fijos y precios desde la sección **Costes** en el menú lateral.";
  }

  // Check if asking about weather, temperatures, frost, precipitation
  if (
    msgLower.includes("temperatura") ||
    msgLower.includes("clima") ||
    msgLower.includes("tiempo") ||
    msgLower.includes("helada") ||
    msgLower.includes("lluvia") ||
    msgLower.includes("precipitaci") ||
    msgLower.includes("viento") ||
    msgLower.includes("humedad") ||
    msgLower.includes("pronóstico") ||
    msgLower.includes("meteorol") ||
    msgLower.includes("calor") ||
    msgLower.includes("frío")
  ) {
    return `🌡️ **Datos meteorológicos de la finca:**\n\n${weatherContext}\n\n---\n*⚠️ Datos de Open-Meteo. Configura tu API key de OpenAI en \`.env.local\` para análisis más detallados.*`;
  }

  // Primero intentar con resultados RAG
  if (ragResults.length > 0) {
    let response = "📚 **Información relevante encontrada:**\n\n";
    for (const r of ragResults.slice(0, 5)) {
      const source =
        r.fuente_tipo === "entrada_diario"
          ? "📋 Diario"
          : r.fuente_tipo === "documento"
            ? "📄 Documento"
            : "📚 Base de conocimiento";
      response += `**${source}${r.titulo ? ` - ${r.titulo}` : ""}:**\n${r.contenido}\n\n`;
    }
    response +=
      "\n---\n*⚠️ Respuesta generada desde la base de conocimiento local. Configura tu API key de OpenAI en `.env.local` para respuestas más inteligentes y personalizadas.*";
    return response;
  }

  // Search knowledge base for relevant info (legacy fallback)
  const relevantDocs = docs.filter((d) => {
    const combined = (d.titulo + " " + d.contenido).toLowerCase();
    const words = msgLower.split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => combined.includes(w));
  });

  if (relevantDocs.length > 0) {
    let response = "📚 **Información de la base de conocimiento:**\n\n";
    for (const doc of relevantDocs) {
      response += `### ${doc.titulo}\n${doc.contenido}\n\n`;
    }
    response +=
      "\n---\n*⚠️ Respuesta generada desde la base de conocimiento local. Configura tu API key de OpenAI en `.env.local` para respuestas más inteligentes y personalizadas.*";
    return response;
  }

  // Check if asking about recent activities
  if (
    msgLower.includes("actividad") ||
    msgLower.includes("último") ||
    msgLower.includes("reciente") ||
    msgLower.includes("hecho")
  ) {
    if (recentEntries.length > 0) {
      let response = "📋 **Últimas actividades registradas:**\n\n";
      for (const e of recentEntries.slice(0, 10)) {
        response += `- **${e.fecha}** - ${e.parcela} (${e.cultivo}): ${e.descripcion}\n`;
      }
      return response;
    }
    return "📋 No hay actividades registradas todavía. ¡Empieza añadiendo entradas en el Diario!";
  }

  return `🤖 **Asistente AgroDiary**

No tengo suficiente información en la base de conocimiento local para responder a tu pregunta de forma precisa.

**Para activar el asistente IA completo:**
1. Obtén una API key de OpenAI en [platform.openai.com](https://platform.openai.com)
2. Crea el archivo \`.env.local\` en la raíz del proyecto
3. Añade: \`OPENAI_API_KEY=tu-api-key\`
4. Reinicia el servidor

**Mientras tanto, puedes preguntarme sobre:**
- 📅 Calendario de tareas por cultivo (pistacho, viñedo, olivo)
- 🐛 Plagas y enfermedades comunes
- 📊 Actividades recientes registradas

*También puedes subir manuales y documentos en la sección de configuración para ampliar la base de conocimiento.*`;
}

// API to add documents to knowledge base
export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { v4: uuid } = require("uuid");

    const stmt = db.prepare(`
      INSERT INTO documentos_ia (id, titulo, contenido, tipo, cultivo)
      VALUES (@id, @titulo, @contenido, @tipo, @cultivo)
    `);

    stmt.run({
      id: uuid(),
      titulo: body.titulo,
      contenido: body.contenido,
      tipo: body.tipo || "manual",
      cultivo: body.cultivo || "",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding document:", error);
    return NextResponse.json(
      { error: "Error al añadir documento" },
      { status: 500 },
    );
  }
}

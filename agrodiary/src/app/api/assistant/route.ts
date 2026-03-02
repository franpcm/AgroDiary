// ==========================================
// API: Asistente IA Agrícola (con RAG)
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { searchKnowledgeBase } from "@/lib/rag";
import OpenAI from "openai";

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

    // Get recent diary entries for context
    const recentEntries = db
      .prepare(
        `
      SELECT e.fecha, e.tipo_actividad, e.descripcion, e.resultado, e.valoracion, 
             p.nombre as parcela, p.cultivo, p.variedad
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
    }>;

    let recentContext = "";
    if (recentEntries.length > 0) {
      recentContext =
        "\n\nÚLTIMAS ACTIVIDADES REGISTRADAS EN EL DIARIO:\n" +
        recentEntries
          .map(
            (e) =>
              `- ${e.fecha} | ${e.parcela} (${e.cultivo}/${e.variedad}) | ${e.tipo_actividad}: ${e.descripcion}${e.resultado ? ` → ${e.resultado}` : ""}${e.valoracion ? ` [${e.valoracion}/5]` : ""}`,
          )
          .join("\n");
    }

    const fullSystemPrompt =
      SYSTEM_PROMPT + ragContext + legacyContext + recentContext;

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === "tu-api-key-aqui") {
      // Provide a helpful response without AI
      return NextResponse.json({
        response: generateLocalResponse(
          message,
          ragResults,
          docs,
          recentEntries,
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

function generateLocalResponse(
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
): string {
  const msgLower = message.toLowerCase();

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

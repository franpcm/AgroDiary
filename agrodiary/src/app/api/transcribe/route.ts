// ==========================================
// API: Transcripción de audio con Whisper
// + modo autoFill: extrae campos con GPT
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key de OpenAI no configurada" },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const autoFill = formData.get("autoFill") === "true";

    if (!audioFile) {
      return NextResponse.json(
        { error: "No se recibió archivo de audio" },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "es",
      response_format: "text",
    });

    const text =
      typeof transcription === "string" ? transcription : String(transcription);

    // If autoFill mode, use GPT to extract structured fields
    if (autoFill && text.trim()) {
      try {
        const extraction = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Eres un asistente agrícola. A partir de la transcripción de un audio de un técnico de campo, extrae los datos para rellenar una entrada de cuaderno de campo.

Devuelve SOLO un JSON con estos campos (deja vacío "" lo que no se mencione):
{
  "tipo_actividad": "uno de: Tratamiento fitosanitario, Riego, Poda, Fertilización, Siembra/Plantación, Cosecha/Vendimia, Laboreo, Observación/Monitoreo, Mantenimiento, Otro",
  "descripcion": "descripción clara de la actividad realizada",
  "productos_usados": "productos fitosanitarios, fertilizantes o insumos mencionados con sus dosis si se indican",
  "resultado": "resultado observado o estado del cultivo",
  "notas": "cualquier nota adicional, observación o dato relevante que no encaje en los otros campos",
  "condiciones_meteo": "condiciones meteorológicas si se mencionan (temperatura, viento, humedad, etc.)"
}

Sé preciso y usa la información textual. No inventes datos que no estén en la transcripción.`,
            },
            {
              role: "user",
              content: `Transcripción del audio del técnico:\n\n"${text}"`,
            },
          ],
        });

        const parsed = JSON.parse(
          extraction.choices[0]?.message?.content || "{}",
        );

        return NextResponse.json({
          text,
          fields: {
            tipo_actividad: parsed.tipo_actividad || "",
            descripcion: parsed.descripcion || "",
            productos_usados: parsed.productos_usados || "",
            resultado: parsed.resultado || "",
            notas: parsed.notas || "",
            condiciones_meteo: parsed.condiciones_meteo || "",
          },
        });
      } catch (extractErr) {
        console.error("Error extracting fields:", extractErr);
        // Fall back to just returning the transcription
        return NextResponse.json({ text });
      }
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: "Error al transcribir el audio" },
      { status: 500 },
    );
  }
}

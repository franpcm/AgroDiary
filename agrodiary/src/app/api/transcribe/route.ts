// ==========================================
// API: Transcripción de audio con Whisper
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

    return NextResponse.json({ text: transcription });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: "Error al transcribir el audio" },
      { status: 500 },
    );
  }
}

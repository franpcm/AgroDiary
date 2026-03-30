"use client";

import { useState, useRef, useCallback } from "react";

export interface AutoFillFields {
  tipo_actividad?: string;
  descripcion?: string;
  productos_usados?: string;
  resultado?: string;
  notas?: string;
  condiciones_meteo?: string;
}

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  onAutoFill?: (fields: AutoFillFields, rawText: string) => void;
  mode?: "field" | "autofill";
  className?: string;
}

const ACCEPTED_AUDIO = ".mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,.mp4,.mpeg,.wma";

export default function AudioRecorder({
  onTranscription,
  onAutoFill,
  mode = "field",
  className = "",
}: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [fileName, setFileName] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAutoFill = mode === "autofill";

  const sendAudioForTranscription = useCallback(
    async (blob: Blob, name: string) => {
      setTranscribing(true);
      setError("");
      try {
        const ext = name.split(".").pop() || "webm";
        const mimeMap: Record<string, string> = {
          mp3: "audio/mpeg",
          m4a: "audio/mp4",
          wav: "audio/wav",
          ogg: "audio/ogg",
          webm: "audio/webm",
          aac: "audio/aac",
          flac: "audio/flac",
          mp4: "audio/mp4",
          wma: "audio/x-ms-wma",
        };
        const file = new File([blob], name, {
          type: mimeMap[ext] || `audio/${ext}`,
        });
        const formData = new FormData();
        formData.append("audio", file);
        if (isAutoFill) formData.append("autoFill", "true");

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else if (isAutoFill && data.fields && onAutoFill) {
          onAutoFill(data.fields, data.text);
        } else if (data.text) {
          onTranscription(data.text);
        }
      } catch (err) {
        setError("Error al transcribir el audio");
        console.error(err);
      } finally {
        setTranscribing(false);
        setFileName("");
      }
    },
    [isAutoFill, onAutoFill, onTranscription],
  );

  const startRecording = useCallback(async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 100) {
          setError("Grabación demasiado corta");
          return;
        }

        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        await sendAudioForTranscription(blob, `grabacion.${ext}`);
      };

      mediaRecorder.start(250);
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("No se pudo acceder al micrófono. Comprueba los permisos.");
    }
  }, [sendAudioForTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [recording]);

  const handleFileAttach = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      await sendAudioForTranscription(file, file.name);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [sendAudioForTranscription],
  );

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition animate-pulse"
        >
          <span className="w-3 h-3 bg-white rounded-full" />
          <span>Parar {formatDuration(duration)}</span>
        </button>
      ) : transcribing ? (
        <button
          type="button"
          disabled
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg"
        >
          <span className="animate-spin">⏳</span>
          <span>
            {isAutoFill
              ? "Transcribiendo y analizando..."
              : "Transcribiendo..."}
          </span>
          {fileName && <span className="text-xs opacity-80">({fileName})</span>}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={startRecording}
            className={`flex items-center gap-2 ${
              isAutoFill
                ? "bg-purple-500 hover:bg-purple-600"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white px-4 py-2 rounded-lg transition`}
            title={
              isAutoFill
                ? "Grabar audio y auto-rellenar todos los campos"
                : "Grabar audio y transcribir"
            }
          >
            🎙️ {isAutoFill ? "Grabar" : "Dictar"}
          </button>

          {/* Attach audio file button */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_AUDIO}
            onChange={handleFileAttach}
            className="hidden"
            id={`audio-attach-${mode}`}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 ${
              isAutoFill
                ? "bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
            } px-4 py-2 rounded-lg transition`}
            title="Adjuntar archivo de audio"
          >
            📎 Adjuntar audio
          </button>
        </>
      )}
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
}

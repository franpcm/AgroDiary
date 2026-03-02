'use client';

import { useState, useRef, useCallback } from 'react';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  className?: string;
}

export default function AudioRecorder({ onTranscription, className = '' }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Try webm first, fallback to mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 100) {
          setError('Grabación demasiado corta');
          return;
        }

        setTranscribing(true);
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const file = new File([blob], `audio.${ext}`, { type: mimeType });
          const formData = new FormData();
          formData.append('audio', file);

          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();

          if (data.error) {
            setError(data.error);
          } else if (data.text) {
            onTranscription(data.text);
          }
        } catch (err) {
          setError('Error al transcribir el audio');
          console.error(err);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('No se pudo acceder al micrófono. Comprueba los permisos.');
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [recording]);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
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
          <span>Transcribiendo...</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
          title="Grabar audio y transcribir con IA"
        >
          🎙️ Dictar
        </button>
      )}
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
}

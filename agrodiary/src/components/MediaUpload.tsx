"use client";

import { useState, useRef } from "react";
import type { ArchivoMedia } from "@/types";
import MediaLightbox from "./MediaLightbox";

interface MediaUploadProps {
  entradaId: string;
  usuarioId: string;
  archivos: ArchivoMedia[];
  onUpload: (archivo: ArchivoMedia) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export default function MediaUpload({
  entradaId,
  usuarioId,
  archivos,
  onUpload,
  onDelete,
  readOnly = false,
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > 50 * 1024 * 1024) {
          setError(`${file.name}: Máximo 50MB`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("entrada_id", entradaId);
        formData.append("usuario_id", usuarioId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else {
          onUpload(data);
        }
      }
    } catch (err) {
      setError("Error al subir archivo");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await fetch(`/api/upload?id=${id}`, { method: "DELETE" });
      onDelete(id);
    } catch (err) {
      console.error(err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* File grid */}
      {archivos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {archivos.map((a, index) => (
            <div
              key={a.id}
              className="relative group rounded-lg overflow-hidden border bg-gray-50 cursor-pointer"
              onClick={() => setLightboxIndex(index)}
            >
              {a.tipo === "imagen" ? (
                <img
                  src={a.url}
                  alt={a.nombre}
                  className="w-full h-32 object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-gray-900 relative">
                  <video
                    src={a.url}
                    className="max-h-full max-w-full"
                    preload="metadata"
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-white text-3xl bg-black/30">
                    ▶
                  </span>
                </div>
              )}
              <div className="p-1.5 text-xs text-gray-500 truncate">
                {a.nombre} ({formatSize(a.tamano)})
              </div>
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(a.id);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                >
                  ✕
                </button>
              )}
              {/* Click to view indicator */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                <span className="text-white text-lg opacity-0 group-hover:opacity-100 transition drop-shadow-lg">
                  🔍
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload buttons */}
      {!readOnly && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            id={`file-upload-${entradaId}`}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleUpload}
            className="hidden"
            id={`camera-upload-${entradaId}`}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleUpload}
            className="hidden"
            id={`video-upload-${entradaId}`}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition border border-blue-200 disabled:opacity-50"
            >
              📷 Hacer foto
            </button>
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-2 rounded-lg transition border border-purple-200 disabled:opacity-50"
            >
              🎥 Grabar vídeo
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg transition border border-gray-200 disabled:opacity-50"
            >
              📎 Adjuntar archivo
            </button>
            {uploading && (
              <span className="flex items-center text-sm text-blue-600 gap-1">
                <span className="animate-spin">⏳</span> Subiendo...
              </span>
            )}
          </div>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && archivos.length > 0 && (
        <MediaLightbox
          archivos={archivos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

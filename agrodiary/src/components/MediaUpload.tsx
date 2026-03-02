"use client";

import { useState, useRef } from "react";
import type { ArchivoMedia } from "@/types";

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
  const fileRef = useRef<HTMLInputElement>(null);

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
          {archivos.map((a) => (
            <div
              key={a.id}
              className="relative group rounded-lg overflow-hidden border bg-gray-50"
            >
              {a.tipo === "imagen" ? (
                <img
                  src={a.url}
                  alt={a.nombre}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                  <video
                    src={a.url}
                    className="max-h-full max-w-full"
                    controls
                    preload="metadata"
                  />
                </div>
              )}
              <div className="p-1.5 text-xs text-gray-500 truncate">
                {a.nombre} ({formatSize(a.tamano)})
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition disabled:text-gray-400"
          >
            {uploading ? <>⏳ Subiendo...</> : <>📎 Añadir fotos / vídeos</>}
          </button>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { ArchivoMedia } from "@/types";

interface MediaLightboxProps {
  archivos: ArchivoMedia[];
  initialIndex: number;
  onClose: () => void;
}

export default function MediaLightbox({
  archivos,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const current = archivos[currentIndex];
  const total = archivos.length;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[100] flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-gray-300">
          {currentIndex + 1} / {total} — {current.nombre}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={current.url}
            download={current.nombre}
            className="text-sm text-blue-400 hover:text-blue-300 transition"
            title="Descargar"
          >
            ⬇️ Descargar
          </a>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 text-2xl transition w-10 h-10 flex items-center justify-center"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex items-center justify-center relative px-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation arrows */}
        {total > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center text-2xl transition"
            >
              ‹
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center text-2xl transition"
            >
              ›
            </button>
          </>
        )}

        {/* Media display */}
        {current.tipo === "imagen" ? (
          <img
            src={current.url}
            alt={current.nombre}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <video
            src={current.url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Thumbnails strip */}
      {total > 1 && (
        <div
          className="flex items-center justify-center gap-2 p-4 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {archivos.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                i === currentIndex
                  ? "border-white opacity-100 scale-110"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              {a.tipo === "imagen" ? (
                <img
                  src={a.url}
                  alt={a.nombre}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-lg">
                  ▶
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

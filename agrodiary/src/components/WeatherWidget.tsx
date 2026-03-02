"use client";

import { useEffect, useState } from "react";

interface WeatherData {
  temperatura: number;
  temperatura_max: number;
  temperatura_min: number;
  humedad: number;
  viento_kmh: number;
  direccion_viento: string;
  precipitacion_mm: number;
  descripcion: string;
  codigo_wmo: number;
  es_dia: boolean;
  uv_index: number;
  presion_hpa: number;
  pronostico_7dias?: {
    fecha: string;
    temp_max: number;
    temp_min: number;
    precipitacion_mm: number;
    codigo_wmo: number;
    descripcion: string;
  }[];
}

const WMO_ICONS: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌨️",
  57: "🌨️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌨️",
  67: "🌨️",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  77: "🌨️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Hoy";
  if (date.getTime() === tomorrow.getTime()) return "Mañana";
  return date
    .toLocaleDateString("es-ES", { weekday: "short" })
    .replace(".", "");
}

export default function WeatherWidget({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setWeather)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`card ${compact ? "p-4" : "p-6"} animate-pulse`}>
        <div className="h-20 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div
        className={`card ${compact ? "p-4" : "p-6"} text-center text-gray-400`}
      >
        <p>🌐 Sin datos meteorológicos</p>
      </div>
    );
  }

  const icon = WMO_ICONS[weather.codigo_wmo] || "🌡️";

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold">{weather.temperatura}°C</span>
        <span className="text-gray-500">{weather.descripcion}</span>
        <span className="text-gray-400">💧{weather.humedad}%</span>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Current weather */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-1">
              Finca del Imperio — Ahora
            </p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold">{weather.temperatura}°</span>
              <div className="mb-1">
                <p className="text-lg font-medium">{weather.descripcion}</p>
                <p className="text-blue-100 text-sm">
                  Máx {weather.temperatura_max}° · Mín {weather.temperatura_min}
                  °
                </p>
              </div>
            </div>
          </div>
          <span className="text-6xl">{icon}</span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-blue-100 text-xs">Humedad</p>
            <p className="font-semibold">{weather.humedad}%</p>
          </div>
          <div className="text-center">
            <p className="text-blue-100 text-xs">Viento</p>
            <p className="font-semibold">
              {weather.viento_kmh} km/h {weather.direccion_viento}
            </p>
          </div>
          <div className="text-center">
            <p className="text-blue-100 text-xs">Lluvia</p>
            <p className="font-semibold">{weather.precipitacion_mm} mm</p>
          </div>
          <div className="text-center">
            <p className="text-blue-100 text-xs">UV</p>
            <p className="font-semibold">{weather.uv_index}</p>
          </div>
        </div>
      </div>

      {/* 7-day forecast */}
      {weather.pronostico_7dias && (
        <div className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pronóstico 7 días
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {weather.pronostico_7dias.map((day) => (
              <div
                key={day.fecha}
                className="py-2 rounded-lg hover:bg-gray-50 transition"
              >
                <p className="text-gray-500 text-xs font-medium capitalize">
                  {getDayName(day.fecha)}
                </p>
                <p className="text-xl my-1">
                  {WMO_ICONS[day.codigo_wmo] || "🌡️"}
                </p>
                <p className="font-semibold text-gray-800">{day.temp_max}°</p>
                <p className="text-gray-400 text-xs">{day.temp_min}°</p>
                {day.precipitacion_mm > 0 && (
                  <p className="text-blue-500 text-xs mt-1">
                    💧{day.precipitacion_mm}mm
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

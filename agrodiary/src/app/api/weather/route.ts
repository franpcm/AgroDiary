import { NextResponse } from "next/server";

// Finca del Imperio coordinates
const FARM_LAT = 39.568;
const FARM_LNG = -2.94;

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
  // Forecast
  pronostico_7dias?: ForecastDay[];
}

interface ForecastDay {
  fecha: string;
  temp_max: number;
  temp_min: number;
  precipitacion_mm: number;
  codigo_wmo: number;
  descripcion: string;
}

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
  56: "Llovizna helada ligera",
  57: "Llovizna helada intensa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  66: "Lluvia helada ligera",
  67: "Lluvia helada intensa",
  71: "Nevada ligera",
  73: "Nevada moderada",
  75: "Nevada intensa",
  77: "Granizo",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
  85: "Chubascos de nieve ligeros",
  86: "Chubascos de nieve intensos",
  95: "Tormenta",
  96: "Tormenta con granizo ligero",
  99: "Tormenta con granizo intenso",
};

function getWindDirection(degrees: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSO",
    "SO",
    "OSO",
    "O",
    "ONO",
    "NO",
    "NNO",
  ];
  const idx = Math.round(degrees / 22.5) % 16;
  return dirs[idx];
}

// Cache weather data for 15 minutes
let cachedWeather: { data: WeatherData; timestamp: number } | null = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 min

export async function GET() {
  try {
    // Return cached data if fresh
    if (
      cachedWeather &&
      Date.now() - cachedWeather.timestamp < CACHE_DURATION
    ) {
      return NextResponse.json(cachedWeather.data);
    }

    // Fetch current weather + 7-day forecast from Open-Meteo
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", FARM_LAT.toString());
    url.searchParams.set("longitude", FARM_LNG.toString());
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day,surface_pressure,uv_index",
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    );
    url.searchParams.set("timezone", "Europe/Madrid");
    url.searchParams.set("forecast_days", "7");

    const res = await fetch(url.toString(), { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);

    const api = await res.json();
    const current = api.current;
    const daily = api.daily;

    const forecast: ForecastDay[] = daily.time.map(
      (fecha: string, i: number) => ({
        fecha,
        temp_max: Math.round(daily.temperature_2m_max[i]),
        temp_min: Math.round(daily.temperature_2m_min[i]),
        precipitacion_mm: daily.precipitation_sum[i],
        codigo_wmo: daily.weather_code[i],
        descripcion: WMO_DESCRIPTIONS[daily.weather_code[i]] || "Desconocido",
      }),
    );

    const weather: WeatherData = {
      temperatura: Math.round(current.temperature_2m * 10) / 10,
      temperatura_max: forecast[0]?.temp_max || 0,
      temperatura_min: forecast[0]?.temp_min || 0,
      humedad: current.relative_humidity_2m,
      viento_kmh: Math.round(current.wind_speed_10m),
      direccion_viento: getWindDirection(current.wind_direction_10m),
      precipitacion_mm: current.precipitation,
      descripcion: WMO_DESCRIPTIONS[current.weather_code] || "Desconocido",
      codigo_wmo: current.weather_code,
      es_dia: current.is_day === 1,
      uv_index: current.uv_index || 0,
      presion_hpa: Math.round(current.surface_pressure),
      pronostico_7dias: forecast,
    };

    cachedWeather = { data: weather, timestamp: Date.now() };

    return NextResponse.json(weather);
  } catch (error) {
    console.error("Weather API error:", error);
    // Return cached data even if stale on error
    if (cachedWeather) {
      return NextResponse.json(cachedWeather.data);
    }
    return NextResponse.json(
      { error: "No se pudo obtener el clima" },
      { status: 500 },
    );
  }
}

// Helper: Generate weather string for diary auto-fill
export function formatWeatherForDiary(w: WeatherData): string {
  return `${w.descripcion} | ${w.temperatura}°C (${w.temperatura_min}-${w.temperatura_max}°C) | Humedad: ${w.humedad}% | Viento: ${w.viento_kmh} km/h ${w.direccion_viento}${w.precipitacion_mm > 0 ? ` | Lluvia: ${w.precipitacion_mm} mm` : ""}`;
}

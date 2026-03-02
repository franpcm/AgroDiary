"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ACTIVIDAD_LABELS,
  CULTIVO_LABELS,
  type TipoActividad,
  type TipoCultivo,
  type EntradaDiario,
} from "@/types";
import WeatherWidget from "@/components/WeatherWidget";
import AlertsPanel from "@/components/AlertsPanel";
interface DashboardData {
  total_entradas: number;
  entradas_hoy: number;
  entradas_semana: number;
  parcelas_activas: number;
  ultima_actividad: EntradaDiario | null;
  actividades_por_tipo: { tipo: TipoActividad; count: number }[];
  actividades_por_cultivo: { cultivo: TipoCultivo; count: number }[];
  recientes: EntradaDiario[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cultivos")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl animate-spin-slow">🌿</div>
          <p className="mt-4 text-gray-500">Cargando AgroDiary...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1 capitalize">{today}</p>
      </div>

      {/* Quick Action */}
      <div className="mb-8">
        <Link
          href="/diario"
          className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition shadow-lg shadow-green-200 text-lg"
        >
          <span className="text-2xl">✏️</span>
          Registrar actividad de hoy
        </Link>
      </div>

      {/* Weather */}
      <div className="mb-8">
        <WeatherWidget />
      </div>

      {/* Alerts */}
      <div className="mb-8">
        <AlertsPanel />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard
          icon="📝"
          label="Total Entradas"
          value={data?.total_entradas || 0}
          color="blue"
        />
        <StatCard
          icon="📅"
          label="Hoy"
          value={data?.entradas_hoy || 0}
          color="green"
        />
        <StatCard
          icon="📆"
          label="Esta Semana"
          value={data?.entradas_semana || 0}
          color="purple"
        />
        <StatCard
          icon="🌱"
          label="Parcelas Activas"
          value={data?.parcelas_activas || 0}
          subtitle="(esta semana)"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activities */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">
              📋 Actividad Reciente
            </h2>
            <Link
              href="/diario"
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              Ver todo →
            </Link>
          </div>
          {data?.recientes && data.recientes.length > 0 ? (
            <div className="space-y-3">
              {data.recientes.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition animate-fade-in"
                >
                  <div className="text-2xl">
                    {ACTIVIDAD_LABELS[
                      entry.tipo_actividad as TipoActividad
                    ]?.split(" ")[0] || "📝"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {entry.descripcion}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <span>{entry.fecha}</span>
                      <span>·</span>
                      <span className={`badge badge-${entry.cultivo}`}>
                        {entry.parcela_nombre}
                      </span>
                      <span>·</span>
                      <span>{entry.realizado_por}</span>
                    </div>
                  </div>
                  {entry.valoracion ? (
                    <div className="text-yellow-500 text-sm">
                      {"★".repeat(entry.valoracion as number)}
                      {"☆".repeat(5 - (entry.valoracion as number))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-3">📝</div>
              <p>No hay actividades registradas</p>
              <Link
                href="/diario"
                className="text-green-600 hover:underline mt-2 inline-block"
              >
                Registrar primera actividad →
              </Link>
            </div>
          )}
        </div>

        {/* Activity by type and crop */}
        <div className="space-y-6">
          {/* By Crop */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              🌾 Actividades por Cultivo
            </h2>
            {data?.actividades_por_cultivo &&
            data.actividades_por_cultivo.length > 0 ? (
              <div className="space-y-3">
                {data.actividades_por_cultivo.map((item) => (
                  <div key={item.cultivo} className="flex items-center gap-3">
                    <span className="text-xl">
                      {CULTIVO_LABELS[item.cultivo as TipoCultivo]?.split(
                        " ",
                      )[0] || "🌾"}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">
                          {CULTIVO_LABELS[item.cultivo as TipoCultivo] ||
                            item.cultivo}
                        </span>
                        <span className="text-gray-500">{item.count}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-500"
                          style={{
                            width: `${Math.min(100, (item.count / Math.max(1, data.total_entradas)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">
                Sin datos todavía
              </p>
            )}
          </div>

          {/* By Type */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              📊 Por Tipo de Actividad
            </h2>
            {data?.actividades_por_tipo &&
            data.actividades_por_tipo.length > 0 ? (
              <div className="space-y-2">
                {data.actividades_por_tipo.slice(0, 6).map((item) => (
                  <div
                    key={item.tipo}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm">
                      {ACTIVIDAD_LABELS[item.tipo as TipoActividad] ||
                        item.tipo}
                    </span>
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">
                Sin datos todavía
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              ⚡ Accesos Rápidos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/parcelas"
                className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-blue-700 font-medium text-sm"
              >
                🗺️ Ver Mapa
              </Link>
              <Link
                href="/asistente"
                className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition text-purple-700 font-medium text-sm"
              >
                🤖 Consultar IA
              </Link>
              <Link
                href="/historico"
                className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition text-amber-700 font-medium text-sm"
              >
                📈 Histórico
              </Link>
              <Link
                href="/diario"
                className="flex items-center gap-2 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition text-green-700 font-medium text-sm"
              >
                📝 Nuevo Registro
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  subtitle?: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    amber: "from-amber-500 to-amber-600",
  };

  return (
    <div className="stat-card relative overflow-hidden">
      <div
        className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${colors[color]} opacity-10 rounded-bl-full`}
      />
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
    </div>
  );
}

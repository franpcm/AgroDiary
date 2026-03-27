"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CATEGORIA_COSTE_LABELS,
  CATEGORIA_PRECIO_LABELS,
  type CategoriaCosteFijo,
  type CategoriaPrecio,
} from "@/types";

type ResumenCostes = {
  costes_fijos: {
    total_costes: number;
    total_ingresos: number;
    balance: number;
    costes_anualizados: number;
    coste_medio_ha: number;
    total_hectareas: number;
    num_registros: number;
    por_categoria: {
      categoria: string;
      tipo: string;
      count: number;
      total: number;
    }[];
  };
  precios: {
    num_registros: number;
    por_categoria: {
      categoria: string;
      count: number;
      precio_medio: number;
    }[];
  };
};

export default function CostesPage() {
  const [resumen, setResumen] = useState<ResumenCostes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/costes/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-6xl animate-spin-slow">💰</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          💰 Costes y Precios
        </h1>
        <p className="text-gray-500 mt-1">
          Resumen general de costes fijos, ingresos y precios de la explotación
        </p>
      </div>

      {/* Quick access cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/costes/fijos"
          className="card p-6 hover:shadow-lg transition group"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏦</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition">
                Costes Fijos
              </h2>
              <p className="text-sm text-gray-500">
                Seguros, arrendamientos, subvenciones, amortizaciones...
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {resumen?.costes_fijos.num_registros || 0}
              </div>
              <div className="text-xs text-gray-400">registros</div>
            </div>
          </div>
        </Link>

        <Link
          href="/costes/precios"
          className="card p-6 hover:shadow-lg transition group"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏷️</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition">
                Precios
              </h2>
              <p className="text-sm text-gray-500">
                Personal, maquinaria, productos, servicios...
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {resumen?.precios.num_registros || 0}
              </div>
              <div className="text-xs text-gray-400">registros</div>
            </div>
          </div>
        </Link>
      </div>

      {resumen && (
        <>
          {/* Main KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="text-2xl mb-1">💸</div>
              <div className="text-sm text-gray-500">Total Costes Fijos</div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(resumen.costes_fijos.total_costes)}
              </div>
            </div>
            <div className="stat-card">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-sm text-gray-500">Total Ingresos</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(resumen.costes_fijos.total_ingresos)}
              </div>
            </div>
            <div className="stat-card">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-sm text-gray-500">Coste Anualizado</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(resumen.costes_fijos.costes_anualizados)}
              </div>
            </div>
            <div className="stat-card">
              <div className="text-2xl mb-1">🌾</div>
              <div className="text-sm text-gray-500">Coste Medio / ha</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(resumen.costes_fijos.coste_medio_ha)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                sobre {resumen.costes_fijos.total_hectareas.toFixed(1)} ha
              </div>
            </div>
          </div>

          {/* Breakdown panels */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Costes por categoría */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                📋 Costes fijos por categoría
              </h3>
              {resumen.costes_fijos.por_categoria.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No hay datos aún.{" "}
                  <Link
                    href="/costes/fijos"
                    className="text-green-600 hover:underline"
                  >
                    Añadir costes →
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {resumen.costes_fijos.por_categoria.map((item, i) => {
                    const maxTotal = Math.max(
                      ...resumen.costes_fijos.por_categoria.map((c) => c.total),
                    );
                    const pct =
                      maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">
                            {CATEGORIA_COSTE_LABELS[
                              item.categoria as CategoriaCosteFijo
                            ] || item.categoria}{" "}
                            <span
                              className={`text-xs ${item.tipo === "ingreso" ? "text-green-500" : "text-red-400"}`}
                            >
                              ({item.tipo})
                            </span>
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.tipo === "ingreso"
                                ? "bg-green-400"
                                : "bg-red-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Precios por categoría */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                🏷️ Precios por categoría
              </h3>
              {resumen.precios.por_categoria.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No hay datos aún.{" "}
                  <Link
                    href="/costes/precios"
                    className="text-green-600 hover:underline"
                  >
                    Añadir precios →
                  </Link>
                </p>
              ) : (
                <div className="space-y-4">
                  {resumen.precios.por_categoria.map((item) => (
                    <div
                      key={item.categoria}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-800">
                          {CATEGORIA_PRECIO_LABELS[
                            item.categoria as CategoriaPrecio
                          ] || item.categoria}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.count} registro{item.count !== 1 && "s"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-800">
                          {formatCurrency(item.precio_medio)}
                        </div>
                        <div className="text-xs text-gray-400">
                          precio medio
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Balance card */}
          <div className="card p-6 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              ⚖️ Balance Costes vs Ingresos
            </h3>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Costes</span>
                  <span className="text-sm font-semibold text-red-600">
                    {formatCurrency(resumen.costes_fijos.total_costes)}
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{
                      width: `${
                        resumen.costes_fijos.total_costes +
                          resumen.costes_fijos.total_ingresos >
                        0
                          ? (resumen.costes_fijos.total_costes /
                              (resumen.costes_fijos.total_costes +
                                resumen.costes_fijos.total_ingresos)) *
                            100
                          : 50
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-center px-4">
                <div
                  className={`text-2xl font-bold ${
                    resumen.costes_fijos.balance >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {resumen.costes_fijos.balance >= 0 ? "+" : ""}
                  {formatCurrency(resumen.costes_fijos.balance)}
                </div>
                <div className="text-xs text-gray-400">balance</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Ingresos</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(resumen.costes_fijos.total_ingresos)}
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{
                      width: `${
                        resumen.costes_fijos.total_costes +
                          resumen.costes_fijos.total_ingresos >
                        0
                          ? (resumen.costes_fijos.total_ingresos /
                              (resumen.costes_fijos.total_costes +
                                resumen.costes_fijos.total_ingresos)) *
                            100
                          : 50
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FarmMapData } from "@/types";

// Color map for different varieties
const VARIETY_COLORS: Record<string, string> = {
  "Tempranillo Abajo": "#8E24AA",
  "Tempranillo Arriba": "#AB47BC",
  "Cabernet Arriba": "#C62828",
  "Cabernet Abajo": "#E53935",
  Airen: "#F9A825",
  Pistachos: "#2E7D32",
  "Pistachos Monte": "#388E3C",
  "Sauvignon Blanc": "#00838F",
  "Sauvignon Blanc 2024": "#0097A7",
};

const SECTOR_COLOR = "#4CAF50";

export default function FarmMap({ mapData }: { mapData: FarmMapData }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map centered on the farm
    const map = L.map(mapRef.current, {
      center: [39.568, -2.94],
      zoom: 14,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Add satellite tile layer
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "AgroDiary | Tiles &copy; Esri",
        maxZoom: 19,
      },
    ).addTo(map);

    // Add labels overlay
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        pane: "overlayPane",
      },
    ).addTo(map);

    // Layer groups
    const sectorsLayer = L.layerGroup().addTo(map);
    const varietiesLayer = L.layerGroup().addTo(map);
    const infrastructureLayer = L.layerGroup().addTo(map);

    // Draw sector polygons
    if (mapData.parcelas) {
      for (const sector of mapData.parcelas) {
        if (sector.coordinates.length > 0) {
          const polygon = L.polygon(
            sector.coordinates.map((c) => [c.lat, c.lng] as L.LatLngTuple),
            {
              color: SECTOR_COLOR,
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.15,
              fillColor: SECTOR_COLOR,
            },
          );
          polygon.bindPopup(`
            <div style="font-family: system-ui; min-width: 150px;">
              <h3 style="font-weight: 700; margin: 0 0 4px 0;">${sector.name}</h3>
              <p style="color: #666; margin: 0; font-size: 0.85em;">Sector de riego</p>
            </div>
          `);
          polygon.bindTooltip(sector.name, {
            permanent: false,
            direction: "center",
          });
          sectorsLayer.addLayer(polygon);
        }
      }
    }

    // Draw variety polygons
    if (mapData.variedades) {
      for (const variety of mapData.variedades) {
        if (variety.coordinates.length > 0) {
          const color = VARIETY_COLORS[variety.name] || "#795548";
          const polygon = L.polygon(
            variety.coordinates.map((c) => [c.lat, c.lng] as L.LatLngTuple),
            {
              color: color,
              weight: 3,
              opacity: 0.9,
              fillOpacity: 0.35,
              fillColor: color,
            },
          );
          // Create popup with loading state, then fetch activity data
          const popup = L.popup({ minWidth: 220, maxWidth: 320 });
          popup.setContent(`
            <div style="font-family: system-ui; min-width: 200px;">
              <h3 style="font-weight: 700; margin: 0 0 4px 0; color: ${color};">${variety.name}</h3>
              <p style="color: #999; margin: 4px 0; font-size: 0.8em;">Cargando actividad...</p>
            </div>
          `);
          polygon.bindPopup(popup);
          polygon.on("popupopen", async () => {
            try {
              const res = await fetch(
                `/api/parcelas/activity?nombre=${encodeURIComponent(variety.name)}&limit=3`,
              );
              const data = await res.json();
              let html = `<div style="font-family: system-ui; min-width: 200px;">
                <h3 style="font-weight: 700; margin: 0 0 2px 0; color: ${color};">${variety.name}</h3>`;
              if (data.parcela) {
                html += `<p style="color: #666; margin: 0 0 6px; font-size: 0.8em;">${data.parcela.cultivo} · ${data.parcela.superficie_ha} ha</p>`;
              }
              if (data.stats?.ultima_actividad) {
                const dias = data.stats.dias_sin_actividad;
                const diasColor =
                  dias > 30 ? "#ef4444" : dias > 14 ? "#f59e0b" : "#22c55e";
                html += `<div style="background: #f8f8f8; border-radius: 6px; padding: 6px 8px; margin: 6px 0;">
                  <span style="font-size: 0.75em; color: ${diasColor}; font-weight: 600;">&#9679;</span>
                  <span style="font-size: 0.8em; color: #555;"> Última actividad: <strong>${data.stats.ultima_actividad}</strong> (hace ${dias} días)</span>
                  <br><span style="font-size: 0.75em; color: #888;">${data.stats.total_entradas} registros totales</span>
                </div>`;
              } else {
                html += `<p style="background: #fef3cd; border-radius: 6px; padding: 6px 8px; margin: 6px 0; font-size: 0.8em; color: #856404;">&#9888; Sin actividad registrada</p>`;
              }
              if (data.entries?.length > 0) {
                html += `<div style="margin-top: 6px; font-size: 0.78em;">`;
                for (const e of data.entries) {
                  html += `<div style="padding: 3px 0; border-bottom: 1px solid #f0f0f0;">
                    <span style="color: #888;">${e.fecha}</span> — <strong>${e.tipo_actividad.replace(/_/g, " ")}</strong>
                    ${e.descripcion ? `<br><span style="color: #666;">${e.descripcion.substring(0, 80)}${e.descripcion.length > 80 ? "..." : ""}</span>` : ""}
                  </div>`;
                }
                html += `</div>`;
              }
              html += `</div>`;
              popup.setContent(html);
            } catch {
              popup.setContent(`
                <div style="font-family: system-ui; min-width: 200px;">
                  <h3 style="font-weight: 700; margin: 0 0 4px 0; color: ${color};">${variety.name}</h3>
                  <p style="color: #666; margin: 0; font-size: 0.85em;">Variedad de cultivo</p>
                </div>
              `);
            }
          });
          polygon.bindTooltip(variety.name, {
            permanent: false,
            direction: "center",
          });
          varietiesLayer.addLayer(polygon);
        }
      }
    }

    // Draw wells
    if (mapData.pozos) {
      for (const pozo of mapData.pozos) {
        const marker = L.marker([pozo.lat, pozo.lng], {
          icon: L.divIcon({
            html: '<div style="font-size: 24px; text-align: center;">💧</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            className: "",
          }),
        });
        marker.bindPopup(`
          <div style="font-family: system-ui;">
            <h3 style="font-weight: 700; margin: 0 0 4px 0;">💧 ${pozo.name}</h3>
            <p style="color: #666; margin: 0; font-size: 0.85em;">Pozo de agua</p>
          </div>
        `);
        infrastructureLayer.addLayer(marker);
      }
    }

    // Draw reservoirs
    if (mapData.reservorios) {
      for (const res of mapData.reservorios) {
        const marker = L.marker([res.lat, res.lng], {
          icon: L.divIcon({
            html: '<div style="font-size: 22px; text-align: center;">&#x1F30A;</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            className: "",
          }),
        });
        marker.bindPopup(`
          <div style="font-family: system-ui;">
            <h3 style="font-weight: 700; margin: 0 0 4px 0;">&#x1F30A; ${res.name}</h3>
            <p style="color: #666; margin: 0; font-size: 0.85em;">Reservorio</p>
          </div>
        `);
        infrastructureLayer.addLayer(marker);
      }
    }

    // Layer control
    L.control
      .layers(
        {},
        {
          "Sectores de Riego": sectorsLayer,
          Variedades: varietiesLayer,
          Infraestructura: infrastructureLayer,
        },
        { position: "topright", collapsed: false },
      )
      .addTo(map);

    // Legend
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-control");
      div.style.cssText =
        "background: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-size: 12px; line-height: 1.8;";
      div.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 6px; font-size: 13px;">🌾 Variedades</div>
        ${Object.entries(VARIETY_COLORS)
          .map(
            ([name, color]) => `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 14px; height: 14px; border-radius: 3px; background: ${color}; display: inline-block;"></span>
            <span>${name}</span>
          </div>
        `,
          )
          .join("")}
        <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 6px;">
          <div>💧 Pozos</div>
          <div>&#x1F30A; Reservorios</div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    // Fit bounds to all data
    const allBounds: L.LatLngTuple[] = [];
    mapData.parcelas?.forEach((s) =>
      s.coordinates.forEach((c) => allBounds.push([c.lat, c.lng])),
    );
    mapData.variedades?.forEach((v) =>
      v.coordinates.forEach((c) => allBounds.push([c.lat, c.lng])),
    );
    if (allBounds.length > 0) {
      map.fitBounds(L.latLngBounds(allBounds), { padding: [30, 30] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [mapData]);

  return <div ref={mapRef} className="h-full w-full rounded-xl" />;
}

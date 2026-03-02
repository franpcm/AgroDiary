# 🌿 AgroDiary — Finca del Imperio

**Diario de explotación agrícola** para gestionar pistachos, viñedos y olivos.

## 🚀 Inicio rápido

```bash
cd agrodiary
npm install
npm run dev
```

Abrir **http://localhost:3000**

## 📋 Funcionalidades

### 📝 Diario de Actividades
- Registra cada tarea: riego, tratamientos, poda, cosecha, análisis...
- Asigna a parcela, persona, productos usados, dosis
- Valora resultados con estrellas (1-5★)
- Filtra por fecha, parcela, tipo de actividad

### 🗺️ Mapa Interactivo
- Mapa de la finca con todas las parcelas del KMZ original
- Capas: Sectores de riego, variedades, pozos, reservorios
- Vista satélite con leyenda de colores por variedad

### 📈 Histórico y Comparativas
- Cronología mensual de actividades
- Vista de análisis: actividades frecuentes, productos usados
- Comparativa de mejores/peores resultados
- Búsqueda libre en descripciones

### 🤖 Asistente IA Agrícola
- Preguntas rápidas predefinidas
- Base de conocimiento con calendarios y plagas (pistacho/viñedo/olivo)
- Conexión a OpenAI GPT-4o-mini (opcional)
- Posibilidad de añadir documentos propios (manuales, guías)

## ⚙️ Configuración de IA

Para activar el asistente completo con IA:

1. Obtén una API key en [platform.openai.com](https://platform.openai.com)
2. Edita `.env.local`:

```env
OPENAI_API_KEY=sk-...tu-key...
```

3. Reinicia `npm run dev`

**Sin API key**, el asistente funciona con la base de conocimiento local (calendarios, plagas).

## 📁 Estructura del proyecto

```
agrodiary/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Dashboard
│   │   ├── diario/page.tsx     # Diario de actividades
│   │   ├── parcelas/page.tsx   # Mapa y lista de parcelas
│   │   ├── historico/page.tsx  # Histórico y comparativas
│   │   ├── asistente/page.tsx  # Asistente IA
│   │   └── api/                # APIs backend
│   ├── components/
│   │   ├── Sidebar.tsx         # Navegación lateral
│   │   └── FarmMap.tsx         # Mapa Leaflet
│   ├── lib/db.ts               # SQLite (auto-inicialización)
│   └── types/index.ts          # Tipos TypeScript
├── data/agrodiary.db           # Base de datos (se crea sola)
└── public/data/farm-map.json   # Datos del mapa del KMZ
```

## 🌾 Parcelas precargadas

| Cultivo | Parcelas | Superficie |
|---------|----------|------------|
| 🍇 Viñedo (Tempranillo) | S1-S4, S9-S11 | ~21 ha |
| 🍇 Viñedo (Cabernet) | S5-S8, S12-S15 | ~22 ha |
| 🍇 Viñedo (Airén) | S16-S24 | ~36 ha |
| 🍇 Viñedo (Sauvignon Blanc) | SB, SB2024 | ~3.5 ha |
| 🌰 Pistacho (Kerman/Peter) | P45, P13, PM | ~68 ha |
| 🫒 Olivo (por determinar) | OL | pendiente |
| **TOTAL** | **30 parcelas** | **~150.5 ha** |

## 🛠️ Tecnologías

- **Next.js 16** + TypeScript + Tailwind CSS
- **SQLite** (better-sqlite3) — sin servidor de BD necesario
- **Leaflet** — mapas interactivos
- **OpenAI API** — asistente IA (opcional)

# AgroDiary - Cuaderno de Campo Digital

## Proyecto
Aplicacion agricola full-stack para la gestion de fincas. Registra actividades diarias, costes, parcelas, y usa IA para asistencia y busqueda semantica (RAG).

## Stack Tecnico
- **Framework**: Next.js 16.1.6 + React 19.2.3 + TypeScript 5.9.3
- **Base de datos**: SQLite con better-sqlite3 (WAL mode, standalone)
- **IA**: OpenAI API (text-embedding-3-small para RAG, GPT para asistente y transcripcion)
- **Mapas**: Leaflet + react-leaflet (parcelas con GeoJSON)
- **UI**: Tailwind CSS 4 + React Compiler habilitado
- **Procesamiento docs**: pdf-parse, xlsx, mammoth, word-extractor

## Comandos
```bash
npm run dev          # Desarrollo local
npm run dev:lan      # Desarrollo accesible en red (0.0.0.0)
npm run dev:https    # Desarrollo con HTTPS + certificados
npm run build        # Build produccion (output: standalone)
npm start            # Arrancar servidor produccion
npm run lint         # ESLint
```

## Despliegue (Servidor)
```bash
cd ~/AgroDiary/agrodiary
git pull origin main
npm run build
pm2 restart agrodiary
pm2 logs agrodiary    # Ver logs
```

## Estructura del Proyecto
```
src/
  app/
    api/               # 18 rutas API (entries, assistant, knowledge, weather, costes, etc.)
    diario/            # Pagina principal - entradas del diario (2700+ lineas)
    asistente/         # Chat IA con RAG
    calendario/        # Vista calendario de actividades
    conocimiento/      # Base de conocimiento (docs RAG)
    costes/            # Costes fijos + precios
    exportar/          # Exportar Cuaderno de Campo
    historico/         # Datos historicos y estadisticas
    parcelas/          # Gestion de parcelas + mapa
    dashboard-page.tsx # Dashboard principal
    layout.tsx         # Layout raiz con UserProvider + Sidebar
  components/
    AudioRecorder.tsx  # Grabacion + transcripcion Whisper + autoFill GPT
    FarmMap.tsx         # Mapa Leaflet con sectores y variedades
    MediaUpload.tsx     # Subida de fotos/videos (max 50MB)
    MediaLightbox.tsx   # Galeria de imagenes
    Sidebar.tsx         # Navegacion lateral + selector de usuario
    WeatherWidget.tsx   # Widget meteorologico (Open-Meteo API)
    AlertsPanel.tsx     # Panel de alertas
  lib/
    db.ts              # Schema SQLite (12 tablas, 21 indices), migraciones, seed
    rag.ts             # Chunking, embeddings, busqueda semantica, cache
  types/
    index.ts           # Interfaces TS: Usuario, Parcela, EntradaDiario, CosteFijo, Precio, etc.
  context/
    UserContext.tsx     # Multi-usuario con persistencia localStorage
```

## Base de Datos (SQLite)
- **12 tablas**: usuarios, parcelas, entradas_diario, comentarios, historial_ediciones, productos_maquinaria, archivos_media, costes_fijos, precios, documentos_ia, rag_documentos, rag_chunks
- **21 indices** en columnas frecuentes (fecha, parcela_id, cultivo, categoria)
- **Pragmas**: WAL, foreign_keys, synchronous=NORMAL, cache_size=64MB, mmap=256MB
- **Path**: `data/agrodiary.db`
- **Migraciones automaticas** al iniciar (añade columnas faltantes, extrae catalogo)

## Variables de Entorno
- `OPENAI_API_KEY` - Embeddings + Asistente IA + Whisper transcripcion

## API - Patrones y Convenciones
- Todas las rutas usan Next.js App Router (`route.ts`)
- Respuestas JSON con NextResponse
- Errores con status codes estandar (400, 404, 500)
- IDs generados con uuid v4
- GET soporta filtros por query params: `?fecha=X&parcela_id=X&tipo=X&cultivo=X&limit=X&offset=X`
- DELETE usa query param: `?id=X`
- Uploads via FormData (fotos/videos) o base64

## Sistema RAG
- Chunking: 800 chars con 150 overlap, corte inteligente (parrafos > frases > espacios)
- Embeddings: text-embedding-3-small, batches de 100, cache en memoria (TTL 5min)
- Busqueda: coseno similarity, TOP_K=8, umbral minimo 0.2
- Fallback sin API key: busqueda por LIKE en SQLite
- Indexa automaticamente entradas del diario al crear/editar

## Tipos de Actividad
riego, tratamiento_fitosanitario, poda, abonado, cosecha, laboreo, siembra_plantacion, injerto, analisis_suelo, analisis_foliar, observacion, mantenimiento_infraestructura, otro

## Cultivos
pistacho, vinedo, olivo, otro

## Convenciones de Codigo
- Todas las paginas son `"use client"` (necesitan hooks/interactividad)
- Path alias: `@/*` -> `./src/*`
- Idioma del codigo: variables y UI en español, comments mixtos
- Indentacion: 2 espacios
- Strict mode TypeScript habilitado
- Siempre usar `getDb()` de `@/lib/db` para acceso a BD
- Archivos subidos van a `public/uploads/`

## Usuarios por Defecto (seed)
- Administrador (admin, #16a34a)
- Francisco (editor, #2563eb)
- Trabajador 1 (editor, #9333ea)
- Trabajador 2 (editor, #ea580c)

## Parcelas por Defecto (seed)
Tempranillo, Cabernet, Airen, Sauvignon Blanc (vinedo) | Kerman, Peter (pistacho) | Picual, Arbequina, Hojiblanca (olivo) | Nave, Caseta (infraestructura)

## Ubicacion
Finca del Imperio - Castilla-La Mancha, España (Lat 39.568, Lng -2.94, Timezone Europe/Madrid)

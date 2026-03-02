// ==========================================
// AgroDiary - Base de datos SQLite
// ==========================================

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "agrodiary.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeDb(db);
  }
  return db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    -- Usuarios
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL DEFAULT '#16a34a',
      rol TEXT NOT NULL DEFAULT 'editor' CHECK(rol IN ('admin', 'editor', 'viewer')),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Parcelas
    CREATE TABLE IF NOT EXISTS parcelas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      cultivo TEXT NOT NULL CHECK(cultivo IN ('pistacho', 'viñedo', 'olivo', 'otro')),
      variedad TEXT DEFAULT '',
      superficie_ha REAL DEFAULT 0,
      sector TEXT DEFAULT '',
      coordinates TEXT DEFAULT '[]',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Entradas del diario
    CREATE TABLE IF NOT EXISTS entradas_diario (
      id TEXT PRIMARY KEY,
      fecha TEXT NOT NULL,
      parcela_id TEXT NOT NULL,
      tipo_actividad TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      usuario_id TEXT DEFAULT '',
      realizado_por TEXT NOT NULL DEFAULT 'Sin especificar',
      productos_usados TEXT DEFAULT '',
      dosis TEXT DEFAULT '',
      condiciones_meteo TEXT DEFAULT '',
      resultado TEXT DEFAULT '',
      valoracion INTEGER DEFAULT 0 CHECK(valoracion >= 0 AND valoracion <= 5),
      fotos TEXT DEFAULT '[]',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE CASCADE
    );

    -- Comentarios en entradas
    CREATE TABLE IF NOT EXISTS comentarios (
      id TEXT PRIMARY KEY,
      entrada_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      texto TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entrada_id) REFERENCES entradas_diario(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Historial de ediciones
    CREATE TABLE IF NOT EXISTS historial_ediciones (
      id TEXT PRIMARY KEY,
      entrada_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      campo TEXT NOT NULL,
      valor_anterior TEXT DEFAULT '',
      valor_nuevo TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entrada_id) REFERENCES entradas_diario(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Archivos multimedia
    CREATE TABLE IF NOT EXISTS archivos_media (
      id TEXT PRIMARY KEY,
      entrada_id TEXT NOT NULL,
      usuario_id TEXT DEFAULT '',
      tipo TEXT NOT NULL CHECK(tipo IN ('imagen', 'video')),
      nombre TEXT NOT NULL,
      url TEXT NOT NULL,
      tamano INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entrada_id) REFERENCES entradas_diario(id) ON DELETE CASCADE
    );

    -- Documentos de IA
    CREATE TABLE IF NOT EXISTS documentos_ia (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      tipo TEXT DEFAULT 'manual',
      cultivo TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- RAG: Documentos subidos (PDFs, TXTs, XLSX, etc.)
    CREATE TABLE IF NOT EXISTS rag_documentos (
      id TEXT PRIMARY KEY,
      nombre_archivo TEXT NOT NULL,
      tipo_archivo TEXT NOT NULL DEFAULT 'pdf',
      titulo TEXT NOT NULL,
      tipo TEXT DEFAULT 'manual',
      cultivo TEXT DEFAULT '',
      contexto_adicional TEXT DEFAULT '',
      tamano INTEGER DEFAULT 0,
      num_chunks INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'procesando' CHECK(estado IN ('procesando', 'listo', 'error')),
      error_msg TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- RAG: Chunks con embeddings
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id TEXT PRIMARY KEY,
      documento_id TEXT NOT NULL,
      fuente_tipo TEXT NOT NULL DEFAULT 'documento' CHECK(fuente_tipo IN ('documento', 'entrada_diario', 'documento_ia')),
      fuente_id TEXT NOT NULL,
      contenido TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      embedding TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (documento_id) REFERENCES rag_documentos(id) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_entradas_fecha ON entradas_diario(fecha);
    CREATE INDEX IF NOT EXISTS idx_entradas_parcela ON entradas_diario(parcela_id);
    CREATE INDEX IF NOT EXISTS idx_entradas_tipo ON entradas_diario(tipo_actividad);
    CREATE INDEX IF NOT EXISTS idx_entradas_usuario ON entradas_diario(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_parcelas_cultivo ON parcelas(cultivo);
    CREATE INDEX IF NOT EXISTS idx_comentarios_entrada ON comentarios(entrada_id);
    CREATE INDEX IF NOT EXISTS idx_historial_entrada ON historial_ediciones(entrada_id);
    CREATE INDEX IF NOT EXISTS idx_archivos_entrada ON archivos_media(entrada_id);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_doc ON rag_chunks(documento_id);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_fuente ON rag_chunks(fuente_tipo, fuente_id);
  `);

  // Migrate: add usuario_id column if missing (for existing databases)
  try {
    const cols = db.prepare("PRAGMA table_info(entradas_diario)").all() as {
      name: string;
    }[];
    if (!cols.find((c) => c.name === "usuario_id")) {
      db.exec(
        "ALTER TABLE entradas_diario ADD COLUMN usuario_id TEXT DEFAULT ''",
      );
    }
  } catch {
    /* column already exists */
  }

  // Migrate: add contexto_adicional column to rag_documentos if missing
  try {
    const ragCols = db.prepare("PRAGMA table_info(rag_documentos)").all() as {
      name: string;
    }[];
    if (!ragCols.find((c) => c.name === "contexto_adicional")) {
      db.exec(
        "ALTER TABLE rag_documentos ADD COLUMN contexto_adicional TEXT DEFAULT ''",
      );
    }
  } catch {
    /* column already exists */
  }

  // Seed with default users if empty
  const userCount = db
    .prepare("SELECT COUNT(*) as count FROM usuarios")
    .get() as { count: number };
  if (userCount.count === 0) {
    seedUsers(db);
  }

  // Seed with default parcelas if empty
  const count = db.prepare("SELECT COUNT(*) as count FROM parcelas").get() as {
    count: number;
  };
  if (count.count === 0) {
    seedParcelas(db);
  }
}

function seedUsers(db: Database.Database) {
  const { v4: uuid } = require("uuid");

  const users = [
    {
      id: uuid(),
      nombre: "Administrador",
      email: "admin@fincadelimperio.es",
      avatar_color: "#16a34a",
      rol: "admin",
    },
    {
      id: uuid(),
      nombre: "Francisco",
      email: "francisco@fincadelimperio.es",
      avatar_color: "#2563eb",
      rol: "editor",
    },
    {
      id: uuid(),
      nombre: "Trabajador 1",
      email: "trabajador1@fincadelimperio.es",
      avatar_color: "#9333ea",
      rol: "editor",
    },
    {
      id: uuid(),
      nombre: "Trabajador 2",
      email: "trabajador2@fincadelimperio.es",
      avatar_color: "#ea580c",
      rol: "editor",
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO usuarios (id, nombre, email, avatar_color, rol)
    VALUES (@id, @nombre, @email, @avatar_color, @rol)
  `);

  const insertUsers = db.transaction(() => {
    for (const u of users) stmt.run(u);
  });

  insertUsers();
}

function seedParcelas(db: Database.Database) {
  const { v4: uuid } = require("uuid");

  const parcelas = [
    // Viñedo - Tempranillo
    ...Array.from({ length: 4 }, (_, i) => ({
      id: uuid(),
      nombre: `Sector ${i + 1}`,
      cultivo: "viñedo",
      variedad: "Tempranillo",
      superficie_ha: 3,
      sector: `S${i + 1}`,
    })),
    // Viñedo - Cabernet
    ...Array.from({ length: 4 }, (_, i) => ({
      id: uuid(),
      nombre: `Sector ${i + 5}`,
      cultivo: "viñedo",
      variedad: "Cabernet Sauvignon",
      superficie_ha: 3,
      sector: `S${i + 5}`,
    })),
    // Viñedo - Tempranillo (arriba)
    ...Array.from({ length: 3 }, (_, i) => ({
      id: uuid(),
      nombre: `Sector ${i + 9}`,
      cultivo: "viñedo",
      variedad: "Tempranillo",
      superficie_ha: 3,
      sector: `S${i + 9}`,
    })),
    // Viñedo - Cabernet (arriba)
    ...Array.from({ length: 4 }, (_, i) => ({
      id: uuid(),
      nombre: `Sector ${i + 12}`,
      cultivo: "viñedo",
      variedad: "Cabernet Sauvignon",
      superficie_ha: 2.5,
      sector: `S${i + 12}`,
    })),
    // Viñedo - Airén
    ...Array.from({ length: 9 }, (_, i) => ({
      id: uuid(),
      nombre: `Airén Sector ${i + 16}`,
      cultivo: "viñedo",
      variedad: "Airén",
      superficie_ha: 4,
      sector: `S${i + 16}`,
    })),
    // Viñedo - Sauvignon Blanc
    {
      id: uuid(),
      nombre: "Sauvignon Blanc",
      cultivo: "viñedo",
      variedad: "Sauvignon Blanc",
      superficie_ha: 2,
      sector: "SB",
    },
    {
      id: uuid(),
      nombre: "Sauvignon Blanc 2024",
      cultivo: "viñedo",
      variedad: "Sauvignon Blanc",
      superficie_ha: 1.5,
      sector: "SB2024",
    },
    // Pistachos
    {
      id: uuid(),
      nombre: "Pistachos 45HA",
      cultivo: "pistacho",
      variedad: "Kerman/Peter",
      superficie_ha: 45,
      sector: "P45",
    },
    {
      id: uuid(),
      nombre: "Pistachos 13HA",
      cultivo: "pistacho",
      variedad: "Kerman/Peter",
      superficie_ha: 13,
      sector: "P13",
    },
    {
      id: uuid(),
      nombre: "Pistachos Monte",
      cultivo: "pistacho",
      variedad: "Kerman/Peter",
      superficie_ha: 10,
      sector: "PM",
    },
    // Olivos (próximamente)
    {
      id: uuid(),
      nombre: "Olivos (Nueva plantación)",
      cultivo: "olivo",
      variedad: "Por determinar",
      superficie_ha: 0,
      sector: "OL",
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO parcelas (id, nombre, cultivo, variedad, superficie_ha, sector, notas)
    VALUES (@id, @nombre, @cultivo, @variedad, @superficie_ha, @sector, '')
  `);

  const insertParcelas = db.transaction(() => {
    for (const p of parcelas) stmt.run(p);
  });

  insertParcelas();

  // Add sample AI documents
  const docs = [
    {
      id: uuid(),
      titulo: "Calendario de tareas - Pistacho",
      tipo: "calendario",
      cultivo: "pistacho",
      contenido: `CALENDARIO DE TAREAS - PISTACHO (Castilla-La Mancha)

ENERO-FEBRERO: Poda de formación y producción. Tratamiento de invierno con cobre.
MARZO: Abonado de fondo. Tratamiento preventivo contra hongos (Botryosphaeria).
ABRIL: Riego si no hay lluvias. Vigilar brotación. Tratamiento preventivo septoria.
MAYO: Inicio riego regular. Abonado foliar. Control de plagas (psila, clytra).
JUNIO: Riego intensivo. Tratamiento contra chinche verde y clytra. Abonado.
JULIO: Riego máximo. Control de plagas. Revisión del cuajado.
AGOSTO: Riego. Preparar cosecha. Control de aflatoxinas.
SEPTIEMBRE: COSECHA (cuando se abre la cáscara). Secado inmediato (<24h). Riego post-cosecha.
OCTUBRE: Abonado otoñal. Riego de apoyo. Análisis foliar.
NOVIEMBRE: Poda ligera. Tratamiento con cobre tras caída de hoja.
DICIEMBRE: Mantenimiento. Análisis de suelo. Planificación.`,
    },
    {
      id: uuid(),
      titulo: "Calendario de tareas - Viñedo",
      tipo: "calendario",
      cultivo: "viñedo",
      contenido: `CALENDARIO DE TAREAS - VIÑEDO (Castilla-La Mancha)

ENERO: Poda en seco. Tratamiento de invierno.
FEBRERO: Continuar poda. Atado de varas. Abonado de fondo.
MARZO: Laboreo/desbroce. Tratamiento preventivo mildiu/oídio. Inicio despunte.
ABRIL: Tratamiento fitosanitario (cobre+azufre). Laboreo de primavera. Espergura.
MAYO: Despunte. Tratamientos mildiu/oídio/botrytis. Riego si necesario. Atado verde.
JUNIO: Desnietado. Tratamientos. Riego. Aclareo de racimos si procede.
JULIO: Envero. Riego controlado (estrés hídrico moderado). Deshojado zona racimos.
AGOSTO: Maduración. Control Botrytis. Análisis de madurez. Preparar vendimia.
SEPTIEMBRE: VENDIMIA. Tempranillo y Cabernet suelen madurar en septiembre.
Airén puede ser antes (finales agosto-septiembre).
OCTUBRE: Post-vendimia. Abonado. Riego de apoyo. Análisis foliar.
NOVIEMBRE: Caída de hoja. Tratamiento con cobre. Laboreo.
DICIEMBRE: Reposo invernal. Mantenimiento de infraestructura.`,
    },
    {
      id: uuid(),
      titulo: "Plagas comunes - Pistacho",
      tipo: "manual",
      cultivo: "pistacho",
      contenido: `PLAGAS Y ENFERMEDADES DEL PISTACHO

PLAGAS:
- Clytra (Labidostomis): Escarabajo que come brotes jóvenes. Tratar con insecticida en mayo-junio.
- Chinche verde (Nezara viridula / Brachynema): Provoca manchas en fruto. Tratar junio-julio.
- Psila del pistacho: Afecta hojas. Control con insecticida sistémico.
- Barrenillo: Ataca madera debilitada. Mantener vigor del árbol.
- Gusano del pistacho: Larva que entra en el fruto. Tratar en cuajado.

ENFERMEDADES:
- Botryosphaeria (Seca del pistacho): Hongos que secan ramas. Poda y quema de restos. Tratamiento preventivo con cobre.
- Septoria: Manchas en hojas. Provoca defoliación prematura. Tratamiento fungicida preventivo.
- Verticilosis: Hongo de suelo. Evitar suelos con historial. No tiene tratamiento curativo.
- Alternaria: Manchas negras en hojas. Fungicidas preventivos.
- Aflatoxinas (Aspergillus): Evitar estrés hídrico, cosechar a tiempo, secar rápido.

PREVENCIÓN:
- Poda adecuada para aireación
- Tratamientos preventivos con cobre (invierno, caída de hoja)
- Análisis foliar y de suelo regulares
- Riego adecuado sin excesos
- Eliminación de restos de poda (quemar)`,
    },
    {
      id: uuid(),
      titulo: "Plagas comunes - Viñedo",
      tipo: "manual",
      cultivo: "viñedo",
      contenido: `PLAGAS Y ENFERMEDADES DEL VIÑEDO

PLAGAS:
- Polilla del racimo (Lobesia botrana): 3 generaciones/año. Tratar según curva de vuelo. Confusión sexual.
- Araña roja (Tetranychus urticae): Hojas amarillentas. Acaricidas si supera umbral.
- Mosquito verde (Empoasca vitis): Amarilleamiento foliar. Insecticida si necesario.
- Melazo/cochinilla: Control con aceite mineral en invierno.
- Filoxera: Afecta raíces. Uso de portainjertos resistentes.

ENFERMEDADES:
- Mildiu (Plasmopara viticola): Manchas de aceite en haz, pelusa en envés. Cobre preventivo.
- Oídio (Uncinula necator): Polvo blanco en hojas y frutos. Azufre preventivo.
- Botrytis (Botrytis cinerea): Podredumbre gris en racimos. Aireación, anti-botrytis en envero.
- Yesca/Eutipiosis: Enfermedades de madera. Proteger heridas de poda.
- Black rot: Manchas negras. Fungicida preventivo.

PREVENCIÓN:
- Calendario de tratamientos: cobre + azufre desde brotación
- Deshojado zona racimos para ventilación
- Gestión adecuada del vigor
- Vendimia en verde si exceso de carga
- Análisis periódicos de plagas`,
    },
    {
      id: uuid(),
      titulo: "Calendario de tareas - Olivo",
      tipo: "calendario",
      cultivo: "olivo",
      contenido: `CALENDARIO DE TAREAS - OLIVO (Castilla-La Mancha)

ENERO-FEBRERO: Poda (formación o producción). Tratamiento de invierno con cobre.
MARZO: Abonado de fondo (NPK). Laboreo. Tratamiento preventivo repilo.
ABRIL: Floración. Tratamiento insecticida si prays. Riego si sequía.  
MAYO: Cuajado. Riego. Control de prays del olivo. Abonado foliar.
JUNIO: Endurecimiento del hueso. Riego. Control de mosca del olivo.
JULIO-AGOSTO: Riego intensivo. Trampas mosca del olivo. Tratamiento si necesario.
SEPTIEMBRE: Control mosca. Preparar recolección. Análisis de madurez.
OCTUBRE-NOVIEMBRE: RECOLECCIÓN (para aceite: envero). Riego post-cosecha.
DICIEMBRE: Abonado otoñal. Análisis suelo. Preparación poda.

PLAGAS PRINCIPALES:
- Mosca del olivo (Bactrocera oleae): Principal plaga. Trampas + tratamiento.
- Prays del olivo: Ataca flor y fruto. Tratamiento en floración.
- Cochinilla de la tizne: Control con aceite mineral.
- Barrenillo: En madera debilitada.
- Repilo (Fusicladium oleagineum): Manchas en hojas. Cobre preventivo.
- Verticilosis: Hongo de suelo. Sin tratamiento curativo.`,
    },
  ];

  const docStmt = db.prepare(`
    INSERT INTO documentos_ia (id, titulo, contenido, tipo, cultivo)
    VALUES (@id, @titulo, @contenido, @tipo, @cultivo)
  `);

  const insertAllDocs = db.transaction(() => {
    for (const d of docs) docStmt.run(d);
  });

  insertAllDocs();
}

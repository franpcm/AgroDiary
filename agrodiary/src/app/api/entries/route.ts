// ==========================================
// API: Entradas del diario
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { indexDiaryEntry } from "@/lib/rag";

// Field labels for edit history
const FIELD_LABELS: Record<string, string> = {
  fecha: "Fecha",
  parcela_id: "Parcela",
  tipo_actividad: "Tipo de Actividad",
  descripcion: "Descripción",
  realizado_por: "Realizado por",
  productos_usados: "Productos usados",
  dosis: "Dosis",
  condiciones_meteo: "Condiciones meteorológicas",
  resultado: "Resultado",
  valoracion: "Valoración",
  notas: "Notas",
};

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const fecha = url.searchParams.get("fecha");
    const parcela_id = url.searchParams.get("parcela_id");
    const tipo = url.searchParams.get("tipo");
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = `
      SELECT e.*, p.nombre as parcela_nombre, p.cultivo,
             u.nombre as usuario_nombre, u.avatar_color as usuario_color,
             (SELECT COUNT(*) FROM comentarios c WHERE c.entrada_id = e.id) as comentarios_count
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      WHERE 1=1
    `;
    const params: Record<string, string | number> = {};

    if (fecha) {
      query += " AND e.fecha = @fecha";
      params.fecha = fecha;
    }
    if (parcela_id) {
      query += " AND e.parcela_id = @parcela_id";
      params.parcela_id = parcela_id;
    }
    if (tipo) {
      query += " AND e.tipo_actividad = @tipo";
      params.tipo = tipo;
    }
    if (desde) {
      query += " AND e.fecha >= @desde";
      params.desde = desde;
    }
    if (hasta) {
      query += " AND e.fecha <= @hasta";
      params.hasta = hasta;
    }

    query +=
      " ORDER BY e.fecha DESC, e.created_at DESC LIMIT @limit OFFSET @offset";
    params.limit = limit;
    params.offset = offset;

    const entries = db.prepare(query).all(params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM entradas_diario e WHERE 1=1
    `;
    const countParams: Record<string, string> = {};
    if (fecha) {
      countQuery += " AND e.fecha = @fecha";
      countParams.fecha = fecha;
    }
    if (parcela_id) {
      countQuery += " AND e.parcela_id = @parcela_id";
      countParams.parcela_id = parcela_id;
    }
    if (tipo) {
      countQuery += " AND e.tipo_actividad = @tipo";
      countParams.tipo = tipo;
    }
    if (desde) {
      countQuery += " AND e.fecha >= @desde";
      countParams.desde = desde;
    }
    if (hasta) {
      countQuery += " AND e.fecha <= @hasta";
      countParams.hasta = hasta;
    }

    const total = db.prepare(countQuery).get(countParams) as { total: number };

    return NextResponse.json({ entries, total: total.total });
  } catch (error) {
    console.error("Error fetching entries:", error);
    return NextResponse.json(
      { error: "Error al obtener entradas" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = uuid();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO entradas_diario (id, fecha, parcela_id, tipo_actividad, descripcion, 
        usuario_id, realizado_por, productos_usados, dosis, condiciones_meteo, resultado, 
        valoracion, fotos, notas, created_at, updated_at)
      VALUES (@id, @fecha, @parcela_id, @tipo_actividad, @descripcion,
        @usuario_id, @realizado_por, @productos_usados, @dosis, @condiciones_meteo, @resultado,
        @valoracion, @fotos, @notas, @created_at, @updated_at)
    `);

    stmt.run({
      id,
      fecha: body.fecha,
      parcela_id: body.parcela_id,
      tipo_actividad: body.tipo_actividad,
      descripcion: body.descripcion,
      usuario_id: body.usuario_id || "",
      realizado_por: body.realizado_por || "Sin especificar",
      productos_usados: body.productos_usados || "",
      dosis: body.dosis || "",
      condiciones_meteo: body.condiciones_meteo || "",
      resultado: body.resultado || "",
      valoracion: body.valoracion || 0,
      fotos: JSON.stringify(body.fotos || []),
      notas: body.notas || "",
      created_at: now,
      updated_at: now,
    });

    const entry = db
      .prepare(
        `
      SELECT e.*, p.nombre as parcela_nombre, p.cultivo,
             u.nombre as usuario_nombre, u.avatar_color as usuario_color
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      WHERE e.id = ?
    `,
      )
      .get(id);

    // Auto-indexar entrada en el sistema RAG (en background, no bloquea la respuesta)
    indexDiaryEntry(id).catch((err) =>
      console.error("Error indexando entrada:", err),
    );

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { error: "Error al crear entrada" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Get old entry to track changes
    const oldEntry = db
      .prepare("SELECT * FROM entradas_diario WHERE id = ?")
      .get(body.id) as Record<string, string | number> | undefined;

    if (!oldEntry) {
      return NextResponse.json(
        { error: "Entrada no encontrada" },
        { status: 404 },
      );
    }

    // Track changes for edit history
    const trackedFields = Object.keys(FIELD_LABELS);
    const editUserId = body.edit_usuario_id || body.usuario_id || "";

    if (editUserId) {
      const histStmt = db.prepare(`
        INSERT INTO historial_ediciones (id, entrada_id, usuario_id, campo, valor_anterior, valor_nuevo)
        VALUES (@id, @entrada_id, @usuario_id, @campo, @valor_anterior, @valor_nuevo)
      `);

      const insertHistory = db.transaction(() => {
        for (const field of trackedFields) {
          const oldVal = String(oldEntry[field] ?? "");
          const newVal = String(body[field] ?? "");
          if (oldVal !== newVal) {
            histStmt.run({
              id: uuid(),
              entrada_id: body.id,
              usuario_id: editUserId,
              campo: FIELD_LABELS[field] || field,
              valor_anterior: oldVal,
              valor_nuevo: newVal,
            });
          }
        }
      });

      insertHistory();
    }

    const stmt = db.prepare(`
      UPDATE entradas_diario SET
        fecha = @fecha,
        parcela_id = @parcela_id,
        tipo_actividad = @tipo_actividad,
        descripcion = @descripcion,
        usuario_id = @usuario_id,
        realizado_por = @realizado_por,
        productos_usados = @productos_usados,
        dosis = @dosis,
        condiciones_meteo = @condiciones_meteo,
        resultado = @resultado,
        valoracion = @valoracion,
        notas = @notas,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id: body.id,
      fecha: body.fecha,
      parcela_id: body.parcela_id,
      tipo_actividad: body.tipo_actividad,
      descripcion: body.descripcion,
      usuario_id: body.usuario_id || "",
      realizado_por: body.realizado_por || "Sin especificar",
      productos_usados: body.productos_usados || "",
      dosis: body.dosis || "",
      condiciones_meteo: body.condiciones_meteo || "",
      resultado: body.resultado || "",
      valoracion: body.valoracion || 0,
      notas: body.notas || "",
      updated_at: new Date().toISOString(),
    });

    const entry = db
      .prepare(
        `
      SELECT e.*, p.nombre as parcela_nombre, p.cultivo,
             u.nombre as usuario_nombre, u.avatar_color as usuario_color
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      WHERE e.id = ?
    `,
      )
      .get(body.id);

    // Re-indexar entrada actualizada en RAG
    indexDiaryEntry(body.id).catch((err) =>
      console.error("Error reindexando entrada:", err),
    );

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { error: "Error al actualizar entrada" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    db.prepare("DELETE FROM entradas_diario WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json(
      { error: "Error al eliminar entrada" },
      { status: 500 },
    );
  }
}

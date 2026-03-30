// ==========================================
// API: Costes Fijos
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");
    const tipo = searchParams.get("tipo");

    let query = "SELECT * FROM costes_fijos";
    const conditions: string[] = [];
    const params: string[] = [];

    if (categoria) {
      conditions.push("categoria = ?");
      params.push(categoria);
    }
    if (tipo) {
      conditions.push("tipo = ?");
      params.push(tipo);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY fecha DESC, nombre";

    const costes = db.prepare(query).all(...params);

    // Enrich with parcela names
    const parcelas = db.prepare("SELECT id, nombre FROM parcelas").all() as {
      id: string;
      nombre: string;
    }[];
    const parcelaMap = new Map(parcelas.map((p) => [p.id, p.nombre]));

    const enriched = (costes as Record<string, unknown>[]).map((c) => {
      let parcelaIds: string[] = [];
      try {
        parcelaIds = JSON.parse((c.parcela_ids as string) || "[]");
      } catch {
        parcelaIds = [];
      }
      const nombres = parcelaIds
        .map((id: string) => parcelaMap.get(id))
        .filter(Boolean);
      return {
        ...c,
        parcela_nombres: nombres.join(", "),
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching costes fijos:", error);
    return NextResponse.json(
      { error: "Error al obtener costes fijos" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.nombre || !body.nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 },
      );
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO costes_fijos (id, nombre, tipo, categoria, fecha, importe, parcela_ids, amortizacion_inicio, amortizacion_fin, periodicidad, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.nombre.trim(),
      body.tipo || "coste",
      body.categoria || "otro",
      body.fecha || new Date().toISOString().split("T")[0],
      body.importe || 0,
      JSON.stringify(body.parcela_ids || []),
      body.amortizacion_inicio || null,
      body.amortizacion_fin || null,
      body.periodicidad || "anual",
      body.notas || "",
    );

    const coste = db.prepare("SELECT * FROM costes_fijos WHERE id = ?").get(id);
    return NextResponse.json(coste, { status: 201 });
  } catch (error) {
    console.error("Error creating coste fijo:", error);
    return NextResponse.json(
      { error: "Error al crear coste fijo" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID es obligatorio" }, { status: 400 });
    }

    db.prepare(
      `UPDATE costes_fijos SET
        nombre = ?, tipo = ?, categoria = ?, fecha = ?, importe = ?,
        parcela_ids = ?, amortizacion_inicio = ?, amortizacion_fin = ?,
        periodicidad = ?, notas = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      body.nombre?.trim() || "",
      body.tipo || "coste",
      body.categoria || "otro",
      body.fecha || "",
      body.importe || 0,
      JSON.stringify(body.parcela_ids || []),
      body.amortizacion_inicio || null,
      body.amortizacion_fin || null,
      body.periodicidad || "anual",
      body.notas || "",
      body.id,
    );

    const coste = db
      .prepare("SELECT * FROM costes_fijos WHERE id = ?")
      .get(body.id);
    return NextResponse.json(coste);
  } catch (error) {
    console.error("Error updating coste fijo:", error);
    return NextResponse.json(
      { error: "Error al actualizar coste fijo" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID es obligatorio" }, { status: 400 });
    }

    db.prepare("DELETE FROM costes_fijos WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting coste fijo:", error);
    return NextResponse.json(
      { error: "Error al eliminar coste fijo" },
      { status: 500 },
    );
  }
}

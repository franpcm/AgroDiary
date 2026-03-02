// ==========================================
// API: Parcelas
// ==========================================
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const parcelas = db.prepare('SELECT * FROM parcelas ORDER BY cultivo, nombre').all();
    return NextResponse.json(parcelas);
  } catch (error) {
    console.error('Error fetching parcelas:', error);
    return NextResponse.json({ error: 'Error al obtener parcelas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { v4: uuid } = require('uuid');

    const id = uuid();
    const stmt = db.prepare(`
      INSERT INTO parcelas (id, nombre, cultivo, variedad, superficie_ha, sector, notas)
      VALUES (@id, @nombre, @cultivo, @variedad, @superficie_ha, @sector, @notas)
    `);

    stmt.run({
      id,
      nombre: body.nombre,
      cultivo: body.cultivo,
      variedad: body.variedad || '',
      superficie_ha: body.superficie_ha || 0,
      sector: body.sector || '',
      notas: body.notas || '',
    });

    const parcela = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(id);
    return NextResponse.json(parcela, { status: 201 });
  } catch (error) {
    console.error('Error creating parcela:', error);
    return NextResponse.json({ error: 'Error al crear parcela' }, { status: 500 });
  }
}

// ==========================================
// API: Usuarios
// ==========================================
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const users = db.prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre').all();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.nombre) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    const id = uuid();
    db.prepare(`
      INSERT INTO usuarios (id, nombre, email, avatar_color, rol)
      VALUES (@id, @nombre, @email, @avatar_color, @rol)
    `).run({
      id,
      nombre: body.nombre,
      email: body.email || '',
      avatar_color: body.avatar_color || '#16a34a',
      rol: body.rol || 'editor',
    });

    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    db.prepare(`
      UPDATE usuarios SET
        nombre = @nombre,
        email = @email,
        avatar_color = @avatar_color,
        rol = @rol,
        activo = @activo
      WHERE id = @id
    `).run({
      id: body.id,
      nombre: body.nombre,
      email: body.email || '',
      avatar_color: body.avatar_color || '#16a34a',
      rol: body.rol || 'editor',
      activo: body.activo !== undefined ? (body.activo ? 1 : 0) : 1,
    });

    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(body.id);
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

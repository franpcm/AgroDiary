// ==========================================
// API: Dashboard / Estadísticas
// ==========================================
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const total = db.prepare('SELECT COUNT(*) as count FROM entradas_diario').get() as { count: number };
    const hoy = db.prepare('SELECT COUNT(*) as count FROM entradas_diario WHERE fecha = ?').get(today) as { count: number };
    const semana = db.prepare('SELECT COUNT(*) as count FROM entradas_diario WHERE fecha >= ?').get(weekAgo) as { count: number };
    const parcelasActivas = db.prepare('SELECT COUNT(DISTINCT parcela_id) as count FROM entradas_diario WHERE fecha >= ?').get(weekAgo) as { count: number };

    const ultimaActividad = db.prepare(`
      SELECT e.*, p.nombre as parcela_nombre, p.cultivo
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      ORDER BY e.fecha DESC, e.created_at DESC LIMIT 1
    `).get();

    const actividadesPorTipo = db.prepare(`
      SELECT tipo_actividad as tipo, COUNT(*) as count 
      FROM entradas_diario 
      GROUP BY tipo_actividad 
      ORDER BY count DESC
    `).all();

    const actividadesPorCultivo = db.prepare(`
      SELECT p.cultivo, COUNT(*) as count 
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      GROUP BY p.cultivo 
      ORDER BY count DESC
    `).all();

    // Recent entries
    const recientes = db.prepare(`
      SELECT e.*, p.nombre as parcela_nombre, p.cultivo
      FROM entradas_diario e
      LEFT JOIN parcelas p ON e.parcela_id = p.id
      ORDER BY e.fecha DESC, e.created_at DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      total_entradas: total.count,
      entradas_hoy: hoy.count,
      entradas_semana: semana.count,
      parcelas_activas: parcelasActivas.count,
      ultima_actividad: ultimaActividad || null,
      actividades_por_tipo: actividadesPorTipo,
      actividades_por_cultivo: actividadesPorCultivo,
      recientes,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}

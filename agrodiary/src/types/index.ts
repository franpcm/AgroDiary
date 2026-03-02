// ==========================================
// AgroDiary - Tipos de datos principales
// ==========================================

// ---- Usuarios ----
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  avatar_color: string; // hex color
  rol: 'admin' | 'editor' | 'viewer';
  activo: boolean;
  created_at: string;
}

export const AVATAR_COLORS = [
  '#16a34a', '#2563eb', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#4f46e5', '#c026d3', '#65a30d', '#0d9488',
];

// ---- Parcelas ----
export interface Parcela {
  id: string;
  nombre: string;
  cultivo: TipoCultivo;
  variedad: string;
  superficie_ha: number;
  sector: string;
  coordinates?: { lat: number; lng: number }[];
  notas?: string;
  created_at: string;
}

export type TipoCultivo = 'pistacho' | 'viñedo' | 'olivo' | 'otro';

export type TipoVariedad =
  | 'Tempranillo'
  | 'Cabernet Sauvignon'
  | 'Airén'
  | 'Sauvignon Blanc'
  | 'Syrah'
  | 'Kerman'
  | 'Peter'
  | 'Picual'
  | 'Arbequina'
  | 'Hojiblanca'
  | string;

// ---- Entradas del diario ----
export interface EntradaDiario {
  id: string;
  fecha: string; // YYYY-MM-DD
  parcela_id: string;
  parcela_nombre?: string;
  cultivo?: TipoCultivo;
  tipo_actividad: TipoActividad;
  descripcion: string;
  usuario_id: string;
  usuario_nombre?: string;
  usuario_color?: string;
  realizado_por: string;
  productos_usados?: string;
  dosis?: string;
  condiciones_meteo?: string;
  resultado?: string;
  valoracion?: 1 | 2 | 3 | 4 | 5;
  fotos?: string; // JSON array of URLs
  notas?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  comentarios_count?: number;
  archivos?: ArchivoMedia[];
}

// ---- Comentarios ----
export interface Comentario {
  id: string;
  entrada_id: string;
  usuario_id: string;
  usuario_nombre?: string;
  usuario_color?: string;
  texto: string;
  created_at: string;
}

// ---- Histórico de ediciones ----
export interface HistorialEdicion {
  id: string;
  entrada_id: string;
  usuario_id: string;
  usuario_nombre?: string;
  usuario_color?: string;
  campo: string;
  valor_anterior: string;
  valor_nuevo: string;
  created_at: string;
}

// ---- Archivos multimedia ----
export interface ArchivoMedia {
  id: string;
  entrada_id: string;
  usuario_id: string;
  tipo: 'imagen' | 'video';
  nombre: string;
  url: string;
  tamano: number; // bytes
  created_at: string;
}

export type TipoActividad =
  | 'riego'
  | 'tratamiento_fitosanitario'
  | 'poda'
  | 'abonado'
  | 'cosecha'
  | 'laboreo'
  | 'siembra_plantacion'
  | 'injerto'
  | 'analisis_suelo'
  | 'analisis_foliar'
  | 'observacion'
  | 'mantenimiento_infraestructura'
  | 'otro';

export const ACTIVIDAD_LABELS: Record<TipoActividad, string> = {
  riego: '💧 Riego',
  tratamiento_fitosanitario: '🧪 Tratamiento Fitosanitario',
  poda: '✂️ Poda',
  abonado: '🌱 Abonado / Fertilización',
  cosecha: '🍇 Cosecha / Recolección',
  laboreo: '🚜 Laboreo',
  siembra_plantacion: '🌿 Siembra / Plantación',
  injerto: '🔗 Injerto',
  analisis_suelo: '🔬 Análisis de Suelo',
  analisis_foliar: '🍃 Análisis Foliar',
  observacion: '👁️ Observación / Inspección',
  mantenimiento_infraestructura: '🔧 Mantenimiento Infraestructura',
  otro: '📝 Otro',
};

export const CULTIVO_LABELS: Record<TipoCultivo, string> = {
  pistacho: '🌰 Pistacho',
  viñedo: '🍇 Viñedo',
  olivo: '🫒 Olivo',
  otro: '🌾 Otro',
};

export const CULTIVO_COLORS: Record<TipoCultivo, string> = {
  pistacho: '#097138',
  viñedo: '#7B1FA2',
  olivo: '#827717',
  otro: '#795548',
};

export interface MensajeChat {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface FarmMapData {
  parcelas: { name: string; coordinates: { lat: number; lng: number }[] }[];
  variedades: { name: string; coordinates: { lat: number; lng: number }[] }[];
  pozos: { name: string; lat: number; lng: number }[];
  reservorios: { name: string; lat: number; lng: number }[];
}

export interface DashboardStats {
  total_entradas: number;
  entradas_hoy: number;
  entradas_semana: number;
  parcelas_activas: number;
  ultima_actividad?: EntradaDiario;
  actividades_por_tipo: { tipo: TipoActividad; count: number }[];
  actividades_por_cultivo: { cultivo: TipoCultivo; count: number }[];
}

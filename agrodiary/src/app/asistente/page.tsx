'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_QUESTIONS = [
  '¿Qué tareas debo hacer este mes en los pistachos?',
  '¿Qué tratamientos toca en el viñedo ahora?',
  '¿Cuáles son las plagas más comunes del pistacho?',
  '¿Cuándo debo vendimiar el Tempranillo?',
  '¿Qué variedad de olivo me recomiendas para Castilla-La Mancha?',
  '¿Qué actividades se han registrado recientemente?',
  'Muéstrame el calendario de tareas del pistacho',
  '¿Cómo prevenir la Botryosphaeria en pistacho?',
];

export default function AsistentePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10), // Last 10 messages for context
        }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response || data.error || 'Sin respuesta',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error de conexión. Verifica que el servidor está funcionando.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">🤖 Asistente Agrícola IA</h1>
            <p className="text-gray-500 text-sm mt-1">
              Pregunta sobre plagas, tratamientos, calendario de tareas y más
            </p>
          </div>
          <button
            onClick={() => setShowDocForm(true)}
            className="text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-lg font-medium transition"
          >
            📚 Añadir Documento
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🌿</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">
                ¡Hola! Soy tu asistente agrícola
              </h2>
              <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                Conozco tu finca, tus cultivos y tengo información sobre plagas, tratamientos 
                y calendario de tareas. ¿En qué puedo ayudarte?
              </p>

              {/* Quick Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-left p-3 rounded-xl bg-white border hover:border-green-300 hover:bg-green-50 transition text-sm text-gray-700"
                  >
                    💬 {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div className={`max-w-[80%] p-4 ${
                    msg.role === 'user' ? 'chat-user' : 'chat-assistant'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="text-xs text-gray-400 mb-1">🤖 Asistente</div>
                    )}
                    <div className="chat-content whitespace-pre-wrap">{msg.content}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="chat-assistant p-4">
                    <div className="flex items-center gap-2">
                      <span className="animate-spin-slow text-xl">🌿</span>
                      <span className="text-gray-500">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Escribe tu pregunta sobre la finca..."
            className="flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-300"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            {loading ? '⏳' : '📤'} Enviar
          </button>
        </div>
      </div>

      {/* Document Upload Modal */}
      {showDocForm && (
        <DocumentForm onClose={() => setShowDocForm(false)} />
      )}
    </div>
  );
}

function DocumentForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    titulo: '',
    contenido: '',
    tipo: 'manual',
    cultivo: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
        <h2 className="text-xl font-bold mb-4">📚 Añadir Documento a la Base de Conocimiento</h2>
        <p className="text-gray-500 text-sm mb-4">
          Sube manuales de plagas, guías de tratamiento o cualquier información útil. 
          El asistente IA la usará para dar mejores respuestas.
        </p>

        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-green-600 font-semibold">¡Documento añadido correctamente!</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input
                value={form.titulo}
                onChange={e => setForm({...form, titulo: e.target.value})}
                placeholder="ej: Manual de plagas del pistacho"
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm({...form, tipo: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="manual">Manual / Guía</option>
                  <option value="calendario">Calendario de tareas</option>
                  <option value="tratamiento">Tratamiento</option>
                  <option value="analisis">Análisis</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cultivo</label>
                <select
                  value={form.cultivo}
                  onChange={e => setForm({...form, cultivo: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">General</option>
                  <option value="pistacho">Pistacho</option>
                  <option value="viñedo">Viñedo</option>
                  <option value="olivo">Olivo</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contenido</label>
              <textarea
                value={form.contenido}
                onChange={e => setForm({...form, contenido: e.target.value})}
                placeholder="Pega aquí el contenido del documento, manual o guía..."
                rows={10}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 rounded-xl font-semibold">
                {saving ? '💾 Guardando...' : '💾 Guardar Documento'}
              </button>
              <button type="button" onClick={onClose} className="px-6 py-2 border rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

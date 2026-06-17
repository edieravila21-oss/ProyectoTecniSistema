import { useEffect, useState } from 'react';
import {
  getCatalogos, crearCatalogo, actualizarCatalogo, eliminarCatalogo, reemplazarItemsCatalogo, seedCatalogoPredefinidos,
  type CatalogoServicio, type CatalogoChecklistItem,
} from '@/api/catalogoServicios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import {
  Plus, X, Pencil, Trash2, Clock, ClipboardList, ChevronDown, ChevronUp,
  Check, GripVertical, ArrowUp, ArrowDown, Save,
} from 'lucide-react';

type Categoria = 'llegada' | 'diagnostico' | 'reparacion' | 'cierre';

const CATEGORIAS: { key: Categoria; label: string; color: string; bg: string }[] = [
  { key: 'llegada',     label: 'Llegada',     color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  { key: 'diagnostico', label: 'Diagnóstico', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  { key: 'reparacion',  label: 'Reparación',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  { key: 'cierre',      label: 'Cierre',      color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
];

type ItemDraft = { id?: string; categoria: Categoria; descripcion: string };

const minsToDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

export const CatalogoServicios = () => {
  const [catalogos, setCatalogos] = useState<CatalogoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<CatalogoServicio | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  // Form para crear/editar cabecera
  const [headerForm, setHeaderForm] = useState({ nombre: '', descripcion: '', duracion_min: '60' });
  // Items del editor
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[]>([]);
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaCat, setNuevaCat] = useState<Categoria>('diagnostico');

  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!confirm('¿Importar los 17 servicios predefinidos? Los que ya existen no se duplicarán.')) return;
    setSeeding(true);
    try {
      const { data: res } = await seedCatalogoPredefinidos();
      toast.success(`${res.data.creados} servicios importados${res.data.omitidos ? `, ${res.data.omitidos} ya existían` : ''}`);
      fetchCatalogos();
    } catch { toast.error('Error importando servicios'); }
    finally { setSeeding(false); }
  };

  const fetchCatalogos = async () => {
    setLoading(true);
    try {
      const { data: res } = await getCatalogos();
      setCatalogos(res.data);
    } catch { toast.error('Error cargando catálogo'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCatalogos(); }, []);

  const openEditor = (cat: CatalogoServicio) => {
    setEditando(cat);
    setHeaderForm({ nombre: cat.nombre, descripcion: cat.descripcion || '', duracion_min: String(cat.duracion_min) });
    setItemsDraft(cat.items.map(it => ({ id: it.id, categoria: it.categoria, descripcion: it.descripcion })));
    setShowNuevo(false);
  };

  const openNuevo = () => {
    setEditando(null);
    setHeaderForm({ nombre: '', descripcion: '', duracion_min: '60' });
    setItemsDraft([]);
    setShowNuevo(true);
  };

  const closeEditor = () => { setEditando(null); setShowNuevo(false); };

  const handleAgregarItem = () => {
    if (!nuevaDesc.trim()) return;
    setItemsDraft(d => [...d, { categoria: nuevaCat, descripcion: nuevaDesc.trim() }]);
    setNuevaDesc('');
  };

  const handleEliminarItem = (idx: number) =>
    setItemsDraft(d => d.filter((_, i) => i !== idx));

  const handleMoverItem = (idx: number, dir: 'up' | 'down') => {
    setItemsDraft(d => {
      const arr = [...d];
      const to = dir === 'up' ? idx - 1 : idx + 1;
      if (to < 0 || to >= arr.length) return arr;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  };

  const handleGuardar = async () => {
    if (!headerForm.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      if (editando) {
        await actualizarCatalogo(editando.id, {
          nombre: headerForm.nombre,
          descripcion: headerForm.descripcion,
          duracion_min: parseInt(headerForm.duracion_min),
        });
        await reemplazarItemsCatalogo(editando.id, itemsDraft);
        toast.success('Servicio actualizado');
      } else {
        await crearCatalogo({
          nombre: headerForm.nombre,
          descripcion: headerForm.descripcion,
          duracion_min: parseInt(headerForm.duracion_min),
          items: itemsDraft as any,
        });
        toast.success('Servicio creado');
      }
      closeEditor();
      fetchCatalogos();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
  };

  const handleEliminarCatalogo = async (id: string) => {
    if (!confirm('¿Eliminar este servicio y su checklist?')) return;
    try {
      await eliminarCatalogo(id);
      toast.success('Eliminado');
      fetchCatalogos();
      if (editando?.id === id) closeEditor();
    } catch { toast.error('Error eliminando'); }
  };

  const toggleExpandido = (id: string) =>
    setExpandido(p => p === id ? null : id);

  const isEditorOpen = editando !== null || showNuevo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Catálogo de Servicios</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tipos de servicio, duración y checklist de cada uno</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeed} disabled={seeding} className="rounded-xl gap-1.5 text-slate-600">
            {seeding ? 'Importando…' : '↓ Importar predefinidos'}
          </Button>
          <Button onClick={openNuevo} className="rounded-xl gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo servicio
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${isEditorOpen ? 'lg:grid-cols-2' : ''}`}>
        {/* Lista de servicios */}
        <div className="space-y-3">
          {loading ? <LoadingSkeleton rows={4} /> : catalogos.length === 0 && !showNuevo ? (
            <Card className="p-10 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Sin servicios configurados</p>
              <p className="text-sm text-slate-400 mt-1">Crea tu primer tipo de servicio</p>
            </Card>
          ) : (
            catalogos.map(cat => (
              <Card
                key={cat.id}
                className={`overflow-hidden transition-all ${editando?.id === cat.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {cat.nombre.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800">{cat.nombre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" /> {minsToDuration(cat.duracion_min)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <ClipboardList className="h-3 w-3" /> {cat.items.length} items
                      </span>
                      {!cat.activo && (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-lg">Inactivo</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleExpandido(cat.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {expandido === cat.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEditor(cat)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleEliminarCatalogo(cat.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Checklist preview expandible */}
                {expandido === cat.id && cat.items.length > 0 && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2.5">
                    {CATEGORIAS.map(({ key, label, color, bg }) => {
                      const group = cat.items.filter(it => it.categoria === key);
                      if (!group.length) return null;
                      return (
                        <div key={key}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
                          <div className="space-y-1">
                            {group.map((it, i) => (
                              <div key={it.id} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${bg}`}>
                                <span className={`font-semibold shrink-0 ${color}`}>{i + 1}.</span>
                                <span className={`${color} leading-snug`}>{it.descripcion}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Editor */}
        {isEditorOpen && (
          <Card className="p-5 space-y-5 h-fit sticky top-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {editando ? 'Editar servicio' : 'Nuevo servicio'}
              </h3>
              <button onClick={closeEditor} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Datos del servicio */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nombre *</label>
                <Input
                  placeholder="Ej: Mantenimiento Aire Split"
                  value={headerForm.nombre}
                  onChange={e => setHeaderForm(f => ({ ...f, nombre: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Descripción</label>
                <Textarea
                  placeholder="Descripción del servicio (opcional)"
                  value={headerForm.descripcion}
                  onChange={e => setHeaderForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="rounded-xl"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">
                  Duración estimada (minutos)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    value={headerForm.duracion_min}
                    onChange={e => setHeaderForm(f => ({ ...f, duracion_min: e.target.value }))}
                    className="rounded-xl w-28"
                  />
                  <span className="text-sm text-slate-500">
                    = {minsToDuration(parseInt(headerForm.duracion_min) || 0)}
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Editor de checklist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-500">
                  Checklist ({itemsDraft.length} items)
                </label>
              </div>

              {/* Items agrupados por categoría */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {CATEGORIAS.map(({ key, label, color, bg }) => {
                  const group = itemsDraft
                    .map((it, i) => ({ ...it, _idx: i }))
                    .filter(it => it.categoria === key);
                  return (
                    <div key={key}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
                      {group.length === 0 && (
                        <p className="text-xs text-slate-300 italic px-1">Sin items</p>
                      )}
                      <div className="space-y-1">
                        {group.map(({ _idx, descripcion }) => (
                          <div key={_idx} className={`flex items-start gap-1.5 px-2 py-1.5 rounded-lg border text-xs group ${bg}`}>
                            <GripVertical className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color} opacity-40`} />
                            <span className={`flex-1 leading-snug ${color}`}>{descripcion}</span>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => handleMoverItem(_idx, 'up')} className="h-5 w-5 rounded flex items-center justify-center hover:bg-white/60">
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button onClick={() => handleMoverItem(_idx, 'down')} className="h-5 w-5 rounded flex items-center justify-center hover:bg-white/60">
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button onClick={() => handleEliminarItem(_idx)} className="h-5 w-5 rounded flex items-center justify-center hover:bg-red-100">
                                <X className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Agregar item */}
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Agregar item</p>
                <select
                  value={nuevaCat}
                  onChange={e => setNuevaCat(e.target.value as Categoria)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {CATEGORIAS.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Descripción del paso..."
                    value={nuevaDesc}
                    onChange={e => setNuevaDesc(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarItem(); } }}
                    className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAgregarItem}
                    className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Guardar */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleGuardar}
                disabled={saving}
                className="flex-1 rounded-xl gap-1.5"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear servicio'}
              </Button>
              <Button variant="ghost" onClick={closeEditor} className="rounded-xl">
                Cancelar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

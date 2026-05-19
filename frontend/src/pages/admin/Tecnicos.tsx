import { useEffect, useState } from 'react';
import { getUsuarios, crearUsuario, actualizarUsuario, toggleActivo } from '@/api/usuarios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import { especialidadLabel } from '@/utils/helpers';
import type { Usuario } from '@/types';
import { Plus, X, Star, Wrench, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

interface TecnicoForm {
  nombre: string;
  email: string;
  pin: string;
  telefono: string;
  especialidad: string;
}

const initialForm: TecnicoForm = { nombre: '', email: '', pin: '', telefono: '', especialidad: 'ambos' };

export const Tecnicos = () => {
  const navigate = useNavigate();
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<TecnicoForm>(initialForm);

  const fetchTecnicos = async () => {
    setLoading(true);
    try {
      const { data: res } = await getUsuarios({ rol: 'tecnico' });
      setTecnicos(res.data);
    } catch {
      toast.error('Error cargando técnicos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: res } = await getUsuarios({ rol: 'tecnico' });
        setTecnicos(res.data);
      } catch {
        toast.error('Error cargando técnicos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await actualizarUsuario(editing.id, { nombre: form.nombre, email: form.email, telefono: form.telefono, especialidad: form.especialidad as Usuario['especialidad'] });
        toast.success('Técnico actualizado');
      } else {
        await crearUsuario({ nombre: form.nombre, email: form.email, pin: form.pin, telefono: form.telefono, especialidad: form.especialidad as Usuario['especialidad'] });
        toast.success('Técnico creado');
      }
      setShowForm(false);
      setEditing(null);
      setForm(initialForm);
      fetchTecnicos();
    } catch (err: unknown) {
      const error = err as AxiosError<{ error: string }>;
      toast.error(error.response?.data?.error || 'Error');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleActivo(id);
      toast.success('Estado actualizado');
      fetchTecnicos();
    } catch {
      toast.error('Error');
    }
  };

  const openEdit = (t: Usuario) => {
    setEditing(t);
    setForm({ nombre: t.nombre, email: t.email, pin: '', telefono: t.telefono || '', especialidad: t.especialidad });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Técnicos</h1>
          <p className="text-sm text-slate-400 mt-0.5">Administra el equipo técnico</p>
        </div>
        <Button className="rounded-xl" onClick={() => { setEditing(null); setForm(initialForm); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />Nuevo técnico
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleCrear} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{editing ? 'Editar técnico' : 'Nuevo técnico'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required className="rounded-xl" />
              <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="rounded-xl" />
              {!editing && (
                <Input
                  placeholder="PIN * (4-6 dígitos)"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g, '')})}
                  required
                  className="rounded-xl"
                />
              )}
              <Input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="rounded-xl" />
              <Select value={form.especialidad} onChange={e => setForm({...form, especialidad: e.target.value})} className="rounded-xl">
                <option value="ambos">Ambos</option>
                <option value="aires">Aires</option>
                <option value="neveras">Neveras</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="rounded-xl">{editing ? 'Guardar' : 'Crear'}</Button>
              <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-xl">Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? <LoadingSkeleton rows={4} /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tecnicos.map(t => (
            <Card key={t.id} className={`p-5 hover:shadow-md transition-all ${!t.activo ? 'opacity-60' : ''}`}>
              <div className="flex flex-col items-center text-center gap-3">
                {/* Avatar */}
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xl overflow-hidden">
                    {t.foto_url ? <img src={t.foto_url} alt={t.nombre} className="h-full w-full object-cover" /> : t.nombre.charAt(0)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${t.activo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                </div>

                {/* Info */}
                <div>
                  <p className="font-semibold text-slate-800">{t.nombre}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.email}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><Wrench className="h-3 w-3" />{especialidadLabel[t.especialidad]}</span>
                  {t.estadisticas && <span className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg text-amber-700"><Star className="h-3 w-3" />{t.estadisticas.calificacion_promedio.toFixed(1)}</span>}
                </div>
                {t.estadisticas && <p className="text-xs text-slate-400">{t.estadisticas.total_servicios} servicios totales</p>}
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => navigate(`/admin/tecnicos/${t.id}`)}>
                  <Eye className="h-3 w-3 mr-1" />Perfil
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => openEdit(t)}>Editar</Button>
                <Button size="sm" variant={t.activo ? 'ghost' : 'default'} className="flex-1 rounded-xl" onClick={() => handleToggle(t.id)}>
                  {t.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

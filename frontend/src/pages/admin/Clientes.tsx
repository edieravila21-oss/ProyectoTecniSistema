import { useEffect, useState } from 'react';
import { getClientes, getCliente, crearCliente, actualizarCliente, crearEquipo } from '@/api/clientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from '@/components/shared/Toast';
import { formatDate, formatCurrency, tipoEquipoLabel } from '@/utils/helpers';
import type { Cliente, Equipo } from '@/types';
import { Search, Plus, X, Phone, Mail, MapPin, ArrowLeft, UsersRound } from 'lucide-react';

export const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showEquipoForm, setShowEquipoForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', direccion_principal: '', notas: '' });
  const [equipoForm, setEquipoForm] = useState<{ tipo: 'nevera' | 'aire_acondicionado' | 'otro'; marca: string; modelo: string; serial: string }>({ tipo: 'nevera', marca: '', modelo: '', serial: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (buscar) params.buscar = buscar;
      const { data: res } = await getClientes(params);
      setClientes(res.data);
      setTotalPages(res.meta?.totalPages || 1);
    } catch { toast.error('Error cargando clientes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClientes(); }, [page]);

  const handleBuscar = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchClientes(); };

  const openDetail = async (id: string) => {
    try {
      const { data: res } = await getCliente(id);
      setSelected(res.data);
    } catch { toast.error('Error cargando cliente'); }
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crearCliente(form);
      toast.success('Cliente creado');
      setShowForm(false);
      setForm({ nombre: '', telefono: '', email: '', direccion_principal: '', notas: '' });
      fetchClientes();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error creando cliente'); }
  };

  const handleCrearEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await crearEquipo(selected.id, equipoForm);
      toast.success('Equipo agregado');
      setShowEquipoForm(false);
      setEquipoForm({ tipo: 'nevera', marca: '', modelo: '', serial: '' });
      openDetail(selected.id);
    } catch { toast.error('Error agregando equipo'); }
  };

  // Detail view
  if (selected) {
    return (
      <div className="space-y-6">
        <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4" /> Volver a clientes
        </button>

        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{selected.nombre}</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Client info */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Datos del cliente</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center"><Phone className="h-3.5 w-3.5 text-blue-600" /></div>
                <span className="text-sm text-slate-700">{selected.telefono}</span>
              </div>
              {selected.email && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center"><Mail className="h-3.5 w-3.5 text-violet-600" /></div>
                  <span className="text-sm text-slate-700">{selected.email}</span>
                </div>
              )}
              {selected.direccion_principal && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center"><MapPin className="h-3.5 w-3.5 text-amber-600" /></div>
                  <span className="text-sm text-slate-700">{selected.direccion_principal}</span>
                </div>
              )}
              <div className="pt-4 mt-2 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-medium">Total gastado</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(selected.total_gastado || 0)}</p>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            {/* Equipment */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Equipos ({selected.equipos?.length || 0})</h3>
                <Button size="sm" className="rounded-xl" onClick={() => setShowEquipoForm(true)}><Plus className="h-3 w-3 mr-1" />Agregar</Button>
              </div>
              {showEquipoForm && (
                <form onSubmit={handleCrearEquipo} className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
                  <Select value={equipoForm.tipo} onChange={e => setEquipoForm({...equipoForm, tipo: e.target.value as any})} className="rounded-xl">
                    <option value="nevera">Nevera</option>
                    <option value="aire_acondicionado">Aire Acondicionado</option>
                    <option value="otro">Otro</option>
                  </Select>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Marca" value={equipoForm.marca} onChange={e => setEquipoForm({...equipoForm, marca: e.target.value})} className="rounded-xl" />
                    <Input placeholder="Modelo" value={equipoForm.modelo} onChange={e => setEquipoForm({...equipoForm, modelo: e.target.value})} className="rounded-xl" />
                    <Input placeholder="Serial" value={equipoForm.serial} onChange={e => setEquipoForm({...equipoForm, serial: e.target.value})} className="rounded-xl" />
                  </div>
                  <div className="flex gap-2"><Button type="submit" size="sm" className="rounded-xl">Guardar</Button><Button type="button" variant="ghost" size="sm" onClick={() => setShowEquipoForm(false)} className="rounded-xl">Cancelar</Button></div>
                </form>
              )}
              <div className="space-y-2">
                {selected.equipos?.map((eq: Equipo) => (
                  <div key={eq.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">
                      {eq.tipo === 'nevera' ? 'NV' : eq.tipo === 'aire_acondicionado' ? 'AC' : 'OT'}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-700">{tipoEquipoLabel[eq.tipo]}</p>
                      <p className="text-xs text-slate-400">{[eq.marca, eq.modelo].filter(Boolean).join(' ') || 'Sin marca/modelo'}</p>
                    </div>
                  </div>
                ))}
                {!selected.equipos?.length && (
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-400">Sin equipos registrados</p>
                  </div>
                )}
              </div>
            </Card>

            {/* History */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Historial de servicios ({selected.servicios?.length || 0})</h3>
              <div className="space-y-2">
                {selected.servicios?.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm text-slate-700">{s.descripcion_falla || 'Servicio'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.fecha_programada ? formatDate(s.fecha_programada) : '--'} · {s.tecnico?.nombre || 'Sin técnico'}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <EstadoBadge estado={s.estado} />
                      {s.valor_final && <p className="text-xs font-semibold text-emerald-600">{formatCurrency(s.valor_final)}</p>}
                    </div>
                  </div>
                ))}
                {!selected.servicios?.length && (
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-400">Sin historial</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Clientes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestiona tu cartera de clientes</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-1.5" />Nuevo cliente</Button>
      </div>

      <Card className="p-4">
        <form onSubmit={handleBuscar} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <Input placeholder="Buscar por nombre o teléfono..." value={buscar} onChange={e => setBuscar(e.target.value)} className="pl-9 rounded-xl bg-slate-50 border-slate-100" />
        </form>
      </Card>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleCrear} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Nuevo cliente</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required className="rounded-xl" />
              <Input placeholder="Teléfono *" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} required className="rounded-xl" />
              <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="rounded-xl" />
              <Input placeholder="Dirección" value={form.direccion_principal} onChange={e => setForm({...form, direccion_principal: e.target.value})} className="rounded-xl" />
            </div>
            <Textarea placeholder="Notas" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="rounded-xl" />
            <div className="flex gap-2"><Button type="submit" className="rounded-xl">Crear</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button></div>
          </form>
        </Card>
      )}

      {loading ? <LoadingSkeleton rows={6} /> : clientes.length === 0 ? (
        <EmptyState title="No hay clientes" description="Crea tu primer cliente con el botón de arriba" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map(c => (
            <Card key={c.id} className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(c.id)}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {c.nombre.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{c.nombre}</p>
                  <p className="text-xs text-slate-400">{c.telefono}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-medium">{c.total_servicios || 0} servicios</span>
                <span className="text-slate-400">{c.ultimo_servicio ? formatDate(c.ultimo_servicio) : 'Sin servicios'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl">Anterior</Button>
          <span className="text-sm text-slate-500 font-medium">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl">Siguiente</Button>
        </div>
      )}
    </div>
  );
};

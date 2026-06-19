import { useEffect, useState, useCallback } from 'react';
import { useSocketStore } from '@/store/socketStore';
import { getServicios, crearServicio, cambiarEstadoServicio, actualizarServicio, subirFoto } from '@/api/servicios';
import { getUsuarios } from '@/api/usuarios';
import { getClientes, getEquipos, crearCliente, getDirecciones } from '@/api/clientes';
import { getSlaConfigs } from '@/api/slaConfig';
import {
  getEventosCalendario, crearEventoCalendario, actualizarEventoCalendario,
  eliminarEventoCalendario, crearEventosCalendarioBulk,
} from '@/api/calendario';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import { tipoEquipoLabel } from '@/utils/helpers';
import type { Servicio, Usuario, EventoCalendario, Cliente, Equipo } from '@/types';
import {
  ChevronLeft, ChevronRight, X, Users, Calendar, MapPin,
  Phone, Wrench, Clock, AlertTriangle, Plus,
  Ban, Coffee, GraduationCap, Stethoscope, Palmtree, CalendarOff,
  CheckCircle2, CalendarPlus, Repeat, Pencil, Save,
} from 'lucide-react';
import {
  format, addDays, addMonths, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

// ── Festivos Colombia 2026-2027 ───────────────────────────────────────────────
// Fijos: 1 Ene, 1 May, 20 Jul, 7 Ago, 8 Dic, 25 Dic + Semana Santa.
// Trasladables (Ley Emiliani): se mueven al lunes siguiente si no caen en lunes.
const FESTIVOS_CO = new Set([
  // 2026
  '2026-01-01', // Año Nuevo
  '2026-01-12', // Reyes Magos (6 ene = mar → lun 12)
  '2026-03-23', // San José (19 mar = jue → lun 23)
  '2026-04-02', // Jueves Santo (Semana Santa, Easter = 5 abr)
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-18', // Ascensión (Easter+39 = 14 may = jue → lun 18)
  '2026-06-08', // Corpus Christi (Easter+60 = 4 jun = jue → lun 8)
  '2026-06-15', // Sagrado Corazón (Easter+68 = 12 jun = vie → lun 15)
  '2026-06-29', // San Pedro y San Pablo (29 jun = lun)
  '2026-07-20', // Independencia
  '2026-08-07', // Boyacá
  '2026-08-17', // Asunción (15 ago = sáb → lun 17)
  '2026-10-12', // Día de la Raza (12 oct = lun)
  '2026-11-02', // Todos los Santos (1 nov = dom → lun 2)
  '2026-11-16', // Independencia Cartagena (11 nov = mié → lun 16)
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
  // 2027
  '2027-01-01', // Año Nuevo
  '2027-01-11', // Reyes Magos (6 ene = mié → lun 11)
  '2027-03-22', // San José (19 mar = vie → lun 22)
  '2027-03-25', // Jueves Santo (Easter = 28 mar)
  '2027-03-26', // Viernes Santo
  '2027-05-01', // Día del Trabajo
  '2027-05-10', // Ascensión (Easter+39 = 6 may = jue → lun 10)
  '2027-05-31', // Corpus Christi (Easter+60 = 27 may = jue → lun 31)
  '2027-06-07', // Sagrado Corazón (Easter+68 = 4 jun = vie → lun 7)
  '2027-07-05', // San Pedro y San Pablo (29 jun = mar → lun 5 jul)
  '2027-07-20', // Independencia
  '2027-08-07', // Boyacá
  '2027-08-16', // Asunción (15 ago = dom → lun 16)
  '2027-10-18', // Día de la Raza (12 oct = mar → lun 18)
  '2027-11-05', // Todos los Santos (1 nov = jue → lun 5)
  '2027-11-12', // Independencia Cartagena (11 nov = dom → lun 12)
  '2027-12-08', // Inmaculada Concepción
  '2027-12-25', // Navidad
]);

const FESTIVOS = FESTIVOS_CO;

const esFestivo = (dateStr: string) => FESTIVOS.has(dateStr);
const esDomingo = (d: Date) => d.getDay() === 0;
const esSabado = (d: Date) => d.getDay() === 6;

// ─────────────────────────────────────────────────────────────────────────────

const estadoColor: Record<string, string> = {
  pendiente: 'bg-slate-100 border-slate-300 text-slate-600',
  asignado: 'bg-blue-50 border-blue-300 text-blue-700',
  en_camino: 'bg-amber-50 border-amber-300 text-amber-700',
  en_servicio: 'bg-orange-50 border-orange-300 text-orange-700',
  completado: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  cancelado: 'bg-red-50 border-red-300 text-red-600',
};

const especialidadBadge: Record<string, { label: string; cls: string }> = {
  aires: { label: 'Aires', cls: 'bg-cyan-100 text-cyan-700' },
  neveras: { label: 'Neveras', cls: 'bg-violet-100 text-violet-700' },
  ambos: { label: 'Ambos', cls: 'bg-blue-100 text-blue-700' },
};

const tipoBloqueoConfig: Record<string, { label: string; icon: typeof Ban; color: string; bg: string; border: string }> = {
  almuerzo: { label: 'Almuerzo', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300' },
  personal: { label: 'Personal', icon: Ban, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-300' },
  vacaciones: { label: 'Vacaciones', icon: Palmtree, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' },
  capacitacion: { label: 'Capacitación', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-300' },
  cita_medica: { label: 'Cita médica', icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300' },
  otro: { label: 'Otro', icon: CalendarOff, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300' },
};

type ModalMode = 'bloqueo' | 'cita';

export const CalendarioTecnicos = () => {
  const [fecha, setFecha] = useState(new Date());
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [selectedTecnico, setSelectedTecnico] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('bloqueo');
  const [saving, setSaving] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelFotos, setCancelFotos] = useState<File[]>([]);
  const [cancelando, setCancelando] = useState(false);
  const [editingEvento, setEditingEvento] = useState<EventoCalendario | null>(null);

  // Edit service state
  const [editandoServicio, setEditandoServicio] = useState(false);
  const [savingServicio, setSavingServicio] = useState(false);
  const [editServicioForm, setEditServicioForm] = useState({
    fecha_programada: '', hora_inicio: '', hora_fin: '',
    tipo_servicio: '', descripcion_falla: '', direccion_servicio: '',
    valor_estimado: '', notas_admin: '',
  });

  // Cita form state
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [slaDuraciones, setSlaDuraciones] = useState<Record<string, number>>({});
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({ nombre: '', telefono: '', direccion_principal: '' });
  const [clienteDirecciones, setClienteDirecciones] = useState<{ id: string; nombre: string; direccion: string; principal: boolean }[]>([]);
  const [citaForm, setCitaForm] = useState({
    clienteId: '', equipoId: '', tecnicoId: '',
    tipo_servicio: '', descripcion_falla: '',
    fecha_programada: '', hora_inicio: '08:00', hora_fin: '10:00',
    direccion_servicio: '', valor_estimado: '40000',
  });

  const HORAS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const HORA_INICIO = 7;
  const PX_POR_HORA = 90;

  const parseHora = (hora: string | undefined, fallback = 8) => {
    if (!hora) return fallback;
    const [h, m] = hora.split(':').map(Number);
    return h + (m || 0) / 60;
  };

  const [form, setForm] = useState({
    tecnicoId: '',
    titulo: '',
    descripcion: '',
    fecha: '',
    hora_inicio: '08:00',
    hora_fin: '09:00',
    tipo: 'personal',
    todo_el_dia: false,
    repeticion: 'ninguna',
    todos_tecnicos: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const diaStr = format(fecha, 'yyyy-MM-dd');
    const [servRes, tecRes, evtRes] = await Promise.allSettled([
      getServicios({ desde: diaStr, hasta: diaStr, limit: '200' }),
      getUsuarios({ rol: 'tecnico', activo: 'true' }),
      getEventosCalendario({ desde: diaStr, hasta: diaStr }),
    ]);
    if (servRes.status === 'fulfilled') setServicios(servRes.value.data.data);
    if (tecRes.status  === 'fulfilled') setTecnicos(tecRes.value.data.data);
    if (evtRes.status  === 'fulfilled') setEventos(evtRes.value.data.data);
    if (tecRes.status  === 'rejected')  toast.error('Error cargando técnicos');
    setLoading(false);
  }, [fecha]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { socket } = useSocketStore();
  useEffect(() => {
    if (!socket) return;
    const onServicioActualizado = (updated: Servicio) => {
      const diaStr = format(fecha, 'yyyy-MM-dd');
      if (String(updated.fecha_programada).substring(0, 10) !== diaStr) return;
      setServicios(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
      setSelectedServicio(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
    };
    socket.on('servicio_actualizado', onServicioActualizado);
    return () => { socket.off('servicio_actualizado', onServicioActualizado); };
  }, [socket, fecha]);

  const sinAsignar = servicios.filter(s => !s.tecnicoId);

  // Comparamos strings YYYY-MM-DD para evitar desfase por zona horaria (Colombia UTC-5).
  // Las fechas de la API llegan como "2026-06-17T00:00:00.000Z"; tomar las 10 primeras
  // letras da siempre la fecha UTC que coincide con lo que enviamos desde el form.
  const diaFechaStr = format(fecha, 'yyyy-MM-dd');

  const getServiciosDia = (tecnicoId: string) =>
    servicios.filter(s => s.tecnicoId === tecnicoId && s.fecha_programada &&
      String(s.fecha_programada).substring(0, 10) === diaFechaStr);

  const getEventosDia = (tecnicoId: string) =>
    eventos.filter(e => e.tecnicoId === tecnicoId &&
      String(e.fecha).substring(0, 10) === diaFechaStr);

  const filteredTecnicos = selectedTecnico
    ? tecnicos.filter(t => t.id === selectedTecnico)
    : tecnicos;

  const getDisponibilidadTecnicos = () => {
    if (!citaForm.fecha_programada) return [];
    const diaSelStr = citaForm.fecha_programada; // "YYYY-MM-DD"
    return tecnicos.map(t => {
      const servsDia = servicios.filter(s =>
        s.tecnicoId === t.id &&
        s.fecha_programada &&
        String(s.fecha_programada).substring(0, 10) === diaSelStr
      );
      const bloquesDia = eventos.filter(e =>
        e.tecnicoId === t.id &&
        String(e.fecha).substring(0, 10) === diaSelStr
      );
      const horaInicio = parseInt(citaForm.hora_inicio.split(':')[0]) * 60 + parseInt(citaForm.hora_inicio.split(':')[1]);
      const horaFin = parseInt(citaForm.hora_fin.split(':')[0]) * 60 + parseInt(citaForm.hora_fin.split(':')[1]);
      const conflicto = servsDia.some(s => {
        if (!s.hora_inicio || !s.hora_fin) return false;
        const sInicio = parseInt(s.hora_inicio.split(':')[0]) * 60 + parseInt(s.hora_inicio.split(':')[1]);
        const sFin = parseInt(s.hora_fin.split(':')[0]) * 60 + parseInt(s.hora_fin.split(':')[1]);
        return horaInicio < sFin && horaFin > sInicio;
      });
      const bloqueado = bloquesDia.some(e => e.todo_el_dia || (() => {
        if (!e.hora_inicio || !e.hora_fin) return false;
        const eInicio = parseInt(e.hora_inicio.split(':')[0]) * 60 + parseInt(e.hora_inicio.split(':')[1]);
        const eFin = parseInt(e.hora_fin.split(':')[0]) * 60 + parseInt(e.hora_fin.split(':')[1]);
        return horaInicio < eFin && horaFin > eInicio;
      })());
      return { tecnico: t, servsDia: servsDia.length, bloquesDia: bloquesDia.length, conflicto, bloqueado, libre: !conflicto && !bloqueado };
    }).sort((a, b) => (a.libre ? -1 : 1) - (b.libre ? -1 : 1) || a.servsDia - b.servsDia);
  };

  const openCreateModal = (tecnicoId?: string, dia?: Date, mode: ModalMode = 'bloqueo') => {
    const fechaStr = dia ? format(dia, 'yyyy-MM-dd') : format(fecha, 'yyyy-MM-dd');
    setEditingEvento(null);
    setModalMode(mode);
    setForm({
      tecnicoId: tecnicoId || (tecnicos.length > 0 ? tecnicos[0].id : ''),
      titulo: mode === 'bloqueo' ? 'Hora de almuerzo' : '',
      descripcion: '',
      fecha: fechaStr,
      hora_inicio: mode === 'bloqueo' ? '12:30' : '08:00',
      hora_fin: mode === 'bloqueo' ? '13:00' : '09:00',
      tipo: 'almuerzo',
      todo_el_dia: false,
      repeticion: 'ninguna',
      todos_tecnicos: false,
    });
    setCitaForm(f => ({ ...f, tecnicoId: tecnicoId || '', fecha_programada: fechaStr }));
    if (mode === 'cita') {
      getClientes({}).then(r => setClientes(r.data.data)).catch(() => {});
      getSlaConfigs().then(r => {
        const map: Record<string, number> = {};
        r.data.data.forEach(s => { map[s.tipo_servicio] = s.max_tiempo_ejecucion_min; });
        setSlaDuraciones(map);
      }).catch(() => {});
    }
    setShowModal(true);
  };

  const openEditModal = (evt: EventoCalendario) => {
    setEditingEvento(evt);
    setModalMode('bloqueo');
    setForm({
      tecnicoId: evt.tecnicoId,
      titulo: evt.titulo,
      descripcion: evt.descripcion || '',
      fecha: String(evt.fecha).substring(0, 10),
      hora_inicio: evt.hora_inicio || '08:00',
      hora_fin: evt.hora_fin || '09:00',
      tipo: evt.tipo || 'personal',
      todo_el_dia: evt.todo_el_dia || false,
      repeticion: 'ninguna',
      todos_tecnicos: false,
    });
    setShowModal(true);
  };

  const handleClienteCitaChange = async (clienteId: string) => {
    setCitaForm(f => ({ ...f, clienteId, equipoId: '', direccion_servicio: '' }));
    setClienteDirecciones([]);
    if (clienteId) {
      try {
        const [equiposRes, dirsRes] = await Promise.all([
          getEquipos(clienteId),
          getDirecciones(clienteId),
        ]);
        setEquipos(equiposRes.data.data);
        const dirs = dirsRes.data.data;
        setClienteDirecciones(dirs);
        // Auto-fill si hay exactamente una dirección o hay una marcada como principal
        const principal = dirs.find(d => d.principal) || dirs[0];
        if (principal) {
          setCitaForm(f => ({ ...f, clienteId, direccion_servicio: principal.direccion }));
        } else {
          // Fallback a direccion_principal del cliente
          const cliente = clientes.find(c => c.id === clienteId);
          if (cliente?.direccion_principal) setCitaForm(f => ({ ...f, clienteId, direccion_servicio: cliente.direccion_principal || '' }));
        }
      } catch { setEquipos([]); }
    }
  };

  const handleCrearClienteRapido = async () => {
    if (!nuevoClienteForm.nombre.trim()) { toast.error('Escribe el nombre del cliente'); return; }
    if (!nuevoClienteForm.telefono.trim()) { toast.error('Escribe el teléfono'); return; }
    setSavingCliente(true);
    try {
      const { data: res } = await crearCliente(nuevoClienteForm);
      const nuevo = res.data;
      // Refrescar lista y seleccionar el nuevo cliente automáticamente
      const { data: lista } = await getClientes({});
      setClientes(lista.data);
      await handleClienteCitaChange(nuevo.id);
      setNuevoClienteForm({ nombre: '', telefono: '', direccion_principal: '' });
      setShowNuevoCliente(false);
      toast.success(`Cliente ${nuevo.nombre} creado`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error creando cliente');
    } finally {
      setSavingCliente(false);
    }
  };

  const handleCrearCita = async () => {
    if (!citaForm.clienteId) { toast.error('Selecciona un cliente'); return; }
    if (!citaForm.fecha_programada) { toast.error('Selecciona una fecha'); return; }
    const dCita = new Date(citaForm.fecha_programada + 'T00:00:00');
    if (esDomingo(dCita)) { toast.error('No se trabaja los domingos'); return; }
    if (esFestivo(citaForm.fecha_programada)) { toast.error('Día festivo — no se trabaja este día'); return; }
    if (esSabado(dCita) && citaForm.hora_inicio >= '12:00') {
      toast.error('Los sábados solo se atiende hasta las 12:00'); return;
    }
    if (!citaForm.hora_inicio) { toast.error('Selecciona la hora'); return; }
    setSaving(true);
    try {
      await crearServicio({
        ...citaForm,
        valor_estimado: parseFloat(citaForm.valor_estimado) || undefined,
        equipoId: citaForm.equipoId || undefined,
        tecnicoId: citaForm.tecnicoId || undefined,
        origen: 'manual',
      } as any);
      toast.success('Cita agendada correctamente');
      setShowModal(false);
      fetchData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error creando cita'); }
    finally { setSaving(false); }
  };

  // Días laborables: lunes–sábado, sin domingos ni festivos
  const getDiasLaborales = (desde: string, hasta: string): string[] => {
    const dias: string[] = [];
    let cur = new Date(desde + 'T00:00:00');
    const end = new Date(hasta + 'T00:00:00');
    while (cur <= end) {
      const d = cur.getDay();
      const ds = format(cur, 'yyyy-MM-dd');
      if (d !== 0 && !esFestivo(ds)) dias.push(ds);
      cur = addDays(cur, 1);
    }
    return dias;
  };

  const getHastaFecha = (desde: string, rep: string): string => {
    const d = new Date(desde + 'T00:00:00');
    if (rep === 'semana') {
      const dow = d.getDay();
      const daysToSat = dow === 0 ? 6 : 6 - dow;
      return format(addDays(d, daysToSat), 'yyyy-MM-dd');
    }
    if (rep === 'mes') return format(addMonths(d, 1), 'yyyy-MM-dd');
    if (rep === 'semestre') return format(addMonths(d, 6), 'yyyy-MM-dd');
    if (rep === 'anio') return format(addMonths(d, 12), 'yyyy-MM-dd');
    if (rep === 'siempre') return format(addMonths(d, 24), 'yyyy-MM-dd');
    return desde;
  };

  const startEditServicio = (s: Servicio) => {
    setEditServicioForm({
      fecha_programada: s.fecha_programada ? String(s.fecha_programada).substring(0, 10) : '',
      hora_inicio: s.hora_inicio || '',
      hora_fin: s.hora_fin || '',
      tipo_servicio: s.tipo_servicio || '',
      descripcion_falla: s.descripcion_falla || '',
      direccion_servicio: s.direccion_servicio || '',
      valor_estimado: s.valor_estimado != null ? String(s.valor_estimado) : '',
      notas_admin: s.notas_admin || '',
    });
    setEditandoServicio(true);
  };

  const handleGuardarServicio = async () => {
    if (!selectedServicio) return;
    setSavingServicio(true);
    try {
      const payload: Record<string, any> = {
        descripcion_falla:   editServicioForm.descripcion_falla || null,
        direccion_servicio:  editServicioForm.direccion_servicio || null,
        hora_inicio:         editServicioForm.hora_inicio || null,
        hora_fin:            editServicioForm.hora_fin || null,
        notas_admin:         editServicioForm.notas_admin || null,
        tipo_servicio:       (editServicioForm.tipo_servicio as Servicio['tipo_servicio']) || null,
      };
      if (editServicioForm.fecha_programada) payload.fecha_programada = editServicioForm.fecha_programada;
      if (editServicioForm.valor_estimado !== '') payload.valor_estimado = parseFloat(editServicioForm.valor_estimado);

      const { data: res } = await actualizarServicio(selectedServicio.id, payload);
      setSelectedServicio(res.data);
      setEditandoServicio(false);
      toast.success('Servicio actualizado');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error guardando');
    } finally { setSavingServicio(false); }
  };

  const handleCancelarServicio = async () => {
    if (!selectedServicio) return;
    setCancelando(true);
    try {
      await cambiarEstadoServicio(selectedServicio.id, 'cancelado',
        cancelMotivo.trim() ? { motivo_cancelacion: cancelMotivo.trim() } : undefined,
      );
      for (const file of cancelFotos) {
        const fd = new FormData();
        fd.append('foto', file);
        fd.append('tipo', 'cancelacion');
        await subirFoto(selectedServicio.id, fd);
      }
      toast.success('Servicio cancelado');
      setSelectedServicio(null);
      setCancelConfirm(false);
      setCancelMotivo('');
      setCancelFotos([]);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error cancelando servicio');
    } finally {
      setCancelando(false);
    }
  };

  const handleCrear = async () => {
    if (!form.titulo.trim()) { toast.error('Escribe un título'); return; }
    setSaving(true);
    try {
      // ── Modo edición: actualizar evento existente ──
      if (editingEvento) {
        await actualizarEventoCalendario(editingEvento.id, {
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim() || undefined,
          fecha: form.fecha,
          hora_inicio: form.todo_el_dia ? '00:00' : form.hora_inicio,
          hora_fin: form.todo_el_dia ? '23:59' : form.hora_fin,
          tipo: form.tipo as any,
          todo_el_dia: form.todo_el_dia,
        });
        toast.success('Evento actualizado');
        setShowModal(false);
        setEditingEvento(null);
        fetchData();
        return;
      }

      // ── Modo creación ──
      if (!form.tecnicoId && !form.todos_tecnicos) {
        toast.error('Selecciona un técnico');
        return;
      }
      const fechas = form.repeticion === 'ninguna'
        ? [form.fecha]
        : getDiasLaborales(form.fecha, getHastaFecha(form.fecha, form.repeticion));
      const tecIds = form.todos_tecnicos ? tecnicos.map(t => t.id) : [form.tecnicoId];
      const eventosData = [];
      for (const tecId of tecIds) {
        for (const f of fechas) {
          eventosData.push({
            tecnicoId: tecId,
            titulo: form.titulo.trim(),
            descripcion: form.descripcion.trim() || undefined,
            fecha: f,
            hora_inicio: form.todo_el_dia ? '00:00' : form.hora_inicio,
            hora_fin: form.todo_el_dia ? '23:59' : form.hora_fin,
            tipo: form.tipo,
            todo_el_dia: form.todo_el_dia,
          });
        }
      }

      if (eventosData.length > 5) {
        // Bulk: dividir en chunks de 2999 si es muy grande
        const CHUNK = 2999;
        let total = 0;
        for (let i = 0; i < eventosData.length; i += CHUNK) {
          const chunk = eventosData.slice(i, i + CHUNK);
          const { data: result } = await crearEventosCalendarioBulk(chunk as any);
          total += result.data.count;
        }
        toast.success(`${total} eventos creados`);
      } else {
        for (const evt of eventosData) {
          await crearEventoCalendario(evt as any);
        }
        toast.success(eventosData.length > 1 ? `${eventosData.length} eventos creados` : 'Evento creado');
      }

      setShowModal(false);
      fetchData();
    } catch { toast.error('Error guardando evento'); }
    finally { setSaving(false); }
  };

  const handleEliminarEvento = async (id: string) => {
    try {
      await eliminarEventoCalendario(id);
      toast.success('Evento eliminado');
      fetchData();
    } catch { toast.error('Error eliminando evento'); }
  };

  // ── Indicadores del día actual ───────────────────────────────────────────────
  const fechaStr = format(fecha, 'yyyy-MM-dd');
  const esFestivoHoy = esFestivo(fechaStr);
  const esSabadoHoy = esSabado(fecha);
  const esDomingoHoy = esDomingo(fecha);

  // Cuántos eventos crearía la recurrencia actual (para mostrar en UI)
  const estimarEventos = () => {
    if (form.repeticion === 'ninguna' || !form.fecha) return 1;
    const dias = getDiasLaborales(form.fecha, getHastaFecha(form.fecha, form.repeticion));
    const tecs = form.todos_tecnicos ? tecnicos.length : 1;
    return dias.length * tecs;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" /> Calendario de Técnicos
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Vista diaria — {tecnicos.length} técnicos activos
          </p>
        </div>
        <Button
          onClick={() => openCreateModal(undefined, undefined, 'cita')}
          className="rounded-xl gap-1.5"
        >
          <CalendarPlus className="h-4 w-4" />
          Nueva cita / bloqueo
        </Button>
      </div>

      {/* Controls */}
      <Card className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFecha(d => addDays(d, -1))} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 min-w-[280px] text-center capitalize">
              {format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
              {esFestivoHoy && (
                <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold align-middle">FESTIVO</span>
              )}
              {esDomingoHoy && (
                <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold align-middle">DOMINGO</span>
              )}
              {esSabadoHoy && (
                <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold align-middle">SAB · hasta 12:00</span>
              )}
            </div>
            <button onClick={() => setFecha(d => addDays(d, 1))} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" className={`rounded-xl ${isToday(fecha) ? 'border-blue-400 text-blue-600' : ''}`} onClick={() => setFecha(new Date())}>
            Hoy
          </Button>

          {/* Technician filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setSelectedTecnico(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!selectedTecnico ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              Todos
            </button>
            {tecnicos.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTecnico(selectedTecnico === t.id ? null : t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  selectedTecnico === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${selectedTecnico === t.id ? 'bg-white' : 'bg-blue-400'}`} />
                {t.nombre.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Alerta festivo / domingo */}
      {(esFestivoHoy || esDomingoHoy) && (
        <Card className="border-amber-200 bg-amber-50/50 p-3">
          <p className="text-sm font-semibold text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {esDomingoHoy ? 'Domingo — día no laboral' : 'Festivo colombiano — no se trabaja este día'}
          </p>
        </Card>
      )}

      {/* Unassigned alert */}
      {sinAsignar.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 p-4">
          <h3 className="font-semibold text-amber-700 mb-2 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> {sinAsignar.length} servicios sin técnico asignado
          </h3>
          <div className="flex flex-wrap gap-2">
            {sinAsignar.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedServicio(s)}
                className="bg-white px-3 py-2 rounded-xl border border-amber-200 text-xs hover:shadow-md transition-all text-left"
              >
                <span className="font-semibold text-slate-700">{s.cliente?.nombre}</span>
                <span className="text-slate-400 ml-1.5">{s.hora_inicio || '--:--'}</span>
                {s.fecha_programada && (
                  <span className="text-amber-600 ml-1.5">{format(new Date(String(s.fecha_programada).substring(0, 10) + 'T12:00:00'), 'd MMM', { locale: es })}</span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading ? <LoadingSkeleton rows={6} /> : (
        <>
          {/* Timeline diaria */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: 160 + HORAS.length * PX_POR_HORA }}>

                {/* Cabecera de horas */}
                <div className="flex border-b border-slate-200 bg-slate-50/80">
                  <div className="shrink-0 border-r border-slate-200 p-3" style={{ width: 160 }}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Técnico</span>
                  </div>
                  <div className="flex flex-1">
                    {HORAS.map(h => (
                      <div key={h} style={{ width: PX_POR_HORA }}
                        className={`text-center py-2 border-l border-slate-100 shrink-0 ${esSabadoHoy && h >= 12 ? 'bg-slate-100/60' : ''}`}>
                        <span className={`text-[10px] font-bold ${esSabadoHoy && h >= 12 ? 'text-slate-300' : 'text-slate-400'}`}>
                          {String(h).padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filas de técnicos */}
                {filteredTecnicos.map((tec, idx) => {
                  const servsDia = getServiciosDia(tec.id);
                  const evtsDia = getEventosDia(tec.id);
                  const esp = especialidadBadge[tec.especialidad] || especialidadBadge.ambos;
                  const esHoy = isToday(fecha);
                  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
                  const totalWidth = HORAS.length * PX_POR_HORA;

                  return (
                    <div key={tec.id} className={`flex border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      {/* Info técnico */}
                      <div
                        className={`shrink-0 p-3 border-r border-slate-200 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}
                        style={{ width: 160 }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {tec.nombre.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-800 truncate">{tec.nombre}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${esp.cls}`}>{esp.label}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          {servsDia.length > 0 ? (
                            <span className="text-[10px] text-slate-500 font-medium">{servsDia.length} servicio{servsDia.length !== 1 ? 's' : ''}</span>
                          ) : evtsDia.length === 0 ? (
                            <span className="text-[10px] text-emerald-600 font-bold">LIBRE</span>
                          ) : null}
                          {evtsDia.length > 0 && (
                            <span className="text-[10px] text-red-400">{evtsDia.length} bloq.</span>
                          )}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="relative" style={{ width: totalWidth, height: 80 }}>
                        {/* Líneas de hora */}
                        {HORAS.map(h => (
                          <div key={h} style={{ left: (h - HORA_INICIO) * PX_POR_HORA }} className="absolute top-0 bottom-0 w-px bg-slate-100" />
                        ))}

                        {/* Overlay sábado: sin servicio después de 12:00 */}
                        {esSabadoHoy && (
                          <div
                            style={{
                              left: (12 - HORA_INICIO) * PX_POR_HORA,
                              width: (HORA_INICIO + HORAS.length - 12) * PX_POR_HORA,
                            }}
                            className="absolute top-0 bottom-0 bg-slate-100/80 border-l-2 border-dashed border-slate-300 z-10 pointer-events-none"
                          >
                            {idx === 0 && (
                              <span className="absolute top-1 left-1 text-[8px] text-slate-400 font-bold whitespace-nowrap select-none">
                                Sin servicio
                              </span>
                            )}
                          </div>
                        )}

                        {/* Indicador hora actual */}
                        {esHoy && nowH >= HORA_INICIO && nowH <= HORA_INICIO + HORAS.length && (
                          <div
                            style={{ left: (nowH - HORA_INICIO) * PX_POR_HORA }}
                            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20"
                          >
                            <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-red-400" />
                          </div>
                        )}

                        {/* Eventos todo el día */}
                        {evtsDia.filter(e => e.todo_el_dia).map(evt => {
                          const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
                          const Icon = cfg.icon;
                          return (
                            <div
                              key={evt.id}
                              onClick={() => openEditModal(evt)}
                              className={`absolute inset-x-1 top-1 bottom-1 rounded-lg border px-2.5 flex items-center gap-2 cursor-pointer group hover:shadow-sm hover:brightness-95 transition-all relative ${cfg.bg} ${cfg.border}`}
                            >
                              <Icon className={`h-3.5 w-3.5 ${cfg.color} shrink-0`} />
                              <span className={`text-[10px] font-semibold ${cfg.color} truncate flex-1`}>{evt.titulo}</span>
                              <span className={`text-[10px] ${cfg.color} opacity-50 shrink-0`}>Todo el día</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEliminarEvento(evt.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-red-100"
                                title="Eliminar"
                              >
                                <X className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Eventos con hora — bloque completo abre edición al hacer click */}
                        {evtsDia.filter(e => !e.todo_el_dia).map(evt => {
                          const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
                          const Icon = cfg.icon;
                          const startH = parseHora(evt.hora_inicio, HORA_INICIO);
                          const endH = parseHora(evt.hora_fin, startH + 1);
                          const left = Math.max(0, (startH - HORA_INICIO) * PX_POR_HORA);
                          const width = Math.max(44, (endH - startH) * PX_POR_HORA);
                          return (
                            <div
                              key={evt.id}
                              style={{ left, width, top: 4, bottom: 4, position: 'absolute' }}
                              onClick={() => openEditModal(evt)}
                              className={`rounded-lg border px-2 py-1 flex flex-col justify-center cursor-pointer group hover:shadow-md hover:brightness-95 hover:z-30 transition-all z-10 relative ${cfg.bg} ${cfg.border}`}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <Icon className={`h-3 w-3 ${cfg.color} shrink-0`} />
                                <p className={`text-[10px] font-semibold ${cfg.color} truncate leading-tight`}>{evt.titulo}</p>
                              </div>
                              <p className={`text-[9px] ${cfg.color} opacity-60 leading-tight`}>{evt.hora_inicio}–{evt.hora_fin}</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEliminarEvento(evt.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0.5 right-0.5 p-0.5 rounded hover:bg-red-100"
                                title="Eliminar"
                              >
                                <X className="h-2.5 w-2.5 text-red-400" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Servicios */}
                        {servsDia.map(s => {
                          const startH = parseHora(s.hora_inicio, 8);
                          const endH = parseHora(s.hora_fin, startH + 1.5);
                          const left = Math.max(0, (startH - HORA_INICIO) * PX_POR_HORA);
                          const width = Math.max(60, (endH - startH) * PX_POR_HORA);
                          const enEjecucion = s.estado === 'en_servicio';
                          const enCamino = s.estado === 'en_camino';
                          return (
                            <button
                              key={s.id}
                              style={{ left, width, top: 4, bottom: 4, position: 'absolute' }}
                              onClick={() => setSelectedServicio(s)}
                              className={`rounded-lg border text-left px-2 overflow-hidden hover:shadow-lg hover:z-30 transition-all z-10 ${estadoColor[s.estado]} ${enEjecucion ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-0.5">
                                <p className="text-[10px] font-bold truncate">{s.hora_inicio}–{s.hora_fin}</p>
                                {enEjecucion && (
                                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                                  </span>
                                )}
                                {enCamino && (
                                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-semibold truncate leading-tight">{s.cliente?.nombre}</p>
                              {enEjecucion && (
                                <p className="text-[9px] font-bold text-orange-600 flex items-center gap-0.5 truncate">
                                  <Wrench className="h-2.5 w-2.5 shrink-0" /> En ejecución
                                </p>
                              )}
                              {!enEjecucion && s.equipo && (
                                <p className="text-[9px] opacity-60 truncate">{tipoEquipoLabel[s.equipo.tipo]}</p>
                              )}
                            </button>
                          );
                        })}

                        {/* Sin nada */}
                        {servsDia.length === 0 && evtsDia.length === 0 && !esFestivoHoy && !esDomingoHoy && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => openCreateModal(tec.id, fecha, 'cita')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-slate-200 text-slate-300 hover:text-blue-500 hover:border-blue-300 transition-colors text-[10px] font-semibold"
                            >
                              <Plus className="h-3 w-3" /> Agendar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 px-1">
            {[
              { label: 'Pendiente', color: 'bg-slate-400' },
              { label: 'Asignado', color: 'bg-blue-500' },
              { label: 'En camino', color: 'bg-amber-500' },
              { label: 'En servicio', color: 'bg-orange-500' },
              { label: 'Completado', color: 'bg-emerald-500' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-[11px] text-slate-500">{label}</span>
              </div>
            ))}
            <div className="h-3 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-red-400 rounded" />
              <span className="text-[11px] text-slate-500">Hora actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 bg-slate-100 border border-dashed border-slate-300 rounded" />
              <span className="text-[11px] text-slate-500">Sin servicio (Sáb 12pm+)</span>
            </div>
          </div>
        </>
      )}

      {/* Service detail slide-over */}
      {selectedServicio && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => { setSelectedServicio(null); setCancelConfirm(false); }} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">
                {editandoServicio ? 'Editar servicio' : 'Detalle del Servicio'}
              </h3>
              <div className="flex items-center gap-1.5">
                {!editandoServicio && selectedServicio.estado !== 'completado' && selectedServicio.estado !== 'cancelado' && (
                  <button
                    onClick={() => startEditServicio(selectedServicio)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
                {editandoServicio && (
                  <button
                    onClick={() => setEditandoServicio(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button onClick={() => { setSelectedServicio(null); setCancelConfirm(false); setEditandoServicio(false); }} className="p-2 rounded-xl hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* ── MODO EDICIÓN ── */}
              {editandoServicio && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tipo de servicio</label>
                      <select
                        value={editServicioForm.tipo_servicio}
                        onChange={e => setEditServicioForm(f => ({ ...f, tipo_servicio: e.target.value }))}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Sin asignar</option>
                        <option value="diagnostico">Diagnóstico</option>
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="reparacion">Reparación</option>
                        <option value="instalacion">Instalación</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Fecha</label>
                      <input
                        type="date"
                        value={editServicioForm.fecha_programada}
                        onChange={e => setEditServicioForm(f => ({ ...f, fecha_programada: e.target.value }))}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Hora inicio</label>
                      <input
                        type="time"
                        value={editServicioForm.hora_inicio}
                        onChange={e => setEditServicioForm(f => ({ ...f, hora_inicio: e.target.value }))}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Hora fin</label>
                      <input
                        type="time"
                        value={editServicioForm.hora_fin}
                        onChange={e => setEditServicioForm(f => ({ ...f, hora_fin: e.target.value }))}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Dirección</label>
                    <input
                      type="text"
                      value={editServicioForm.direccion_servicio}
                      onChange={e => setEditServicioForm(f => ({ ...f, direccion_servicio: e.target.value }))}
                      placeholder="Dirección del servicio"
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Falla reportada</label>
                    <textarea
                      value={editServicioForm.descripcion_falla}
                      onChange={e => setEditServicioForm(f => ({ ...f, descripcion_falla: e.target.value }))}
                      rows={3}
                      placeholder="Descripción de la falla"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Valor estimado</label>
                    <input
                      type="number"
                      value={editServicioForm.valor_estimado}
                      onChange={e => setEditServicioForm(f => ({ ...f, valor_estimado: e.target.value }))}
                      placeholder="0"
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Notas admin</label>
                    <textarea
                      value={editServicioForm.notas_admin}
                      onChange={e => setEditServicioForm(f => ({ ...f, notas_admin: e.target.value }))}
                      rows={2}
                      placeholder="Notas internas"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleGuardarServicio}
                    disabled={savingServicio}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    {savingServicio ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              )}
              {!editandoServicio && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <EstadoBadge estado={selectedServicio.estado} />
                  {selectedServicio.origen === 'whatsapp' && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg font-medium">vía WhatsApp</span>
                  )}
                </div>
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                  <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cliente</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedServicio.cliente?.nombre}</p>
                    {selectedServicio.cliente?.telefono && (
                      <a href={`tel:${selectedServicio.cliente.telefono}`} className="text-xs text-blue-500 flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" /> {selectedServicio.cliente.telefono}
                      </a>
                    )}
                  </div>
                </div>

                {selectedServicio.tecnico && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <Wrench className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">Técnico Asignado</p>
                      <p className="text-sm font-bold text-blue-800 mt-0.5">{selectedServicio.tecnico.nombre}</p>
                    </div>
                  </div>
                )}

                {!selectedServicio.tecnico && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-700">Sin técnico asignado</p>
                      <p className="text-xs text-amber-600 mt-0.5">Asigna un técnico desde Servicios</p>
                    </div>
                  </div>
                )}

                {selectedServicio.fecha_programada && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Fecha Programada</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
                        {format(new Date(String(selectedServicio.fecha_programada).substring(0, 10) + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {selectedServicio.hora_inicio || '--'} — {selectedServicio.hora_fin || '--'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedServicio.direccion_servicio && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Dirección</p>
                      <p className="text-sm text-slate-700 mt-0.5">{selectedServicio.direccion_servicio}</p>
                    </div>
                  </div>
                )}

                {selectedServicio.equipo && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <Wrench className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Equipo</p>
                      <p className="text-sm text-slate-700 mt-0.5">
                        {tipoEquipoLabel[selectedServicio.equipo.tipo]} {selectedServicio.equipo.marca} {selectedServicio.equipo.modelo}
                      </p>
                    </div>
                  </div>
                )}

                {selectedServicio.descripcion_falla && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-500 uppercase">Falla Reportada</p>
                    <p className="text-sm text-amber-800 mt-1">{selectedServicio.descripcion_falla}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {selectedServicio.valor_estimado != null && (
                    <div className="p-3 bg-slate-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Estimado</p>
                      <p className="text-lg font-black text-slate-700">${selectedServicio.valor_estimado.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedServicio.valor_final != null && (
                    <div className="p-3 bg-emerald-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase">Cobrado</p>
                      <p className="text-lg font-black text-emerald-700">${selectedServicio.valor_final.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Cancelar servicio */}
                {['pendiente', 'asignado', 'en_camino', 'en_servicio'].includes(selectedServicio.estado) && (
                  <div className="border border-red-100 bg-red-50/40 rounded-xl p-4">
                    {!cancelConfirm ? (
                      <button
                        onClick={() => { setCancelConfirm(true); setCancelMotivo(''); setCancelFotos([]); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 hover:border-red-300 transition-colors"
                      >
                        <Ban className="h-4 w-4" /> Cancelar servicio
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-red-700">Cancelar servicio</p>

                        <div>
                          <label className="text-[10px] font-bold text-red-400 uppercase">Motivo de cancelación</label>
                          <textarea
                            value={cancelMotivo}
                            onChange={e => setCancelMotivo(e.target.value)}
                            placeholder="Describe el motivo de la cancelación..."
                            rows={3}
                            className="mt-1 w-full text-sm rounded-lg border border-red-200 bg-white px-3 py-2 text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-red-400 uppercase">Fotos (opcional)</label>
                          <label className="mt-1 flex items-center gap-2 cursor-pointer w-full px-3 py-2 rounded-lg border border-dashed border-red-200 bg-white hover:bg-red-50 transition-colors">
                            <span className="text-xs text-slate-500">
                              {cancelFotos.length === 0 ? 'Adjuntar fotos...' : `${cancelFotos.length} foto${cancelFotos.length !== 1 ? 's' : ''} seleccionada${cancelFotos.length !== 1 ? 's' : ''}`}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={e => setCancelFotos(Array.from(e.target.files ?? []))}
                            />
                          </label>
                          {cancelFotos.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {cancelFotos.map((f, i) => (
                                <div key={i} className="relative group">
                                  <img
                                    src={URL.createObjectURL(f)}
                                    className="h-14 w-14 object-cover rounded-lg border border-red-100"
                                  />
                                  <button
                                    onClick={() => setCancelFotos(prev => prev.filter((_, j) => j !== i))}
                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-red-400">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setCancelConfirm(false); setCancelMotivo(''); setCancelFotos([]); }}
                            disabled={cancelando}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            Volver
                          </button>
                          <button
                            onClick={handleCancelarServicio}
                            disabled={cancelando || !cancelMotivo.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear / editar evento o agendar cita */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowModal(false); setEditingEvento(null); }} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">

            {/* Header con pestañas */}
            <div className="p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingEvento
                    ? 'Editar evento'
                    : modalMode === 'cita'
                    ? 'Agendar cita'
                    : 'Bloquear horario'}
                </h3>
                <button onClick={() => { setShowModal(false); setEditingEvento(null); }} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              {/* Solo mostrar tabs si no estamos editando */}
              {!editingEvento && (
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setModalMode('cita')}
                    className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${modalMode === 'cita' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Agendar cita
                  </button>
                  <button
                    onClick={() => setModalMode('bloqueo')}
                    className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${modalMode === 'bloqueo' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Ban className="h-3.5 w-3.5" /> Bloquear horario
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ── MODO CITA ── */}
              {modalMode === 'cita' && !editingEvento && (
                <div className="p-5 space-y-4">
                  {/* Fecha primero para computar disponibilidad */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Fecha <span className="text-slate-400 font-normal">(Lun–Sáb, sin festivos)</span>
                      </label>
                      <input
                        type="date"
                        value={citaForm.fecha_programada}
                        onChange={e => {
                          const v = e.target.value;
                          const d = new Date(v + 'T00:00:00');
                          if (esDomingo(d)) { toast.error('No se trabaja los domingos'); return; }
                          if (esFestivo(v)) { toast.error('Día festivo — no se trabaja'); return; }
                          setCitaForm(f => ({ ...f, fecha_programada: v }));
                        }}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Inicio</label>
                      <input type="time" value={citaForm.hora_inicio}
                        onChange={e => {
                          const inicio = e.target.value;
                          const dur = slaDuraciones[citaForm.tipo_servicio];
                          if (dur) {
                            const [h, m] = inicio.split(':').map(Number);
                            const finMin = h * 60 + m + dur;
                            const fin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
                            setCitaForm(f => ({ ...f, hora_inicio: inicio, hora_fin: fin }));
                          } else {
                            setCitaForm(f => ({ ...f, hora_inicio: inicio }));
                          }
                        }}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Fin
                        {slaDuraciones[citaForm.tipo_servicio] && (
                          <span className="ml-1 text-blue-500 font-normal">({slaDuraciones[citaForm.tipo_servicio]} min)</span>
                        )}
                      </label>
                      <input type="time" value={citaForm.hora_fin}
                        onChange={e => setCitaForm(f => ({ ...f, hora_fin: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tipo servicio</label>
                      <select value={citaForm.tipo_servicio}
                        onChange={e => {
                          const tipo = e.target.value;
                          const dur = slaDuraciones[tipo];
                          if (dur) {
                            const [h, m] = citaForm.hora_inicio.split(':').map(Number);
                            const finMin = h * 60 + m + dur;
                            const fin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
                            setCitaForm(f => ({ ...f, tipo_servicio: tipo, hora_fin: fin }));
                          } else {
                            setCitaForm(f => ({ ...f, tipo_servicio: tipo }));
                          }
                        }}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Tipo</option>
                        <option value="diagnostico">Diagnóstico</option>
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="reparacion">Reparación</option>
                        <option value="instalacion">Instalación</option>
                      </select>
                    </div>
                  </div>

                  {/* Aviso sábado */}
                  {citaForm.fecha_programada && esSabado(new Date(citaForm.fecha_programada + 'T00:00:00')) && (
                    <div className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2 border border-blue-200">
                      Sábado — atención solo hasta las 12:00
                    </div>
                  )}

                  {/* Panel disponibilidad técnicos */}
                  {citaForm.fecha_programada && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-2 block">
                        Disponibilidad — {format(new Date(citaForm.fecha_programada + 'T00:00:00'), "EEEE d MMM", { locale: es })}
                        <span className="font-normal ml-1">{citaForm.hora_inicio}–{citaForm.hora_fin}</span>
                      </label>
                      <div className="space-y-2">
                        {getDisponibilidadTecnicos().map(({ tecnico, servsDia, conflicto, bloqueado }) => {
                          const selected = citaForm.tecnicoId === tecnico.id;
                          return (
                            <button
                              key={tecnico.id}
                              onClick={() => !bloqueado && setCitaForm(f => ({ ...f, tecnicoId: tecnico.id }))}
                              disabled={bloqueado}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                selected ? 'border-blue-500 bg-blue-50' :
                                bloqueado ? 'border-red-100 bg-red-50/40 opacity-60 cursor-not-allowed' :
                                conflicto ? 'border-amber-200 bg-amber-50/40' :
                                'border-slate-100 hover:border-blue-200 hover:bg-blue-50/20'
                              }`}
                            >
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {tecnico.nombre.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{tecnico.nombre}</p>
                                <p className="text-[11px] text-slate-500">{servsDia} servicio{servsDia !== 1 ? 's' : ''} hoy</p>
                              </div>
                              <div className="shrink-0">
                                {bloqueado ? (
                                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-200">BLOQUEADO</span>
                                ) : conflicto ? (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">CONFLICTO</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> LIBRE
                                  </span>
                                )}
                              </div>
                              {selected && <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cliente y equipo */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Cliente *</label>
                    <select value={citaForm.clienteId}
                      onChange={e => handleClienteCitaChange(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Seleccionar cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.telefono}</option>)}
                    </select>

                    {/* Acceso rápido para crear cliente */}
                    {!showNuevoCliente ? (
                      <button
                        type="button"
                        onClick={() => setShowNuevoCliente(true)}
                        className="mt-2 w-full h-9 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Crear nuevo cliente
                      </button>
                    ) : (
                      <div className="mt-3 p-3 rounded-xl border border-blue-200 bg-blue-50 space-y-2">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Nuevo cliente</p>
                        <input
                          type="text"
                          placeholder="Nombre *"
                          value={nuevoClienteForm.nombre}
                          onChange={e => setNuevoClienteForm(f => ({ ...f, nombre: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <input
                          type="tel"
                          placeholder="Teléfono *"
                          value={nuevoClienteForm.telefono}
                          onChange={e => setNuevoClienteForm(f => ({ ...f, telefono: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Dirección (opcional)"
                          value={nuevoClienteForm.direccion_principal}
                          onChange={e => setNuevoClienteForm(f => ({ ...f, direccion_principal: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCrearClienteRapido}
                            disabled={savingCliente}
                            className="flex-1 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                          >
                            {savingCliente ? 'Guardando…' : 'Crear cliente'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNuevoCliente(false); setNuevoClienteForm({ nombre: '', telefono: '', direccion_principal: '' }); }}
                            className="h-8 px-3 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {equipos.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Equipo</label>
                      <select value={citaForm.equipoId}
                        onChange={e => setCitaForm(f => ({ ...f, equipoId: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Seleccionar equipo (opcional)</option>
                        {equipos.map(eq => <option key={eq.id} value={eq.id}>{tipoEquipoLabel[eq.tipo]} {eq.marca} {eq.modelo}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Dirección del servicio</label>
                    {clienteDirecciones.length > 1 ? (
                      <>
                        <select
                          value={citaForm.direccion_servicio}
                          onChange={e => setCitaForm(f => ({ ...f, direccion_servicio: e.target.value }))}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mb-2"
                        >
                          <option value="">Seleccionar dirección</option>
                          {clienteDirecciones.map(d => (
                            <option key={d.id} value={d.direccion}>
                              {d.nombre}{d.principal ? ' ★' : ''} — {d.direccion}
                            </option>
                          ))}
                        </select>
                        <input type="text" value={citaForm.direccion_servicio}
                          onChange={e => setCitaForm(f => ({ ...f, direccion_servicio: e.target.value }))}
                          placeholder="O escribe una dirección diferente"
                          className="w-full h-9 px-4 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </>
                    ) : (
                      <input type="text" value={citaForm.direccion_servicio}
                        onChange={e => setCitaForm(f => ({ ...f, direccion_servicio: e.target.value }))}
                        placeholder="Dirección donde se realizará el servicio"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Descripción de la falla / motivo</label>
                    <textarea value={citaForm.descripcion_falla}
                      onChange={e => setCitaForm(f => ({ ...f, descripcion_falla: e.target.value }))}
                      placeholder="Describe la falla o motivo de la visita..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Valor estimado</label>
                    <input type="number" value={citaForm.valor_estimado}
                      onChange={e => setCitaForm(f => ({ ...f, valor_estimado: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {/* ── MODO BLOQUEO / EDICIÓN ── */}
              {modalMode === 'bloqueo' && (
                <div className="p-5 space-y-4">
                  {/* Técnico — solo editable en creación */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Técnico</label>
                    {!form.todos_tecnicos && (
                      <select
                        value={form.tecnicoId}
                        onChange={e => setForm(f => ({ ...f, tecnicoId: e.target.value }))}
                        disabled={!!editingEvento}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mb-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    )}
                    {!editingEvento && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          className={`relative w-11 h-6 rounded-full transition-colors ${form.todos_tecnicos ? 'bg-blue-600' : 'bg-slate-200'}`}
                          onClick={() => setForm(f => ({ ...f, todos_tecnicos: !f.todos_tecnicos }))}
                        >
                          <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.todos_tecnicos ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">Aplicar a todos los técnicos</span>
                      </label>
                    )}
                  </div>

                  {/* Tipo de evento */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-2 block">Tipo de evento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(tipoBloqueoConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        const selected = form.tipo === key;
                        return (
                          <button key={key} onClick={() => {
                            const upd: Partial<typeof form> = { tipo: key };
                            if (key === 'almuerzo') {
                              upd.todo_el_dia = false;
                              // Solo auto-rellena las horas la primera vez que se selecciona almuerzo
                              if (form.tipo !== 'almuerzo') {
                                upd.hora_inicio = '12:30';
                                upd.hora_fin = '13:00';
                              }
                              if (!form.titulo || form.titulo === 'Hora de almuerzo') upd.titulo = 'Hora de almuerzo';
                            }
                            setForm(f => ({ ...f, ...upd }));
                          }}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                            <Icon className={`h-5 w-5 ${selected ? 'text-blue-600' : cfg.color}`} />
                            <span className={`text-[10px] font-semibold ${selected ? 'text-blue-700' : 'text-slate-500'}`}>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Título</label>
                    <input type="text" value={form.titulo}
                      onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ej: Vacaciones, Capacitación AC inverter"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Descripción (opcional)</label>
                    <textarea value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Detalles adicionales..." rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fecha</label>
                    <input type="date" value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {/* Repetición — solo en creación, no en edición */}
                  {!editingEvento && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-2 block">Repetir</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { key: 'ninguna', label: 'Solo hoy' },
                          { key: 'semana', label: 'Esta semana' },
                          { key: 'mes', label: '1 mes' },
                          { key: 'semestre', label: '6 meses' },
                          { key: 'anio', label: '1 año' },
                          { key: 'siempre', label: '♾ Para siempre' },
                        ] as const).map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, repeticion: key }))}
                            className={`py-2 px-1 rounded-xl text-[10px] font-semibold border-2 transition-all ${
                              form.repeticion === key
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {form.repeticion !== 'ninguna' && (
                        <p className="text-[11px] text-blue-600 mt-1.5 flex items-center gap-1">
                          <Repeat className="h-3 w-3 shrink-0" />
                          {form.repeticion === 'siempre' ? 'Próximos 2 años · Lun–Sáb, sin festivos ni domingos' : 'Lun–Sáb, excluye domingos y festivos'}
                          {form.todos_tecnicos && tecnicos.length > 0 ? ` · ${tecnicos.length} técnicos` : ''}
                          {' · '}~{estimarEventos()} evento{estimarEventos() !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`relative w-11 h-6 rounded-full transition-colors ${form.todo_el_dia ? 'bg-blue-600' : 'bg-slate-200'}`}
                      onClick={() => setForm(f => ({ ...f, todo_el_dia: !f.todo_el_dia }))}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.todo_el_dia ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Todo el día</span>
                  </label>

                  {!form.todo_el_dia && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hora inicio</label>
                        <input type="time" value={form.hora_inicio}
                          onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hora fin</label>
                        <input type="time" value={form.hora_fin}
                          onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                onClick={() => { setShowModal(false); setEditingEvento(null); }}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={modalMode === 'cita' && !editingEvento ? handleCrearCita : handleCrear}
                disabled={saving || (modalMode === 'bloqueo' && !form.titulo.trim()) || (modalMode === 'cita' && !editingEvento && !citaForm.clienteId)}
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {saving
                  ? 'Guardando...'
                  : editingEvento
                  ? 'Guardar cambios'
                  : modalMode === 'cita'
                  ? 'Agendar cita'
                  : 'Crear evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

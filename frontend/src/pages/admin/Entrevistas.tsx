import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { getUsuarios } from '@/api/usuarios';
import { getEvaluaciones, crearEvaluacion } from '@/api/evaluaciones';
import { toast } from '@/components/shared/Toast';
import type { Usuario } from '@/types';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  Tooltip, Legend
} from 'recharts';
import { 
  ClipboardCheck, Brain, HeartHandshake, ChevronRight, ChevronLeft, 
  Save, Trash2, Info, History, TrendingUp, TrendingDown, Minus 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const KNOWLEDGE_QUESTIONS = [
  { id: 1, text: '¿Sabe identificar fallas comunes en sistemas de refrigeración?', category: 'Diagnóstico' },
  { id: 2, text: '¿Conoce el manejo adecuado de gases refrigerantes?', category: 'Seguridad' },
  { id: 3, text: '¿Sabe utilizar un multímetro para medir voltaje y amperaje?', category: 'Herramientas' },
  { id: 4, text: '¿Conoce los procedimientos de mantenimiento preventivo?', category: 'Mantenimiento' },
  { id: 5, text: '¿Sabe realizar soldaduras en tubería de cobre?', category: 'Mantenimiento' },
  { id: 6, text: '¿Conoce los esquemas eléctricos de aires acondicionados?', category: 'Sistemas' },
  { id: 7, text: '¿Sabe identificar fugas mediante presurización con nitrógeno?', category: 'Diagnóstico' },
  { id: 8, text: '¿Conoce el funcionamiento de los compresores inverter?', category: 'Sistemas' },
  { id: 9, text: '¿Sabe realizar limpieza de condensadores y evaporadores?', category: 'Mantenimiento' },
  { id: 10, text: '¿Conoce las normas de seguridad para trabajos en alturas?', category: 'Seguridad' },
  { id: 11, text: '¿Sabe programar termostatos digitales?', category: 'Sistemas' },
  { id: 12, text: '¿Conoce el ciclo básico de refrigeración?', category: 'Diagnóstico' },
  { id: 13, text: '¿Sabe realizar el vacío de un sistema antes de la carga?', category: 'Herramientas' },
  { id: 14, text: '¿Conoce el uso de bombas de vacío y manómetros?', category: 'Herramientas' },
  { id: 15, text: '¿Sabe diagnosticar fallas en placas electrónicas básicas?', category: 'Diagnóstico' },
];

const SERVICE_QUESTIONS = [
  { id: 1, text: '¿Saluda cordialmente al cliente al llegar?', category: 'Protocolo' },
  { id: 2, text: '¿Explica claramente el diagnóstico al cliente?', category: 'Comunicación' },
  { id: 3, text: '¿Utiliza un lenguaje profesional y respetuoso?', category: 'Comunicación' },
  { id: 4, text: '¿Mantiene el área de trabajo limpia y ordenada?', category: 'Puntualidad' },
  { id: 5, text: '¿Es puntual con las citas programadas?', category: 'Puntualidad' },
  { id: 6, text: '¿Sabe manejar clientes difíciles o molestos?', category: 'Conflictos' },
  { id: 7, text: '¿Ofrece recomendaciones adicionales al cliente?', category: 'Fidelización' },
  { id: 8, text: '¿Verifica la satisfacción del cliente antes de retirarse?', category: 'Fidelización' },
  { id: 9, text: '¿Porta el uniforme y carnet de identificación correctamente?', category: 'Protocolo' },
  { id: 10, text: '¿Explica los costos y garantía del servicio?', category: 'Conflictos' },
  { id: 11, text: '¿Responde de manera asertiva a las dudas del cliente?', category: 'Comunicación' },
  { id: 12, text: '¿Sigue el protocolo de bioseguridad si aplica?', category: 'Protocolo' },
  { id: 13, text: '¿Reporta cualquier novedad de manera inmediata?', category: 'Puntualidad' },
  { id: 14, text: '¿Pide permiso antes de ingresar a áreas privadas?', category: 'Conflictos' },
  { id: 15, text: '¿Agradece al cliente por preferir el servicio?', category: 'Fidelización' },
];

export const Entrevistas = () => {
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState('');
  const [activeTab, setActiveTab] = useState<'conocimiento' | 'servicio'>('conocimiento');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [evaluacionesAnteriores, setEvaluacionesAnteriores] = useState<any[]>([]);
  const [evaluacionComparar, setEvaluacionComparar] = useState<any | null>(null);

  useEffect(() => {
    const fetchTecnicos = async () => {
      try {
        const { data: res } = await getUsuarios({ rol: 'tecnico' });
        setTecnicos(res.data);
      } catch { toast.error('Error cargando técnicos'); }
    };
    fetchTecnicos();
  }, []);

  useEffect(() => {
    if (selectedTecnico) {
      const fetchHistory = async () => {
        try {
          const { data: res } = await getEvaluaciones({ tecnicoId: selectedTecnico });
          setEvaluacionesAnteriores(res.data);
          // Si hay una anterior, seleccionamos la más reciente para comparar por defecto
          if (res.data.length > 0) {
            setEvaluacionComparar(res.data[0]);
          } else {
            setEvaluacionComparar(null);
          }
        } catch { toast.error('Error cargando historial'); }
      };
      fetchHistory();
    } else {
      setEvaluacionesAnteriores([]);
      setEvaluacionComparar(null);
    }
  }, [selectedTecnico]);

  const handleScoreChange = (qId: number, type: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [`${type}_${qId}`]: value
    }));
  };

  const calculateCategoryAverages = (questions: typeof KNOWLEDGE_QUESTIONS, type: string, currentScores: Record<string, number>, baselineScores?: any) => {
    const categories: Record<string, { total: number, count: number, baselineTotal: number }> = {};
    questions.forEach(q => {
      const score = currentScores[`${type}_${q.id}`] || 0;
      const baselineScore = baselineScores ? baselineScores[q.id] || 0 : 0;
      
      if (!categories[q.category]) {
        categories[q.category] = { total: 0, count: 0, baselineTotal: 0 };
      }
      categories[q.category].total += score;
      categories[q.category].baselineTotal += baselineScore;
      categories[q.category].count += 1;
    });

    return Object.keys(categories).map(cat => ({
      subject: cat,
      A: (categories[cat].total / categories[cat].count) * 10,
      B: baselineScores ? (categories[cat].baselineTotal / categories[cat].count) * 10 : undefined,
      fullMark: 100
    }));
  };

  const knowledgeData = calculateCategoryAverages(
    KNOWLEDGE_QUESTIONS, 
    'conocimiento', 
    scores, 
    evaluacionComparar?.conocimiento
  );
  
  const serviceData = calculateCategoryAverages(
    SERVICE_QUESTIONS, 
    'servicio', 
    scores, 
    evaluacionComparar?.servicio
  );

  const getAnalysis = () => {
    const kAvg = knowledgeData.reduce((acc, curr) => acc + curr.A, 0) / knowledgeData.length;
    const sAvg = serviceData.reduce((acc, curr) => acc + curr.A, 0) / serviceData.length;
    const globalAvg = (kAvg + sAvg) / 2;

    let baseKAvg = 0;
    let baseSAvg = 0;
    if (evaluacionComparar) {
      baseKAvg = evaluacionComparar.promedio_k;
      baseSAvg = evaluacionComparar.promedio_s;
    }

    const improvementK = evaluacionComparar ? kAvg - baseKAvg : 0;
    const improvementS = evaluacionComparar ? sAvg - baseSAvg : 0;

    const kStrong = knowledgeData.filter(d => d.A >= 70).map(d => d.subject);
    const kWeak = knowledgeData.filter(d => d.A < 50).map(d => d.subject);
    const kMid = knowledgeData.filter(d => d.A >= 50 && d.A < 70).map(d => d.subject);
    const sStrong = serviceData.filter(d => d.A >= 70).map(d => d.subject);
    const sWeak = serviceData.filter(d => d.A < 50).map(d => d.subject);
    const sMid = serviceData.filter(d => d.A >= 50 && d.A < 70).map(d => d.subject);

    const tecnicoName = tecnicos.find(t => t.id === selectedTecnico)?.nombre || 'El técnico';

    let parts: string[] = [];

    // 1. Classification
    let nivel = '';
    if (globalAvg >= 80) nivel = 'Perfil avanzado';
    else if (globalAvg >= 65) nivel = 'Perfil intermedio con potencial de crecimiento';
    else if (globalAvg >= 45) nivel = 'Perfil en etapa de formación';
    else nivel = 'Perfil que requiere capacitación prioritaria';

    parts.push(`CLASIFICACIÓN: ${nivel} (Score global: ${globalAvg.toFixed(1)}%).`);

    // 2. Knowledge analysis
    parts.push(`\nCONOCIMIENTO TÉCNICO (${kAvg.toFixed(1)}%):`);
    if (kStrong.length > 0) {
      parts.push(`${tecnicoName} demuestra buen dominio en ${kStrong.join(', ')}. Estas son competencias que puede aprovechar para mentorear a compañeros o asumir servicios de mayor complejidad.`);
    }
    if (kMid.length > 0) {
      parts.push(`En las áreas de ${kMid.join(', ')} muestra un conocimiento aceptable pero con margen de mejora. Se recomienda práctica supervisada y estudio complementario para consolidar estas habilidades.`);
    }
    if (kWeak.length > 0) {
      parts.push(`Las áreas de ${kWeak.join(', ')} son puntos críticos que requieren atención inmediata. Se sugiere un plan de capacitación enfocado con acompañamiento de un técnico senior antes de asignar servicios que involucren estas competencias.`);
    }
    if (kWeak.length === 0 && kMid.length === 0) {
      parts.push('No se detectan áreas críticas en conocimiento técnico. El nivel es sólido en todas las categorías evaluadas.');
    }

    // 3. Service analysis
    parts.push(`\nSERVICIO AL CLIENTE (${sAvg.toFixed(1)}%):`);
    if (sStrong.length > 0) {
      parts.push(`Se destaca positivamente en ${sStrong.join(', ')}. Esto refleja buena actitud profesional y genera confianza en los clientes.`);
    }
    if (sMid.length > 0) {
      parts.push(`En ${sMid.join(', ')} tiene un desempeño regular. Se recomienda reforzar estos aspectos con role-playing o acompañamiento en los primeros servicios.`);
    }
    if (sWeak.length > 0) {
      parts.push(`Necesita mejorar significativamente en ${sWeak.join(', ')}. Estas debilidades pueden afectar la percepción del cliente y la calificación del servicio. Se sugiere capacitación en habilidades blandas y protocolos de atención.`);
    }
    if (sWeak.length === 0 && sMid.length === 0) {
      parts.push('El trato al cliente es ejemplar en todas las categorías. Este técnico es un referente para el equipo.');
    }

    // 4. Comparative evolution
    if (evaluacionComparar) {
      const totalImprovement = (improvementK + improvementS) / 2;
      parts.push(`\nEVOLUCIÓN vs evaluación del ${format(new Date(evaluacionComparar.fecha), "d 'de' MMMM yyyy", { locale: es })}:`);

      if (totalImprovement > 15) {
        parts.push(`Mejora sobresaliente (+${totalImprovement.toFixed(1)}%). ${tecnicoName} ha demostrado un progreso notable que evidencia compromiso con su desarrollo profesional. Se recomienda reconocimiento formal y considerar para ascenso o asignación de servicios de mayor responsabilidad.`);
      } else if (totalImprovement > 5) {
        parts.push(`Mejora progresiva (+${totalImprovement.toFixed(1)}%). Se observa una evolución positiva y sostenida. El plan de formación está dando resultados. Mantener el acompañamiento actual y reforzar las áreas que aún están por debajo del 70%.`);
      } else if (totalImprovement > -5) {
        parts.push(`Desempeño estable (${totalImprovement >= 0 ? '+' : ''}${totalImprovement.toFixed(1)}%). No hay cambios significativos respecto a la evaluación anterior. Esto puede indicar que el técnico ha alcanzado un techo con los recursos actuales de capacitación, o que necesita un nuevo enfoque de aprendizaje.`);
      } else {
        parts.push(`Alerta de descenso (${totalImprovement.toFixed(1)}%). El rendimiento ha disminuido respecto a la evaluación anterior. Es importante tener una conversación directa para identificar posibles causas: desmotivación, problemas personales, carga laboral excesiva, o falta de herramientas adecuadas.`);
      }

      if (improvementK > 5 && improvementS < -5) {
        parts.push('Nota: Ha mejorado técnicamente pero ha bajado en servicio al cliente. Esto puede indicar que se está enfocando solo en lo técnico descuidando la relación con el cliente.');
      } else if (improvementS > 5 && improvementK < -5) {
        parts.push('Nota: Ha mejorado en servicio al cliente pero bajó en conocimiento técnico. Verificar si está evitando servicios complejos o si necesita actualización técnica.');
      }
    }

    // 5. Recommendations
    parts.push('\nRECOMENDACIONES:');
    const recs: string[] = [];
    if (kWeak.length > 0) recs.push(`Capacitación técnica prioritaria en: ${kWeak.join(', ')}`);
    if (sWeak.length > 0) recs.push(`Taller de habilidades blandas enfocado en: ${sWeak.join(', ')}`);
    if (kAvg < 60) recs.push('Asignar un técnico senior como mentor durante al menos 1 mes');
    if (sAvg < 60) recs.push('Acompañamiento en los próximos 5 servicios para observar trato al cliente');
    if (globalAvg >= 75) recs.push('Considerar para servicios de mayor valor y clientes corporativos');
    if (globalAvg >= 85) recs.push('Candidato para liderar equipo o capacitar nuevos técnicos');
    if (kMid.length > 0) recs.push(`Práctica supervisada en: ${kMid.join(', ')}`);
    if (recs.length === 0) recs.push('Mantener el nivel actual. Programar siguiente evaluación en 3 meses.');
    parts.push(recs.map((r, i) => `${i + 1}. ${r}`).join('\n'));

    const analysis = parts.join('\n');

    return { kAvg, sAvg, improvementK, improvementS, analysis };
  };

  const handleFinalize = async () => {
    if (!selectedTecnico) return toast.error('Selecciona un técnico');
    
    const result = getAnalysis();
    
    // Transform scores for storage
    const knowledgeScores: Record<number, number> = {};
    const serviceScores: Record<number, number> = {};
    
    KNOWLEDGE_QUESTIONS.forEach(q => {
      knowledgeScores[q.id] = scores[`conocimiento_${q.id}`] || 0;
    });
    SERVICE_QUESTIONS.forEach(q => {
      serviceScores[q.id] = scores[`servicio_${q.id}`] || 0;
    });

    try {
      await crearEvaluacion({
        tecnicoId: selectedTecnico,
        conocimiento: knowledgeScores,
        servicio: serviceScores,
        promedio_k: result.kAvg,
        promedio_s: result.sAvg,
        analisis: result.analysis
      });
      setIsCompleted(true);
      toast.success('Evaluación guardada correctamente');
    } catch {
      toast.error('Error al guardar la evaluación');
    }
  };

  const reset = () => {
    setScores({});
    setIsCompleted(false);
  };

  const result = getAnalysis();

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            Evaluación y Seguimiento
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitorea la evolución de las competencias técnicas y humanas</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Técnico/Candidato</label>
             <Select
                value={selectedTecnico}
                onChange={(e) => setSelectedTecnico(e.target.value)}
                className="w-full md:w-64 rounded-xl"
              >
                <option value="">Seleccionar técnico</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </Select>
          </div>
          
          {evaluacionesAnteriores.length > 0 && !isCompleted && (
            <div className="flex flex-col gap-1">
               <label className="text-[10px] font-bold text-blue-400 uppercase ml-2 flex items-center gap-1">
                 <History className="h-2.5 w-2.5" /> Comparar con
               </label>
               <Select
                  value={evaluacionComparar?.id || ''}
                  onChange={(e) => setEvaluacionComparar(evaluacionesAnteriores.find(ev => ev.id === e.target.value))}
                  className="w-full md:w-56 rounded-xl border-blue-100 bg-blue-50/30"
                >
                  <option value="">Sin comparación</option>
                  {evaluacionesAnteriores.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {format(new Date(ev.fecha), 'dd/MM/yyyy')} - Avg: {((ev.promedio_k + ev.promedio_s)/2).toFixed(1)}%
                    </option>
                  ))}
                </Select>
            </div>
          )}
        </div>
      </div>

      {!isCompleted ? (
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
              <button onClick={() => setActiveTab('conocimiento')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'conocimiento' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                <Brain className="h-4 w-4" /> Conocimiento
              </button>
              <button onClick={() => setActiveTab('servicio')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'servicio' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                <HeartHandshake className="h-4 w-4" /> Servicio
              </button>
            </div>

            <Card className="p-6 rounded-3xl border-slate-100 shadow-sm overflow-hidden">
              <div className="space-y-4">
                {(activeTab === 'conocimiento' ? KNOWLEDGE_QUESTIONS : SERVICE_QUESTIONS).map((q, idx) => (
                  <div key={q.id} className="group flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <span className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[15px] font-medium text-slate-700">{q.text}</p>
                        <div className="flex items-center gap-2">
                           {evaluacionComparar && (
                             <span className="text-[10px] font-bold text-blue-400 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                               Anterior: {evaluacionComparar[activeTab][q.id] || 0}
                             </span>
                           )}
                           <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full">
                            {q.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                          <button
                            key={v}
                            onClick={() => handleScoreChange(q.id, activeTab, v)}
                            className={`h-8 w-8 rounded-lg text-xs font-bold transition-all border ${
                              scores[`${activeTab}_${q.id}`] === v
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200 hover:text-blue-500'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                {activeTab === 'conocimiento' ? (
                  <>
                    <div />
                    <Button onClick={() => setActiveTab('servicio')} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6">
                      Siguiente: Servicio <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setActiveTab('conocimiento')} className="text-slate-500 rounded-xl">
                      <ChevronLeft className="h-4 w-4 mr-2" /> Atrás
                    </Button>
                    <Button
                      onClick={handleFinalize}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8"
                    >
                      <Save className="h-4 w-4 mr-2" /> Guardar y Comparar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 rounded-3xl border-slate-100 sticky top-24">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Diferencial de Mejora
              </h3>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conocimiento Técnico</p>
                    {evaluacionComparar && (
                      <div className={`flex items-center gap-1 text-xs font-bold ${result.improvementK > 0 ? 'text-emerald-500' : result.improvementK < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {result.improvementK > 0 ? <TrendingUp className="h-3 w-3" /> : result.improvementK < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {result.improvementK > 0 ? '+' : ''}{result.improvementK.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="60%" data={knowledgeData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <Radar name="Actual" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.4} />
                        {evaluacionComparar && <Radar name="Anterior" dataKey="B" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.2} strokeDasharray="4 4" />}
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servicio al Cliente</p>
                    {evaluacionComparar && (
                      <div className={`flex items-center gap-1 text-xs font-bold ${result.improvementS > 0 ? 'text-emerald-500' : result.improvementS < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {result.improvementS > 0 ? <TrendingUp className="h-3 w-3" /> : result.improvementS < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {result.improvementS > 0 ? '+' : ''}{result.improvementS.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="60%" data={serviceData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <Radar name="Actual" dataKey="A" stroke="#059669" fill="#10b981" fillOpacity={0.4} />
                        {evaluacionComparar && <Radar name="Anterior" dataKey="B" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.2} strokeDasharray="4 4" />}
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Real-time Analysis */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm">
                  <Brain className="h-4 w-4 text-blue-500" /> Análisis en Tiempo Real
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-blue-50/50 p-4 rounded-2xl border border-blue-50 whitespace-pre-line">
                  {result.analysis || "Responde las preguntas para generar el análisis."}
                </p>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
          <Card className="p-8 rounded-[2rem] border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-900/5 border relative overflow-hidden">
             {/* Comparison Badge */}
             {evaluacionComparar && (
               <div className="absolute top-6 right-6">
                 <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl font-bold flex items-center gap-2 border border-emerald-200">
                    <TrendingUp className="h-4 w-4" />
                    + {((result.improvementK + result.improvementS)/2).toFixed(1)}% de Mejora
                 </div>
               </div>
             )}

            <h3 className="font-bold text-blue-900 text-xl mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6" />
              Análisis Comparativo de Evolución
            </h3>
            <p className="text-blue-800 leading-relaxed font-medium max-w-3xl whitespace-pre-line text-sm">
              {result.analysis}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
               <div className="bg-white/60 backdrop-blur-sm p-5 rounded-3xl border border-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Score Conocimiento</p>
                  <p className="text-3xl font-black text-blue-600">{result.kAvg.toFixed(1)}%</p>
                  {evaluacionComparar && (
                    <p className={`text-xs font-bold mt-1 ${result.improvementK >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {result.improvementK >= 0 ? '↑' : '↓'} {Math.abs(result.improvementK).toFixed(1)}% vs anterior
                    </p>
                  )}
               </div>
               <div className="bg-white/60 backdrop-blur-sm p-5 rounded-3xl border border-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Score Servicio</p>
                  <p className="text-3xl font-black text-emerald-600">{result.sAvg.toFixed(1)}%</p>
                  {evaluacionComparar && (
                    <p className={`text-xs font-bold mt-1 ${result.improvementS >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {result.improvementS >= 0 ? '↑' : '↓'} {Math.abs(result.improvementS).toFixed(1)}% vs anterior
                    </p>
                  )}
               </div>
               <div className="bg-white/60 backdrop-blur-sm p-5 rounded-3xl border border-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Puntos Críticos</p>
                  <div className="flex gap-1 mt-2">
                    {knowledgeData.filter(d => d.A < 60).map(d => (
                      <span key={d.subject} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg">{d.subject}</span>
                    ))}
                    {knowledgeData.filter(d => d.A < 60).length === 0 && <span className="text-[10px] text-emerald-600 font-bold">Ninguno detectado</span>}
                  </div>
               </div>
               <div className="bg-white/60 backdrop-blur-sm p-5 rounded-3xl border border-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado de Meta</p>
                  <div className="mt-2 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(result.kAvg + result.sAvg)/2}%` }} />
                  </div>
                  <p className="text-[10px] text-indigo-500 font-bold mt-2">Próxima evaluación en 3 meses</p>
               </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 font-bold shadow-lg shadow-blue-600/20">
                Imprimir Reporte Evolutivo
              </Button>
              <Button variant="outline" className="rounded-xl px-8 h-12 font-bold border-blue-200 text-blue-700 bg-white/50" onClick={reset}>
                Nueva Evaluación
              </Button>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-8">
             {/* Final Comparison Knowledge */}
             <Card className="p-6 rounded-[2rem] border-slate-100 shadow-sm bg-white">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800">Comparativa Radar: Conocimiento</h3>
                   <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-500" /> Actual</div>
                      <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-300" /> Anterior</div>
                   </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={knowledgeData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Radar name="Actual" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} dot={{ r: 3 }} />
                      {evaluacionComparar && <Radar name="Anterior" dataKey="B" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.2} strokeDasharray="4 4" />}
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
             </Card>

             {/* Final Comparison Service */}
             <Card className="p-6 rounded-[2rem] border-slate-100 shadow-sm bg-white">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800">Comparativa Radar: Servicio</h3>
                   <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Actual</div>
                      <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-300" /> Anterior</div>
                   </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={serviceData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Radar name="Actual" dataKey="A" stroke="#059669" fill="#10b981" fillOpacity={0.5} dot={{ r: 3 }} />
                      {evaluacionComparar && <Radar name="Anterior" dataKey="B" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.2} strokeDasharray="4 4" />}
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
             </Card>
          </div>
        </div>
      )}
    </div>
  );
};

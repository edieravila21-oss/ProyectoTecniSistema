require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  await prisma.eventoServicio.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.fotoServicio.deleteMany();
  await prisma.firmaCliente.deleteMany();
  await prisma.mensajeWhatsApp.deleteMany();
  await prisma.recordatorioMantenimiento.deleteMany();
  await prisma.metrica.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.equipo.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.configuracion.deleteMany();
  await prisma.configuracionSLA.deleteMany();

  const hashedAdminPin = await bcrypt.hash('1234', 10);
  const hashedTecnicoPin = await bcrypt.hash('5678', 10);

  const admin = await prisma.usuario.create({
    data: {
      nombre: 'Carlos Administrador',
      email: 'admin@techserv.com',
      password: hashedAdminPin,
      rol: 'admin',
      telefono: '573001234567',
      especialidad: 'ambos',
    },
  });

  const tecnicos = await Promise.all([
    prisma.usuario.create({
      data: {
        nombre: 'Miguel Torres',
        email: 'miguel@techserv.com',
        password: hashedTecnicoPin,
        rol: 'tecnico',
        telefono: '573101112233',
        especialidad: 'aires',
      },
    }),
    prisma.usuario.create({
      data: {
        nombre: 'Andrés Ramírez',
        email: 'andres@techserv.com',
        password: hashedTecnicoPin,
        rol: 'tecnico',
        telefono: '573204445566',
        especialidad: 'neveras',
      },
    }),
    prisma.usuario.create({
      data: {
        nombre: 'Luis Herrera',
        email: 'luis@techserv.com',
        password: hashedTecnicoPin,
        rol: 'tecnico',
        telefono: '573157778899',
        especialidad: 'ambos',
      },
    }),
  ]);

  const clientesData = [
    { nombre: 'María García', telefono: '573001111111', email: 'maria@email.com', direccion_principal: 'Calle 80 #45-12, Barranquilla' },
    { nombre: 'Pedro Martínez', telefono: '573002222222', email: 'pedro@email.com', direccion_principal: 'Carrera 50 #72-30, Barranquilla' },
    { nombre: 'Ana López', telefono: '573003333333', email: 'ana@email.com', direccion_principal: 'Calle 93 #18-45, Barranquilla' },
    { nombre: 'José Rodríguez', telefono: '573004444444', direccion_principal: 'Carrera 43 #85-60, Barranquilla' },
    { nombre: 'Laura Sánchez', telefono: '573005555555', email: 'laura@email.com', direccion_principal: 'Calle 76 #52-15, Barranquilla' },
    { nombre: 'Diego Hernández', telefono: '573006666666', direccion_principal: 'Carrera 38 #64-22, Barranquilla' },
    { nombre: 'Carmen Díaz', telefono: '573007777777', email: 'carmen@email.com', direccion_principal: 'Calle 45 #30-18, Barranquilla' },
    { nombre: 'Roberto Vargas', telefono: '573008888888', direccion_principal: 'Carrera 54 #70-40, Barranquilla' },
  ];

  const clientes = await Promise.all(
    clientesData.map((c) => prisma.cliente.create({ data: c }))
  );

  const equiposData = [
    { clienteId: clientes[0].id, tipo: 'aire_acondicionado', marca: 'Samsung', modelo: 'AR12TSHQAWKNCO', serial: 'SAM001' },
    { clienteId: clientes[0].id, tipo: 'nevera', marca: 'LG', modelo: 'GT29BPPK', serial: 'LG001' },
    { clienteId: clientes[1].id, tipo: 'aire_acondicionado', marca: 'LG', modelo: 'S4-Q12JA3AD', serial: 'LG002' },
    { clienteId: clientes[2].id, tipo: 'nevera', marca: 'Whirlpool', modelo: 'WRM56AKBPE', serial: 'WH001' },
    { clienteId: clientes[3].id, tipo: 'aire_acondicionado', marca: 'Carrier', modelo: '42TAVQA121', serial: 'CAR001' },
    { clienteId: clientes[4].id, tipo: 'nevera', marca: 'Samsung', modelo: 'RT38K5930SL', serial: 'SAM002' },
    { clienteId: clientes[5].id, tipo: 'aire_acondicionado', marca: 'Midea', modelo: 'MSAGIC-12H', serial: 'MID001' },
    { clienteId: clientes[6].id, tipo: 'nevera', marca: 'Haceb', modelo: 'AREZZO 395L', serial: 'HAC001' },
    { clienteId: clientes[7].id, tipo: 'aire_acondicionado', marca: 'Daikin', modelo: 'FTX25', serial: 'DAI001' },
    { clienteId: clientes[7].id, tipo: 'nevera', marca: 'Mabe', modelo: 'RMA300FJMRX0', serial: 'MAB001' },
  ];

  const equipos = await Promise.all(
    equiposData.map((e) => prisma.equipo.create({ data: e }))
  );

  const { getChecklistPorTipo } = require('../src/services/checklistService');
  const today = new Date();
  const estados = ['pendiente', 'asignado', 'en_camino', 'en_servicio', 'completado', 'completado', 'completado', 'completado', 'cancelado', 'pendiente', 'asignado', 'completado', 'completado', 'en_servicio', 'asignado'];
  const fallas = [
    'No enfría correctamente', 'Hace ruido extraño', 'No enciende', 'Fuga de agua',
    'Mal olor', 'No congela', 'Goteo excesivo', 'Control remoto no responde',
    'Compresor no arranca', 'Filtra agua por la base', 'No mantiene temperatura',
    'Hace hielo en exceso', 'Consume mucha energía', 'Vibra demasiado', 'No seca ropa',
  ];

  for (let i = 0; i < 15; i++) {
    const equipo = equipos[i % equipos.length];
    const tecnico = tecnicos[i % tecnicos.length];
    const cliente = clientes[i % clientes.length];
    const estado = estados[i];
    const fechaProg = new Date(today);
    fechaProg.setDate(today.getDate() - 7 + i);

    const checklist = getChecklistPorTipo(equipo.tipo);

    const servicio = await prisma.servicio.create({
      data: {
        clienteId: cliente.id,
        equipoId: equipo.id,
        tecnicoId: estado !== 'pendiente' ? tecnico.id : null,
        estado,
        descripcion_falla: fallas[i],
        fecha_programada: fechaProg,
        hora_inicio: `${8 + (i % 4) * 2}:00`,
        hora_fin: `${10 + (i % 4) * 2}:00`,
        direccion_servicio: cliente.direccion_principal,
        valor_estimado: 40000,
        valor_final: estado === 'completado' ? 80000 + (i * 15000) : null,
        metodo_pago: estado === 'completado' ? (i % 2 === 0 ? 'efectivo' : 'transferencia') : null,
        calificacion_cliente: estado === 'completado' ? Math.min(5, 3 + (i % 3)) : null,
        notas_admin: i % 3 === 0 ? 'Cliente frecuente, dar prioridad' : null,
        notas_tecnico: estado === 'completado' ? 'Servicio realizado sin novedad' : null,
        origen: i % 4 === 0 ? 'whatsapp' : 'manual',
        fecha_en_camino: ['en_camino', 'en_servicio', 'completado'].includes(estado) ? fechaProg : null,
        fecha_inicio_real: ['en_servicio', 'completado'].includes(estado) ? new Date(fechaProg.getTime() + 900000) : null,
        fecha_fin_real: estado === 'completado' ? new Date(fechaProg.getTime() + 2 * 3600000) : null,
        checklist: {
          create: checklist.map((item, idx) => ({
            ...item,
            completado: estado === 'completado' || (estado === 'en_servicio' && idx < checklist.length / 2),
            completado_at: estado === 'completado' ? fechaProg : null,
          })),
        },
        eventos: {
          create: [
            { tipo: 'creado', descripcion: 'Servicio creado', createdAt: new Date(fechaProg.getTime() - 86400000) },
            ...(estado !== 'pendiente' ? [{ tipo: 'asignado', descripcion: `Asignado a ${tecnico.nombre}`, usuarioId: admin.id, createdAt: new Date(fechaProg.getTime() - 43200000) }] : []),
            ...(estado === 'completado' ? [
              { tipo: 'en_camino', descripcion: 'Técnico en camino', usuarioId: tecnico.id, createdAt: fechaProg },
              { tipo: 'en_servicio', descripcion: 'Servicio iniciado', usuarioId: tecnico.id, createdAt: new Date(fechaProg.getTime() + 900000) },
              { tipo: 'completado', descripcion: 'Servicio completado', usuarioId: tecnico.id, createdAt: new Date(fechaProg.getTime() + 7200000) },
            ] : []),
          ],
        },
      },
    });
  }

  await prisma.configuracion.create({
    data: {
      nombre_negocio: 'TechServ Pro',
      telefono_negocio: '573001234567',
      direccion_negocio: 'Calle 72 #54-30, Barranquilla',
      hora_inicio: '07:00',
      hora_fin: '20:00',
      valor_diagnostico: 40000,
      mensaje_bienvenida: 'Bienvenido a TechServ Pro, servicio técnico especializado en aires y neveras.',
      meses_recordatorio: 6,
    },
  });

  // Configuración de SLAs por tipo de servicio
  await prisma.configuracionSLA.createMany({
    data: [
      {
        tipo_servicio: 'diagnostico',
        max_tiempo_camino_min: 15,
        max_tiempo_ejecucion_min: 30,
        descripcion: 'Diagnóstico rápido del equipo',
      },
      {
        tipo_servicio: 'mantenimiento',
        max_tiempo_camino_min: 15,
        max_tiempo_ejecucion_min: 45,
        descripcion: 'Mantenimiento preventivo y limpieza',
      },
      {
        tipo_servicio: 'reparacion',
        max_tiempo_camino_min: 15,
        max_tiempo_ejecucion_min: 120,
        descripcion: 'Reparación de componentes',
      },
      {
        tipo_servicio: 'instalacion',
        max_tiempo_camino_min: 15,
        max_tiempo_ejecucion_min: 180,
        descripcion: 'Instalación de nuevo equipo',
      },
    ],
  });

  const metricasData = [];
  for (let i = 30; i >= 0; i--) {
    const fecha = new Date(today);
    fecha.setDate(today.getDate() - i);
    fecha.setHours(0, 0, 0, 0);
    metricasData.push({
      fecha,
      total_servicios: Math.floor(Math.random() * 6) + 2,
      completados: Math.floor(Math.random() * 4) + 1,
      cancelados: Math.floor(Math.random() * 2),
      pendientes: Math.floor(Math.random() * 3),
      ingresos_del_dia: (Math.floor(Math.random() * 5) + 1) * 80000,
      tiempo_promedio_minutos: Math.floor(Math.random() * 60) + 60,
      mensajes_whatsapp_recibidos: Math.floor(Math.random() * 10) + 2,
      mensajes_resueltos_bot: Math.floor(Math.random() * 8) + 1,
      calificacion_promedio: 3.5 + Math.random() * 1.5,
    });
  }

  for (const m of metricasData) {
    await prisma.metrica.create({ data: m });
  }

  console.log('Seed completado!');
  console.log('Admin: admin@techserv.com / PIN: 1234');
  console.log('Técnicos: miguel@techserv.com, andres@techserv.com, luis@techserv.com / PIN: 5678');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

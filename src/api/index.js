const BASE_URL = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body) {
  const token = getToken();
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (nombre, email, password, role) => request('POST', '/auth/register', { nombre, email, password, role }),
  me: () => request('GET', '/auth/me'),

  // Torneos
  getTorneos: () => request('GET', '/torneos'),
  getTorneo: (id) => request('GET', `/torneos/${id}`),
  createTorneo: (data) => request('POST', '/torneos', data),
  addJugadorTorneo: (torneoId, userId) => request('POST', `/torneos/${torneoId}/jugadores`, { user_id: userId }),
  removeJugadorTorneo: (torneoId, userId) => request('DELETE', `/torneos/${torneoId}/jugadores/${userId}`),
  getTablaGeneral: (torneoId) => request('GET', `/torneos/${torneoId}/tabla`),
  getTablaMensual: (torneoId, mes, anio) => request('GET', `/torneos/${torneoId}/tabla-mensual?mes=${mes}&anio=${anio}`),
  getCierre: (torneoId, mes, anio) => request('GET', `/torneos/${torneoId}/tabla-mensual-cierre?mes=${mes}&anio=${anio}`),
  saveCierre: (torneoId, data) => request('PUT', `/torneos/${torneoId}/tabla-mensual-cierre`, data),
  recalcularTabla: (torneoId) => request('POST', `/torneos/${torneoId}/recalcular-tabla`),
  getH2H: (torneoId, userId) => request('GET', `/torneos/${torneoId}/h2h/${userId}`),
  getTotalesBloque: (torneoId) => request('GET', `/torneos/${torneoId}/totales-bloque`),

  // Usuarios
  getUsuarios: () => request('GET', '/usuarios'),
  toggleRolUsuario: (id) => request('PATCH', `/usuarios/${id}/role`),
  generarResetLink: (id) => request('POST', `/usuarios/${id}/reset-link`),
  resetPassword: (token, password) => request('POST', '/auth/reset-password', { token, password }),

  // Fechas
  getFechas: (torneoId) => request('GET', `/fechas/torneo/${torneoId}`),
  getFecha: (id) => request('GET', `/fechas/${id}`),
  createFecha: (data) => request('POST', '/fechas', data),
  updateFecha: (id, data) => request('PATCH', `/fechas/${id}`, data),
  deleteFecha: (id) => request('DELETE', `/fechas/${id}`),
  recalcularFecha: (id) => request('POST', `/fechas/${id}/recalcular`),

  // Eventos
  getEventos: (fechaId) => request('GET', `/eventos/fecha/${fechaId}`),
  createEvento: (data) => request('POST', '/eventos', data),
  updateEvento: (id, data) => request('PATCH', `/eventos/${id}`, data),
  bulkEventos: (fechaId, eventos) => request('PUT', `/eventos/fecha/${fechaId}/bulk`, { eventos }),
  bulkResultados: (fechaId, resultados) => request('PUT', `/eventos/fecha/${fechaId}/resultados`, { resultados }),

  // Pronósticos
  getPronosticos: (fechaId, userId) =>
    request('GET', `/pronosticos/fecha/${fechaId}${userId ? `?user_id=${userId}` : ''}`),
  savePronostico: (data) => request('POST', '/pronosticos', data),
  bulkPronosticos: (fechaId, pronosticos) => request('POST', `/pronosticos/fecha/${fechaId}/bulk`, { pronosticos }),
  getEstadoPronosticos: (fechaId) => request('GET', `/pronosticos/fecha/${fechaId}/estado`),
  // Admin: ver todos los pronósticos de la fecha (para corregir preguntas abiertas)
  getPronosticosAdmin: (fechaId) => request('GET', `/pronosticos/fecha/${fechaId}/todos`),
  // Admin: asignar puntaje manual a un pronóstico de pregunta abierta
  setPuntosManual: (pronoId, puntos) => request('PATCH', `/pronosticos/${pronoId}/puntos`, { puntos }),

  // Cruces
  getCruces: (fechaId) => request('GET', `/cruces/fecha/${fechaId}`),
  getMiCruce: (fechaId) => request('GET', `/cruces/fecha/${fechaId}/mio`),
  getMisCruces: (torneoId) => request('GET', `/cruces/torneo/${torneoId}/mios`),
  setFixture: (fechaId, cruces) => request('POST', `/cruces/fecha/${fechaId}`, { cruces }),
  recalcularCruces: (fechaId) => request('POST', `/cruces/fecha/${fechaId}/recalcular`),
  // Cruces modo resumido
  getCrucesResumido: (fechaId) => request('GET', `/cruces/fecha/${fechaId}/resumido`),
  guardarResumido: (fechaId, resultados) => request('POST', `/cruces/fecha/${fechaId}/resumido`, { resultados }),

  // GDT — Catálogo de equipos (admin)
  gdtGetCatalogo: () => request('GET', '/gdt/catalogo'),
  gdtAddCatalogo: (nombre, pais) => request('POST', '/gdt/catalogo', { nombre, pais }),
  gdtDeleteCatalogo: (id) => request('DELETE', `/gdt/catalogo/${id}`),

  // GDT — Jugadores
  gdtBuscarJugador: (nombre, equipoId) =>
    request('GET', `/gdt/jugadores/buscar?nombre=${encodeURIComponent(nombre)}${equipoId ? `&equipo_id=${equipoId}` : ''}`),
  gdtGetEstadoJugadores: () => request('GET', '/gdt/jugadores/estado'),
  gdtGetTodosJugadores: () => request('GET', '/gdt/jugadores/todos'),             // admin
  gdtEditarJugador: (id, data) => request('PATCH', `/gdt/jugadores/${id}`, data), // admin
  gdtEliminarJugador: (id) => request('DELETE', `/gdt/jugadores/${id}`),          // admin
  gdtBulkPais: (pais) => request('POST', '/gdt/jugadores/bulk-pais', { pais }),   // admin
  gdtGetDuplicados: () => request('GET', '/gdt/jugadores/duplicados'),            // admin
  gdtMergeJugadores: (keepId, mergeId) => request('POST', '/gdt/jugadores/merge', { keep_id: keepId, merge_id: mergeId }), // admin

  // GDT — Equipo del usuario
  gdtGetMiEquipo: () => request('GET', '/gdt/equipo'),
  gdtGuardarEquipo: (jugadores) => request('POST', '/gdt/equipo', { jugadores }),

  // GDT — Admin acciones sobre equipos
  gdtGetEquipos: () => request('GET', '/gdt/equipos'),
  gdtEditarSlot: (userId, slot, data) => request('PATCH', `/gdt/admin/equipo/${userId}/slot`, { slot, ...data }),
  gdtValidarEquipo: (userId) => request('POST', `/gdt/admin/equipo/${userId}/validar`),
  gdtInvalidarEquipo: (userId, motivo) => request('POST', `/gdt/admin/equipo/${userId}/invalidar`, { motivo }),

  // GDT — Puntajes por fecha (admin)
  gdtGetPuntajes: (fechaId) => request('GET', `/gdt/puntajes/${fechaId}`),
  gdtGuardarPuntajes: (fechaId, puntajes) => request('POST', `/gdt/puntajes/${fechaId}`, { puntajes }),

  // GDT — Ventana de cambios (usuario)
  gdtGetVentanaActiva: () => request('GET', '/gdt/ventana/activa'),
  gdtGetDisponibles: () => request('GET', '/gdt/ventana/disponibles'),
  gdtHacerCambio: (slot, jugador_nuevo_id) => request('POST', '/gdt/ventana/cambio', { slot, jugador_nuevo_id }),

  // GDT — Ventana de cambios (admin)
  gdtGetVentanas: () => request('GET', '/gdt/admin/ventanas'),
  gdtAbrirVentana: (nombre, cambios_por_usuario) => request('POST', '/gdt/admin/ventanas', { nombre, cambios_por_usuario }),
  gdtCerrarVentana: (id) => request('POST', `/gdt/admin/ventanas/${id}/cerrar`),
  gdtGetDetalleVentana: (id) => request('GET', `/gdt/admin/ventanas/${id}/detalle`),

  // GDT — Resultado de cruce
  gdtGetResultado: (cruceId) => request('GET', `/gdt/resultado/${cruceId}`),

  // GDT — Revisión de pendientes (admin)
  gdtGetPendientes: () => request('GET', '/gdt/pendientes'),
  gdtAprobarPendiente: (id, data) => request('POST', `/gdt/pendientes/${id}/aprobar`, data || {}),
  gdtRechazarPendiente: (id) => request('POST', `/gdt/pendientes/${id}/rechazar`),
  gdtUnificarPendiente: (id, keepId) => request('POST', `/gdt/pendientes/${id}/unificar`, { keep_id: keepId }),

  // Movimientos económicos
  getResumenEconomico: () => request('GET', '/movimientos/resumen-home'),
  getMovimientosFecha: (fechaId) => request('GET', `/movimientos/fecha/${fechaId}`),
  getPozoMensual: (torneoId, mes, anio) => request('GET', `/movimientos/pozo-mensual?torneo_id=${torneoId}&mes=${mes}&anio=${anio}`),
  getDeudores: (torneoId) => request('GET', `/movimientos/deudores${torneoId ? `?torneo_id=${torneoId}` : ''}`),
  crearMovimientoManual: (data) => request('POST', '/movimientos/manual', data),
  togglePagadoMovimiento: (id) => request('PATCH', `/movimientos/${id}/pagar`),
  eliminarMovimiento: (id) => request('DELETE', `/movimientos/${id}`),
};

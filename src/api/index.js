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
  if (!res.ok) {
    // Si el backend manda un detail (error interno con causa real), lo mostramos
    // para poder diagnosticar sin depender de los logs del server.
    const msg = data.detail
      ? `${data.error || 'Error'}: ${data.detail}`
      : (data.error || 'Error en la solicitud');
    throw new Error(msg);
  }
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
  updateTorneo: (id, data) => request('PATCH', `/torneos/${id}`, data),
  addJugadorTorneo: (torneoId, userId) => request('POST', `/torneos/${torneoId}/jugadores`, { user_id: userId }),
  removeJugadorTorneo: (torneoId, userId) => request('DELETE', `/torneos/${torneoId}/jugadores/${userId}`),
  getTablaGeneral: (torneoId) => request('GET', `/torneos/${torneoId}/tabla`),
  getTablaMensual: (torneoId, mes, anio) => request('GET', `/torneos/${torneoId}/tabla-mensual?mes=${mes}&anio=${anio}`),
  getCierre: (torneoId, mes, anio) => request('GET', `/torneos/${torneoId}/tabla-mensual-cierre?mes=${mes}&anio=${anio}`),
  saveCierre: (torneoId, data) => request('PUT', `/torneos/${torneoId}/tabla-mensual-cierre`, data),
  recalcularTabla: (torneoId) => request('POST', `/torneos/${torneoId}/recalcular-tabla`),
  getH2H: (torneoId, userId) => request('GET', `/torneos/${torneoId}/h2h/${userId}`),
  getH2HGlobal: (userId, liga_id) => request('GET', `/torneos/h2h-global/${userId}${liga_id ? `?liga_id=${liga_id}` : ''}`),
  getRecords: (liga_id) => request('GET', `/torneos/records${liga_id ? `?liga_id=${liga_id}` : ''}`),
  getTotalesBloque: (torneoId, fechaId) => request('GET', `/torneos/${torneoId}/totales-bloque${fechaId ? `?fecha_id=${fechaId}` : ''}`),

  // Usuarios
  getUsuarios: () => request('GET', '/usuarios'),
  getUsuariosLista: () => request('GET', '/usuarios/lista'),
  toggleRolUsuario: (id) => request('PATCH', `/usuarios/${id}/role`),
  generarResetLink: (id) => request('POST', `/usuarios/${id}/reset-link`),
  resetPassword: (token, password) => request('POST', '/auth/reset-password', { token, password }),
  // Pre-prod (admin-only):
  // - createUsuario({ nombre, email, password, role? }): crea usuario.
  //   role default 'user' (JUGADOR). Solo 'user' o 'admin' aceptados.
  //   201 con { id, nombre, email, role }. 409 si email duplicado.
  // - cambiarPasswordUsuario(id, password): pisa password del user.
  //   Mín 6 caracteres. Invalida magic links pendientes del user.
  // - editarNombreUsuario(id, nombre): edita el nombre visible (admin only).
  //   No toca email/role/password/magic link. Trim + validación non-empty.
  createUsuario: (data) => request('POST', '/usuarios', data),
  cambiarPasswordUsuario: (id, password) =>
    request('POST', `/usuarios/${id}/password`, { password }),
  editarNombreUsuario: (id, nombre) =>
    request('PATCH', `/usuarios/${id}`, { nombre }),

  // Fechas
  getFechas: (torneoId) => request('GET', `/fechas/torneo/${torneoId}`),
  getFecha: (id) => request('GET', `/fechas/${id}`),
  createFecha: (data) => request('POST', '/fechas', data),
  updateFecha: (id, data) => request('PATCH', `/fechas/${id}`, data),
  deleteFecha: (id) => request('DELETE', `/fechas/${id}`),
  recalcularFecha: (id) => request('POST', `/fechas/${id}/recalcular`),
  getDeadlineCumplimiento: (fechaId) => request('GET', `/fechas/${fechaId}/deadline-cumplimiento`),

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
  // Admin: corregir lev_pronostico manualmente (cuando el override se perdió)
  setLevManual: (pronoId, lev) => request('PATCH', `/pronosticos/${pronoId}/lev`, { lev }),

  // Cruces
  getCruces: (fechaId) => request('GET', `/cruces/fecha/${fechaId}`),
  getMiCruce: (fechaId) => request('GET', `/cruces/fecha/${fechaId}/mio`),
  getMisCruces: (torneoId) => request('GET', `/cruces/torneo/${torneoId}/mios`),
  setFixture: (fechaId, cruces) => request('POST', `/cruces/fecha/${fechaId}`, { cruces }),
  recalcularCruces: (fechaId) => request('POST', `/cruces/fecha/${fechaId}/recalcular`),
  // Cruces modo resumido
  getCrucesResumido: (fechaId) => request('GET', `/cruces/fecha/${fechaId}/resumido`),
  guardarResumido: (fechaId, resultados) => request('POST', `/cruces/fecha/${fechaId}/resumido`, { resultados }),

  // GDT — Ligas / Competencias (per-torneo: Fase 5)
  gdtGetLigas: (torneo_id) => request('GET', `/gdt/ligas${torneo_id ? `?torneo_id=${torneo_id}` : ''}`),
  gdtGetLigaSlots: (liga_id) => request('GET', `/gdt/liga/slots${liga_id ? `?liga_id=${liga_id}` : ''}`),

  // GDT — Admin ligas (per-torneo)
  gdtAdminGetLigas:     (torneo_id)  => request('GET',    `/gdt/admin/ligas${torneo_id ? `?torneo_id=${torneo_id}` : ''}`),
  gdtAdminCrearLiga:    (data)       => request('POST',   '/gdt/admin/ligas', data),
  gdtAdminEditarLiga:   (id, data)   => request('PUT',    `/gdt/admin/ligas/${id}`, data),
  gdtAdminToggleActivo: (id)         => request('PATCH',  `/gdt/admin/ligas/${id}/activo`),
  gdtAdminSetDefault:   (id)         => request('PATCH',  `/gdt/admin/ligas/${id}/default`),

  // GDT — [PARCHE TEMPORAL] Refresh snapshot
  gdtRefreshSnapshot: (fechaId) => request('POST', `/gdt/admin/fecha/${fechaId}/refresh-snapshot`),

  // GDT — Admin slots de liga
  gdtAdminGetSlots:      (ligaId)              => request('GET',    `/gdt/admin/ligas/${ligaId}/slots`),
  gdtAdminAgregarSlot:   (ligaId, data)        => request('POST',   `/gdt/admin/ligas/${ligaId}/slots`, data),
  gdtAdminEditarSlot:    (ligaId, slotId, data) => request('PUT',   `/gdt/admin/ligas/${ligaId}/slots/${slotId}`, data),
  gdtAdminEliminarSlot:  (ligaId, slotId)      => request('DELETE', `/gdt/admin/ligas/${ligaId}/slots/${slotId}`),

  // GDT — Catálogo de equipos (admin)
  gdtGetCatalogo: (ligaId) => request('GET', `/gdt/catalogo${ligaId ? `?liga_id=${ligaId}` : ''}`),
  gdtAddCatalogo: (nombre, pais, liga_id) => request('POST', '/gdt/catalogo', { nombre, pais, ...(liga_id != null ? { liga_id } : {}) }),
  gdtDeleteCatalogo: (id) => request('DELETE', `/gdt/catalogo/${id}`),

  // GDT — Jugadores
  gdtBuscarJugador: (nombre, equipoId, liga_id) =>
    request('GET', `/gdt/jugadores/buscar?nombre=${encodeURIComponent(nombre)}${equipoId ? `&equipo_id=${equipoId}` : ''}${liga_id ? `&liga_id=${liga_id}` : ''}`),
  gdtGetEstadoJugadores: (liga_id) => request('GET', `/gdt/jugadores/estado${liga_id ? `?liga_id=${liga_id}` : ''}`),
  gdtGetTodosJugadores: (ligaId) => request('GET', `/gdt/jugadores/todos${ligaId ? `?liga_id=${ligaId}` : ''}`), // admin
  gdtEditarJugador: (id, data) => request('PATCH', `/gdt/jugadores/${id}`, data), // admin
  gdtEliminarJugador: (id) => request('DELETE', `/gdt/jugadores/${id}`),          // admin
  gdtBulkPais: (pais, liga_id) => request('POST', '/gdt/jugadores/bulk-pais', { pais, ...(liga_id != null ? { liga_id } : {}) }),   // admin
  gdtGetDuplicados: (ligaId) => request('GET', `/gdt/jugadores/duplicados${ligaId ? `?liga_id=${ligaId}` : ''}`), // admin
  gdtMergeJugadores: (keepId, mergeId) => request('POST', '/gdt/jugadores/merge', { keep_id: keepId, merge_id: mergeId }), // admin

  // GDT — Equipo del usuario
  gdtGetMiEquipo: (liga_id) => request('GET', `/gdt/equipo${liga_id ? `?liga_id=${liga_id}` : ''}`),
  gdtGuardarEquipo: (jugadores, liga_id) => request('POST', '/gdt/equipo', { jugadores, ...(liga_id != null ? { liga_id } : {}) }),

  // GDT — Admin acciones sobre equipos
  gdtGetEquipos: (ligaId) => request('GET', `/gdt/equipos${ligaId ? `?liga_id=${ligaId}` : ''}`),
  gdtEditarSlot: (userId, slot, data, liga_id) => request('PATCH', `/gdt/admin/equipo/${userId}/slot`, { slot, ...data, ...(liga_id != null ? { liga_id } : {}) }),
  gdtValidarEquipo: (userId, liga_id) => request('POST', `/gdt/admin/equipo/${userId}/validar`, liga_id != null ? { liga_id } : {}),
  gdtInvalidarEquipo: (userId, motivo, liga_id) => request('POST', `/gdt/admin/equipo/${userId}/invalidar`, { motivo, ...(liga_id != null ? { liga_id } : {}) }),

  // GDT — Puntajes por fecha (admin)
  gdtGetPuntajes: (fechaId) => request('GET', `/gdt/puntajes/${fechaId}`),
  gdtGuardarPuntajes: (fechaId, puntajes) => request('POST', `/gdt/puntajes/${fechaId}`, { puntajes }),

  // GDT — Ventana de cambios (usuario)
  gdtGetVentanaActiva: (liga_id) => request('GET', `/gdt/ventana/activa${liga_id ? `?liga_id=${liga_id}` : ''}`),
  gdtGetDisponibles:   (liga_id) => request('GET', `/gdt/ventana/disponibles${liga_id ? `?liga_id=${liga_id}` : ''}`),
  gdtHacerCambio:      (slot, jugador_nuevo_id, liga_id) => request('POST', '/gdt/ventana/cambio', { slot, jugador_nuevo_id, ...(liga_id != null ? { liga_id } : {}) }),
  gdtHacerCambioNuevo: (slot, nuevo_jugador,    liga_id) => request('POST', '/gdt/ventana/cambio', { slot, nuevo_jugador,    ...(liga_id != null ? { liga_id } : {}) }),
  gdtCrearEquipoCatalogoUsuario: (nombre, liga_id) => request('POST', '/gdt/catalogo/usuario', { nombre, ...(liga_id != null ? { liga_id } : {}) }),

  // GDT — Ventana de cambios (admin)
  gdtGetVentanas:  (ligaId) => request('GET', `/gdt/admin/ventanas${ligaId ? `?liga_id=${ligaId}` : ''}`),
  gdtAbrirVentana: (nombre, cambios_por_usuario, liga_id) => request('POST', '/gdt/admin/ventanas', { nombre, cambios_por_usuario, ...(liga_id != null ? { liga_id } : {}) }),
  gdtAbrirCorreccion: (liga_id) => request('POST', '/gdt/admin/ventanas/abrir-correccion', { ...(liga_id != null ? { liga_id } : {}) }),
  gdtCerrarVentana: (id) => request('POST', `/gdt/admin/ventanas/${id}/cerrar`),
  gdtGetDetalleVentana: (id) => request('GET', `/gdt/admin/ventanas/${id}/detalle`),

  // GDT — Resultado de cruce
  gdtGetResultado: (cruceId) => request('GET', `/gdt/resultado/${cruceId}`),

  // GDT — Revisión de pendientes (admin)
  gdtGetPendientes: (ligaId) => request('GET', `/gdt/pendientes${ligaId ? `?liga_id=${ligaId}` : ''}`),
  gdtAprobarPendiente: (id, data) => request('POST', `/gdt/pendientes/${id}/aprobar`, data || {}),
  gdtRechazarPendiente: (id) => request('POST', `/gdt/pendientes/${id}/rechazar`),
  gdtUnificarPendiente: (id, keepId) => request('POST', `/gdt/pendientes/${id}/unificar`, { keep_id: keepId }),

  // Movimientos económicos
  getResumenEconomico: () => request('GET', '/movimientos/resumen-home'),
  getMovimientosFecha: (fechaId) => request('GET', `/movimientos/fecha/${fechaId}`),
  getPozoMensual: (torneoId, mes, anio) => request('GET', `/movimientos/pozo-mensual?torneo_id=${torneoId}&mes=${mes}&anio=${anio}`),
  getDeudores: (torneoId) => request('GET', `/movimientos/deudores${torneoId ? `?torneo_id=${torneoId}` : ''}`),
  crearMultaDeadline: (data) => request('POST', '/movimientos/multa-deadline', data),
  togglePagadoMovimiento: (id) => request('PATCH', `/movimientos/${id}/pagar`),
  eliminarMovimiento: (id) => request('DELETE', `/movimientos/${id}`),

  // Comidas mensuales
  getComida: (torneoId, mes, anio) => request('GET', `/comidas?torneo_id=${torneoId}&mes=${mes}&anio=${anio}`),
  saveComida: (data) => request('PUT', '/comidas', data),
  getParticipantes: (comidaId) => request('GET', `/comidas/${comidaId}/participantes`),
  saveParticipantes: (comidaId, data) => request('PUT', `/comidas/${comidaId}/participantes`, data),

  getFotos: (comidaId) => request('GET', `/comidas/${comidaId}/fotos`),

  // Comidas — votos por usuario
  getMisVotos: (comidaId) => request('GET', `/comidas/${comidaId}/votos/me`),
  saveMisVotos: (comidaId, votos) => request('PUT', `/comidas/${comidaId}/votos`, { votos }),

  // Comidas — estado de votación (admin)
  getVotacionStatus: (comidaId) => request('GET', `/comidas/${comidaId}/votacion-status`),
  getComidasHistorico: (torneoId) => request('GET', `/comidas/torneo/${torneoId}/historico`),
  getComidaLista: (torneoId) => request('GET', `/comidas/torneo/${torneoId}/lista`),
  getComidaById: (comidaId) => request('GET', `/comidas/${comidaId}`),
  cerrarVotacion: (comidaId) => request('PUT', `/comidas/${comidaId}/votacion-cerrar`),

  // Comidas — configuración de votación por torneo
  getComidaVotacionConfig: (torneoId) => request('GET', `/comidas/config/${torneoId}`),
  saveComidaVotacionConfig: (torneoId, items) => request('PUT', `/comidas/config/${torneoId}`, { items }),
  addFoto: (comidaId, url) => request('POST', `/comidas/${comidaId}/fotos`, { url }),

  // Permisos (solo superadmin)
  getMisPermisos: () => request('GET', '/permisos/me'),
  getPermisosCatalogo: () => request('GET', '/permisos/catalogo'),
  getUsuariosPermisos: () => request('GET', '/permisos/usuarios'),
  updatePermisosUsuario: (userId, permisos) => request('PUT', `/permisos/usuarios/${userId}`, { permisos }),

  // Mundial — Fase 1 (lecturas + edición de config).
  // Carga de respuestas, ranking, scoring e importer Excel quedan para Fases posteriores.
  getMundialTorneos: () => request('GET', '/mundial/torneos'),
  getMundialConfig: (torneoId) => request('GET', `/mundial/${torneoId}/config`),
  updateMundialConfig: (torneoId, data) => request('PUT', `/mundial/${torneoId}/config`, data),
  getMundialEquiposCatalogo: (torneoId) => request('GET', `/mundial/${torneoId}/equipos`),
  getMundialPremios: (torneoId) => request('GET', `/mundial/${torneoId}/premios`),

  // Mundial — Fase 2.1 (catálogo de equipos: CRUD + alta masiva).
  // Endpoints admin: requieren rol admin/superadmin + permiso 'gestionar_mundial'.
  // Editable solo en estados 'configuracion' o 'abierto' (el backend devuelve 409 si no).
  seedMundial2026Equipos: (torneoId) =>
    request('POST', `/mundial/${torneoId}/equipos/seed-mundial-2026`),
  createMundialEquipo: (torneoId, data) =>
    request('POST', `/mundial/${torneoId}/equipos`, data),
  updateMundialEquipo: (torneoId, equipoId, data) =>
    request('PATCH', `/mundial/${torneoId}/equipos/${equipoId}`, data),
  deleteMundialEquipo: (torneoId, equipoId) =>
    request('DELETE', `/mundial/${torneoId}/equipos/${equipoId}`),

  // Mundial — Fase 2.2 (preguntas: CRUD + bulk).
  // Editable según estado:
  //   'configuracion': POST/PUT bulk/DELETE/PATCH (todos los campos salvo numero+tipo).
  //   'abierto':       PATCH solo enunciado/aclaracion/activa.
  //   resto:           bloqueado (409).
  // Las respuestas con warnings traen el shape:
  //   { pregunta, warnings: [{ codigos_no_encontrados: [...] }] }  para POST/PATCH
  //   { creados, actualizados, total, warnings: [{ pregunta_numero, codigos_no_encontrados }] }  para bulk
  getMundialPreguntas: (torneoId) =>
    request('GET', `/mundial/${torneoId}/preguntas`),
  createMundialPregunta: (torneoId, data) =>
    request('POST', `/mundial/${torneoId}/preguntas`, data),
  updateMundialPregunta: (torneoId, preguntaId, data) =>
    request('PATCH', `/mundial/${torneoId}/preguntas/${preguntaId}`, data),
  deleteMundialPregunta: (torneoId, preguntaId) =>
    request('DELETE', `/mundial/${torneoId}/preguntas/${preguntaId}`),
  bulkMundialPreguntas: (torneoId, preguntas) =>
    request('PUT', `/mundial/${torneoId}/preguntas/bulk`, { preguntas }),
  seedMundial2026Preguntas: (torneoId) =>
    request('POST', `/mundial/${torneoId}/preguntas/seed-mundial-2026`),

  // Mundial — Fase 2.4 (respuestas del usuario)
  // - getMundialPreguntasActivas: filtra `?activa=1` en el GET de preguntas (uso user).
  // - getMundialMisRespuestas:    devuelve solo las respuestas del user autenticado.
  // - saveMundialMisRespuestas:   bulk save atómico. Cross-check strict de equipos
  //                                contra catálogo activo. 409 si estado != 'abierto'
  //                                o si deadline_carga vencido.
  getMundialPreguntasActivas: (torneoId) =>
    request('GET', `/mundial/${torneoId}/preguntas?activa=1`),
  getMundialMisRespuestas: (torneoId) =>
    request('GET', `/mundial/${torneoId}/mis-respuestas`),
  saveMundialMisRespuestas: (torneoId, respuestas) =>
    request('PUT', `/mundial/${torneoId}/mis-respuestas`, { respuestas }),

  // Mundial — Fase 3 (resultados + ranking + mis-puntos)
  // - getMundialResultados:   solo visible en estado >= 'grupos_jugados' (sino 403).
  // - saveMundialResultado:   upsert; requiere estado >= 'grupos_jugados';
  //                           cross-check de equipos contra catálogo activo.
  // - deleteMundialResultado: borra el resultado cargado de una pregunta.
  // - getMundialRanking:      { visible, motivo, estado, ranking, preguntas_con_resultado, total_preguntas }.
  //                           Si visible=false, ranking=[] y motivo explica el porqué.
  // - getMundialMisPuntos:    { visible, estado, items, pts_totales }. items[].pts_obtenidos
  //                           es null si la pregunta aún no tiene resultado cargado.
  getMundialResultados: (torneoId) =>
    request('GET', `/mundial/${torneoId}/resultados`),
  saveMundialResultado: (torneoId, preguntaId, resultado_json) =>
    request('POST', `/mundial/${torneoId}/resultados/${preguntaId}`, { resultado_json }),
  deleteMundialResultado: (torneoId, preguntaId) =>
    request('DELETE', `/mundial/${torneoId}/resultados/${preguntaId}`),
  getMundialRanking: (torneoId) =>
    request('GET', `/mundial/${torneoId}/ranking`),
  getMundialMisPuntos: (torneoId) =>
    request('GET', `/mundial/${torneoId}/mis-puntos`),

  // Fase 3.1 — respuestas de todos los users para UNA pregunta. Admin-only.
  // Pensado para el editor de overrides_pts de tipos texto.
  // Gate: estado >= 'grupos_jugados' (sino 403). Devuelve [] si nadie respondió.
  getMundialRespuestasPregunta: (torneoId, preguntaId) =>
    request('GET', `/mundial/${torneoId}/preguntas/${preguntaId}/respuestas`),

  // Fase 3.3 — vista social: respuestas de TODOS los participantes en TODAS
  // las preguntas activas. Accesible por cualquier user del torneo.
  // Gate: visible solo cuando ya no se puede cambiar la planilla
  //   (estado != 'abierto' OR deadline_carga vencido).
  // Si no visible, devuelve { visible: false, motivo, mensaje }.
  getMundialRespuestasPublicas: (torneoId) =>
    request('GET', `/mundial/${torneoId}/respuestas-publicas`),

  // ── Fase 5 — Cambios post-grupos ──────────────────────────────────────
  // Admin (ventanas):
  getMundialVentanas: (torneoId) =>
    request('GET', `/mundial/${torneoId}/ventanas-cambios`),
  createMundialVentana: (torneoId, body) =>
    request('POST', `/mundial/${torneoId}/ventanas-cambios`, body || {}),
  updateMundialVentana: (torneoId, ventanaId, body) =>
    request('PATCH', `/mundial/${torneoId}/ventanas-cambios/${ventanaId}`, body),
  publicarMundialVentana: (torneoId, ventanaId) =>
    request('POST', `/mundial/${torneoId}/ventanas-cambios/${ventanaId}/publicar`),
  // Admin (habilitados):
  getMundialVentanaHabilitados: (torneoId, ventanaId) =>
    request('GET', `/mundial/${torneoId}/ventanas-cambios/${ventanaId}/habilitados`),
  habilitarMundialUser: (torneoId, ventanaId, user_id) =>
    request('POST', `/mundial/${torneoId}/ventanas-cambios/${ventanaId}/habilitados`, { user_id }),
  deshabilitarMundialUser: (torneoId, ventanaId, userId) =>
    request('DELETE', `/mundial/${torneoId}/ventanas-cambios/${ventanaId}/habilitados/${userId}`),
  // Admin (historial):
  getMundialVentanaCambios: (torneoId, ventanaId) =>
    request('GET', `/mundial/${torneoId}/ventanas-cambios/${ventanaId}/cambios`),
  // User:
  getMundialMisCambiosDisponibles: (torneoId) =>
    request('GET', `/mundial/${torneoId}/mis-cambios-disponibles`),
  getMundialMisCambios: (torneoId) =>
    request('GET', `/mundial/${torneoId}/mis-cambios`),
  saveMundialMisCambios: (torneoId, cambios) =>
    request('PUT', `/mundial/${torneoId}/mis-cambios`, { cambios }),
};

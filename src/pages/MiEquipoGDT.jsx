import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/index.js'

const SLOTS = ['ARQ', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'MED1', 'MED2', 'MED3', 'MED4', 'DEL1', 'DEL2']

const SLOT_POSICION = {
  ARQ: 'ARQ',
  DEF1: 'DEF', DEF2: 'DEF', DEF3: 'DEF', DEF4: 'DEF',
  MED1: 'MED', MED2: 'MED', MED3: 'MED', MED4: 'MED',
  DEL1: 'DEL', DEL2: 'DEL',
}

const POSICION_LABELS = { ARQ: 'Arquero', DEF: 'Defensor', MED: 'Mediocampista', DEL: 'Delantero' }

const SLOT_GROUPS = [
  { label: 'Arquero',          slots: ['ARQ'] },
  { label: 'Defensores',       slots: ['DEF1', 'DEF2', 'DEF3', 'DEF4'] },
  { label: 'Mediocampistas',   slots: ['MED1', 'MED2', 'MED3', 'MED4'] },
  { label: 'Delanteros',       slots: ['DEL1', 'DEL2'] },
]

const FORMATO_BADGE = {
  F5:   { bg: 'rgba(139,92,246,0.15)', color: '#7c3aed' },
  F7:   { bg: 'rgba(59,130,246,0.15)', color: '#2563eb' },
  F9:   { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  F11:  { bg: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
  otro: { bg: 'var(--color-surface2)', color: 'var(--color-muted)' },
}

// Construye los grupos de slots a partir de la respuesta de /api/gdt/liga/slots
const POSICION_GROUP_LABEL = { ARQ: 'Arquero', DEF: 'Defensores', MED: 'Mediocampistas', DEL: 'Delanteros' }
const POSICION_ORDER = ['ARQ', 'DEF', 'MED', 'DEL']
function buildSlotGroups(slots) {
  const map = {}
  for (const { slot, posicion } of slots) {
    if (!map[posicion]) map[posicion] = []
    map[posicion].push(slot)
  }
  return POSICION_ORDER
    .filter(p => map[p])
    .map(p => ({ label: POSICION_GROUP_LABEL[p], slots: map[p] }))
}

function estadoBadge(estado) {
  if (estado === 'eliminado') return <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 12 }}>❌ Eliminado</span>
  if (estado === 'bloqueado') return <span style={{ color: 'var(--color-warning)', fontSize: 12 }}>⚠️ Bloqueado</span>
  if (estado === 'pendiente') return <span style={{ color: '#a78bfa', fontSize: 12 }}>⏳ Pendiente</span>
  if (estado === 'rechazado') return <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>🚫 Rechazado</span>
  return <span style={{ color: 'var(--color-success)', fontSize: 12 }}>✅</span>
}

/**
 * Banner de estado del equipo.
 * Consume directamente los campos pre-calculados del endpoint:
 *   puede_participar, motivos_no_participa, estado_equipo, observaciones
 * No deduce nada — el backend ya separó los dos niveles.
 */
function BannerEstado({ puedeParticipar, motivos, estadoEquipo, observaciones }) {
  if (puedeParticipar) return null

  // Estilo según causa raíz (nivel equipo tiene prioridad visual si hay 11 aprobados)
  const esAdmin     = estadoEquipo === 'requiere_correccion'
  const esObservado = estadoEquipo === 'observado'
  const color = esAdmin ? 'var(--color-danger)' : esObservado ? 'var(--color-warning)' : '#a78bfa'
  const bg    = esAdmin ? 'rgba(239,68,68,0.12)' : esObservado ? 'rgba(245,158,11,0.1)' : 'rgba(167,139,250,0.1)'
  const icon  = esAdmin ? '❌' : esObservado ? '⚠️' : '⏳'

  return (
    <div style={{ background: bg, border: `1px solid ${color}`, borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
      <strong style={{ color }}>{icon} Tu equipo no puede participar en GDT</strong>
      <ul style={{ marginTop: 8, paddingLeft: 20, color: 'var(--color-muted)', fontSize: 13, marginBottom: 0 }}>
        {motivos.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
      {/* Detalle de mismatches de posición (solo cuando estadoEquipo = 'observado') */}
      {esObservado && observaciones?.length > 0 && (
        <ul style={{ marginTop: 6, paddingLeft: 20, color: 'var(--color-muted)', fontSize: 12 }}>
          {observaciones.map((o, i) => (
            <li key={i}>
              {o.slot}: <strong>{o.jugador}</strong> es {POSICION_LABELS[o.posicion_jugador]},
              esperaba {POSICION_LABELS[o.posicion_esperada]}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Componente de entrada de un slot ────────────────────────────────────────

function SlotInput({ slot, posicionDefault, catalogoEquipos, value, onChange }) {
  const [busqueda, setBusqueda] = useState(value?.nombre || '')
  const [sugerencias, setSugerencias] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const timerRef = useRef(null)
  // posicion viene del padre (slotsConfig.slotPosicion[slot]) — dinámico por liga
  const posicion = posicionDefault ?? null
  const confirmado = value?.jugador_id != null

  async function buscar(nombre) {
    if (!nombre?.trim() || nombre.trim().length < 3) return
    setBuscando(true)
    try {
      // Pasar equipo_catalogo_id si está disponible (mejora la precisión)
      const res = await api.gdtBuscarJugador(nombre, value?.equipo_catalogo_id || null)
      if (res.exacto) {
        onChange({ ...value, jugador_id: res.exacto.id, nombre: res.exacto.nombre, posicion: res.exacto.posicion || posicion })
        setSugerencias(null)
      } else {
        setSugerencias(res.similares || [])
      }
    } catch (_) {
      setSugerencias([])
    } finally {
      setBuscando(false)
    }
  }

  function handleNombreChange(e) {
    const nombre = e.target.value
    setBusqueda(nombre)
    onChange({ ...value, nombre, jugador_id: null })
    setSugerencias(null)
    clearTimeout(timerRef.current)
    if (nombre.trim().length >= 3) {
      timerRef.current = setTimeout(() => buscar(nombre), 500)
    }
  }

  function handleEquipoChange(e) {
    const rawText = e.target.value
    // Buscar si el texto coincide con algún equipo del catálogo (case-insensitive)
    const found = catalogoEquipos.find(c =>
      c.nombre.toLowerCase() === rawText.toLowerCase()
    )
    onChange({
      ...value,
      equipo_raw: rawText,
      equipo_catalogo_id: found?.id || null,
      jugador_id: null,
    })
    setSugerencias(null)
  }

  function seleccionarSugerencia(jug) {
    onChange({ ...value, jugador_id: jug.id, nombre: jug.nombre, posicion: jug.posicion || posicion })
    setSugerencias(null)
  }

  function usarNuevo() {
    // Confirmar el texto como nuevo jugador (se creará pendiente en backend)
    onChange({ ...value, jugador_id: -1, nombre: busqueda.trim(), posicion })
    setSugerencias(null)
  }

  function limpiar() {
    onChange({ slot, equipo_raw: value?.equipo_raw, equipo_catalogo_id: value?.equipo_catalogo_id, nombre: '', jugador_id: null, posicion })
    setBusqueda('')
    setSugerencias(null)
  }

  const equipoRaw = value?.equipo_raw || ''
  const nombreDisplay = value?.nombre || ''

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td style={{ ...tdStyle, color: 'var(--color-primary)', fontWeight: 600, width: 55 }}>{slot}</td>
      <td style={{ ...tdStyle, color: 'var(--color-muted)', fontSize: 11, width: 85 }}>{POSICION_LABELS[posicion]}</td>

      {/* Equipo — texto libre con sugerencias del catálogo */}
      <td style={{ ...tdStyle, width: 170 }}>
        <input
          list={`cat-${slot}`}
          type="text"
          placeholder="Equipo real..."
          value={equipoRaw}
          onChange={handleEquipoChange}
          style={{
            ...inputStyle,
            width: '100%',
            borderColor: value?.equipo_catalogo_id ? 'var(--color-success)' : 'var(--color-border)',
          }}
        />
        {catalogoEquipos.length > 0 && (
          <datalist id={`cat-${slot}`}>
            {catalogoEquipos.map(e => <option key={e.id} value={e.nombre} />)}
          </datalist>
        )}
      </td>

      {/* Jugador */}
      <td style={tdStyle}>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={confirmado ? nombreDisplay : busqueda || nombreDisplay}
              onChange={handleNombreChange}
              onFocus={() => { if (confirmado) limpiar() }}
              placeholder="Nombre del jugador..."
              style={{
                ...inputStyle,
                flex: 1,
                color: confirmado ? 'var(--color-success)' : 'var(--color-text)',
                borderColor: confirmado ? 'var(--color-success)' : 'var(--color-border)',
              }}
            />
            {buscando && <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>🔍</span>}
            {confirmado && (
              <button onClick={limpiar} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 14 }} title="Cambiar">✕</button>
            )}
          </div>

          {/* Sugerencias */}
          {sugerencias !== null && !confirmado && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              {sugerencias.length > 0 && (
                <>
                  <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    ¿Quisiste decir...?
                  </div>
                  {sugerencias.map(s => (
                    <div
                      key={s.id}
                      onClick={() => seleccionarSugerencia(s)}
                      style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {s.nombre} <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>({s.equipo_real})</span>
                    </div>
                  ))}
                </>
              )}
              <div
                onClick={usarNuevo}
                style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                ➕ Usar "{busqueda.trim()}" tal como está
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Posición */}
      <td style={{ ...tdStyle, width: 130 }}>
        <select
          value={value?.posicion || posicion}
          onChange={e => onChange({ ...value, posicion: e.target.value })}
          style={{
            ...inputStyle, width: '100%',
            color: value?.posicion && value.posicion !== posicion ? 'var(--color-warning)' : 'var(--color-text)',
          }}
        >
          <option value="ARQ">Arquero</option>
          <option value="DEF">Defensor</option>
          <option value="MED">Mediocampista</option>
          <option value="DEL">Delantero</option>
        </select>
      </td>
    </tr>
  )
}

// ─── Estilos de tabla compartidos ────────────────────────────────────────────
const thStyle = { textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }
const tdStyle = { padding: '8px 10px', verticalAlign: 'middle' }

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MiEquipoGDT() {
  const [searchParams, setSearchParams] = useSearchParams()
  // liga_id desde URL: ?liga_id=X → carga equipo de esa liga; sin param → liga default
  const ligaIdUrl = searchParams.get('liga_id') ? Number(searchParams.get('liga_id')) : null

  const [equipoDB, setEquipoDB] = useState([])
  const [estadoEquipo, setEstadoEquipo] = useState(null)
  const [puedeParticipar, setPuedeParticipar] = useState(false)
  const [motivos, setMotivos] = useState([])
  const [aprobadosCount, setAprobadosCount] = useState(0)
  const [pendientesCount, setPendientesCount] = useState(0)
  const [rechazadosCount, setRechazadosCount] = useState(0)
  const [observaciones, setObservaciones] = useState([])
  const [form, setForm] = useState({})
  const [catalogo, setCatalogo] = useState([])
  // Slots dinámicos: cargados desde /api/gdt/liga/slots, fallback a constantes F11
  const [slotsConfig, setSlotsConfig] = useState({ slotNames: SLOTS, groups: SLOT_GROUPS, total: 11, liga_id: null, slotPosicion: SLOT_POSICION })
  const [estadoGlobal, setEstadoGlobal] = useState({ eliminados: [], mi_equipo_invalidados: [] })
  // Ligas activas — para el selector prominente
  const [ligas, setLigas] = useState([])
  const [ligaId, setLigaId] = useState(ligaIdUrl)                       // null = esperar default
  const [ligaResolved, setLigaResolved] = useState(ligaIdUrl !== null)  // true = listo para cargar
  const [modoEdicion, setModoEdicion] = useState(false)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  // Ventana de cambios
  const [ventanaInfo, setVentanaInfo] = useState(null)      // { ventana, soltados_ids }
  const [disponibles, setDisponibles] = useState([])
  const [modoVentana, setModoVentana] = useState(false)
  const [slotEditando, setSlotEditando] = useState(null)
  const [busquedaDisp, setBusquedaDisp] = useState('')
  const [haciendoCambio, setHaciendoCambio] = useState(false)
  const [creandoJugador, setCreandoJugador] = useState(false)  // form crear jugador visible
  const [formNuevo, setFormNuevo] = useState({ nombre: '', equipoRaw: '', equipoCatalogoId: null, posicion: '' })

  // Efecto 1: cargar ligas activas y pre-seleccionar default si no hay URL param
  useEffect(() => {
    api.gdtGetLigas().then(ls => {
      const lista = Array.isArray(ls) ? ls : []
      setLigas(lista)
      if (ligaIdUrl === null) {
        const def = lista.find(l => l.es_default) || lista[0]
        if (def) setLigaId(def.id)
        setLigaResolved(true) // desbloquea cargar() incluso si lista vacía → backend usa default
      }
    }).catch(() => {
      if (ligaIdUrl === null) setLigaResolved(true) // fallback: cargar con null → backend usa default
    })
  }, [])

  // Efecto 2: cargar equipo cuando liga está resuelta o cambia
  useEffect(() => {
    if (!ligaResolved) return
    cargar()
  }, [ligaId, ligaResolved])

  // Cargar configuración de slots de la liga (independiente del equipo del usuario)
  useEffect(() => {
    if (!ligaResolved) return
    api.gdtGetLigaSlots(ligaId)
      .then(data => {
        if (data?.slots?.length > 0) {
          setSlotsConfig({
            slotNames: data.slots.map(s => s.slot),
            groups: buildSlotGroups(data.slots),
            total: data.total,
            liga_id: data.liga_id ?? null,
            // mapa slot→posicion derivado de la API — reemplaza SLOT_POSICION hardcodeado
            slotPosicion: Object.fromEntries(data.slots.map(s => [s.slot, s.posicion])),
          })
        }
      })
      .catch(() => {}) // fallback: mantiene constantes F11 (incluye slotPosicion: SLOT_POSICION)
  }, [ligaId, ligaResolved])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [equipoRes, estadoRes, catalogoRes, ventanaRes] = await Promise.all([
        api.gdtGetMiEquipo(ligaId),
        api.gdtGetEstadoJugadores(),
        api.gdtGetCatalogo(),
        api.gdtGetVentanaActiva(),
      ])
      setEquipoDB(equipoRes.equipo || [])
      setEstadoEquipo(equipoRes.estado_equipo || null)
      setPuedeParticipar(equipoRes.puede_participar ?? false)
      setMotivos(equipoRes.motivos_no_participa || [])
      setAprobadosCount(equipoRes.aprobados_count || 0)
      setPendientesCount(equipoRes.pendientes_count || 0)
      setRechazadosCount(equipoRes.rechazados_count || 0)
      setObservaciones(equipoRes.observaciones || [])
      setEstadoGlobal(estadoRes)
      setCatalogo(catalogoRes)
      setVentanaInfo(ventanaRes.ventana ? ventanaRes : null)

      // Si hay ventana abierta, cargar disponibles
      if (ventanaRes.ventana) {
        try {
          const disp = await api.gdtGetDisponibles()
          setDisponibles(disp)
        } catch (_) {}
      }

      // Inicializar form con datos actuales.
      // Iteramos la unión de SLOTS (fallback F11) + slots reales del equipo del servidor,
      // para cubrir tanto equipos F11 como cualquier formato de liga sin depender de timing de slotsConfig.
      const f = {}
      const slotsParaInit = new Set([...SLOTS, ...(equipoRes.equipo || []).map(e => e.slot)])
      for (const slot of slotsParaInit) {
        const j = (equipoRes.equipo || []).find(e => e.slot === slot)
        // posicion: viene del DB, luego del mapa actual de slotsConfig, luego null
        const posicionFallback = slotsConfig.slotPosicion[slot] ?? null
        f[slot] = j
          ? {
              equipo_raw: j.equipo_raw || j.equipo_real || '',
              equipo_catalogo_id: null,
              nombre: j.nombre,
              jugador_id: j.jugador_id,
              posicion: j.posicion || posicionFallback,
            }
          : { equipo_raw: '', equipo_catalogo_id: null, nombre: '', jugador_id: null, posicion: posicionFallback }
      }
      setForm(f)

      // Auto-entrar en modo edición si no tiene equipo (no requiere ventana: es armado inicial)
      if (!equipoRes.equipo || equipoRes.equipo.length === 0) setModoEdicion(true)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function handleSlotChange(slot, valor) {
    setForm(prev => ({ ...prev, [slot]: { ...prev[slot], ...valor } }))
    setExito(null)
  }

  function handleLigaChange(newId) {
    setSearchParams(prev => { prev.set('liga_id', String(newId)); return prev })
    setLigaId(newId)
  }

  async function handleGuardar() {
    // Validar que todos los slots tengan nombre y equipo
    // Usa slotsConfig.slotNames (dinámico por liga) en lugar de SLOTS (F11 fijo)
    const total = slotsConfig.slotNames.length
    const incompletos = slotsConfig.slotNames.filter(s => !form[s]?.nombre?.trim())
    if (incompletos.length > 0) {
      const completos = total - incompletos.length
      setError(`Equipo incompleto (${completos}/${total}). Faltan jugadores en: ${incompletos.join(', ')}`)
      return
    }
    const sinEquipo = slotsConfig.slotNames.filter(s => !form[s]?.equipo_raw?.trim())
    if (sinEquipo.length > 0) {
      setError(`Falta el equipo real en ${sinEquipo.length} slot${sinEquipo.length > 1 ? 's' : ''}: ${sinEquipo.join(', ')}`)
      return
    }

    setGuardando(true); setError(null); setExito(null)
    try {
      const jugadores = slotsConfig.slotNames.map(slot => ({
        slot,
        nombre: form[slot].nombre.trim(),
        equipo_raw: form[slot].equipo_raw?.trim() || '',
        equipo_catalogo_id: form[slot].equipo_catalogo_id || null,
        posicion: form[slot].posicion || slotsConfig.slotPosicion[slot] || null,
      }))

      const res = await api.gdtGuardarEquipo(jugadores, slotsConfig.liga_id)

      if (res.puede_participar) {
        setExito('✅ Equipo guardado. Tu equipo participa en GDT.')
      } else if (res.pendientes_count > 0) {
        setExito(`⏳ Equipo guardado. ${res.pendientes_count} jugador${res.pendientes_count > 1 ? 'es' : ''} pendiente${res.pendientes_count > 1 ? 's' : ''} de aprobación del admin.`)
      } else {
        setExito('⚠️ Equipo guardado. Revisá el estado arriba.')
      }
      setModoEdicion(false)
      await cargar()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  async function hacerCambio(slot, jugadorNuevoId) {
    setHaciendoCambio(true); setError(null)
    try {
      const res = await api.gdtHacerCambio(slot, jugadorNuevoId)
      if (res.jugador_eliminado) {
        setExito(res.mensaje)
      } else {
        setExito(`✅ Cambio realizado. Te quedan ${res.cambios_restantes} cambio(s).`)
      }
      setSlotEditando(null); setBusquedaDisp('')
      await cargar()
    } catch (e) { setError(e.message) }
    finally { setHaciendoCambio(false) }
  }

  async function hacerCambioConNuevoJugador(slot) {
    const { nombre, equipoRaw, equipoCatalogoId, posicion } = formNuevo
    if (!nombre.trim()) { setError('El nombre del jugador es obligatorio'); return }
    if (!equipoRaw.trim()) { setError('El equipo es obligatorio'); return }
    if (!posicion) { setError('La posición es obligatoria'); return }
    setHaciendoCambio(true); setError(null)
    try {
      // Crear equipo si no existe en catálogo
      let catId = equipoCatalogoId
      if (!catId && equipoRaw.trim()) {
        const ec = await api.gdtCrearEquipoCatalogoUsuario(equipoRaw.trim())
        catId = ec.id
      }
      const res = await api.gdtHacerCambioNuevo(slot, {
        nombre: nombre.trim(),
        equipo_real: equipoRaw.trim(),
        equipo_catalogo_id: catId || null,
        posicion,
      })
      if (res.jugador_pendiente) {
        setExito(`⏳ Jugador creado. Queda pendiente de aprobación del admin. Tu equipo no participará en GDT hasta que sea aprobado.`)
      } else if (res.jugador_eliminado) {
        setExito(res.mensaje)
      } else {
        setExito(`✅ Cambio realizado. Te quedan ${res.cambios_restantes} cambio(s).`)
      }
      setSlotEditando(null); setBusquedaDisp('')
      setCreandoJugador(false)
      setFormNuevo({ nombre: '', equipoRaw: '', equipoCatalogoId: null, posicion: '' })
      await cargar()
    } catch (e) { setError(e.message) }
    finally { setHaciendoCambio(false) }
  }

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  const tieneEquipo = equipoDB.length === slotsConfig.total

  // Slots con jugadores eliminados (para UX de corrección)
  // eliminadosIds: Set de IDs derivado de estadoGlobal.eliminados (array de objetos {jugador_id,...})
  const eliminadosIds = new Set(
    (estadoGlobal?.eliminados ?? []).map(el => el?.jugador_id).filter(Boolean)
  )
  const slotsEliminados = new Set(
    (equipoDB ?? [])
      .filter(e => e.estado_jugador === 'eliminado' || eliminadosIds.has(e.jugador_id))
      .map(e => e.slot)
  )
  const requiereCorreccion = estadoEquipo === 'requiere_correccion' || slotsEliminados.size > 0

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>⚽ Mi Equipo Gran DT</h2>
        {tieneEquipo && !modoEdicion && ventanaInfo?.ventana && (
          <button className="btn btn-secondary" onClick={() => setModoEdicion(true)}>Editar equipo</button>
        )}
      </div>

      {/* Selector de liga GDT — pills prominentes, visible si hay más de una liga activa */}
      {ligas.length > 1 && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 20,
          background: 'var(--color-surface2)',
          padding: '10px 14px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 11, color: 'var(--color-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4,
          }}>
            Liga
          </span>
          {ligas.map(l => {
            const isSelected = ligaId === l.id
            const c = FORMATO_BADGE[l.formato] || FORMATO_BADGE.otro
            return (
              <button
                key={l.id}
                onClick={() => handleLigaChange(l.id)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 99,
                  border: `2px solid ${isSelected ? c.color : 'transparent'}`,
                  background: isSelected ? c.bg : 'transparent',
                  color: isSelected ? c.color : 'var(--color-muted)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {l.nombre}{l.es_default ? ' ★' : ''}
                {l.formato && (
                  <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>({l.formato})</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Banner de estado — usa directamente los campos del endpoint, sin deducción */}
      {!modoEdicion && (
        <BannerEstado
          puedeParticipar={puedeParticipar}
          motivos={motivos}
          estadoEquipo={estadoEquipo}
          observaciones={observaciones}
        />
      )}

      {/* Banner ventana abierta */}
      {ventanaInfo?.ventana && (
        <div style={{ background: 'rgba(59,130,246,0.1)', border: '2px solid var(--color-primary)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--color-primary)' }}>🔄 Ventana abierta: {ventanaInfo.ventana.nombre}</strong>
              <span style={{ color: 'var(--color-muted)', fontSize: 13, marginLeft: 12 }}>
                {ventanaInfo.ventana.cambios_restantes} cambio(s) restante(s) de {ventanaInfo.ventana.cambios_por_usuario}
              </span>
            </div>
            {ventanaInfo.ventana.cambios_restantes > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setModoVentana(!modoVentana)}
              >
                {modoVentana ? 'Ocultar cambios' : '🔄 Hacer cambios'}
              </button>
            )}
          </div>

          {/* UI de cambios */}
          {modoVentana && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
              <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 10 }}>
                Hacé clic en un slot para cambiarlo. Solo podés elegir jugadores libres (que nadie tiene actualmente).
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={thStyle}>Slot</th>
                    <th style={thStyle}>Jugador actual</th>
                    <th style={thStyle}>Equipo</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {slotsConfig.slotNames.map(slot => {
                    const j = equipoDB.find(e => e.slot === slot)
                    const enEdicion = slotEditando === slot
                    const fueYaSoltado = ventanaInfo.soltados_ids?.includes(j?.jugador_id)
                    const esEliminadoSlot = slotsEliminados.has(slot)
                    return (
                      <>
                        <tr key={slot} style={{
                          borderBottom: enEdicion ? 'none' : '1px solid var(--color-border)',
                          background: esEliminadoSlot ? 'rgba(239,68,68,0.07)' : 'transparent',
                        }}>
                          <td style={{ ...tdStyle, color: esEliminadoSlot ? 'var(--color-danger)' : 'var(--color-primary)', fontWeight: 600 }}>{slot}</td>
                          <td style={tdStyle}>
                            {j?.nombre || <span style={{ color: 'var(--color-muted)' }}>—</span>}
                            {fueYaSoltado && <span style={{ color: 'var(--color-warning)', fontSize: 11, marginLeft: 6 }}>ya soltado</span>}
                            {esEliminadoSlot && (
                              <span style={{ color: 'var(--color-danger)', fontSize: 11, marginLeft: 6, fontWeight: 600 }}>⚠ ELIMINADO — reemplazá este slot</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--color-muted)', fontSize: 12 }}>{j?.equipo_real || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => { setSlotEditando(enEdicion ? null : slot); setBusquedaDisp('') }}
                              disabled={haciendoCambio}
                            >
                              {enEdicion ? 'Cancelar' : '🔄 Cambiar'}
                            </button>
                          </td>
                        </tr>
                        {enEdicion && (
                          <tr key={`${slot}-edit`} style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(59,130,246,0.04)' }}>
                            <td colSpan={4} style={{ padding: '10px 10px' }}>
                              <div style={{ marginBottom: 8 }}>
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Buscar jugador libre..."
                                  value={busquedaDisp}
                                  onChange={e => setBusquedaDisp(e.target.value)}
                                  style={{ ...inputStyleV, width: '100%' }}
                                />
                              </div>
                              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 4 }}>
                                {disponibles
                                  .filter(d => !busquedaDisp || d.nombre.toLowerCase().includes(busquedaDisp.toLowerCase()) || (d.equipo_real || '').toLowerCase().includes(busquedaDisp.toLowerCase()))
                                  .slice(0, 20)
                                  .map(d => (
                                    <div
                                      key={d.id}
                                      onClick={() => hacerCambio(slot, d.id)}
                                      style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <span><strong>{d.nombre}</strong> <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>({d.equipo_real})</span></span>
                                      <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{d.posicion}</span>
                                    </div>
                                  ))
                                }
                                {disponibles.filter(d => !busquedaDisp || d.nombre.toLowerCase().includes(busquedaDisp.toLowerCase()) || (d.equipo_real || '').toLowerCase().includes(busquedaDisp.toLowerCase())).length === 0 && (
                                  <div>
                                    <p style={{ padding: '8px 10px', color: 'var(--color-muted)', fontSize: 13, textAlign: 'center', margin: 0 }}>
                                      No hay jugadores libres con ese nombre.
                                    </p>
                                    {busquedaDisp.trim().length >= 3 && !creandoJugador && (
                                      <div
                                        onClick={() => { setCreandoJugador(true); setFormNuevo({ nombre: busquedaDisp.trim(), equipoRaw: '', equipoCatalogoId: null, posicion: '' }) }}
                                        style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderTop: '1px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 600 }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                      >
                                        ➕ Crear jugador: &ldquo;{busquedaDisp.trim()}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                )}
                                {creandoJugador && slotEditando === slot && (
                                  <div style={{ padding: '12px 10px', borderTop: '1px solid var(--color-border)', background: 'rgba(59,130,246,0.04)' }}>
                                    <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>Nuevo jugador — quedará pendiente de aprobación del admin</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <input
                                        type="text"
                                        placeholder="Nombre del jugador"
                                        value={formNuevo.nombre}
                                        onChange={e => setFormNuevo(f => ({ ...f, nombre: e.target.value }))}
                                        style={{ ...inputStyleV, width: '100%' }}
                                      />
                                      <div style={{ position: 'relative' }}>
                                        <input
                                          list="catalogo-nuevo-jug"
                                          type="text"
                                          placeholder="Equipo real..."
                                          value={formNuevo.equipoRaw}
                                          onChange={e => {
                                            const v = e.target.value
                                            const found = catalogo.find(c => c.nombre.toLowerCase() === v.toLowerCase())
                                            setFormNuevo(f => ({ ...f, equipoRaw: v, equipoCatalogoId: found?.id || null }))
                                          }}
                                          style={{ ...inputStyleV, width: '100%' }}
                                        />
                                        <datalist id="catalogo-nuevo-jug">
                                          {catalogo.map(c => <option key={c.id} value={c.nombre} />)}
                                        </datalist>
                                      </div>
                                      <select
                                        value={formNuevo.posicion}
                                        onChange={e => setFormNuevo(f => ({ ...f, posicion: e.target.value }))}
                                        style={{ ...inputStyleV, width: '100%' }}
                                      >
                                        <option value="">Posición...</option>
                                        <option value="ARQ">ARQ</option>
                                        <option value="DEF">DEF</option>
                                        <option value="MED">MED</option>
                                        <option value="DEL">DEL</option>
                                      </select>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                          className="btn btn-primary btn-sm"
                                          onClick={() => hacerCambioConNuevoJugador(slot)}
                                          disabled={haciendoCambio}
                                        >
                                          {haciendoCambio ? 'Guardando...' : '✅ Confirmar'}
                                        </button>
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => { setCreandoJugador(false); setFormNuevo({ nombre: '', equipoRaw: '', equipoCatalogoId: null, posicion: '' }) }}
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Banner corrección requerida */}
      {requiereCorreccion && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
          <strong style={{ color: 'var(--color-danger)', fontSize: 14, display: 'block', marginBottom: 6 }}>
            ⚠️ Tenés jugadores eliminados. Debés reemplazarlos.
          </strong>
          {(estadoGlobal?.mi_equipo_invalidados?.length ?? 0) > 0 && (
            <ul style={{ margin: '6px 0 8px', paddingLeft: 18, color: 'var(--color-danger)', fontSize: 13 }}>
              {(estadoGlobal?.mi_equipo_invalidados ?? []).map(j => (
                <li key={j.slot ?? j.jugador_id}><strong>{j.slot}</strong>: {j.nombre} — cuenta como 0 pts</li>
              ))}
            </ul>
          )}
          <p style={{ color: 'var(--color-muted)', fontSize: 12, margin: 0 }}>
            {ventanaInfo?.ventana
              ? 'Hay una ventana abierta — usá el panel de cambios arriba para reemplazar los slots marcados.'
              : 'Podrás reemplazarlos cuando se abra la próxima ventana de cambios. Mientras tanto, esos slots suman 0 puntos.'}
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-danger)', whiteSpace: 'pre-line' }}>
          {error}
        </div>
      )}
      {exito && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-success)' }}>
          {exito}
        </div>
      )}

      {/* Vista equipo guardado */}
      {tieneEquipo && !modoEdicion && (
        <div>
          {slotsConfig.groups.map(group => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <h3 style={{ color: 'var(--color-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{group.label}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={thStyle}>Slot</th>
                    <th style={thStyle}>Jugador</th>
                    <th style={thStyle}>Equipo</th>
                    <th style={thStyle}>Posición</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {group.slots.map(slot => {
                    const j = equipoDB.find(e => e.slot === slot)
                    const obs = observaciones.find(o => o.slot === slot)
                    const esPendiente = j?.estado_jugador === 'pendiente'
                    const esRechazado = j?.estado_jugador === 'rechazado'
                    const esEliminado = slotsEliminados.has(slot)
                    return (
                      <tr key={slot} style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: esEliminado ? 'rgba(239,68,68,0.1)'
                                  : esRechazado ? 'rgba(239,68,68,0.05)'
                                  : esPendiente ? 'rgba(167,139,250,0.06)'
                                  : obs ? 'rgba(245,158,11,0.05)' : 'transparent'
                      }}>
                        <td style={{ ...tdStyle, color: esEliminado ? 'var(--color-danger)' : 'var(--color-primary)', fontWeight: 600 }}>{slot}</td>
                        <td style={{ ...tdStyle, color: esPendiente || esRechazado ? 'var(--color-muted)' : 'var(--color-text)' }}>
                          {j?.nombre || '—'}
                          {esEliminado && (
                            <span style={{ display: 'block', color: 'var(--color-danger)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                              Jugador eliminado — no suma puntos
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{j?.equipo_real || j?.equipo_raw || '—'}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: obs ? 'var(--color-warning)' : 'var(--color-muted)' }}>
                          {j?.posicion ? POSICION_LABELS[j.posicion] : '—'}
                          {obs && <span> ⚠️ (esperaba {POSICION_LABELS[obs.posicion_esperada]})</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{j ? estadoBadge(j.estado_jugador) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

        </div>
      )}

      {/* Formulario de edición */}
      {modoEdicion && (
        <div>
          <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 6 }}>
            Formación 1-4-4-2. Escribí el equipo real y el nombre del jugador.
          </p>
          {catalogo.length > 0 && (
            <p style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 14 }}>
              💡 El catálogo tiene {catalogo.length} equipo{catalogo.length > 1 ? 's' : ''} cargado{catalogo.length > 1 ? 's' : ''} — aparecerán como sugerencias al escribir.
            </p>
          )}
          {slotsConfig.groups.map(group => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <h3 style={{ color: 'var(--color-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{group.label}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={thStyle}>Slot</th>
                    <th style={thStyle}>Pos.</th>
                    <th style={thStyle}>Equipo real</th>
                    <th style={thStyle}>Nombre del jugador</th>
                    <th style={thStyle}>Posición canónica</th>
                  </tr>
                </thead>
                <tbody>
                  {group.slots.map(slot => (
                    <SlotInput
                      key={slot}
                      slot={slot}
                      posicionDefault={slotsConfig.slotPosicion[slot] ?? null}
                      catalogoEquipos={catalogo}
                      value={form[slot]}
                      onChange={(val) => handleSlotChange(slot, val)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar equipo'}
            </button>
            {tieneEquipo && (
              <button className="btn btn-secondary" onClick={() => { setModoEdicion(false); setError(null) }}>
                Cancelar
              </button>
            )}
            {/* Counter dinámico de progreso */}
            {(() => {
              const completados = slotsConfig.slotNames.filter(s => form[s]?.nombre?.trim()).length
              const tot = slotsConfig.slotNames.length
              const listo = completados === tot
              return (
                <span style={{ fontSize: 12, color: listo ? 'var(--color-success)' : 'var(--color-muted)', fontWeight: listo ? 600 : 400 }}>
                  {completados}/{tot} jugadores
                </span>
              )
            })()}
            <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
              Los jugadores nuevos quedan pendientes hasta que el admin los apruebe.
            </span>
          </div>
        </div>
      )}

      {/* Sin equipo */}
      {!tieneEquipo && !modoEdicion && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
          <p>Todavía no cargaste tu equipo Gran DT.</p>
          <button className="btn btn-primary" onClick={() => setModoEdicion(true)}>
            Armar mi equipo
          </button>
        </div>
      )}
    </div>
  )
}
)}

      {/* Sin equipo */}
      {!tieneEquipo && !modoEdicion && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
          <p>Todavía no cargaste tu equipo Gran DT.</p>
          <button className="btn btn-primary" onClick={() => setModoEdicion(true)}>
            Armar mi equipo
          </button>
        </div>
      )}
    </div>
  )
}

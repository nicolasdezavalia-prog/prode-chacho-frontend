import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/index.js'
import { useAuth } from '../../App.jsx'

function formatARS(importe) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(importe)
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_SIGUIENTE = {
  borrador: 'abierta',
  abierta: 'cerrada',
  cerrada: 'finalizada',
  finalizada: null
}

const ESTADO_ANTERIOR = {
  abierta:    'borrador',
  cerrada:    'abierta',
  finalizada: 'cerrada',
}

const ESTADO_BTN = {
  borrador:   { label: 'Abrir fecha',     cls: 'btn-success' },
  abierta:    { label: 'Cerrar fecha',    cls: 'btn-danger'  },
  cerrada:    { label: 'Finalizar fecha', cls: 'btn-primary' },
  finalizada: null,
}

const ESTADO_BACK_BTN = {
  abierta:    { label: '← Volver a Borrador' },
  cerrada:    { label: '← Reabrir fecha'     },
  finalizada: { label: '← Volver a Cerrada'  },
}

export default function AdminFecha() {
  const { fechaId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'superadmin'
  const isNew = !fechaId

  const [torneos, setTorneos] = useState([])
  const [fecha, setFecha] = useState(null)
  const [form, setForm] = useState({
    torneo_id: '',
    nombre: '',
    numero: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    tipo: 'completa',
    importe_apuesta: '',
    deadline: ''
  })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadTorneos()
    if (!isNew) {
      loadFecha()
      loadCrucesYMovimientos()
    }
  }, [fechaId])

  useEffect(() => {
    if (!isNew && fecha?.deadline) {
      loadCumplimiento()
    }
  }, [fecha?.deadline, fechaId])

  const loadCrucesYMovimientos = async () => {
    try {
      const [cs, movs] = await Promise.all([
        api.getCruces(fechaId),
        api.getMovimientosFecha(fechaId),
      ])
      setCruces(cs)
      setMovFecha(movs.movimientos || [])
    } catch (_) {}
  }

  const loadCumplimiento = async () => {
    try {
      const data = await api.getDeadlineCumplimiento(fechaId)
      setCumplimiento(data)
    } catch (_) {
      setCumplimiento(null)
    }
  }

  const loadJugadoresTorneo = async (torneoId) => {
    if (!torneoId) return
    try {
      const t = await api.getTorneo(torneoId)
      setJugadoresTorneo(t.jugadores || [])
    } catch (_) {}
  }

  const loadTorneos = async () => {
    try {
      const ts = await api.getTorneos()
      setTorneos(ts)
      if (ts.length > 0 && !form.torneo_id) {
        setForm(f => ({ ...f, torneo_id: ts[0].id }))
      }
    } catch (err) { console.error(err) }
  }

  const loadFecha = async () => {
    try {
      const f = await api.getFecha(fechaId)
      setFecha(f)
      setForm({
        torneo_id: f.torneo_id,
        nombre: f.nombre,
        numero: f.numero,
        mes: f.mes,
        anio: f.anio,
        tipo: f.tipo || 'completa',
        importe_apuesta: f.importe_apuesta ?? '',
        deadline: f.deadline ?? ''
      })
      loadJugadoresTorneo(f.torneo_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const created = await api.createFecha({
          ...form,
          importe_apuesta: form.importe_apuesta === '' ? null : parseInt(form.importe_apuesta),
          deadline: form.deadline === '' ? null : form.deadline,
        })
        setSuccess('Fecha creada correctamente')
        navigate(`/admin/fecha/${created.id}`)
      } else {
        await api.updateFecha(fechaId, {
          nombre: form.nombre,
          mes: form.mes,
          anio: form.anio,
          tipo: form.tipo,
          importe_apuesta: form.importe_apuesta === '' ? null : parseInt(form.importe_apuesta),
          deadline: form.deadline === '' ? null : form.deadline,
        })
        setSuccess('Fecha actualizada')
        loadFecha()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCambiarEstado = async () => {
    if (!fecha) return
    const nuevoEstado = ESTADO_SIGUIENTE[fecha.estado]
    if (!nuevoEstado) return
    try {
      await api.updateFecha(fechaId, { estado: nuevoEstado })
      loadFecha()
    } catch (err) { setError(err.message) }
  }

  const handleEliminar = async () => {
    if (!confirm(`⚠️ ¿Eliminar la fecha "${fecha.nombre}"?\n\nEsto borrará todos sus eventos, cruces y pronósticos. No se puede deshacer.`)) return
    try {
      await api.deleteFecha(fechaId)
      navigate('/')
    } catch (err) { setError(err.message) }
  }

  const handleRetrocederEstado = async () => {
    if (!fecha) return
    const estadoAnterior = ESTADO_ANTERIOR[fecha.estado]
    if (!estadoAnterior) return
    const btn = ESTADO_BACK_BTN[fecha.estado]
    if (!confirm(`¿${btn.label.replace('← ', '')} la fecha "${fecha.nombre}"?`)) return
    try {
      await api.updateFecha(fechaId, { estado: estadoAnterior })
      loadFecha()
    } catch (err) { setError(err.message) }
  }

  const [recalculando, setRecalculando] = useState(false)
  const [cruces, setCruces] = useState([])
  const [movFecha, setMovFecha] = useState([])
  const [jugadoresTorneo, setJugadoresTorneo] = useState([])
  const [apuestaForm, setApuestaForm] = useState({ paga_user_id: '', acreedor_user_id: '', importe: '', concepto: 'Deuda adicional' })
  const [savingApuesta, setSavingApuesta] = useState(false)
  const [cumplimiento, setCumplimiento] = useState(null)
  const [multaImportes, setMultaImportes] = useState({}) // { user_id: importe_str }
  const [savingMulta, setSavingMulta] = useState({})
  const handleRecalcular = async () => {
    if (!fecha || fecha.estado === 'borrador') return
    setRecalculando(true)
    setError('')
    try {
      await api.recalcularFecha(fechaId)
      setSuccess('Recálculo completado: puntos, cruces y tabla actualizados')
    } catch (err) {
      setError('Error al recalcular: ' + err.message)
    } finally {
      setRecalculando(false)
    }
  }

  const handleAgregarApuesta = async (e) => {
    e.preventDefault()
    if (!apuestaForm.paga_user_id || !apuestaForm.importe) return
    const acreedorId = apuestaForm.acreedor_user_id ? parseInt(apuestaForm.acreedor_user_id) : null
    setSavingApuesta(true)
    try {
      await api.crearMovimientoManual({
        torneo_id: fecha.torneo_id,
        fecha_id: parseInt(fechaId),
        user_id: parseInt(apuestaForm.paga_user_id),
        acreedor_user_id: acreedorId,
        concepto: apuestaForm.concepto || 'Deuda adicional',
        importe: parseInt(apuestaForm.importe),
        signo: '+',
      })
      setApuestaForm(f => ({ ...f, paga_user_id: '', acreedor_user_id: '', importe: '', concepto: 'Deuda adicional' }))
      await loadCrucesYMovimientos()
      setSuccess('Deuda agregada')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingApuesta(false)
    }
  }

  const handleEliminarMov = async (id) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      await api.eliminarMovimiento(id)
      await loadCrucesYMovimientos()
      if (fecha?.deadline) await loadCumplimiento()
    } catch (err) { setError(err.message) }
  }

  const handleCargarMulta = async (userId) => {
    const importe = parseInt(multaImportes[userId])
    if (!importe || importe <= 0) return
    setSavingMulta(s => ({ ...s, [userId]: true }))
    try {
      await api.crearMultaDeadline({
        torneo_id: fecha.torneo_id,
        fecha_id: parseInt(fechaId),
        user_id: userId,
        importe,
      })
      setMultaImportes(m => ({ ...m, [userId]: '' }))
      await Promise.all([loadCumplimiento(), loadCrucesYMovimientos()])
      setSuccess('Multa cargada')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingMulta(s => ({ ...s, [userId]: false }))
    }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to="/" className="text-muted" style={{fontSize: 13, textDecoration: 'none'}}>
            ← Inicio
          </Link>
          <div className="page-title" style={{marginTop: 4}}>
            {isNew ? 'Nueva Fecha' : `Admin: ${fecha?.nombre}`}
          </div>
        </div>
        {!isNew && fecha && (
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <span className={`badge badge-${fecha.estado}`}>{fecha.estado}</span>
            {ESTADO_BACK_BTN[fecha.estado] && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRetrocederEstado}
                style={{ fontSize: 12 }}
              >
                {ESTADO_BACK_BTN[fecha.estado].label}
              </button>
            )}
            {ESTADO_BTN[fecha.estado] && (
              <button
                className={`btn ${ESTADO_BTN[fecha.estado].cls}`}
                onClick={handleCambiarEstado}
              >
                {ESTADO_BTN[fecha.estado].label}
              </button>
            )}
            {fecha.estado !== 'borrador' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRecalcular}
                disabled={recalculando}
                title="Recalcula puntos, cruces y tabla general para esta fecha"
                style={{ fontSize: 12 }}
              >
                {recalculando ? '⏳ Recalculando...' : '🔄 Recalcular'}
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleEliminar}
              style={{ fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            >
              🗑 Eliminar
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {/* Formulario */}
      <div className="card" style={{maxWidth: 600}}>
        <div className="card-header">Datos de la fecha</div>
        <form onSubmit={handleSubmit}>
          {isNew && (
            <div className="form-group">
              <label>Torneo</label>
              <select
                value={form.torneo_id}
                onChange={e => setForm(f => ({ ...f, torneo_id: parseInt(e.target.value) }))}
                required
              >
                <option value="">Seleccionar...</option>
                {torneos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} ({t.semestre})</option>
                ))}
              </select>
            </div>
          )}

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div className="form-group">
              <label>Nombre de la fecha</label>
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Fecha 3"
                required
              />
            </div>
            {isNew && (
              <div className="form-group">
                <label>Número</label>
                <input
                  type="number"
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: parseInt(e.target.value) }))}
                  min="1"
                  required
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Tipo de fecha</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {[
                { value: 'completa', label: '📋 Completa', desc: 'Con 30 eventos, pronósticos y resultados detallados' },
                { value: 'resumida', label: '⚡ Resumida', desc: 'Solo ganadores de bloque (histórico o abierta simplificada)' },
              ].map(opt => (
                <label key={opt.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                  background: form.tipo === opt.value ? 'rgba(99,102,241,0.1)' : 'var(--color-surface2)',
                  border: `1px solid ${form.tipo === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius)', padding: '10px 14px', flex: 1,
                }}>
                  <input
                    type="radio"
                    name="tipo"
                    value={opt.value}
                    checked={form.tipo === opt.value}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div className="form-group">
              <label>Mes</label>
              <select
                value={form.mes}
                onChange={e => setForm(f => ({ ...f, mes: parseInt(e.target.value) }))}
              >
                {MESES.map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Año</label>
              <input
                type="number"
                value={form.anio}
                onChange={e => setForm(f => ({ ...f, anio: parseInt(e.target.value) }))}
                min="2024"
              />
            </div>
          </div>

          <div className="form-group">
            <label>💰 Apuesta por fecha (ARS)</label>
            <input
              type="number"
              value={form.importe_apuesta}
              onChange={e => setForm(f => ({ ...f, importe_apuesta: e.target.value }))}
              placeholder="Ej: 5000 — dejá vacío si no hay apuesta"
              min="0"
              style={{ maxWidth: 280 }}
            />
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
              Si se carga un importe, los empates generan una deuda al pozo automáticamente.
            </div>
          </div>

          <div className="form-group">
            <label>⏰ Deadline de pronósticos</label>
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              style={{ maxWidth: 280 }}
            />
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
              Opcional. Fecha y hora límite para cargar pronósticos (solo informativo por ahora).
            </div>
          </div>

          {/* Bloques: info de solo lectura, se configura en Admin Torneo */}
          {form.torneo_id && (() => {
            const t = torneos.find(x => x.id === form.torneo_id || x.id === parseInt(form.torneo_id))
            if (!t) return null
            return (
              <div style={{
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, fontSize: 12
              }}>
                <span style={{ color: 'var(--color-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Bloques del torneo
                </span>
                <div style={{ marginTop: 6, display: 'flex', gap: 24 }}>
                  <span>🅰 <strong>{t.bloque1_nombre || 'Bloque 1'}</strong> (eventos 1–15)</span>
                  <span>🅱 <strong>{t.bloque2_nombre || 'Bloque 2'}</strong> (eventos 16–30)</span>
                </div>
                <div style={{ marginTop: 4, color: 'var(--color-muted)', fontSize: 11 }}>
                  Para cambiar los nombres, ir a <strong>Admin Torneo</strong>.
                </div>
              </div>
            )
          })()}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isNew ? 'Crear fecha' : 'Actualizar'}
          </button>
        </form>
      </div>

      {/* Acciones rápidas para fecha existente */}
      {!isNew && fecha && (
        <div className="card" style={{marginTop: 16}}>
          <div className="card-header">
            Acciones de la fecha
            {fecha.tipo === 'resumida' && (
              <span style={{
                marginLeft: 10, fontSize: 11, fontWeight: 600,
                background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)',
                padding: '2px 8px', borderRadius: 99,
              }}>⚡ RESUMIDA</span>
            )}
          </div>
          <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
            {fecha.tipo === 'resumida' ? (
              <>
                <Link to={`/admin/fecha/${fechaId}/fixture`} className="btn btn-secondary">
                  🔀 Definir fixture de cruces
                </Link>
                <Link to={`/admin/fecha/${fechaId}/resumido`} className="btn btn-primary">
                  ⚡ Resultados resumidos
                </Link>
              </>
            ) : (
              <>
                <Link to={`/admin/fecha/${fechaId}/eventos`} className="btn btn-secondary">
                  📋 Cargar eventos (30)
                </Link>
                <Link to={`/admin/fecha/${fechaId}/fixture`} className="btn btn-secondary">
                  🔀 Definir fixture de cruces
                </Link>
                <Link to={`/admin/fecha/${fechaId}/resultados`} className="btn btn-secondary">
                  ⚽ Cargar resultados
                </Link>
                <Link to={`/admin/fecha/${fechaId}/gdt`} className="btn btn-secondary">
                  🏆 Puntajes GDT
                </Link>
              </>
            )}
            {fecha?.estado === 'abierta' && (
              <Link to={`/fecha/${fechaId}?preview=true`} className="btn btn-secondary">
                👁 Ver como jugador
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Cumplimiento de deadline — solo si la fecha tiene deadline */}
      {!isNew && fecha?.deadline && cumplimiento && (
        <div className="card" style={{marginTop: 16}}>
          <div className="card-header">
            ⏰ Cumplimiento de deadline
            <span style={{marginLeft: 10, fontSize: 12, fontWeight: 400, color: 'var(--color-muted)'}}>
              {new Date(fecha.deadline).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              style={{marginLeft: 12, fontSize: 11}}
              onClick={loadCumplimiento}
            >
              🔄
            </button>
          </div>

          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
            <thead>
              <tr style={{background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)'}}>
                {['Jugador', 'Pronós.', 'Último envío', 'Estado', 'Multa (ARS)', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '6px 10px', fontWeight: 600, fontSize: 11,
                    textAlign: i >= 4 ? 'center' : 'left',
                    color: 'var(--color-muted)', textTransform: 'uppercase'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cumplimiento.jugadores.map(j => {
                const estadoConfig = {
                  ok:              { label: '✅ OK',              color: 'var(--color-success)' },
                  incompleto:      { label: '⚠️ Incompleto',     color: '#b45309' },
                  fuera_de_termino:{ label: '🚨 Fuera de término', color: 'var(--color-danger)' },
                }[j.estado]

                const puedeMultar = (j.estado === 'incompleto' || j.estado === 'fuera_de_termino') && !j.ya_multado
                const importeStr = multaImportes[j.user_id] || ''

                return (
                  <tr key={j.user_id} style={{borderBottom: '1px solid var(--color-border)'}}>
                    <td style={{padding: '7px 10px', fontWeight: 600}}>{j.nombre}</td>
                    <td style={{padding: '7px 10px', color: 'var(--color-muted)'}}>
                      {j.total_pronos} / {j.total_eventos}
                    </td>
                    <td style={{padding: '7px 10px', fontSize: 12, color: 'var(--color-muted)'}}>
                      {j.ultimo_at
                        ? new Date(j.ultimo_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td style={{padding: '7px 10px', fontWeight: 600, color: estadoConfig.color}}>
                      {estadoConfig.label}
                    </td>
                    <td style={{padding: '7px 10px'}}>
                      {j.ya_multado ? (
                        <span style={{fontSize: 12, color: 'var(--color-danger)', fontWeight: 600}}>
                          {formatARS(j.importe_multa)} multa cargada
                        </span>
                      ) : puedeMultar ? (
                        <input
                          type="number"
                          min="1"
                          placeholder="Importe"
                          value={importeStr}
                          onChange={e => setMultaImportes(m => ({ ...m, [j.user_id]: e.target.value }))}
                          style={{width: 100, padding: '3px 6px', fontSize: 12}}
                        />
                      ) : (
                        <span style={{fontSize: 11, color: 'var(--color-muted)'}}>—</span>
                      )}
                    </td>
                    <td style={{padding: '7px 10px', textAlign: 'center'}}>
                      {j.ya_multado ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)'}}
                          onClick={async () => {
                            if (!confirm(`¿Eliminar la multa de ${j.nombre}?`)) return
                            try {
                              for (const id of j.multa_ids) await api.eliminarMovimiento(id)
                              await Promise.all([loadCumplimiento(), loadCrucesYMovimientos()])
                            } catch (err) { setError(err.message) }
                          }}
                        >
                          🗑 Eliminar multa
                        </button>
                      ) : puedeMultar && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{fontSize: 11}}
                          disabled={!importeStr || savingMulta[j.user_id]}
                          onClick={() => handleCargarMulta(j.user_id)}
                        >
                          {savingMulta[j.user_id] ? '...' : 'Multar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{fontSize: 11, color: 'var(--color-muted)', marginTop: 10}}>
            La multa va al pozo. El admin puede perdonar simplemente no cargándola. Las multas ya cargadas se pueden eliminar desde la sección de deudas.
          </div>
        </div>
      )}

      {/* Deudas adicionales — solo superadmin */}
      {!isNew && fecha && isSuperAdmin && fecha.estado !== 'borrador' && jugadoresTorneo.length > 0 && (
        <div className="card" style={{marginTop: 16}}>
          <div className="card-header">💸 Deudas adicionales</div>

          {/* Formulario */}
          <form onSubmit={handleAgregarApuesta} style={{marginBottom: 16}}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12}}>
              {/* Quién paga */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>Quién paga</label>
                <select
                  value={apuestaForm.paga_user_id}
                  onChange={e => setApuestaForm(f => ({ ...f, paga_user_id: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {jugadoresTorneo.map(j => (
                    <option key={j.id} value={j.id}>{j.nombre}</option>
                  ))}
                </select>
              </div>

              {/* A quién le paga */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>A quién le paga</label>
                <select
                  value={apuestaForm.acreedor_user_id}
                  onChange={e => setApuestaForm(f => ({ ...f, acreedor_user_id: e.target.value }))}
                >
                  <option value="">Al POZO</option>
                  {jugadoresTorneo
                    .filter(j => j.id !== parseInt(apuestaForm.paga_user_id))
                    .map(j => (
                      <option key={j.id} value={j.id}>{j.nombre}</option>
                    ))}
                </select>
              </div>

              {/* Importe */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>Importe (ARS)</label>
                <input
                  type="number"
                  min="1"
                  value={apuestaForm.importe}
                  onChange={e => setApuestaForm(f => ({ ...f, importe: e.target.value }))}
                  placeholder="Ej: 5000"
                  required
                />
              </div>

              {/* Concepto */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>Concepto</label>
                <input
                  value={apuestaForm.concepto}
                  onChange={e => setApuestaForm(f => ({ ...f, concepto: e.target.value }))}
                  placeholder="Deuda adicional"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-sm" disabled={savingApuesta}>
              {savingApuesta ? 'Agregando...' : '+ Agregar deuda'}
            </button>
          </form>

          {/* Lista de movimientos manuales y multas de deadline */}
          {movFecha.filter(m => m.tipo === 'manual' || m.tipo === 'multa_deadline').length > 0 && (
            <div>
              <div style={{fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase'}}>
                Apuestas cargadas
              </div>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
                <thead>
                  <tr style={{background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)'}}>
                    {['Jugador', 'Concepto', 'Importe', 'A quién', 'Estado', ''].map((h, i) => (
                      <th key={i} style={{padding: '5px 8px', fontWeight: 600, fontSize: 11, textAlign: i >= 2 ? 'center' : 'left', color: 'var(--color-muted)', textTransform: 'uppercase'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movFecha.filter(m => m.tipo === 'manual' || m.tipo === 'multa_deadline').map(m => (
                    <tr key={m.id} style={{borderBottom: '1px solid var(--color-border)', background: m.pagado ? '#f0fdf4' : 'inherit'}}>
                      <td style={{padding: '5px 8px', fontWeight: 600}}>{m.user_nombre}</td>
                      <td style={{padding: '5px 8px', color: 'var(--color-muted)'}}>
                        {m.concepto}
                        {m.tipo === 'multa_deadline' && (
                          <span style={{marginLeft: 6, fontSize: 10, fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: 'var(--color-danger)', padding: '1px 5px', borderRadius: 4}}>
                            MULTA
                          </span>
                        )}
                      </td>
                      <td style={{padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: m.pagado ? 'var(--color-success)' : '#b45309'}}>
                        {formatARS(m.importe)}
                      </td>
                      <td style={{padding: '5px 8px', textAlign: 'center'}}>
                        {m.acreedor_nombre || <span style={{color: 'var(--color-muted)'}}>POZO</span>}
                      </td>
                      <td style={{padding: '5px 8px', textAlign: 'center'}}>
                        <span style={{fontSize: 11, fontWeight: 600, color: m.pagado ? 'var(--color-success)' : '#b45309'}}>
                          {m.pagado ? '✓ Pagado' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{padding: '5px 8px', textAlign: 'center'}}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)'}}
                          onClick={() => handleEliminarMov(m.id)}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {movFecha.filter(m => m.tipo === 'manual' || m.tipo === 'multa_deadline').length === 0 && (
            <p style={{fontSize: 12, color: 'var(--color-muted)', margin: 0}}>
              Sin apuestas adicionales cargadas para esta fecha.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

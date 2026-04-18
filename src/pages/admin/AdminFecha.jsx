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
    bloque1_nombre: 'Liga Argentina',
    bloque2_nombre: 'Bloque 2',
    tipo: 'completa',
    importe_apuesta: ''
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
        bloque1_nombre: f.bloque1_nombre,
        bloque2_nombre: f.bloque2_nombre,
        tipo: f.tipo || 'completa',
        importe_apuesta: f.importe_apuesta ?? ''
      })
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
        })
        setSuccess('Fecha creada correctamente')
        navigate(`/admin/fecha/${created.id}`)
      } else {
        await api.updateFecha(fechaId, {
          nombre: form.nombre,
          bloque1_nombre: form.bloque1_nombre,
          bloque2_nombre: form.bloque2_nombre,
          mes: form.mes,
          anio: form.anio,
          tipo: form.tipo,
          importe_apuesta: form.importe_apuesta === '' ? null : parseInt(form.importe_apuesta),
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
  const [apuestaForm, setApuestaForm] = useState({ cruce_id: '', paga_user_id: '', acreedor: 'rival', importe: '', concepto: 'Apuesta adicional' })
  const [savingApuesta, setSavingApuesta] = useState(false)
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
    if (!apuestaForm.cruce_id || !apuestaForm.paga_user_id || !apuestaForm.importe) return
    const cruce = cruces.find(c => c.id === parseInt(apuestaForm.cruce_id))
    if (!cruce) return
    const acreedorId = apuestaForm.acreedor === 'rival'
      ? (cruce.user1_id === parseInt(apuestaForm.paga_user_id) ? cruce.user2_id : cruce.user1_id)
      : null
    setSavingApuesta(true)
    try {
      await api.crearMovimientoManual({
        torneo_id: fecha.torneo_id,
        fecha_id: parseInt(fechaId),
        cruce_id: parseInt(apuestaForm.cruce_id),
        user_id: parseInt(apuestaForm.paga_user_id),
        acreedor_user_id: acreedorId,
        concepto: apuestaForm.concepto || 'Apuesta adicional',
        importe: parseInt(apuestaForm.importe),
        signo: '+',
      })
      setApuestaForm(f => ({ ...f, cruce_id: '', paga_user_id: '', importe: '', concepto: 'Apuesta adicional' }))
      await loadCrucesYMovimientos()
      setSuccess('Apuesta agregada')
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
    } catch (err) { setError(err.message) }
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

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div className="form-group">
              <label>Nombre Bloque 1 (eventos 1-15)</label>
              <input
                value={form.bloque1_nombre}
                onChange={e => setForm(f => ({ ...f, bloque1_nombre: e.target.value }))}
                placeholder="Liga Argentina"
              />
            </div>
            <div className="form-group">
              <label>Nombre Bloque 2 (eventos 16-30)</label>
              <input
                value={form.bloque2_nombre}
                onChange={e => setForm(f => ({ ...f, bloque2_nombre: e.target.value }))}
                placeholder="Bloque 2"
              />
            </div>
          </div>

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
            <Link to={`/fecha/${fechaId}?preview=true`} className="btn btn-secondary">
              👁 Ver como jugador
            </Link>
          </div>
        </div>
      )}

      {/* Apuestas adicionales — solo superadmin, solo cuando hay cruces con apuesta */}
      {!isNew && fecha && isSuperAdmin && fecha.estado !== 'borrador' && cruces.length > 0 && fecha.importe_apuesta > 0 && (
        <div className="card" style={{marginTop: 16}}>
          <div className="card-header">💸 Apuestas adicionales por duelo</div>

          {/* Formulario */}
          <form onSubmit={handleAgregarApuesta} style={{marginBottom: 16}}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12}}>
              {/* Seleccionar cruce */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>Duelo</label>
                <select
                  value={apuestaForm.cruce_id}
                  onChange={e => setApuestaForm(f => ({ ...f, cruce_id: e.target.value, paga_user_id: '' }))}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {cruces.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.user1_nombre} vs {c.user2_nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quién paga */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>Quién paga</label>
                <select
                  value={apuestaForm.paga_user_id}
                  onChange={e => setApuestaForm(f => ({ ...f, paga_user_id: e.target.value }))}
                  required
                  disabled={!apuestaForm.cruce_id}
                >
                  <option value="">Seleccionar...</option>
                  {apuestaForm.cruce_id && (() => {
                    const c = cruces.find(c => c.id === parseInt(apuestaForm.cruce_id))
                    return c ? [
                      <option key={c.user1_id} value={c.user1_id}>{c.user1_nombre}</option>,
                      <option key={c.user2_id} value={c.user2_id}>{c.user2_nombre}</option>,
                    ] : null
                  })()}
                </select>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12}}>
              {/* A quién le paga */}
              <div className="form-group" style={{margin: 0}}>
                <label style={{fontSize: 12}}>A quién</label>
                <select
                  value={apuestaForm.acreedor}
                  onChange={e => setApuestaForm(f => ({ ...f, acreedor: e.target.value }))}
                >
                  <option value="rival">Al rival</option>
                  <option value="pozo">Al POZO</option>
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
                  placeholder="Apuesta adicional"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-sm" disabled={savingApuesta}>
              {savingApuesta ? 'Agregando...' : '+ Agregar apuesta'}
            </button>
          </form>

          {/* Lista de movimientos manuales de esta fecha */}
          {movFecha.filter(m => m.tipo === 'manual').length > 0 && (
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
                  {movFecha.filter(m => m.tipo === 'manual').map(m => (
                    <tr key={m.id} style={{borderBottom: '1px solid var(--color-border)', background: m.pagado ? '#f0fdf4' : 'inherit'}}>
                      <td style={{padding: '5px 8px', fontWeight: 600}}>{m.user_nombre}</td>
                      <td style={{padding: '5px 8px', color: 'var(--color-muted)'}}>{m.concepto}</td>
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

          {movFecha.filter(m => m.tipo === 'manual').length === 0 && (
            <p style={{fontSize: 12, color: 'var(--color-muted)', margin: 0}}>
              Sin apuestas adicionales cargadas para esta fecha.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

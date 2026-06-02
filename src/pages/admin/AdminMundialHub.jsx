import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'
import MundialIcon from '../../components/MundialIcon.jsx'
import AdminMundialEquipos from './AdminMundialEquipos.jsx'
import AdminMundialPreguntas from './AdminMundialPreguntas.jsx'

/**
 * Hub admin del módulo Mundial — Fase 1.
 * En esta fase SOLO está activa la pestaña Config:
 *   - mostrar/editar estado (con transiciones forward-only)
 *   - editar costo_cambio_usd, cambios_por_usuario, deadline_carga
 *     (solo cuando estado ∈ {configuracion, abierto})
 *
 * Las pestañas Preguntas, Equipos, Premios, Resultados y Cambios se habilitan
 * en fases siguientes (Fase 2-5). En Fase 1 aparecen como tabs deshabilitadas.
 */

const ESTADO_LABEL = {
  configuracion:    'Configuración',
  abierto:          'Abierto',
  cerrado:          'Cerrado',
  grupos_jugados:   'Grupos jugados',
  cambios_abiertos: 'Cambios abiertos',
  cambios_cerrados: 'Cambios cerrados',
  resultados:       'Resultados',
  finalizado:       'Finalizado',
}

const PROXIMO_ESTADO = {
  configuracion:    'abierto',
  abierto:          'cerrado',
  cerrado:          'grupos_jugados',
  grupos_jugados:   'cambios_abiertos',
  cambios_abiertos: 'cambios_cerrados',
  cambios_cerrados: 'resultados',
  resultados:       'finalizado',
  finalizado:       null,
}

/**
 * Parsea un `deadline_carga` ISO con offset -03:00 (formato canónico que
 * generamos al guardar) y devuelve { fecha: 'YYYY-MM-DD', hora: 'HH:MM' }.
 * Si el valor no matchea (vacío, formato exótico), devuelve campos vacíos
 * y el usuario re-ingresa. No intenta convertir desde UTC u otros offsets
 * para no introducir bugs de zona horaria silenciosos.
 */
function parseDeadlineISO(s) {
  if (!s || typeof s !== 'string') return { fecha: '', hora: '' }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?-03:00$/)
  if (!m) return { fecha: '', hora: '' }
  return { fecha: m[1], hora: m[2] }
}

/**
 * Combina fecha (YYYY-MM-DD) + hora (HH:MM) en ISO 8601 con offset -03:00.
 * Si alguno está vacío o malformado, devuelve null → backend persiste sin deadline.
 */
function buildDeadlineISO(fecha, hora) {
  if (!fecha || !hora) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  if (!/^\d{2}:\d{2}$/.test(hora))        return null
  return `${fecha}T${hora}:00-03:00`
}

/** Preview legible 'DD/MM/YYYY HH:MM' a partir de los campos del form. */
function previewDeadline(fecha, hora) {
  if (!fecha || !hora) return ''
  const [y, m, d] = fecha.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y} ${hora}`
}

export default function AdminMundialHub() {
  const { torneoId } = useParams()
  const [torneo, setTorneo]   = useState(null)
  const [config, setConfig]   = useState(null)
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const [avanzando, setAvanzando] = useState(false)
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')
  // Tabs state-based (Fase 2.1). Solo 'config' y 'equipos' están activas.
  // Las demás (preguntas, premios, resultados, cambios) entran en fases siguientes.
  const [activeTab, setActiveTab] = useState('config')

  useEffect(() => { load() }, [torneoId])

  async function load() {
    setError(''); setInfo('')
    try {
      const [torneos, cfg] = await Promise.all([
        api.getMundialTorneos(),
        api.getMundialConfig(torneoId),
      ])
      const t = (torneos || []).find(x => x.id === parseInt(torneoId))
      if (!t) throw new Error('Torneo Mundial no encontrado (¿está bien la URL?)')
      setTorneo(t)
      setConfig(cfg)
      const parsedDeadline = parseDeadlineISO(cfg.deadline_carga)
      setForm({
        costo_cambio_usd:    cfg.costo_cambio_usd ?? 30,
        cambios_por_usuario: cfg.cambios_por_usuario ?? 3,
        deadline_fecha:      parsedDeadline.fecha,
        deadline_hora:       parsedDeadline.hora,
      })
    } catch (e) { setError(e.message) }
  }

  const editable = config && (config.estado === 'configuracion' || config.estado === 'abierto')
  const proximo  = config && PROXIMO_ESTADO[config.estado]

  async function handleGuardarConfig(e) {
    e.preventDefault()
    if (!editable) return
    setSaving(true); setError(''); setInfo('')
    try {
      const body = {
        costo_cambio_usd:    parseInt(form.costo_cambio_usd, 10),
        cambios_por_usuario: parseInt(form.cambios_por_usuario, 10),
        // Solo se persiste si ambos campos están completos. Si uno está vacío,
        // mandamos null (el backend ya acepta null para borrar el deadline).
        deadline_carga:      buildDeadlineISO(form.deadline_fecha, form.deadline_hora),
      }
      await api.updateMundialConfig(torneoId, body)
      setInfo('Configuración guardada.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvanzarEstado() {
    if (!proximo) return
    const ok = confirm(
      `¿Pasar el torneo a estado "${ESTADO_LABEL[proximo]}"?\n\n` +
      `Las transiciones son forward-only en Fase 1: no hay manera de revertir desde la UI.`
    )
    if (!ok) return
    setAvanzando(true); setError(''); setInfo('')
    try {
      await api.updateMundialConfig(torneoId, { estado: proximo })
      setInfo(`Estado avanzado a "${ESTADO_LABEL[proximo]}".`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setAvanzando(false)
    }
  }

  if (error && !torneo) return <div className="error-msg" style={{ margin: 24 }}>{error}</div>
  if (!torneo || !config) return <div className="loading">Cargando...</div>

  return (
    <div style={{ maxWidth: 920, margin: '24px auto', padding: '0 16px' }}>
      {/* Header */}
      <div className="flex-between mb-16">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MundialIcon size={32} />
            <span>Admin Mundial — {torneo.nombre}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {torneo.semestre}
          </div>
        </div>
        <Link to="/admin/torneo" className="btn btn-secondary btn-sm">
          ← Volver a Torneos
        </Link>
      </div>

      {/* Estado actual + avanzar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{
              fontSize: 11,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}>
              Estado actual
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {ESTADO_LABEL[config.estado] || config.estado}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {proximo ? (
            <button
              className="btn btn-primary"
              onClick={handleAvanzarEstado}
              disabled={avanzando}
            >
              {avanzando ? 'Avanzando...' : `→ Pasar a "${ESTADO_LABEL[proximo]}"`}
            </button>
          ) : (
            <span className="badge badge-finalizada">Torneo finalizado</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 16,
        overflowY: 'hidden',
      }}>
        <Tab
          label="⚙️ Config"
          active={activeTab === 'config'}
          onClick={() => setActiveTab('config')}
        />
        <Tab
          label="❓ Preguntas"
          active={activeTab === 'preguntas'}
          onClick={() => setActiveTab('preguntas')}
        />
        <Tab
          label="🌐 Equipos"
          active={activeTab === 'equipos'}
          onClick={() => setActiveTab('equipos')}
        />
        <Tab label="🏆 Premios"    disabled tip="Disponible en Fase 2" />
        <Tab label="📋 Resultados" disabled tip="Disponible en Fase 3" />
        <Tab label="🔁 Cambios"    disabled tip="Disponible en Fase 5" />
      </div>

      {error && <div className="error-msg">{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(22,163,74,0.10)',
          color: 'var(--color-success)',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}>
          {info}
        </div>
      )}

      {/* Tab Config */}
      {activeTab === 'config' && (
        <>
          <form onSubmit={handleGuardarConfig} className="card">
            <div className="card-header">Configuración general</div>

            {!editable && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.04)',
                color: 'var(--color-muted)',
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 13,
              }}>
                ℹ️ La configuración solo se puede editar mientras el estado es{' '}
                <strong>Configuración</strong> o <strong>Abierto</strong>.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Costo por paquete de cambios (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={form.costo_cambio_usd}
                  onChange={e => setForm(f => ({ ...f, costo_cambio_usd: e.target.value }))}
                  disabled={!editable}
                />
              </div>
              <div className="form-group">
                <label>Cambios máx. por usuario</label>
                <input
                  type="number"
                  min="0"
                  value={form.cambios_por_usuario}
                  onChange={e => setForm(f => ({ ...f, cambios_por_usuario: e.target.value }))}
                  disabled={!editable}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Deadline de carga (opcional)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={form.deadline_fecha}
                    onChange={e => setForm(f => ({ ...f, deadline_fecha: e.target.value }))}
                    disabled={!editable}
                    style={{ flex: '1 1 170px', maxWidth: 220 }}
                  />
                  <input
                    type="time"
                    step="60"
                    value={form.deadline_hora}
                    onChange={e => setForm(f => ({ ...f, deadline_hora: e.target.value }))}
                    disabled={!editable}
                    style={{ flex: '0 0 130px' }}
                  />
                  {(form.deadline_fecha || form.deadline_hora) && editable && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setForm(f => ({ ...f, deadline_fecha: '', deadline_hora: '' }))}
                      title="Quitar deadline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                  Horario Argentina (UTC-3)
                </div>
                {(form.deadline_fecha && form.deadline_hora) ? (
                  <div style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 6 }}>
                    Cierre de carga: <strong>{previewDeadline(form.deadline_fecha, form.deadline_hora)}</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    Sin deadline (la carga queda abierta hasta el cambio de estado manual).
                  </div>
                )}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={!editable || saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>

          <div style={{
            marginTop: 24,
            fontSize: 12,
            color: 'var(--color-muted)',
            lineHeight: 1.5,
          }}>
            <strong>Fase 2.2.</strong> Activas: <em>Config</em>, <em>Equipos</em> y <em>Preguntas</em>.
            Premios (Fase 2), Resultados (Fase 3) y Cambios (Fase 5) entran en fases
            siguientes. Tampoco hay carga de respuestas de usuarios, ranking ni importer
            de Excel todavía.
          </div>
        </>
      )}

      {/* Tab Equipos */}
      {activeTab === 'equipos' && (
        <AdminMundialEquipos
          torneoId={torneoId}
          estado={config.estado}
          onChanged={load}
        />
      )}

      {/* Tab Preguntas */}
      {activeTab === 'preguntas' && (
        <AdminMundialPreguntas
          torneoId={torneoId}
          estado={config.estado}
          onChanged={load}
        />
      )}
    </div>
  )
}

function Tab({ label, active, disabled, tip, onClick }) {
  return (
    <button
      title={tip}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-text)' : 'var(--color-muted)',
        borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        marginBottom: -1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

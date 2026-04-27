import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/index.js'

/**
 * Panel admin — Catálogo de equipos GDT + revisión de duplicados de jugadores.
 *
 * Dos secciones:
 * 1. Catálogo de equipos: el admin define qué equipos reales son válidos para el torneo.
 * 2. Duplicados: el sistema detecta jugadores con nombres similares en el mismo equipo.
 */
export default function AdminGDTCatalogo() {
  const [searchParams] = useSearchParams()
  const ligaId = searchParams.get('liga_id') || undefined
  const [catalogo, setCatalogo] = useState([])
  const [duplicados, setDuplicados] = useState([])
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPais, setNuevoPais] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDups, setLoadingDups] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)
  const [mergeConfirm, setMergeConfirm] = useState(null) // { keepId, mergeId, keepNombre, mergeNombre }
  const [mergeando, setMergeando] = useState(false)

  useEffect(() => {
    cargarCatalogo()
    cargarDuplicados()
  }, [ligaId])

  async function cargarCatalogo() {
    setLoading(true)
    try { setCatalogo(await api.gdtGetCatalogo(ligaId)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function cargarDuplicados() {
    setLoadingDups(true)
    try { setDuplicados(await api.gdtGetDuplicados(ligaId)) }
    catch (e) { /* silencioso */ }
    finally { setLoadingDups(false) }
  }

  async function handleAgregar() {
    if (!nuevoNombre.trim()) return
    setGuardando(true); setError(null); setExito(null)
    try {
      await api.gdtAddCatalogo(nuevoNombre.trim(), nuevoPais.trim() || undefined)
      setNuevoNombre('')
      setNuevoPais('')
      setExito(`Equipo "${nuevoNombre.trim()}" agregado correctamente.`)
      await cargarCatalogo()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  async function handleEliminar(id, nombre) {
    if (!confirm(`¿Desactivar "${nombre}"? Los jugadores existentes no se verán afectados.`)) return
    try {
      await api.gdtDeleteCatalogo(id)
      await cargarCatalogo()
    } catch (e) { setError(e.message) }
  }

  async function handleMerge() {
    if (!mergeConfirm) return
    setMergeando(true)
    try {
      await api.gdtMergeJugadores(mergeConfirm.keepId, mergeConfirm.mergeId)
      setMergeConfirm(null)
      await cargarDuplicados()
    } catch (e) { setError(e.message) }
    finally { setMergeando(false) }
  }

  const porPais = catalogo.reduce((acc, e) => {
    const p = e.pais || 'Sin categoría'
    if (!acc[p]) acc[p] = []
    acc[p].push(e)
    return acc
  }, {})

  return (
    <div className="main-content">
      <h2 style={{ marginBottom: 4 }}>⚙️ Catálogo GDT</h2>
      <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 24 }}>
        Definí los equipos reales válidos para el torneo activo. Los usuarios elegirán de esta lista al armar su equipo GDT.
      </p>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-danger)' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {exito && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-success)' }}>
          {exito}
          <button onClick={() => setExito(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Sección 1: Catálogo ──────────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Equipos en el catálogo ({catalogo.length})</strong>
        </div>

        {/* Formulario agregar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>NOMBRE DEL EQUIPO *</label>
            <input
              type="text"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              placeholder="Ej: River Plate"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>PAÍS / CATEGORÍA</label>
            <input
              type="text"
              value={nuevoPais}
              onChange={e => setNuevoPais(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              placeholder="Ej: Argentina"
              style={{ ...inputStyle, width: 140 }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAgregar}
            disabled={guardando || !nuevoNombre.trim()}
            style={{ marginBottom: 1 }}
          >
            {guardando ? 'Agregando...' : '+ Agregar'}
          </button>
        </div>

        {/* Lista agrupada por país */}
        {loading ? (
          <p style={{ padding: 16, color: 'var(--color-muted)' }}>Cargando...</p>
        ) : catalogo.length === 0 ? (
          <p style={{ padding: 16, color: 'var(--color-muted)', fontSize: 13 }}>
            No hay equipos cargados. Agregá equipos para que los usuarios puedan armar su GDT.
          </p>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {Object.entries(porPais).sort().map(([pais, equipos]) => (
              <div key={pais}>
                <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 1, background: 'rgba(255,255,255,0.02)' }}>
                  {pais}
                </div>
                {equipos.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 13 }}>{e.nombre}</span>
                    <button
                      onClick={() => handleEliminar(e.id, e.nombre)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 12 }}
                      title="Desactivar"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sección 2: Duplicados ────────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Posibles duplicados de jugadores</strong>
            <span style={{ color: 'var(--color-muted)', fontSize: 12, marginLeft: 10 }}>
              Jugadores con nombres similares en el mismo equipo
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={cargarDuplicados} disabled={loadingDups}>
            {loadingDups ? 'Revisando...' : '🔄 Revisar'}
          </button>
        </div>

        {loadingDups ? (
          <p style={{ padding: 16, color: 'var(--color-muted)', fontSize: 13 }}>Buscando duplicados...</p>
        ) : duplicados.length === 0 ? (
          <p style={{ padding: 16, color: 'var(--color-success)', fontSize: 13 }}>✅ No se detectaron duplicados.</p>
        ) : (
          <div>
            {duplicados.map(({ equipo, pares }) => (
              <div key={equipo} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--color-muted)', background: 'rgba(255,255,255,0.02)', fontWeight: 600 }}>
                  {equipo}
                </div>
                {pares.map(({ a, b }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                      <span style={{ color: 'var(--color-warning)' }}>⚠️</span>
                      <span><strong>"{a.nombre}"</strong></span>
                      <span style={{ color: 'var(--color-muted)' }}>↔</span>
                      <span><strong>"{b.nombre}"</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => setMergeConfirm({ keepId: a.id, mergeId: b.id, keepNombre: a.nombre, mergeNombre: b.nombre, equipo })}
                        style={{ fontSize: 11, padding: '4px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Unificar → conservar "{a.nombre}"
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => setMergeConfirm({ keepId: b.id, mergeId: a.id, keepNombre: b.nombre, mergeNombre: a.nombre, equipo })}
                        style={{ fontSize: 11, padding: '4px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Unificar → conservar "{b.nombre}"
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmar merge */}
      {mergeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: 24, width: 420, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 12 }}>Confirmar unificación</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 8 }}>
              <strong>Equipo:</strong> {mergeConfirm.equipo}
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 8 }}>
              Se conserva: <strong style={{ color: 'var(--color-success)' }}>"{mergeConfirm.keepNombre}"</strong>
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 14 }}>
              Se elimina: <strong style={{ color: 'var(--color-danger)' }}>"{mergeConfirm.mergeNombre}"</strong> — todos sus usos en equipos y puntajes pasan al nombre conservado.
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 16 }}>
              ⚠️ Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setMergeConfirm(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleMerge}
                disabled={mergeando}
              >
                {mergeando ? 'Unificando...' : 'Confirmar unificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  color: 'var(--color-text)',
  padding: '6px 10px',
  fontSize: 13,
  width: 220,
}

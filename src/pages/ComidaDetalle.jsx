import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/index.js'
import { useAuth } from '../App.jsx'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const ESTADO_CFG = {
  pendiente:   { label: 'Pendiente',   color: 'var(--color-muted)',   bg: 'rgba(0,0,0,0.07)' },
  confirmada:  { label: 'Confirmada',  color: 'var(--color-success)', bg: 'rgba(22,163,74,0.12)' },
  cancelada:   { label: 'Cancelada',   color: 'var(--color-danger)',  bg: 'rgba(239,68,68,0.12)' },
  realizada:   { label: 'Realizada',   color: 'var(--color-primary)', bg: 'rgba(59,130,246,0.12)' },
}

function Badge({ label, color, bg, style = {} }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 99,
      background: bg,
      color,
      letterSpacing: 0.3,
      ...style,
    }}>
      {label}
    </span>
  )
}

export default function ComidaDetalle() {
  const { comidaId } = useParams()
  const { user } = useAuth()

  const [comida,        setComida]        = useState(null)
  const [participantes, setParticipantes] = useState([])
  const [fotos,         setFotos]         = useState([])
  const [misVotos,      setMisVotos]      = useState({})
  const [votacionConfig, setVotacionConfig] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  // Modal votación
  const [modalVoto,     setModalVoto]     = useState(false)
  const [votacionForm,  setVotacionForm]  = useState({})
  const [savingVoto,    setSavingVoto]    = useState(false)
  const [votacionOk,    setVotacionOk]    = useState(false)
  const [votacionError, setVotacionError] = useState('')

  // Modal galería
  const [modalGaleria,  setModalGaleria]  = useState(false)
  const [fotoIdx,       setFotoIdx]       = useState(0)

  // Upload foto
  const [subiendo, setSubiendo] = useState(false)

  const id = parseInt(comidaId)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.getComidaById(id),
      api.getParticipantes(id),
      api.getFotos(id),
    ])
      .then(([c, p, f]) => {
        setComida(c)
        setParticipantes(Array.isArray(p) ? p : [])
        setFotos(Array.isArray(f) ? f : [])
        // Cargar config de votación y mis votos en paralelo
        return Promise.all([
          api.getComidaVotacionConfig(c.torneo_id),
          api.getMisVotos(id),
        ])
      })
      .then(([cfg, votos]) => {
        setVotacionConfig(Array.isArray(cfg?.items) ? cfg.items : [])
        const map = {}
        const formMap = {}
        ;(Array.isArray(votos) ? votos : []).forEach(v => {
          map[v.item] = v.puntaje
          formMap[v.item] = String(v.puntaje)
        })
        setMisVotos(map)
        setVotacionForm(formMap)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubirFoto = () => {
    if (!comida?.id) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      setSubiendo(true)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const foto = await api.addFoto(comida.id, ev.target.result)
          setFotos(prev => [...prev, foto])
        } catch (err) {
          alert('Error al subir foto: ' + err.message)
        } finally {
          setSubiendo(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const handleGuardarVoto = async () => {
    setVotacionError('')
    for (const item of votacionConfig) {
      const v = votacionForm[item.nombre]
      if (!v || isNaN(Number(v)) || Number(v) < 1 || Number(v) > 10) {
        setVotacionError(`Puntaje inválido para "${item.nombre}". Debe ser entre 1 y 10.`)
        return
      }
    }
    setSavingVoto(true)
    try {
      const votos = votacionConfig.map(item => ({
        item: item.nombre,
        puntaje: Number(votacionForm[item.nombre]),
      }))
      await api.saveMisVotos(comida.id, votos)
      const map = {}
      votos.forEach(v => { map[v.item] = v.puntaje })
      setMisVotos(map)
      setVotacionOk(true)
      setModalVoto(false)
    } catch (err) {
      setVotacionError(err.message)
    } finally {
      setSavingVoto(false)
    }
  }

  // ——— Derivados ——————————————————————————
  const jugadores = participantes.filter(p => p.es_jugador)
  const invitados = participantes.filter(p => !p.es_jugador)

  const soyOrganizador = comida?.organizador_user_id && comida.organizador_user_id === user?.id
  const yoPuedoVotar   = !soyOrganizador && participantes.some(
    p => p.user_id === user?.id && p.puede_votar
  )
  const yaVote         = Object.keys(misVotos).length > 0
  const votacionCerrada = comida?.votacion_estado === 'cerrada'
  const torneoCerrado   = comida && !comida.torneo_activo

  // ——— Estados de carga / error ————————
  if (loading) return <div className="loading">Cargando...</div>
  if (error)   return <div style={{ padding: 32 }}><div className="error-msg">{error}</div></div>
  if (!comida) return <div style={{ padding: 32, color: 'var(--color-muted)' }}>Comida no encontrada.</div>

  const estadoCfg = ESTADO_CFG[comida.estado] || { label: comida.estado, color: 'var(--color-muted)', bg: 'rgba(0,0,0,0.07)' }
  const heroFoto  = fotos[0]?.url || null

  // ——— Render —————————————————————————
  return (
    <div style={{ maxWidth: 680, paddingBottom: 40 }}>

      {/* ——— Breadcrumb ——— */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/comidas" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
          🍕 Comidas
        </Link>
        <span>›</span>
        <span>{MESES[comida.mes]} {comida.anio}</span>
      </div>

      {/* ——— HERO ——— */}
      <div style={{
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 24,
        position: 'relative',
        background: heroFoto ? undefined : 'linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 100%)',
        backgroundImage: heroFoto ? `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.65)), url(${heroFoto})` : undefined,
        backgroundSize: heroFoto ? 'cover' : undefined,
        backgroundPosition: heroFoto ? 'center center' : undefined,
        backgroundRepeat: heroFoto ? 'no-repeat' : undefined,
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '24px 24px 20px',
      }}>
        {/* Nombre del lugar */}
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 26, lineHeight: 1.2, marginBottom: 10, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          {comida.lugar || 'Sin lugar definido'}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.18)', borderRadius: 99,
            padding: '3px 12px', backdropFilter: 'blur(4px)',
          }}>
            {MESES[comida.mes]} {comida.anio}
          </span>
          <Badge label={estadoCfg.label} color="#fff" bg="rgba(255,255,255,0.18)" />
          {votacionCerrada
            ? <Badge label="🔒 Votación cerrada" color="#fff" bg="rgba(239,68,68,0.45)" />
            : <Badge label="🗳️ Votación abierta"  color="#fff" bg="rgba(22,163,74,0.45)" />
          }
        </div>

        {/* Botones de fotos sobre el hero */}
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
          {fotos.length > 0 && (
            <button
              onClick={() => { setFotoIdx(0); setModalGaleria(true) }}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.22)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              📷 {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* ——— INFO ——— */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 12 }}>📋 Información</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
          {comida.organizador_nombre && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Organizador</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{comida.organizador_nombre}</div>
            </div>
          )}
          {comida.fecha_comida && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Fecha</div>
              <div style={{ fontSize: 14 }}>{(() => {
                const m = comida.fecha_comida?.match(/(\d{4})-(\d{2})-(\d{2})/)
                if (!m) return comida.fecha_comida
                return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
              })()}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Torneo</div>
            <div style={{ fontSize: 14 }}>{comida.torneo_nombre} · {comida.torneo_semestre}</div>
          </div>
          {comida.fotos_count > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Fotos</div>
              <div style={{ fontSize: 14 }}>{comida.fotos_count} foto{comida.fotos_count !== 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {comida.nota && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Nota</div>
            <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>{comida.nota}</div>
          </div>
        )}

        {comida.google_maps_url && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <a
              href={comida.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, color: 'var(--color-primary)', fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              📍 Ver en Maps →
            </a>
          </div>
        )}
      </div>

      {/* ——— PARTICIPANTES ——— */}
      {participantes.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            👥 Participantes
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', marginLeft: 8 }}>
              ({participantes.length})
            </span>
          </div>

          {jugadores.length > 0 && (
            <div style={{ marginBottom: invitados.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5, marginBottom: 8 }}>
                🎮 Jugadores
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {jugadores.map((p, i) => (
                  <span key={i} style={{
                    fontSize: 13, padding: '4px 12px', borderRadius: 99,
                    background: 'var(--color-surface2)',
                    border: '1px solid var(--color-border)',
                    fontWeight: p.user_id === user?.id ? 600 : 400,
                    color: p.user_id === user?.id ? 'var(--color-primary)' : 'var(--color-text)',
                  }}>
                    {p.nombre}
                    {p.user_id === user?.id && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>tú</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {invitados.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', letterSpacing: 0.5, marginBottom: 8 }}>
                👤 Invitados
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {invitados.map((p, i) => (
                  <span key={i} style={{
                    fontSize: 13, padding: '4px 12px', borderRadius: 99,
                    background: 'var(--color-surface2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-muted)',
                  }}>
                    {p.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ——— FOTOS ——— */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="card-header" style={{ margin: 0 }}>
            📷 Fotos
            {fotos.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', marginLeft: 8 }}>({fotos.length})</span>
            )}
          </div>
          <button
            onClick={handleSubirFoto}
            disabled={subiendo}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12 }}
          >
            {subiendo ? 'Subiendo...' : '+ Agregar foto'}
          </button>
        </div>

        {fotos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
            Todavía no hay fotos. ¡Sé el primero en agregar una!
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
            {fotos.map((f, i) => (
              <div
                key={f.id || i}
                onClick={() => { setFotoIdx(i); setModalGaleria(true) }}
                style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#111',
                  border: '1px solid var(--color-border)',
                }}
              >
                <img
                  src={f.url}
                  alt={`Foto ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ——— VOTACIÓN ——— */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 14 }}>🗳️ Votación</div>

        {soyOrganizador && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--color-muted)', fontStyle: 'italic' }}>
              Organizador · no vota
            </span>
          </div>
        )}

        {!soyOrganizador && votacionCerrada && !torneoCerrado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔒</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger)' }}>Votación cerrada</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>Los resultados se mostrarán cuando cierre el torneo.</div>
            </div>
          </div>
        )}

        {!soyOrganizador && !votacionCerrada && yoPuedoVotar && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {yaVote ? '✓ Voto guardado' : 'Aún no votaste'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                {yaVote ? 'Podés editar tu voto mientras la votación esté abierta.' : 'Puntuá esta comida en cada ítem.'}
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '8px 20px', minWidth: 120 }}
              onClick={() => { setVotacionError(''); setModalVoto(true) }}
            >
              {yaVote ? '✏️ Editar voto' : '🗳️ Votar'}
            </button>
          </div>
        )}

        {!soyOrganizador && !votacionCerrada && !yoPuedoVotar && (
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            No estás habilitado para votar en esta comida.
          </div>
        )}
      </div>

      {/* ——— RESULTADOS (solo si torneo cerrado) ——— */}
      {torneoCerrado && comida.items?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>🏆 Resultados</div>

          {comida.puntuacion_total !== null ? (
            <>
              {/* Puntaje total grande */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  fontSize: 56, fontWeight: 900,
                  color: 'var(--color-primary)',
                  lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                }}>
                  {comida.puntuacion_total}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>Puntaje total ponderado</div>
              </div>

              {/* Breakdown por ítem */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comida.items.map(item => (
                  <div key={item.item} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--color-surface2)',
                    border: '1px solid var(--color-border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.item}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                        peso {item.peso}%
                      </div>
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      color: item.promedio >= 8 ? 'var(--color-success)' : item.promedio >= 6 ? 'var(--color-warning)' : 'var(--color-danger)',
                    }}>
                      {item.promedio ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
              No hay votos suficientes para mostrar resultados.
            </p>
          )}
        </div>
      )}

      {/* ——————————————————————————————————
           MODAL GALERÍA
      —————————————————————————————————— */}
      {modalGaleria && fotos.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setModalGaleria(false)}
        >
          {/* Cerrar */}
          <button
            onClick={() => setModalGaleria(false)}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 20, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Contador */}
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
            {fotoIdx + 1} / {fotos.length}
          </div>

          {/* Imagen */}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '75vh' }}>
            <img
              src={fotos[fotoIdx].url}
              alt={`Foto ${fotoIdx + 1}`}
              style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: 10, display: 'block' }}
            />
          </div>

          {/* Navegación */}
          {fotos.length > 1 && (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 16, marginTop: 20 }}>
              <button
                onClick={() => setFotoIdx(i => (i - 1 + fotos.length) % fotos.length)}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 20, padding: '8px 18px',
                }}
              >
                ‹
              </button>
              <button
                onClick={() => setFotoIdx(i => (i + 1) % fotos.length)}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 20, padding: '8px 18px',
                }}
              >
                ›
              </button>
            </div>
          )}

          {/* Miniaturas */}
          {fotos.length > 1 && (
            <div onClick={e => e.stopPropagation()} style={{
              display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center',
              maxWidth: '90vw', overflowX: 'auto',
            }}>
              {fotos.map((f, i) => (
                <img
                  key={f.id || i}
                  src={f.url}
                  alt=""
                  onClick={() => setFotoIdx(i)}
                  style={{
                    width: 52, height: 52, objectFit: 'cover', borderRadius: 6, cursor: 'pointer',
                    opacity: i === fotoIdx ? 1 : 0.45,
                    border: i === fotoIdx ? '2px solid #fff' : '2px solid transparent',
                    transition: 'opacity 0.15s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ——————————————————————————————————
           MODAL VOTACIÓN
      —————————————————————————————————— */}
      {modalVoto && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setModalVoto(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: '24px',
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>🗳️ Tu voto — {comida.lugar || `${MESES[comida.mes]} ${comida.anio}`}</div>
              <button
                onClick={() => setModalVoto(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-muted)', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {votacionConfig.map(item => (
                <div key={item.nombre}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <label style={{ fontSize: 14, fontWeight: 600 }}>{item.nombre}</label>
                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>peso {item.peso}% · 1–10</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={votacionForm[item.nombre] ?? ''}
                    onChange={e => setVotacionForm(f => ({ ...f, [item.nombre]: e.target.value }))}
                    disabled={votacionCerrada}
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8, fontSize: 15, fontWeight: 600,
                      background: 'var(--color-surface2)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>

            {votacionError && (
              <div className="error-msg" style={{ marginTop: 14, fontSize: 13 }}>
                {votacionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 14, padding: '10px' }}
                onClick={handleGuardarVoto}
                disabled={savingVoto || votacionCerrada}
              >
                {savingVoto ? 'Guardando...' : yaVote ? 'Actualizar voto' : 'Guardar voto'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 14, padding: '10px 16px' }}
                onClick={() => setModalVoto(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

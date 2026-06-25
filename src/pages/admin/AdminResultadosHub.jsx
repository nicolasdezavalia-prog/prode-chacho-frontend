import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function formatDeadline(dl) {
  if (!dl) return null
  const d = new Date(dl)
  if (isNaN(d)) return dl
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminResultadosHub() {
  const [fechas, setFechas] = useState([])   // [{ ...fecha, torneo_nombre }]
  // Mundial en el hub de resultados: torneos mundial con el resumen de su
  // fixture ({ ...torneo, partidos, finalizados }). La carga de resultados de
  // partidos vive en /admin/mundial/:id/resultados-partidos (solo partidos ya
  // cargados en el Fixture — sin alta ni seed desde ahí).
  const [mundiales, setMundiales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const torneos = await api.getTorneos()
      // Resultados/fechas son del Prode tradicional — Mundial no tiene fechas
      // (devolvería 404 o vacío). Filtrar para no generar requests inútiles.
      const tradi = (torneos || []).filter(t => t.tipo !== 'mundial_preguntas')
      // Cargar fechas de todos los torneos tradicionales en paralelo
      const resultados = await Promise.all(
        tradi.map(t =>
          api.getFechas(t.id)
            .then(fs => fs.map(f => ({ ...f, torneo_nombre: t.nombre, torneo_id: t.id })))
            .catch(() => [])
        )
      )
      const todas = resultados.flat()
      // Mostrar cerradas primero, luego abierta (también en disputa)
      const enDisputa = todas
        .filter(f => f.estado === 'cerrada' || f.estado === 'abierta')
        .sort((a, b) => {
          // cerrada antes que abierta
          if (a.estado !== b.estado) return a.estado === 'cerrada' ? -1 : 1
          // dentro del mismo estado, más reciente primero
          return (b.anio - a.anio) || (b.mes - a.mes)
        })
      setFechas(enDisputa)

      // Mundial: torneos accesibles + resumen del fixture (si algo falla,
      // el hub tradicional sigue funcionando igual que siempre).
      const ts = await api.getMundialTorneos().catch(() => [])
      const conFixture = await Promise.all(
        (ts || []).map(async t => {
          const fx = await api.getMundialPartidos(t.id).catch(() => null)
          return {
            ...t,
            partidos: fx?.meta?.total ?? 0,
            finalizados: fx?.meta?.finalizados ?? 0,
          }
        })
      )
      setMundiales(conFixture)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Cargando...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Admin</Link>
        <span>›</span>
        <span style={{ color: 'var(--color-text)' }}>Cargar resultados</span>
      </div>

      <div className="flex-between mb-16">
        <div>
          <div className="page-title">📋 Cargar resultados</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>
            Fechas en disputa (abiertas o cerradas)
          </div>
        </div>
      </div>

      {/* Mundial — carga de resultados de partidos (solo los del Fixture) */}
      {mundiales.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {mundiales.map(t => (
            <MundialCard key={t.id} torneo={t} />
          ))}
        </div>
      )}

      {fechas.length === 0 && mundiales.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
          No hay fechas abiertas o cerradas en este momento.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fechas.map(f => (
          <FechaCard key={f.id} fecha={f} />
        ))}
      </div>
    </div>
  )
}

// Card del Mundial en el hub de resultados. El botón principal lleva a la
// vista de carga de resultados de partidos (grilla del Fixture en modo
// 'resultados': SOLO partidos ya cargados; alta/seed/borrado quedan en
// Admin Mundial → 📅 Fixture). Nada acá toca scoring/ranking.
function MundialCard({ torneo: t }) {
  const pendientes = Math.max(0, (t.partidos || 0) - (t.finalizados || 0))
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
            background: 'rgba(99,102,241,0.12)', color: '#4f46e5', whiteSpace: 'nowrap',
          }}>
            Mundial
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>🏆 {t.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {t.partidos > 0
                ? <>{t.partidos} partidos en el fixture · <strong>{t.finalizados}</strong> finalizados · {pendientes} pendientes</>
                : 'Sin partidos en el fixture todavía'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            to={`/admin/mundial/${t.id}/resultados-partidos`}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            ⚽ Cargar resultados de partidos
          </Link>
          <Link
            to={`/admin/torneo/${t.id}/mundial?tab=resultados`}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            ❓ Cargar resultados de preguntas
          </Link>
          <Link
            to={`/admin/torneo/${t.id}/mundial`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12 }}
          >
            🏆 Admin Mundial
          </Link>
        </div>
      </div>
    </div>
  )
}

function FechaCard({ fecha: f }) {
  const esCerrada = f.estado === 'cerrada'
  const esAbierta = f.estado === 'abierta'

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

        {/* Info de la fecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Estado badge */}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
            background: esCerrada ? 'rgba(234,179,8,0.15)' : 'rgba(22,163,74,0.12)',
            color: esCerrada ? '#ca8a04' : '#16a34a',
            whiteSpace: 'nowrap',
          }}>
            {esCerrada ? 'Cerrada' : 'Abierta'}
          </span>

          {/* Nombre + torneo */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {f.nombre || `Fecha ${f.numero}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {f.torneo_nombre}
              {f.mes && f.anio && ` · ${MESES[f.mes - 1]} ${f.anio}`}
            </div>
          </div>

          {/* Deadline */}
          {f.deadline && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⏰</span>
              <span>{formatDeadline(f.deadline)}</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            to={`/admin/fecha/${f.id}/resultados`}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            📋 Cargar resultados
          </Link>
          <Link
            to={`/admin/fecha/${f.id}/gdt`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12 }}
          >
            ⚽ Puntajes GDT
          </Link>
          <Link
            to={`/admin/fecha/${f.id}`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12 }}
          >
            ⚙️ Admin fecha
          </Link>
        </div>
      </div>
    </div>
  )
}

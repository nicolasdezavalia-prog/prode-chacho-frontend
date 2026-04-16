import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/index.js'

const OPCIONES = [
  { value: '',       label: '— sin resultado —' },
  { value: 'user1',  label: 'Ganó LOCAL'  },
  { value: 'empate', label: 'Empate'       },
  { value: 'user2',  label: 'Ganó VISITANTE' },
]

export default function AdminFechaResumida() {
  const { fechaId } = useParams()
  const [fecha, setFecha]     = useState(null)
  const [cruces, setCruces]   = useState([])
  const [form, setForm]       = useState({})   // { cruceId: { bloque_a, bloque_b, gdt } }
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]     = useState(null)
  const [exito, setExito]     = useState(null)

  useEffect(() => { cargar() }, [fechaId])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [fechaRes, crucesRes] = await Promise.all([
        api.getFecha(fechaId),
        api.getCrucesResumido(fechaId),
      ])
      setFecha(fechaRes)
      setCruces(crucesRes)

      // Inicializar form con valores existentes
      const f = {}
      for (const c of crucesRes) {
        f[c.id] = {
          bloque_a: c.ganador_tabla_a || '',
          bloque_b: c.ganador_tabla_b || '',
          gdt:      c.ganador_gdt     || '',
        }
      }
      setForm(f)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function setBloque(cruceId, campo, valor) {
    setForm(f => ({ ...f, [cruceId]: { ...f[cruceId], [campo]: valor } }))
    setExito(null)
  }

  async function guardar() {
    setGuardando(true); setError(null); setExito(null)
    try {
      const resultados = cruces
        .filter(c => form[c.id]?.bloque_a && form[c.id]?.bloque_b && form[c.id]?.gdt)
        .map(c => ({
          cruce_id: c.id,
          bloque_a: form[c.id].bloque_a,
          bloque_b: form[c.id].bloque_b,
          gdt:      form[c.id].gdt,
        }))

      if (resultados.length === 0) {
        setError('Completá al menos un cruce (los 3 bloques)'); return
      }

      await api.guardarResumido(fechaId, resultados)
      setExito(`✅ ${resultados.length} cruce(s) guardados y tabla recalculada`)
      cargar()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  const completos = cruces.filter(c => form[c.id]?.bloque_a && form[c.id]?.bloque_b && form[c.id]?.gdt).length

  if (loading) return <div className="main-content"><p style={{ color: 'var(--color-muted)' }}>Cargando...</p></div>

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Link to={`/admin/fecha/${fechaId}`} style={{ color: 'var(--color-muted)', fontSize: 13 }}>
            ← {fecha?.nombre || `Fecha ${fechaId}`}
          </Link>
          <h2 style={{ margin: '4px 0 0' }}>📋 Resultados resumidos</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {fecha?.bloque1_nombre} · {fecha?.bloque2_nombre} · GDT
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando || completos === 0}>
            {guardando ? 'Guardando...' : `Guardar y recalcular (${completos}/${cruces.length})`}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-danger)' }}>{error}</div>}
      {exito && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, color: 'var(--color-success)' }}>{exito}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={thStyle}>Cruce</th>
            <th style={{ ...thStyle, textAlign: 'center', color: 'var(--color-primary)' }}>
              {fecha?.bloque1_nombre || 'Bloque Argentina'}
            </th>
            <th style={{ ...thStyle, textAlign: 'center', color: '#a78bfa' }}>
              {fecha?.bloque2_nombre || 'Bloque Juanmar'}
            </th>
            <th style={{ ...thStyle, textAlign: 'center', color: 'var(--color-warning)' }}>GDT</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {cruces.map(c => {
            const f = form[c.id] || {}
            const completo = f.bloque_a && f.bloque_b && f.gdt

            // Preview del resultado final
            let piU1 = 0, piU2 = 0
            if (f.bloque_a === 'user1') piU1 += 1; else if (f.bloque_a === 'user2') piU2 += 1
            if (f.bloque_b === 'user1') piU1 += 1; else if (f.bloque_b === 'user2') piU2 += 1
            if (f.gdt === 'user1') piU1 += 2; else if (f.gdt === 'user2') piU2 += 2
            const ganador = piU1 > piU2 ? c.user1_nombre : piU2 > piU1 ? c.user2_nombre : 'Empate'
            const ganadorColor = piU1 > piU2 ? 'var(--color-success)' : piU2 > piU1 ? 'var(--color-danger)' : 'var(--color-warning)'

            return (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', background: completo ? 'rgba(34,197,94,0.03)' : 'transparent' }}>
                {/* Cruce */}
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600 }}>{c.user1_nombre}</div>
                  <div style={{ color: 'var(--color-muted)', fontSize: 11 }}>vs {c.user2_nombre}</div>
                </td>

                {/* Bloque A */}
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <BloqueSelect
                    value={f.bloque_a || ''}
                    user1={c.user1_nombre}
                    user2={c.user2_nombre}
                    onChange={v => setBloque(c.id, 'bloque_a', v)}
                  />
                </td>

                {/* Bloque B */}
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <BloqueSelect
                    value={f.bloque_b || ''}
                    user1={c.user1_nombre}
                    user2={c.user2_nombre}
                    onChange={v => setBloque(c.id, 'bloque_b', v)}
                  />
                </td>

                {/* GDT */}
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <BloqueSelect
                    value={f.gdt || ''}
                    user1={c.user1_nombre}
                    user2={c.user2_nombre}
                    onChange={v => setBloque(c.id, 'gdt', v)}
                  />
                </td>

                {/* Resultado preview */}
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {completo ? (
                    <div>
                      <div style={{ fontWeight: 700, color: ganadorColor, fontSize: 13 }}>{ganador}</div>
                      <div style={{ color: 'var(--color-muted)', fontSize: 11 }}>{piU1} — {piU2} pts int.</div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {cruces.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
          <p>No hay cruces cargados para esta fecha.</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            Primero configurá el fixture en <Link to={`/admin/fecha/${fechaId}/fixture`}>Admin Fixture</Link>.
          </p>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando || completos === 0}>
          {guardando ? 'Guardando...' : `Guardar y recalcular (${completos}/${cruces.length})`}
        </button>
      </div>
    </div>
  )
}

// ─── Select de bloque con nombres de usuarios ─────────────────────────────────
function BloqueSelect({ value, user1, user2, onChange }) {
  const opciones = [
    { value: '',       label: '—'         },
    { value: 'user1',  label: `▲ ${user1}` },
    { value: 'empate', label: '= Empate'   },
    { value: 'user2',  label: `▼ ${user2}` },
  ]

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--color-surface2)',
        border: `1px solid ${value ? COLOR[value] : 'var(--color-border)'}`,
        borderRadius: 4,
        color: value ? COLOR[value] : 'var(--color-muted)',
        padding: '5px 8px',
        fontSize: 12,
        fontWeight: value ? 600 : 400,
        cursor: 'pointer',
        minWidth: 130,
      }}
    >
      {opciones.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

const COLOR = {
  user1:  'var(--color-success)',
  empate: 'var(--color-warning)',
  user2:  'var(--color-danger)',
  '':     'var(--color-border)',
}

const thStyle = { textAlign: 'left', padding: '8px 12px', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' }

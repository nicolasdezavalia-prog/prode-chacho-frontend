/**
 * ImportarPreguntasMundial — Fase 2.3
 *
 * Sub-vista del AdminMundialPreguntas que muestra:
 *   - File picker (acepta .xlsx, .xls, .csv).
 *   - Preview editable de las preguntas parseadas.
 *   - Botón "Enviar X pregunta(s)" → PUT /preguntas/bulk.
 *
 * Props:
 *   torneoId            — id del torneo Mundial.
 *   equiposCatalogo     — catálogo del torneo, para los selectores del editor.
 *   preguntasExistentes — array de preguntas ya cargadas. Si alguna del Excel
 *                         comparte `numero`, mostramos warning de UPSERT antes
 *                         de enviar.
 *   onDone(resumen)     — callback cuando el bulk fue OK ({ creados, actualizados, total, warnings }).
 *   onCancel()          — cierra el importer sin guardar.
 */

import { useState } from 'react'
import { api } from '../../api/index.js'
import { parsearArchivoExcel } from '../../lib/parser-excel-mundial.js'
import MundialConfigEditor, { TIPO_LABEL, PLANTILLAS_CONFIG } from './MundialConfigEditor.jsx'

const thStyle = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid var(--color-border)',
  background: 'var(--color-surface2)',
  whiteSpace: 'nowrap',
}

const cellStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 13,
  verticalAlign: 'top',
}

const inputStyle = {
  width: '100%',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
  background: 'white',
}

const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }

export default function ImportarPreguntasMundial({ torneoId, equiposCatalogo = [], preguntasExistentes = [], onDone, onCancel }) {
  const [parseando, setParseando] = useState(false)
  const [parseado, setParseado]   = useState(null) // { preguntas: [...], advertencias: [...] }
  const [error, setError]         = useState('')
  const [enviando, setEnviando]   = useState(false)
  const [openRow, setOpenRow]     = useState(null) // numero de la fila expandida
  const [erroresPorNumero, setErroresPorNumero] = useState({}) // { N: 'mensaje' }

  async function handleFile(file) {
    setError('')
    setParseado(null)
    setErroresPorNumero({})
    setParseando(true)
    try {
      const r = await parsearArchivoExcel(file)
      setParseado(r)
      if (r.preguntas.length === 0 && r.advertencias.length === 0) {
        setError('No se encontraron preguntas en el archivo.')
      }
    } catch (e) {
      setError(`Error parseando: ${e.message}`)
    } finally {
      setParseando(false)
    }
  }

  function updatePregunta(numero, patch) {
    setParseado(p => ({
      ...p,
      preguntas: p.preguntas.map(q => q.numero === numero ? { ...q, ...patch } : q),
    }))
    // Limpiar error específico si la fila se editó
    if (erroresPorNumero[numero]) {
      setErroresPorNumero(prev => {
        const next = { ...prev }
        delete next[numero]
        return next
      })
    }
  }

  function handleTipoChange(numero, nuevoTipo) {
    // Cambiar tipo → resetear config a la plantilla por defecto del nuevo tipo
    const nuevaConfig = PLANTILLAS_CONFIG[nuevoTipo]()
    updatePregunta(numero, { tipo_pregunta: nuevoTipo, config_json: nuevaConfig })
  }

  async function handleEnviar() {
    if (!parseado) return
    const aEnviar = parseado.preguntas
      .filter(q => q.incluir)
      .map(q => ({
        numero: q.numero,
        enunciado: q.enunciado,
        aclaracion: q.aclaracion,
        tipo_pregunta: q.tipo_pregunta,
        config_json: q.config_json,
        activa: 1,
      }))

    if (aEnviar.length === 0) {
      alert('No hay preguntas marcadas para enviar.')
      return
    }

    // Pre-flight: warning si va a sobrescribir preguntas existentes por mismo `numero`.
    const sobreescribibles = aEnviar.filter(q => preguntasExistentes.some(e => e.numero === q.numero))
    if (sobreescribibles.length > 0) {
      const nums = sobreescribibles.map(q => q.numero).join(', ')
      const ok = confirm(
        `Esto puede sobrescribir ${sobreescribibles.length} pregunta(s) existente(s) con el mismo número:\n` +
        `${nums}\n\n¿Continuar?`
      )
      if (!ok) return
    }

    setEnviando(true)
    setError('')
    setErroresPorNumero({})
    try {
      const r = await api.bulkMundialPreguntas(torneoId, aEnviar)
      onDone(r)
    } catch (e) {
      // Intentar extraer el numero específico del mensaje "numero N: <mensaje>"
      const m = String(e.message || '').match(/numero\s+(\d+)\s*:/i)
      if (m) {
        const numEr = parseInt(m[1], 10)
        setErroresPorNumero({ [numEr]: e.message })
      }
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  // ── Vista 1: file picker (todavía no se cargó el Excel) ──
  if (!parseado) {
    return (
      <div style={{ padding: 20 }}>
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>📥 Importar preguntas desde Excel</h3>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          Subí el archivo <code>Mundial.xlsx</code> (o cualquier <code>.xlsx</code> con la hoja "Preguntas").
          El parser detecta el tipo de cada pregunta automáticamente. Después podés corregir lo que haga falta antes de enviar.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          disabled={parseando}
          style={{ fontSize: 13 }}
        />
        {parseando && <div style={{ marginTop: 12, fontSize: 13 }}>Parseando archivo...</div>}
        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    )
  }

  // ── Vista 2: preview editable ──
  const incluidas = parseado.preguntas.filter(q => q.incluir).length
  const total     = parseado.preguntas.length

  return (
    <div style={{ padding: 16 }}>
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>📥 Preview de importación</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={enviando}>
            Cancelar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleEnviar}
            disabled={enviando || incluidas === 0}
          >
            {enviando ? 'Enviando...' : `Enviar ${incluidas} de ${total} pregunta(s)`}
          </button>
        </div>
      </div>

      {parseado.advertencias.length > 0 && (
        <div style={{
          padding: '8px 12px', background: 'rgba(234,179,8,0.12)',
          color: '#a16207', borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          <strong>Advertencias del parser:</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {parseado.advertencias.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 40 }}>✓</th>
              <th style={{ ...thStyle, width: 60 }}>Nº</th>
              <th style={thStyle}>Enunciado / detector</th>
              <th style={{ ...thStyle, width: 220 }}>Tipo</th>
              <th style={{ ...thStyle, width: 60 }}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {parseado.preguntas.map(q => (
              <PreviewRow
                key={q.numero}
                pregunta={q}
                isOpen={openRow === q.numero}
                onToggleOpen={() => setOpenRow(openRow === q.numero ? null : q.numero)}
                onToggleIncluir={() => updatePregunta(q.numero, { incluir: !q.incluir })}
                onChangeTipo={nuevo => handleTipoChange(q.numero, nuevo)}
                onChangeConfig={nuevoConfig => updatePregunta(q.numero, { config_json: nuevoConfig })}
                onChangeEnunciado={nuevo => updatePregunta(q.numero, { enunciado: nuevo })}
                onChangeAclaracion={nuevo => updatePregunta(q.numero, { aclaracion: nuevo })}
                error={erroresPorNumero[q.numero]}
                sobreescribe={preguntasExistentes.some(e => e.numero === q.numero)}
                equiposCatalogo={equiposCatalogo}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sub-componente row del preview ─────────────────────────────────────────
function PreviewRow({
  pregunta, isOpen, onToggleOpen, onToggleIncluir,
  onChangeTipo, onChangeConfig, onChangeEnunciado, onChangeAclaracion,
  error, sobreescribe, equiposCatalogo,
}) {
  const q = pregunta
  return (
    <>
      <tr style={{
        background: !q.incluir
          ? 'rgba(0,0,0,0.04)'
          : error
            ? 'rgba(220,38,38,0.06)'
            : 'white',
      }}>
        <td style={cellStyle}>
          <input type="checkbox" checked={q.incluir} onChange={onToggleIncluir} />
        </td>
        <td style={{ ...cellStyle, fontWeight: 600 }}>
          {q.numero}
          {sobreescribe && (
            <span
              title="Va a sobrescribir una pregunta existente con el mismo número"
              style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#a16207', letterSpacing: '0.05em', marginTop: 2 }}
            >
              UPSERT
            </span>
          )}
        </td>
        <td style={cellStyle}>
          <div style={{ fontWeight: 500 }}>{q.enunciado}</div>
          <small style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            Detector: {q.detectorUsado}
          </small>
          {q.puntosRaw && (
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'monospace', marginTop: 2 }}>
              D: <code>{q.puntosRaw}</code>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 6, color: 'var(--color-danger)', fontSize: 12 }}>
              ✗ {error}
            </div>
          )}
        </td>
        <td style={cellStyle}>
          <select
            value={q.tipo_pregunta}
            onChange={e => onChangeTipo(e.target.value)}
            style={{ ...inputStyle, fontSize: 12 }}
            disabled={!q.incluir}
          >
            {Object.entries(TIPO_LABEL).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
          </select>
        </td>
        <td style={cellStyle}>
          <button onClick={onToggleOpen} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
            {isOpen ? '▼' : '▶'}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={5} style={{ padding: 16, background: 'rgba(59,130,246,0.03)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ marginBottom: 10 }}>
              <label style={fieldLabel}>Enunciado</label>
              <input value={q.enunciado} onChange={e => onChangeEnunciado(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={fieldLabel}>Aclaración</label>
              <input value={q.aclaracion || ''} onChange={e => onChangeAclaracion(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>
                CONFIGURACIÓN ({TIPO_LABEL[q.tipo_pregunta]})
              </div>
              <MundialConfigEditor
                tipo={q.tipo_pregunta}
                config={q.config_json}
                onChange={onChangeConfig}
                equiposCatalogo={equiposCatalogo}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

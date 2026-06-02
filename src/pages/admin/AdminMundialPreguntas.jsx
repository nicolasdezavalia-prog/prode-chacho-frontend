/**
 * AdminMundialPreguntas — Fase 2.2
 *
 * Tab Preguntas del AdminMundialHub.
 *
 * Props:
 *   torneoId  — id del torneo Mundial.
 *   estado    — estado actual del torneo (de mundial_config).
 *   onChanged — callback opcional.
 *
 * UX:
 *   - Grilla con una fila por pregunta. Click en "Ver/Editar" abre acordeón
 *     que despliega el form completo (campos comunes + MundialConfigEditor).
 *   - Botón "+ Agregar pregunta" muestra un form de alta nueva al inicio.
 *   - Bloqueo por estado:
 *       'configuracion' → todo editable.
 *       'abierto'       → solo enunciado/aclaracion/activa editables.
 *       resto           → todo deshabilitado.
 *   - Errores 400/409 del backend caen al banner del componente.
 *   - Warnings (códigos de equipo no en catálogo) se muestran como banner amarillo
 *     informativo después de guardar.
 *
 * Sin importer Excel todavía (Fase 2.3). Sin alta masiva preset todavía.
 */

import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import MundialConfigEditor, { PLANTILLAS_CONFIG, TIPO_LABEL } from './MundialConfigEditor.jsx'
import ImportarPreguntasMundial from './ImportarPreguntasMundial.jsx'

const ESTADOS_FULL_EDIT  = new Set(['configuracion'])
const ESTADOS_PATCH_EDIT = new Set(['configuracion', 'abierto'])

const TIPOS_DISPONIBLES = Object.keys(TIPO_LABEL)

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

export default function AdminMundialPreguntas({ torneoId, estado, onChanged }) {
  const [preguntas, setPreguntas]             = useState([])
  const [equiposCatalogo, setEquiposCatalogo] = useState([])  // para selectores en config_json
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState('')
  const [info, setInfo]                       = useState('')
  const [warnings, setWarnings]               = useState([])
  const [openId, setOpenId]                   = useState(null)
  const [showNuevo, setShowNuevo]             = useState(false)
  const [showImporter, setShowImporter]       = useState(false)

  const fullEdit  = ESTADOS_FULL_EDIT.has(estado)
  const patchEdit = ESTADOS_PATCH_EDIT.has(estado)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      // Cargar preguntas + catálogo en paralelo. El catálogo es read-only acá
      // (los editores estructurados lo usan para dropdowns/chips).
      const [preg, equipos] = await Promise.all([
        api.getMundialPreguntas(torneoId),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      setPreguntas(Array.isArray(preg) ? preg : [])
      setEquiposCatalogo(Array.isArray(equipos) ? equipos : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function clearMessages() {
    setError(''); setInfo(''); setWarnings([])
  }

  async function handleDelete(pregunta) {
    if (!fullEdit) return
    const ok = confirm(`¿Borrar pregunta #${pregunta.numero}: "${pregunta.enunciado}"?\n\nEsta acción no se puede deshacer.`)
    if (!ok) return
    clearMessages()
    try {
      await api.deleteMundialPregunta(torneoId, pregunta.id)
      setInfo(`Pregunta #${pregunta.numero} borrada.`)
      if (openId === pregunta.id) setOpenId(null)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSave(preguntaId, patch) {
    clearMessages()
    try {
      const r = await api.updateMundialPregunta(torneoId, preguntaId, patch)
      setInfo(`Pregunta #${r.pregunta?.numero ?? preguntaId} guardada.`)
      if (Array.isArray(r.warnings) && r.warnings.length > 0) setWarnings(r.warnings)
      await load()
      onChanged?.()
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  async function handleCreate(data) {
    clearMessages()
    try {
      const r = await api.createMundialPregunta(torneoId, data)
      setInfo(`Pregunta #${r.pregunta?.numero ?? '?'} creada.`)
      if (Array.isArray(r.warnings) && r.warnings.length > 0) setWarnings(r.warnings)
      setShowNuevo(false)
      await load()
      onChanged?.()
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  async function handleImportDone(resumen) {
    setShowImporter(false)
    clearMessages()
    const partes = [`creadas: ${resumen.creados}`, `actualizadas: ${resumen.actualizados}`, `total: ${resumen.total}`]
    setInfo(`Importación OK · ${partes.join(' · ')}`)
    if (Array.isArray(resumen.warnings) && resumen.warnings.length > 0) setWarnings(resumen.warnings)
    await load()
    onChanged?.()
  }

  if (loading) return <div className="loading">Cargando preguntas...</div>

  // Vista exclusiva del importer cuando está activo (toggle full-screen del tab).
  if (showImporter) {
    return (
      <ImportarPreguntasMundial
        torneoId={torneoId}
        equiposCatalogo={equiposCatalogo}
        preguntasExistentes={preguntas}
        onDone={handleImportDone}
        onCancel={() => setShowImporter(false)}
      />
    )
  }

  return (
    <div>
      {/* Banner si estado bloqueado */}
      {!patchEdit && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(0,0,0,0.04)',
          color: 'var(--color-muted)',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}>
          ℹ️ Las preguntas solo se editan en estado <strong>Configuración</strong> (todo) o
          <strong> Abierto</strong> (solo enunciado, aclaración, activa).
          Estado actual: <strong>{estado}</strong>. Acciones deshabilitadas.
        </div>
      )}
      {patchEdit && !fullEdit && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(234,179,8,0.12)',
          color: '#a16207',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}>
          ⚠️ Estado <strong>{estado}</strong>: solo se permite editar enunciado, aclaración y activa.
          Tipo, número, config y borrado quedan bloqueados.
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14 }}>
          <strong>{preguntas.length}</strong> pregunta(s) cargada(s)
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowImporter(true); clearMessages() }}
            disabled={!fullEdit}
            title={!fullEdit ? `No disponible en estado '${estado}'` : 'Cargar preguntas desde Excel (.xlsx)'}
          >
            📥 Importar Excel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowNuevo(v => !v); clearMessages() }}
            disabled={!fullEdit}
            title={!fullEdit ? `No disponible en estado '${estado}'` : ''}
          >
            {showNuevo ? 'Cancelar' : '+ Agregar pregunta'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {info && (
        <div style={{
          padding: '8px 12px', background: 'rgba(22,163,74,0.10)',
          color: 'var(--color-success)', borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          {info}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{
          padding: '8px 12px', background: 'rgba(234,179,8,0.12)',
          color: '#a16207', borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          ⚠️ Códigos referenciados que no están en el catálogo de equipos:
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {warnings.map((w, i) => (
              <li key={i}>
                {w.pregunta_numero != null && <span>Pregunta #{w.pregunta_numero}: </span>}
                <code>{(w.codigos_no_encontrados || []).join(', ')}</code>
              </li>
            ))}
          </ul>
          <small style={{ display: 'block', marginTop: 4 }}>
            La pregunta se guarda igual. En fases siguientes, cuando los usuarios respondan, estos códigos van a requerir estar en el catálogo.
          </small>
        </div>
      )}

      {/* Form nueva */}
      {showNuevo && fullEdit && (
        <PreguntaForm
          modo="nueva"
          onCancel={() => setShowNuevo(false)}
          onSubmit={handleCreate}
          equiposCatalogo={equiposCatalogo}
        />
      )}

      {/* Grilla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50 }}>Nº</th>
              <th style={thStyle}>Enunciado</th>
              <th style={thStyle}>Tipo</th>
              <th style={{ ...thStyle, width: 80 }}>Activa</th>
              <th style={{ ...thStyle, width: 180 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {preguntas.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No hay preguntas cargadas. Usá <strong>+ Agregar pregunta</strong> para empezar.
                </td>
              </tr>
            )}
            {preguntas.map(p => (
              <PreguntaFila
                key={p.id}
                pregunta={p}
                isOpen={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                onDelete={() => handleDelete(p)}
                onSave={(patch) => handleSave(p.id, patch)}
                fullEdit={fullEdit}
                patchEdit={patchEdit}
                estado={estado}
                equiposCatalogo={equiposCatalogo}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Fila de la grilla (con acordeón) ────────────────────────────────────────
function PreguntaFila({ pregunta, isOpen, onToggle, onDelete, onSave, fullEdit, patchEdit, estado, equiposCatalogo }) {
  return (
    <>
      <tr style={{ background: pregunta.activa ? 'white' : 'rgba(0,0,0,0.02)' }}>
        <td style={{ ...cellStyle, fontWeight: 600 }}>{pregunta.numero}</td>
        <td style={cellStyle}>
          <div style={{ fontWeight: 500 }}>{pregunta.enunciado}</div>
          {pregunta.aclaracion && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {pregunta.aclaracion}
            </div>
          )}
        </td>
        <td style={cellStyle}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: 'rgba(99,102,241,0.10)', color: '#6366f1',
          }}>
            {TIPO_LABEL[pregunta.tipo_pregunta] || pregunta.tipo_pregunta}
          </span>
        </td>
        <td style={cellStyle}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: pregunta.activa ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.07)',
            color:      pregunta.activa ? 'var(--color-success)'  : 'var(--color-muted)',
          }}>
            {pregunta.activa ? 'Activa' : 'Inactiva'}
          </span>
        </td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onToggle}
              disabled={!patchEdit}
              title={!patchEdit ? `Bloqueado en estado '${estado}'` : ''}
              style={{ fontSize: 11 }}
            >
              {isOpen ? '▼ Cerrar' : '✏️ Ver/Editar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onDelete}
              disabled={!fullEdit}
              title={!fullEdit ? `Borrar solo en 'configuracion'` : ''}
              style={{ fontSize: 11, color: fullEdit ? 'var(--color-danger)' : 'inherit' }}
            >
              🗑️
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={5} style={{ padding: '16px 20px', background: 'rgba(59,130,246,0.03)', borderBottom: '1px solid var(--color-border)' }}>
            <PreguntaForm
              modo="editar"
              pregunta={pregunta}
              fullEdit={fullEdit}
              patchEdit={patchEdit}
              onCancel={onToggle}
              onSubmit={onSave}
              equiposCatalogo={equiposCatalogo}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Form completo (alta nueva o edición) ────────────────────────────────────
function PreguntaForm({ modo, pregunta, fullEdit, patchEdit, onCancel, onSubmit, equiposCatalogo }) {
  const esNueva = modo === 'nueva'
  // Defaults para alta nueva:
  const tipoInicial = esNueva ? 'opcion_unica' : pregunta.tipo_pregunta
  let configInicial
  try {
    configInicial = esNueva
      ? PLANTILLAS_CONFIG[tipoInicial]()
      : (pregunta.config_json ? JSON.parse(pregunta.config_json) : PLANTILLAS_CONFIG[tipoInicial]())
  } catch {
    configInicial = PLANTILLAS_CONFIG[tipoInicial]()
  }

  const [numero, setNumero]         = useState(esNueva ? '' : pregunta.numero)
  const [enunciado, setEnunciado]   = useState(esNueva ? '' : pregunta.enunciado || '')
  const [aclaracion, setAclaracion] = useState(esNueva ? '' : (pregunta.aclaracion || ''))
  const [tipo, setTipo]             = useState(tipoInicial)
  const [config, setConfig]         = useState(configInicial)
  const [activa, setActiva]         = useState(esNueva ? true : !!pregunta.activa)
  const [saving, setSaving]         = useState(false)

  // Disabled si el modo es edición y NO hay patchEdit
  const baseDisabled = !esNueva && !patchEdit

  // Campos que solo se editan en 'configuracion' (no en 'abierto')
  const soloFullEdit = !esNueva && !fullEdit

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo)
    // Al cambiar de tipo en alta nueva, resetear config con la plantilla.
    setConfig(PLANTILLAS_CONFIG[nuevoTipo]())
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (esNueva) {
        const numInt = parseInt(numero, 10)
        if (!Number.isInteger(numInt) || numInt <= 0) {
          alert('Número entero positivo requerido')
          setSaving(false); return
        }
        const ok = await onSubmit({
          numero: numInt,
          enunciado: String(enunciado || '').trim(),
          aclaracion: aclaracion || null,
          tipo_pregunta: tipo,
          config_json: config,
          activa: activa ? 1 : 0,
        })
        if (!ok) setSaving(false)
        // Si OK, el parent va a recargar y este form desaparece — no necesitamos setSaving(false).
      } else {
        // Editar: armar patch SOLO con lo que cambió, según los campos permitidos por estado.
        const patch = {}
        if (enunciado !== pregunta.enunciado) patch.enunciado = enunciado
        if ((aclaracion || null) !== (pregunta.aclaracion || null)) patch.aclaracion = aclaracion || null
        if ((activa ? 1 : 0) !== pregunta.activa) patch.activa = activa ? 1 : 0
        if (fullEdit) {
          // Comparar config: si cambió, mandarla
          const configActualStr = JSON.stringify(config)
          const configOriginalStr = pregunta.config_json
          if (configActualStr !== configOriginalStr) patch.config_json = config
        }
        if (Object.keys(patch).length === 0) {
          alert('No hay cambios para guardar.')
          setSaving(false); return
        }
        const ok = await onSubmit(patch)
        if (!ok) setSaving(false)
      }
    } catch (err) {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">{esNueva ? 'Nueva pregunta' : `Editar pregunta #${pregunta.numero}`}</div>

      {/* Campos comunes */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 100px', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Número</label>
          <input
            type="number" min="1"
            value={numero}
            onChange={e => setNumero(e.target.value)}
            disabled={!esNueva || baseDisabled}
            style={inputStyle}
            required={esNueva}
            title={!esNueva ? 'Inmutable post-creación' : ''}
          />
        </div>
        <div>
          <label style={fieldLabel}>Enunciado</label>
          <input
            value={enunciado}
            onChange={e => setEnunciado(e.target.value)}
            disabled={baseDisabled}
            style={inputStyle}
            required
            placeholder="¿Quién será campeón?"
          />
        </div>
        <div>
          <label style={fieldLabel}>Aclaración (opcional)</label>
          <input
            value={aclaracion}
            onChange={e => setAclaracion(e.target.value)}
            disabled={baseDisabled}
            style={inputStyle}
            placeholder="Detalle, formato esperado, etc."
          />
        </div>
        <div>
          <label style={fieldLabel}>Activa</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6 }}>
            <input
              type="checkbox"
              checked={activa}
              onChange={e => setActiva(e.target.checked)}
              disabled={baseDisabled}
            />
            <span style={{ fontSize: 13 }}>{activa ? 'Sí' : 'No'}</span>
          </label>
        </div>
      </div>

      {/* Tipo de pregunta */}
      <div style={{ marginTop: 12 }}>
        <label style={fieldLabel}>Tipo de pregunta</label>
        <select
          value={tipo}
          onChange={e => handleTipoChange(e.target.value)}
          disabled={!esNueva || baseDisabled}
          style={{ ...inputStyle, maxWidth: 360 }}
          title={!esNueva ? 'Inmutable post-creación — para cambiar tipo, borrá y creá una nueva' : ''}
        >
          {TIPOS_DISPONIBLES.map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {/* Editor de config_json según el tipo */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>
          CONFIGURACIÓN ({TIPO_LABEL[tipo]})
        </div>
        <MundialConfigEditor
          tipo={tipo}
          config={config}
          onChange={setConfig}
          disabled={baseDisabled || soloFullEdit}
          equiposCatalogo={equiposCatalogo}
        />
        {soloFullEdit && !baseDisabled && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
            La configuración solo se edita en estado <strong>Configuración</strong>.
          </div>
        )}
      </div>

      {/* Botones */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving || baseDisabled}>
          {saving ? 'Guardando...' : (esNueva ? 'Crear pregunta' : 'Guardar cambios')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * AdminMundialDatosUtiles — Datos útiles Fase 1 (MVP manual)
 *
 * Tab del AdminMundialHub. CRUD plano contra `mundial_datos_utiles`.
 * Sin Fase 2 (no expone pregunta_id, no implementa "lo pusieron").
 *
 * UX:
 *   - Filtro por tipo (chips) + "Todos".
 *   - Botón "+ Nuevo" → form inline.
 *   - Lista debajo, cada ítem editable con [Editar] [×] y toggle activo.
 *   - Equipo se elige con EquipoAutocomplete (reuso).
 *
 * Cero scoring, cero ranking, cero acoplamiento con el resto del módulo.
 */

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import EquipoAutocomplete from '../../components/EquipoAutocomplete.jsx'

const TIPOS_ORDEN = [
  'goleadores',
  'amarillas_equipo',
  'rojas_equipo',
  'clasificados',
  'eliminados',
  'tabla_grupos',
  'otro',
]
const TIPO_LABEL = {
  goleadores:       'Goleadores',
  amarillas_equipo: 'Amarillas (equipo)',
  rojas_equipo:     'Rojas (equipo)',
  clasificados:     'Clasificados',
  eliminados:       'Eliminados',
  tabla_grupos:     'Tabla de grupos',
  otro:             'Otro',
}

const FORM_INICIAL = {
  tipo:          'goleadores',
  titulo:        '',
  valor_num:     '',
  valor_texto:   '',
  equipo_codigo: '',
  jugador:       '',
  grupo:         '',
  descripcion:   '',
  orden_display: 0,
  activo:        1,
}

export default function AdminMundialDatosUtiles({ torneoId }) {
  const [items, setItems]       = useState([])
  const [equipos, setEquipos]   = useState([])
  const [filtroTipo, setFiltro] = useState('')   // '' = todos
  const [editingId, setEditingId] = useState(null) // null = lista, 0 = nuevo, N = edit existente
  const [form, setForm]         = useState(FORM_INICIAL)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [torneoId])

  async function load() {
    setLoading(true); setError(''); setInfo('')
    try {
      const [list, cat] = await Promise.all([
        // Admin: traemos también inactivos para poder ver/editar.
        api.getMundialDatosUtiles(torneoId, { incluir_inactivos: 1 }),
        api.getMundialEquiposCatalogo(torneoId).catch(() => []),
      ])
      setItems(Array.isArray(list) ? list : [])
      setEquipos(Array.isArray(cat) ? cat : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const equipoBy = useMemo(() => {
    const m = new Map()
    for (const e of equipos) m.set(e.codigo, e)
    return m
  }, [equipos])

  const filtrados = useMemo(() => {
    if (!filtroTipo) return items
    return items.filter(x => x.tipo === filtroTipo)
  }, [items, filtroTipo])

  // ── Form helpers ─────────────────────────────────────────────────────────
  function abrirNuevo() {
    setForm({ ...FORM_INICIAL, tipo: filtroTipo || 'goleadores' })
    setEditingId(0)
    setError(''); setInfo('')
  }
  function abrirEdit(item) {
    setForm({
      tipo:          item.tipo,
      titulo:        item.titulo || '',
      valor_num:     Number.isInteger(item.valor_num) ? item.valor_num : '',
      valor_texto:   item.valor_texto || '',
      equipo_codigo: item.equipo_codigo || '',
      jugador:       item.jugador || '',
      grupo:         item.grupo || '',
      descripcion:   item.descripcion || '',
      orden_display: Number.isInteger(item.orden_display) ? item.orden_display : 0,
      activo:        item.activo === 1 ? 1 : 0,
    })
    setEditingId(item.id)
    setError(''); setInfo('')
  }
  function cancelar() {
    setEditingId(null)
    setError('')
  }

  // Construye el payload normalizado para POST/PUT.
  function buildPayload() {
    const parseIntOrNull = (v) => {
      if (v === '' || v === null || v === undefined) return null
      const n = parseInt(v, 10)
      return Number.isInteger(n) ? n : null
    }
    return {
      tipo:          form.tipo,
      titulo:        form.titulo,
      valor_num:     parseIntOrNull(form.valor_num),
      valor_texto:   form.valor_texto || null,
      equipo_codigo: form.equipo_codigo || null,
      jugador:       form.jugador || null,
      grupo:         form.grupo || null,
      descripcion:   form.descripcion || null,
      orden_display: parseIntOrNull(form.orden_display) ?? 0,
      activo:        form.activo === 1 ? 1 : 0,
    }
  }

  async function guardar() {
    if (saving) return
    setError(''); setInfo('')
    if (!form.titulo || !form.titulo.trim()) {
      setError('Título es requerido'); return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (editingId === 0) {
        await api.createMundialDatoUtil(torneoId, payload)
        setInfo('Creado.')
      } else {
        await api.updateMundialDatoUtil(torneoId, editingId, payload)
        setInfo('Actualizado.')
      }
      setEditingId(null)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function borrar(item) {
    if (!window.confirm(`Borrar "${item.titulo}"? No se puede deshacer.`)) return
    setError(''); setInfo('')
    try {
      await api.deleteMundialDatoUtil(torneoId, item.id)
      setInfo('Borrado.')
      await load()
    } catch (e) { setError(e.message) }
  }

  async function toggleActivo(item) {
    setError(''); setInfo('')
    try {
      await api.updateMundialDatoUtil(torneoId, item.id, {
        tipo:          item.tipo,
        titulo:        item.titulo,
        valor_num:     item.valor_num,
        valor_texto:   item.valor_texto,
        equipo_codigo: item.equipo_codigo,
        jugador:       item.jugador,
        grupo:         item.grupo,
        descripcion:   item.descripcion,
        orden_display: item.orden_display,
        activo:        item.activo === 1 ? 0 : 1,
      })
      await load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="loading">Cargando datos útiles...</div>

  return (
    <div>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {info && (
        <div style={{
          padding: '6px 10px', marginBottom: 12,
          background: 'rgba(22,163,74,0.10)', color: 'var(--color-success)',
          borderRadius: 6, fontSize: 12,
        }}>{info}</div>
      )}

      {/* Filtros por tipo + Acciones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
        <FiltroChip label="Todos" activo={filtroTipo === ''} onClick={() => setFiltro('')} count={items.length} />
        {TIPOS_ORDEN.map(t => {
          const count = items.filter(x => x.tipo === t).length
          return (
            <FiltroChip
              key={t}
              label={TIPO_LABEL[t]}
              activo={filtroTipo === t}
              onClick={() => setFiltro(t)}
              count={count}
            />
          )
        })}
        <span style={{ flex: 1 }} />
        {editingId === null && (
          <button className="btn btn-primary btn-sm" onClick={abrirNuevo} disabled={saving}>
            + Nuevo
          </button>
        )}
      </div>

      {/* Form crear/editar */}
      {editingId !== null && (
        <DatoForm
          form={form}
          setForm={setForm}
          equipos={equipos}
          esNuevo={editingId === 0}
          saving={saving}
          onSave={guardar}
          onCancel={cancelar}
        />
      )}

      {/* Lista */}
      {filtrados.length === 0 && (
        <div style={{
          padding: '14px 16px', textAlign: 'center',
          background: 'rgba(0,0,0,0.04)', color: 'var(--color-muted)',
          borderRadius: 8, fontSize: 13,
        }}>
          {items.length === 0
            ? 'No hay datos útiles cargados todavía. Tocá "+ Nuevo".'
            : 'Sin datos útiles para este filtro.'}
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface2, #f1f3f5)' }}>
                <th style={th}>Tipo</th>
                <th style={th}>Título</th>
                <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                <th style={th}>Equipo</th>
                <th style={th}>Jugador</th>
                <th style={{ ...th, textAlign: 'right' }}>Orden</th>
                <th style={{ ...th, textAlign: 'center' }}>Activo</th>
                <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(d => {
                const eq = d.equipo_codigo ? equipoBy.get(d.equipo_codigo) : null
                return (
                  <tr key={d.id} style={{
                    borderTop: '1px solid var(--color-border)',
                    background: d.activo === 0 ? 'rgba(0,0,0,0.025)' : 'transparent',
                    color: d.activo === 0 ? 'var(--color-muted)' : 'var(--color-text)',
                  }}>
                    <td style={td}>
                      <span style={tipoChip}>{TIPO_LABEL[d.tipo] || d.tipo}</span>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{d.titulo}</div>
                      {d.descripcion && (
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          {d.descripcion}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Number.isInteger(d.valor_num) ? <strong>{d.valor_num}</strong> : null}
                      {d.valor_texto && (
                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{d.valor_texto}</div>
                      )}
                    </td>
                    <td style={td}>
                      {d.equipo_codigo ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {eq?.emoji ? `${eq.emoji} ` : ''}{eq?.nombre || d.equipo_codigo}
                        </span>
                      ) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td style={td}>
                      {d.jugador || <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Number.isInteger(d.orden_display) ? d.orden_display : 0}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => toggleActivo(d)}
                        title={d.activo === 1 ? 'Click para desactivar' : 'Click para activar'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 16, padding: 2,
                        }}
                      >
                        {d.activo === 1 ? '✅' : '⬜'}
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => abrirEdit(d)}
                        disabled={editingId !== null}
                        style={{ marginRight: 4 }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => borrar(d)}
                        disabled={editingId !== null}
                        title="Borrar"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 14, padding: '4px 6px', color: 'var(--color-muted)',
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function FiltroChip({ label, activo, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 99,
        border: activo ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
        background: activo ? 'rgba(59,130,246,0.10)' : 'white',
        color: activo ? 'var(--color-primary)' : 'var(--color-text)',
        fontSize: 12, fontWeight: activo ? 600 : 500,
        cursor: 'pointer', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      <span style={{
        fontSize: 10, color: activo ? 'var(--color-primary)' : 'var(--color-muted)',
        background: activo ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.06)',
        padding: '1px 6px', borderRadius: 99, fontWeight: 600,
      }}>
        {count}
      </span>
    </button>
  )
}

function DatoForm({ form, setForm, equipos, esNuevo, saving, onSave, onCancel }) {
  function patch(p) { setForm(prev => ({ ...prev, ...p })) }
  return (
    <div className="card" style={{
      padding: 14, marginBottom: 12,
      border: '1px solid var(--color-primary)',
      background: 'rgba(59,130,246,0.04)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
        {esNuevo ? '+ Nuevo dato útil' : 'Editar dato útil'}
      </div>

      <div style={gridForm}>
        <Label text="Tipo">
          <select
            value={form.tipo}
            onChange={e => patch({ tipo: e.target.value })}
            disabled={saving}
            style={inp}
          >
            {TIPOS_ORDEN.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </Label>
        <Label text="Título *">
          <input
            type="text" value={form.titulo}
            onChange={e => patch({ titulo: e.target.value })}
            disabled={saving} style={inp} placeholder="Ej: Messi"
          />
        </Label>
        <Label text="Valor (número)">
          <input
            type="number" step="1" value={form.valor_num}
            onChange={e => patch({ valor_num: e.target.value })}
            disabled={saving} style={inp} placeholder="Ej: 5"
          />
        </Label>
        <Label text="Valor (texto)">
          <input
            type="text" value={form.valor_texto}
            onChange={e => patch({ valor_texto: e.target.value })}
            disabled={saving} style={inp} placeholder="Ej: Récord histórico"
          />
        </Label>
        <Label text="Equipo (opcional)">
          <EquipoAutocomplete
            equipos={equipos}
            valor={form.equipo_codigo}
            onChange={c => patch({ equipo_codigo: c || '' })}
            disabled={saving}
            autoLimpiar={false}
            placeholder="Buscá un equipo…"
          />
          {form.equipo_codigo && (
            <button
              type="button"
              onClick={() => patch({ equipo_codigo: '' })}
              disabled={saving}
              style={{
                marginTop: 4, fontSize: 11, color: 'var(--color-muted)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              Quitar equipo
            </button>
          )}
        </Label>
        <Label text="Jugador (opcional)">
          <input
            type="text" value={form.jugador}
            onChange={e => patch({ jugador: e.target.value })}
            disabled={saving} style={inp} placeholder="Ej: L. Messi"
          />
        </Label>
        <Label text="Grupo (opcional)">
          <input
            type="text" value={form.grupo}
            onChange={e => patch({ grupo: e.target.value })}
            disabled={saving} style={inp} placeholder="Ej: A"
          />
        </Label>
        <Label text="Orden">
          <input
            type="number" step="1" min="0" value={form.orden_display}
            onChange={e => patch({ orden_display: e.target.value })}
            disabled={saving} style={inp}
          />
        </Label>
        <Label text="Descripción (opcional)" full>
          <textarea
            rows={2} value={form.descripcion}
            onChange={e => patch({ descripcion: e.target.value })}
            disabled={saving}
            style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Nota libre"
          />
        </Label>
        <Label text="Activo" full>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.activo === 1}
              onChange={e => patch({ activo: e.target.checked ? 1 : 0 })}
              disabled={saving}
            />
            Mostrar en la vista pública
          </label>
        </Label>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving} style={{ minWidth: 100 }}>
          {saving ? 'Guardando...' : (esNuevo ? 'Crear' : 'Guardar')}
        </button>
      </div>
    </div>
  )
}

function Label({ text, full, children }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{
        fontSize: 11, color: 'var(--color-muted)', fontWeight: 600,
        marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {text}
      </div>
      {children}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '7px 10px',
  fontSize: 13, border: '1px solid var(--color-border)',
  borderRadius: 6, background: 'white', outline: 'none', boxSizing: 'border-box',
}
const th = {
  padding: '8px 10px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
}
const td = {
  padding: '8px 10px',
  fontSize: 13, verticalAlign: 'middle',
}
const tipoChip = {
  display: 'inline-block', fontSize: 10, fontWeight: 700,
  padding: '2px 7px', borderRadius: 4,
  background: 'rgba(0,0,0,0.06)', color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
}
const gridForm = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
}

import { useState, useCallback, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

const CATEGORIAS_GASTO = ['Carnes', 'Lacteos', 'Verduras', 'Bebidas', 'Limpieza', 'Descartables', 'Otros']

export default function Ingredientes() {
  const [ingredientes, setIngredientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showMovModal, setShowMovModal] = useState(false)
  const [showLotesModal, setShowLotesModal] = useState(false)
  const [showLoteForm, setShowLoteForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [ingredienteSeleccionado, setIngredienteSeleccionado] = useState(null)
  const [form, setForm] = useState({ nombre: '', unidad: '', stockActual: '', stockMinimo: '', costo: '' })
  const [movForm, setMovForm] = useState({ tipo: 'ENTRADA', cantidad: '', motivo: '', categoriaGasto: '', costoUnitario: '' })
  const [lotes, setLotes] = useState([])
  const [alertasVenc, setAlertasVenc] = useState([])
  const [loteForm, setLoteForm] = useState({ cantidad: '', codigoLote: '', costoUnitario: '', fechaVencimiento: '', categoriaGasto: '' })

  const cargarIngredientes = useCallback(async () => {
    const response = await api.get('/ingredientes')
    setIngredientes(response.data)
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarIngredientesRequest = useCallback(async (_ctx) => (
    cargarIngredientes()
  ), [cargarIngredientes])

  const { loading, execute: cargarIngredientesAsync } = useAsync(
    cargarIngredientesRequest,
    { onError: handleLoadError }
  )

  // Cargar alertas de vencimiento
  useEffect(() => {
    api.get('/ingredientes/lotes/alertas-vencimiento?dias=7', { skipToast: true })
      .then(res => setAlertasVenc(res.data))
      .catch(() => setAlertasVenc([]))
  }, [ingredientes])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...form,
        stockActual: parseFloat(form.stockActual),
        stockMinimo: parseFloat(form.stockMinimo),
        costo: form.costo ? parseFloat(form.costo) : null
      }
      if (editando) {
        await api.put(`/ingredientes/${editando.id}`, data)
        toast.success('Ingrediente actualizado')
      } else {
        await api.post('/ingredientes', data)
        toast.success('Ingrediente creado')
      }
      setShowModal(false)
      resetForm()
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleMovimiento = async (e) => {
    e.preventDefault()
    try {
      const data = {
        tipo: movForm.tipo,
        cantidad: parseFloat(movForm.cantidad),
        motivo: movForm.motivo
      }
      if (movForm.tipo === 'ENTRADA') {
        if (movForm.categoriaGasto) data.categoriaGasto = movForm.categoriaGasto
        if (movForm.costoUnitario) data.costoUnitario = parseFloat(movForm.costoUnitario)
      }
      await api.post(`/ingredientes/${ingredienteSeleccionado.id}/movimiento`, data)
      toast.success('Movimiento registrado')
      setShowMovModal(false)
      setMovForm({ tipo: 'ENTRADA', cantidad: '', motivo: '', categoriaGasto: '', costoUnitario: '' })
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleEdit = (ingrediente) => {
    setEditando(ingrediente)
    setForm({
      nombre: ingrediente.nombre,
      unidad: ingrediente.unidad,
      stockActual: ingrediente.stockActual,
      stockMinimo: ingrediente.stockMinimo,
      costo: ingrediente.costo || ''
    })
    setShowModal(true)
  }

  const abrirMovimiento = (ingrediente) => {
    setIngredienteSeleccionado(ingrediente)
    setShowMovModal(true)
  }

  const abrirLotes = async (ingrediente) => {
    setIngredienteSeleccionado(ingrediente)
    try {
      const res = await api.get(`/ingredientes/${ingrediente.id}/lotes`, { skipToast: true })
      setLotes(res.data)
    } catch {
      setLotes([])
    }
    setShowLotesModal(true)
  }

  const handleCrearLote = async (e) => {
    e.preventDefault()
    try {
      const data = {
        cantidad: parseFloat(loteForm.cantidad)
      }
      if (loteForm.codigoLote) data.codigoLote = loteForm.codigoLote
      if (loteForm.costoUnitario) data.costoUnitario = parseFloat(loteForm.costoUnitario)
      if (loteForm.fechaVencimiento) data.fechaVencimiento = loteForm.fechaVencimiento
      if (loteForm.categoriaGasto) data.categoriaGasto = loteForm.categoriaGasto
      await api.post(`/ingredientes/${ingredienteSeleccionado.id}/lotes`, data)
      toast.success('Lote creado')
      setShowLoteForm(false)
      setLoteForm({ cantidad: '', codigoLote: '', costoUnitario: '', fechaVencimiento: '', categoriaGasto: '' })
      // Recargar lotes y stock
      const res = await api.get(`/ingredientes/${ingredienteSeleccionado.id}/lotes`, { skipToast: true })
      setLotes(res.data)
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDescartarLote = async (loteId) => {
    if (!confirm('Descartar este lote? Se restara del stock.')) return
    try {
      await api.post(`/ingredientes/lotes/${loteId}/descartar`)
      toast.success('Lote descartado')
      const res = await api.get(`/ingredientes/${ingredienteSeleccionado.id}/lotes`, { skipToast: true })
      setLotes(res.data)
      cargarIngredientesAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const resetForm = () => {
    setForm({ nombre: '', unidad: '', stockActual: '', stockMinimo: '', costo: '' })
    setEditando(null)
  }

  const stockBajo = (ing) => parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo)

  if (loading && ingredientes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Ingredientes / Stock</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Ingrediente
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Stock Actual</th>
              <th>Stock Mínimo</th>
              <th>Costo Unit.</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map((ing) => (
              <tr key={ing.id} className={stockBajo(ing) ? 'bg-error-50' : ''}>
                <td className="font-medium text-text-primary">{ing.nombre}</td>
                <td className="text-text-primary">
                  {parseFloat(ing.stockActual).toFixed(2)} {ing.unidad}
                </td>
                <td className="text-text-secondary">
                  {parseFloat(ing.stockMinimo).toFixed(2)} {ing.unidad}
                </td>
                <td className="text-text-secondary">
                  {ing.costo ? `$${parseFloat(ing.costo).toLocaleString('es-AR')}` : '-'}
                </td>
                <td>
                  <span className={`badge ${stockBajo(ing) ? 'badge-error' : 'badge-success'}`}>
                    {stockBajo(ing) ? 'Stock Bajo' : 'OK'}
                  </span>
                </td>
                <td className="text-right space-x-2">
                  <button
                    aria-label={`Lotes de: ${ing.nombre}`}
                    onClick={() => abrirLotes(ing)}
                    className="text-amber-500 hover:text-amber-600 transition-colors"
                    title="Ver lotes"
                  >
                    <ArchiveBoxIcon className="w-5 h-5" />
                  </button>
                  <button
                    aria-label={`Movimiento de stock: ${ing.nombre}`}
                    onClick={() => abrirMovimiento(ing)}
                    className="text-success-500 hover:text-success-600 transition-colors"
                    title="Registrar movimiento"
                  >
                    <ArrowUpIcon className="w-5 h-5 inline" />
                    <ArrowDownIcon className="w-5 h-5 inline" />
                  </button>
                  <button
                    aria-label={`Editar ingrediente: ${ing.nombre}`}
                    onClick={() => handleEdit(ing)}
                    className="text-primary-500 hover:text-primary-600 transition-colors"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alertas de vencimiento */}
      {alertasVenc.length > 0 && (
        <div className="card bg-amber-50 border-amber-200 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Lotes proximos a vencer ({alertasVenc.length})</h3>
          </div>
          <div className="space-y-2">
            {alertasVenc.map(lote => {
              const vencido = new Date(lote.fechaVencimiento) < new Date()
              return (
                <div key={lote.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${vencido ? 'bg-error-50' : 'bg-amber-100'}`}>
                  <div>
                    <span className="font-medium text-text-primary">{lote.ingrediente?.nombre}</span>
                    <span className="text-sm text-text-secondary ml-2">
                      Lote: {lote.codigoLote || lote.id} - Cant: {parseFloat(lote.cantidadActual).toFixed(2)} {lote.ingrediente?.unidad}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${vencido ? 'text-error-600' : 'text-amber-600'}`}>
                      {vencido ? 'VENCIDO' : `Vence: ${new Date(lote.fechaVencimiento).toLocaleDateString('es-AR')}`}
                    </span>
                    <button
                      onClick={() => handleDescartarLote(lote.id)}
                      className="text-xs bg-error-500 text-white px-2 py-1 rounded hover:bg-error-600"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal Ingrediente */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">
              {editando ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
            </h2>
	            <form onSubmit={handleSubmit} className="space-y-4">
	              <div>
	                <label className="label" htmlFor="ingrediente-nombre">Nombre</label>
	                <input
	                  id="ingrediente-nombre"
	                  type="text"
	                  className="input"
	                  value={form.nombre}
	                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
	                  required
	                />
	              </div>
	              <div className="grid grid-cols-2 gap-4">
	                <div>
	                  <label className="label" htmlFor="ingrediente-unidad">Unidad</label>
	                  <input
	                    id="ingrediente-unidad"
	                    type="text"
	                    className="input"
	                    value={form.unidad}
	                    onChange={(e) => setForm({ ...form, unidad: e.target.value })}
	                    placeholder="kg, litros, unidades"
	                    required
	                  />
	                </div>
	                <div>
	                  <label className="label" htmlFor="ingrediente-costo">Costo Unitario ($)</label>
	                  <input
	                    id="ingrediente-costo"
	                    type="number"
	                    step="0.01"
	                    className="input"
	                    value={form.costo}
	                    onChange={(e) => setForm({ ...form, costo: e.target.value })}
	                  />
	                </div>
	              </div>
	              <div className="grid grid-cols-2 gap-4">
	                <div>
	                  <label className="label" htmlFor="ingrediente-stock-actual">Stock Actual</label>
	                  <input
	                    id="ingrediente-stock-actual"
	                    type="number"
	                    step="0.01"
	                    className="input"
	                    value={form.stockActual}
	                    onChange={(e) => setForm({ ...form, stockActual: e.target.value })}
	                    required
	                  />
	                </div>
	                <div>
	                  <label className="label" htmlFor="ingrediente-stock-minimo">Stock Mínimo</label>
	                  <input
	                    id="ingrediente-stock-minimo"
	                    type="number"
	                    step="0.01"
	                    className="input"
	                    value={form.stockMinimo}
	                    onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
	                    required
	                  />
	                </div>
	              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lotes */}
      {showLotesModal && ingredienteSeleccionado && (
        <div className="modal-overlay">
          <div className="modal max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading-3">
                Lotes: {ingredienteSeleccionado.nombre}
              </h2>
              <button
                onClick={() => setShowLoteForm(!showLoteForm)}
                className="btn btn-primary btn-sm flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Nuevo Lote
              </button>
            </div>

            {/* Form crear lote */}
            {showLoteForm && (
              <form onSubmit={handleCrearLote} className="bg-surface-hover p-4 rounded-lg mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs" htmlFor="lote-cantidad">Cantidad ({ingredienteSeleccionado.unidad})*</label>
                    <input id="lote-cantidad" type="number" step="0.01" className="input" value={loteForm.cantidad}
                      onChange={(e) => setLoteForm({ ...loteForm, cantidad: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="lote-codigo">Codigo de Lote</label>
                    <input id="lote-codigo" type="text" className="input" value={loteForm.codigoLote}
                      onChange={(e) => setLoteForm({ ...loteForm, codigoLote: e.target.value })} placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="lote-costo">Costo Unitario ($)</label>
                    <input id="lote-costo" type="number" step="0.01" min="0" className="input" value={loteForm.costoUnitario}
                      onChange={(e) => setLoteForm({ ...loteForm, costoUnitario: e.target.value })} />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="lote-vencimiento">Fecha Vencimiento</label>
                    <input id="lote-vencimiento" type="date" className="input" value={loteForm.fechaVencimiento}
                      onChange={(e) => setLoteForm({ ...loteForm, fechaVencimiento: e.target.value })} />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="lote-categoria">Categoria de Gasto</label>
                    <select id="lote-categoria" className="input" value={loteForm.categoriaGasto}
                      onChange={(e) => setLoteForm({ ...loteForm, categoriaGasto: e.target.value })}>
                      <option value="">Sin categoria</option>
                      {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowLoteForm(false)} className="btn btn-secondary btn-sm">Cancelar</button>
                  <button type="submit" className="btn btn-primary btn-sm">Crear Lote</button>
                </div>
              </form>
            )}

            {/* Lista de lotes */}
            {lotes.length === 0 ? (
              <p className="text-text-secondary text-center py-6">No hay lotes registrados para este ingrediente</p>
            ) : (
              <div className="border border-border-default rounded-xl overflow-hidden">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Cantidad</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map(lote => {
                      const cantActual = parseFloat(lote.cantidadActual)
                      const cantInicial = parseFloat(lote.cantidadInicial)
                      const porcentaje = cantInicial > 0 ? (cantActual / cantInicial) * 100 : 0
                      const vencido = lote.fechaVencimiento && new Date(lote.fechaVencimiento) < new Date()
                      return (
                        <tr key={lote.id} className={lote.agotado ? 'opacity-50' : vencido ? 'bg-error-50' : ''}>
                          <td className="font-medium">{lote.codigoLote || `#${lote.id}`}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-surface-hover rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${vencido ? 'bg-error-500' : 'bg-success-500'}`}
                                  style={{ width: `${porcentaje}%` }}
                                />
                              </div>
                              <span>{cantActual.toFixed(2)} / {cantInicial.toFixed(2)}</span>
                            </div>
                          </td>
                          <td>
                            {lote.fechaVencimiento
                              ? new Date(lote.fechaVencimiento).toLocaleDateString('es-AR')
                              : '-'
                            }
                          </td>
                          <td>
                            {lote.agotado ? (
                              <span className="badge badge-default text-xs">Agotado</span>
                            ) : vencido ? (
                              <span className="badge badge-error text-xs">Vencido</span>
                            ) : (
                              <span className="badge badge-success text-xs">Activo</span>
                            )}
                          </td>
                          <td className="text-right">
                            {!lote.agotado && (
                              <button
                                onClick={() => handleDescartarLote(lote.id)}
                                className="text-xs text-error-500 hover:text-error-600"
                              >
                                Descartar
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-footer mt-4">
              <button type="button" onClick={() => { setShowLotesModal(false); setShowLoteForm(false) }} className="btn btn-secondary flex-1">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Movimiento */}
      {showMovModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">
              Movimiento de Stock: {ingredienteSeleccionado?.nombre}
            </h2>
	            <form onSubmit={handleMovimiento} className="space-y-4">
	              <div>
	                <label className="label" htmlFor="ingrediente-mov-tipo">Tipo de Movimiento</label>
	                <select
	                  id="ingrediente-mov-tipo"
	                  className="input"
	                  value={movForm.tipo}
	                  onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}
	                >
                  <option value="ENTRADA">Entrada (Compra/Recepción)</option>
                  <option value="SALIDA">Salida (Merma/Pérdida)</option>
                </select>
              </div>
	              <div>
	                <label className="label" htmlFor="ingrediente-mov-cantidad">Cantidad ({ingredienteSeleccionado?.unidad})</label>
	                <input
	                  id="ingrediente-mov-cantidad"
	                  type="number"
	                  step="0.01"
	                  className="input"
	                  value={movForm.cantidad}
	                  onChange={(e) => setMovForm({ ...movForm, cantidad: e.target.value })}
	                  required
	                />
	              </div>
	              <div>
	                <label className="label" htmlFor="ingrediente-mov-motivo">Motivo</label>
	                <input
	                  id="ingrediente-mov-motivo"
	                  type="text"
	                  className="input"
	                  value={movForm.motivo}
	                  onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })}
	                  placeholder="Compra proveedor, merma, etc."
	                />
	              </div>
              {movForm.tipo === 'ENTRADA' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="ingrediente-mov-categoria">Categoria de Gasto</label>
                      <select
                        id="ingrediente-mov-categoria"
                        className="input"
                        value={movForm.categoriaGasto}
                        onChange={(e) => setMovForm({ ...movForm, categoriaGasto: e.target.value })}
                      >
                        <option value="">Sin categoria</option>
                        <option value="Carnes">Carnes</option>
                        <option value="Lacteos">Lacteos</option>
                        <option value="Verduras">Verduras</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Limpieza">Limpieza</option>
                        <option value="Descartables">Descartables</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="ingrediente-mov-costo">Costo Unitario ($)</label>
                      <input
                        id="ingrediente-mov-costo"
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        value={movForm.costoUnitario}
                        onChange={(e) => setMovForm({ ...movForm, costoUnitario: e.target.value })}
                        placeholder="Costo por unidad"
                      />
                    </div>
                  </div>
                  {movForm.costoUnitario && movForm.cantidad && (
                    <div className="text-sm text-text-secondary bg-surface-hover px-3 py-2 rounded-lg">
                      Costo total: <span className="font-medium text-text-primary">${(parseFloat(movForm.costoUnitario) * parseFloat(movForm.cantidad)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </>
              )}
              <div className="modal-footer">
                <button type="button" onClick={() => setShowMovModal(false)} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

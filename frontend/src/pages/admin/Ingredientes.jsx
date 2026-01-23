import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

export default function Ingredientes() {
  const [ingredientes, setIngredientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showMovModal, setShowMovModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [ingredienteSeleccionado, setIngredienteSeleccionado] = useState(null)
  const [form, setForm] = useState({ nombre: '', unidad: '', stockActual: '', stockMinimo: '', costo: '' })
  const [movForm, setMovForm] = useState({ tipo: 'ENTRADA', cantidad: '', motivo: '' })

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
      await api.post(`/ingredientes/${ingredienteSeleccionado.id}/movimiento`, {
        tipo: movForm.tipo,
        cantidad: parseFloat(movForm.cantidad),
        motivo: movForm.motivo
      })
      toast.success('Movimiento registrado')
      setShowMovModal(false)
      setMovForm({ tipo: 'ENTRADA', cantidad: '', motivo: '' })
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

  const resetForm = () => {
    setForm({ nombre: '', unidad: '', stockActual: '', stockMinimo: '', costo: '' })
    setEditando(null)
  }

  const stockBajo = (ing) => parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo)

  if (loading && ingredientes.length === 0) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ingredientes / Stock</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Ingrediente
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingrediente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Actual</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Mínimo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Unit.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ingredientes.map((ing) => (
              <tr key={ing.id} className={stockBajo(ing) ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{ing.nombre}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {parseFloat(ing.stockActual).toFixed(2)} {ing.unidad}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {parseFloat(ing.stockMinimo).toFixed(2)} {ing.unidad}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {ing.costo ? `$${parseFloat(ing.costo).toLocaleString('es-AR')}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    stockBajo(ing) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {stockBajo(ing) ? 'Stock Bajo' : 'OK'}
                  </span>
                </td>
	                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
	                  <button
	                    aria-label={`Movimiento de stock: ${ing.nombre}`}
	                    onClick={() => abrirMovimiento(ing)}
	                    className="text-green-600 hover:text-green-800"
	                    title="Registrar movimiento"
	                  >
                    <ArrowUpIcon className="w-5 h-5 inline" />
                    <ArrowDownIcon className="w-5 h-5 inline" />
                  </button>
	                  <button
	                    aria-label={`Editar ingrediente: ${ing.nombre}`}
	                    onClick={() => handleEdit(ing)}
	                    className="text-primary-600 hover:text-primary-800"
	                  >
	                    <PencilIcon className="w-5 h-5" />
	                  </button>
	                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Ingrediente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">
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
              <div className="flex gap-3 pt-4">
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

      {/* Modal Movimiento */}
      {showMovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">
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
              <div className="flex gap-3 pt-4">
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

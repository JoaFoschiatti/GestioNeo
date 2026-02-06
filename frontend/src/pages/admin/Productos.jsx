// ============================================================
// PRODUCTOS - Gestión del catálogo de productos
// ============================================================
//
// Esta página permite a los administradores gestionar el catálogo:
// - CRUD de productos (crear, editar, eliminar)
// - Subir imágenes de productos
// - Gestionar variantes (ej: tamaños de pizza)
// - Agrupar productos existentes como variantes
//
// SISTEMA DE VARIANTES:
// Un producto puede tener variantes (ej: Pizza → Chica, Mediana, Grande).
// Las variantes comparten algunos datos del producto base pero tienen
// su propio precio y multiplicador de insumos para el stock.
//
// Hay dos formas de crear variantes:
// 1. Crear variante nueva: Desde el menú de un producto base
// 2. Agrupar existentes: Convierte productos independientes en variantes
//
// VISTAS:
// - Vista agrupada: Muestra productos base con variantes anidadas
// - Vista plana: Muestra todos los productos (incluidas variantes) como lista
//
// ESTADOS PRINCIPALES:
// - productos: Lista de productos (con o sin variantes según vista)
// - categorias: Lista de categorías para el select
// - showModal: Modal de crear/editar producto
// - showVarianteModal: Modal de crear variante
// - showAgruparModal: Modal de agrupar productos como variantes
// - editando: Producto que se está editando (null si es nuevo)
// - productoBase: Producto al que se le agregan variantes
// ============================================================

import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import useAsync from '../../hooks/useAsync'

import {
  PlusIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Square2StackIcon,
  LinkSlashIcon,
  CubeIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import { BACKEND_URL } from '../../config/constants'

export default function Productos() {
  // ----------------------------------------------------------
  // ESTADO: Datos principales
  // ----------------------------------------------------------
  const [productos, setProductos] = useState([]) // Lista de productos
  const [categorias, setCategorias] = useState([]) // Lista de categorías para select

  // ----------------------------------------------------------
  // ESTADO: Modales
  // ----------------------------------------------------------
  const [showModal, setShowModal] = useState(false) // Modal crear/editar producto
  const [showVarianteModal, setShowVarianteModal] = useState(false) // Modal crear variante
  const [showAgruparModal, setShowAgruparModal] = useState(false) // Modal agrupar variantes

  // ----------------------------------------------------------
  // ESTADO: Edición
  // ----------------------------------------------------------
  const [editando, setEditando] = useState(null) // Producto en edición (null = nuevo)
  const [productoBase, setProductoBase] = useState(null) // Producto base para variantes
  const [expandedProducts, setExpandedProducts] = useState({}) // Productos expandidos en vista
  const [vistaAgrupada, setVistaAgrupada] = useState(true) // true = agrupada, false = plana
  const [imagePreview, setImagePreview] = useState(null) // Preview de imagen en form

  // ----------------------------------------------------------
  // FORMULARIOS
  // ----------------------------------------------------------

  // Formulario principal de producto
  const [form, setForm] = useState({
    nombre: '', // Nombre del producto
    descripcion: '', // Descripción opcional
    precio: '', // Precio en moneda local
    categoriaId: '', // ID de la categoría
    disponible: true, // Si está disponible para venta
    destacado: false // Si aparece en destacados
  })

  // Formulario para crear variante
  const [varianteForm, setVarianteForm] = useState({
    nombreVariante: '', // Nombre de la variante (ej: "Grande")
    precio: '', // Precio de esta variante
    multiplicadorInsumos: '1.0', // Factor para multiplicar ingredientes (ej: 1.5 para grande)
    ordenVariante: '0', // Orden de aparición
    esVariantePredeterminada: false, // Si es la opción por defecto
    descripcion: '' // Descripción específica de la variante
  })

  // Formulario para agrupar productos como variantes
  const [agruparForm, setAgruparForm] = useState({
    productoBaseId: '', // ID del producto que será el "padre"
    productosSeleccionados: [] // Productos que se convertirán en variantes
  })

  const cargarDatos = useCallback(async () => {
    const endpoint = vistaAgrupada ? '/productos/con-variantes' : '/productos'
    const [prodRes, catRes] = await Promise.all([
      api.get(endpoint, { skipToast: true }),
      api.get('/categorias', { skipToast: true })
    ])
    setProductos(prodRes.data)
    setCategorias(catRes.data)
    return { productos: prodRes.data, categorias: catRes.data }
  }, [vistaAgrupada])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    if (error.response?.status !== 401) {
      toast.error(error.response?.data?.error?.message || 'Error al cargar datos')
    }
  }, [])

  const cargarDatosRequest = useCallback(async (_ctx) => (
    cargarDatos()
  ), [cargarDatos])

  const { loading, execute: cargarDatosAsync } = useAsync(cargarDatosRequest, { onError: handleLoadError })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const formData = new FormData()
      formData.append('nombre', form.nombre)
      formData.append('descripcion', form.descripcion || '')
      formData.append('precio', parseFloat(form.precio))
      formData.append('categoriaId', form.categoriaId)
      formData.append('disponible', form.disponible)
      formData.append('destacado', form.destacado)

      // Solo agregar imagen si es un archivo nuevo
      if (form.imagen instanceof File) {
        formData.append('imagen', form.imagen)
      }

      if (editando) {
        await api.put(`/productos/${editando.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        toast.success('Producto actualizado')
      } else {
        await api.post('/productos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        toast.success('Producto creado')
      }
      setShowModal(false)
      resetForm()
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleCrearVariante = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/productos/${productoBase.id}/variantes`, {
        ...varianteForm,
        precio: parseFloat(varianteForm.precio),
        multiplicadorInsumos: parseFloat(varianteForm.multiplicadorInsumos),
        ordenVariante: parseInt(varianteForm.ordenVariante)
      })
      toast.success('Variante creada')
      setShowVarianteModal(false)
      resetVarianteForm()
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleAgruparVariantes = async (e) => {
    e.preventDefault()
    try {
      const variantes = agruparForm.productosSeleccionados.map((prod, index) => ({
        productoId: prod.id,
        nombreVariante: prod.nombreVariante || 'Variante ' + (index + 1),
        multiplicadorInsumos: parseFloat(prod.multiplicadorInsumos) || 1.0,
        ordenVariante: index,
        esVariantePredeterminada: index === 0
      }))

      await api.post('/productos/agrupar-variantes', {
        productoBaseId: parseInt(agruparForm.productoBaseId),
        variantes
      })
      toast.success('Productos agrupados como variantes')
      setShowAgruparModal(false)
      resetAgruparForm()
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDesagrupar = async (productoId) => {
    if (!confirm('¿Desagrupar esta variante como producto independiente?')) return
    try {
      await api.delete(`/productos/${productoId}/desagrupar`)
      toast.success('Variante desagrupada')
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleEdit = (producto) => {
    setEditando(producto)
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio,
      categoriaId: producto.categoriaId,
      disponible: producto.disponible,
      destacado: producto.destacado
    })
    // Mostrar preview de imagen existente
    if (producto.imagen) {
      const imageUrl = producto.imagen.startsWith('http')
        ? producto.imagen
        : `${BACKEND_URL}${producto.imagen}`
      setImagePreview(imageUrl)
    } else {
      setImagePreview(null)
    }
    setShowModal(true)
  }

  const handleToggleDisponible = async (producto) => {
    try {
      await api.patch(`/productos/${producto.id}/disponibilidad`, {
        disponible: !producto.disponible
      })
      toast.success(producto.disponible ? 'Producto desactivado' : 'Producto activado')
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const toggleExpanded = (productoId) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productoId]: !prev[productoId]
    }))
  }

  const resetForm = () => {
    setForm({ nombre: '', descripcion: '', precio: '', categoriaId: '', disponible: true, destacado: false })
    setEditando(null)
    setImagePreview(null)
  }

  const resetVarianteForm = () => {
    setVarianteForm({
      nombreVariante: '',
      precio: '',
      multiplicadorInsumos: '1.0',
      ordenVariante: '0',
      esVariantePredeterminada: false,
      descripcion: ''
    })
    setProductoBase(null)
  }

  const resetAgruparForm = () => {
    setAgruparForm({
      productoBaseId: '',
      productosSeleccionados: []
    })
  }

  const openVarianteModal = (producto) => {
    setProductoBase(producto)
    setVarianteForm({
      ...varianteForm,
      precio: producto.precio,
      ordenVariante: (producto.variantes?.length || 0).toString()
    })
    setShowVarianteModal(true)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setForm({ ...form, imagen: file })
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  // Filtrar productos sin variante para agrupar
  const productosDisponiblesParaAgrupar = productos.filter(p =>
    p.productoBaseId === null && p.id !== parseInt(agruparForm.productoBaseId)
  )

  if (loading && productos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-1">Productos</h1>
          <div className="tabs mt-2">
            <button
              onClick={() => setVistaAgrupada(true)}
              className={`tab ${vistaAgrupada ? 'tab-active' : ''}`}
            >
              Vista agrupada
            </button>
            <button
              onClick={() => setVistaAgrupada(false)}
              className={`tab ${!vistaAgrupada ? 'tab-active' : ''}`}
            >
              Vista plana
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAgruparModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Square2StackIcon className="w-5 h-5" />
            Agrupar Variantes
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="btn btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {productos.map((producto) => (
          <div key={producto.id} className={`card card-hover ${!producto.disponible ? 'opacity-60' : ''}`}>
            {/* Producto principal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {producto.variantes && producto.variantes.length > 0 && (
                  <button
                    onClick={() => toggleExpanded(producto.id)}
                    type="button"
                    className="p-1 hover:bg-surface-hover rounded transition-colors"
                    aria-label={`${expandedProducts[producto.id] ? 'Contraer' : 'Expandir'} variantes de ${producto.nombre}`}
                  >
                    {expandedProducts[producto.id]
                      ? <ChevronDownIcon className="w-5 h-5 text-text-tertiary" />
                      : <ChevronRightIcon className="w-5 h-5 text-text-tertiary" />
                    }
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{producto.nombre}</h3>
                    {producto.productoBase && (
                      <span className="badge badge-info">
                        Variante de {producto.productoBase.nombre}
                      </span>
                    )}
                    {producto.variantes && producto.variantes.length > 0 && (
                      <span className="badge badge-info">
                        {producto.variantes.length} variante{producto.variantes.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {producto.destacado && (
                      <span className="badge badge-warning">Destacado</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">{producto.categoria?.nombre}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xl font-bold text-primary-500">
                  ${parseFloat(producto.precio).toLocaleString('es-AR')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleDisponible(producto)}
                    className={`badge cursor-pointer transition-colors ${
                      producto.disponible
                        ? 'badge-success hover:bg-success-200'
                        : 'badge-error hover:bg-error-200'
                    }`}
                  >
                    {producto.disponible ? 'Disponible' : 'No disponible'}
                  </button>
                  {/* Solo mostrar boton de variante si no es una variante */}
                  {!producto.productoBase && (
                    <button
                      onClick={() => openVarianteModal(producto)}
                      type="button"
                      className="p-1.5 text-primary-500 hover:bg-primary-50 rounded transition-colors"
                      title="Crear variante"
                      aria-label={`Crear variante para ${producto.nombre}`}
                    >
                      <CubeIcon className="w-5 h-5" />
                    </button>
                  )}
                  {/* Mostrar boton de desagrupar si es variante */}
                  {producto.productoBase && (
                    <button
                      onClick={() => handleDesagrupar(producto.id)}
                      type="button"
                      className="p-1.5 text-warning-500 hover:bg-warning-50 rounded transition-colors"
                      title="Desagrupar variante"
                      aria-label={`Desagrupar variante ${producto.nombre}`}
                    >
                      <LinkSlashIcon className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(producto)}
                    type="button"
                    className="p-1.5 text-primary-500 hover:bg-primary-50 rounded transition-colors"
                    aria-label={`Editar producto: ${producto.nombre}`}
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Variantes expandidas */}
            {producto.variantes && producto.variantes.length > 0 && expandedProducts[producto.id] && (
              <div className="mt-4 ml-8 border-l-2 border-border-default pl-4 space-y-3">
                {producto.variantes.map((variante) => (
                  <div
                    key={variante.id}
                    className={`flex items-center justify-between p-3 bg-surface-hover rounded-xl ${!variante.disponible ? 'opacity-60' : ''}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{variante.nombreVariante || variante.nombre}</span>
                        {variante.esVariantePredeterminada && (
                          <span className="badge badge-success">
                            Predeterminada
                          </span>
                        )}
                        <span className="text-xs text-text-tertiary">
                          Multiplicador: {variante.multiplicadorInsumos}x
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary-500">
                        ${parseFloat(variante.precio).toLocaleString('es-AR')}
                      </span>
                      <button
                        onClick={() => handleDesagrupar(variante.id)}
                        type="button"
                        className="p-1 text-warning-500 hover:bg-warning-50 rounded transition-colors"
                        title="Desagrupar"
                        aria-label={`Desagrupar variante ${variante.nombreVariante || variante.nombre}`}
                      >
                        <LinkSlashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Crear/Editar Producto */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">
              {editando ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label" htmlFor="producto-nombre">Nombre</label>
                <input
                  id="producto-nombre"
                  type="text"
                  className="input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="producto-descripcion">Descripcion</label>
                <textarea
                  id="producto-descripcion"
                  className="input"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows="3"
                />
              </div>
              <div>
                <label className="label" htmlFor="imagen-input">Imagen</label>
                <input
                  type="file"
                  id="imagen-input"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label
                  htmlFor="imagen-input"
                  className="block cursor-pointer border border-dashed border-border-default rounded-xl p-4 hover:border-primary-400 transition-colors"
                >
                  {imagePreview ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-xl mb-2"
                      />
                      <span className="text-sm text-text-secondary">Click para cambiar imagen</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-text-tertiary">
                      <PhotoIcon className="w-12 h-12 mb-2" />
                      <span className="text-sm">Click para subir imagen</span>
                      <span className="text-xs mt-1">PNG, JPG, WebP (max. 5MB)</span>
                    </div>
                  )}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="producto-precio">Precio ($)</label>
                  <input
                    id="producto-precio"
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="producto-categoria">Categoria</label>
                  <select
                    id="producto-categoria"
                    className="input"
                    value={form.categoriaId}
                    onChange={(e) => {
                      const value = e.target.value
                      setForm({ ...form, categoriaId: value === '' ? '' : parseInt(value) })
                    }}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.disponible}
                    onChange={(e) => setForm({ ...form, disponible: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Disponible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.destacado}
                    onChange={(e) => setForm({ ...form, destacado: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Destacado</span>
                </label>
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

      {/* Modal Crear Variante */}
      {showVarianteModal && productoBase && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-2">Crear Variante</h2>
            <p className="text-sm text-text-secondary mb-4">
              Variante de: <span className="font-medium text-text-primary">{productoBase.nombre}</span>
            </p>
            <form onSubmit={handleCrearVariante} className="space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label" htmlFor="variante-nombre">Nombre de la Variante *</label>
                <input
                  id="variante-nombre"
                  type="text"
                  className="input"
                  value={varianteForm.nombreVariante}
                  onChange={(e) => setVarianteForm({ ...varianteForm, nombreVariante: e.target.value })}
                  placeholder="Ej: Simple, Doble, Triple"
                  required
                />
                <p className="input-hint">
                  Se mostrara como: {productoBase.nombre} {varianteForm.nombreVariante}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="variante-precio">Precio ($) *</label>
                  <input
                    id="variante-precio"
                    type="number"
                    step="0.01"
                    className="input"
                    value={varianteForm.precio}
                    onChange={(e) => setVarianteForm({ ...varianteForm, precio: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="variante-multiplicador">Multiplicador Insumos</label>
                  <input
                    id="variante-multiplicador"
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="input"
                    value={varianteForm.multiplicadorInsumos}
                    onChange={(e) => setVarianteForm({ ...varianteForm, multiplicadorInsumos: e.target.value })}
                  />
                  <p className="input-hint">
                    1.0 = igual, 2.0 = doble insumos
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="variante-orden">Orden</label>
                  <input
                    id="variante-orden"
                    type="number"
                    className="input"
                    value={varianteForm.ordenVariante}
                    onChange={(e) => setVarianteForm({ ...varianteForm, ordenVariante: e.target.value })}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={varianteForm.esVariantePredeterminada}
                      onChange={(e) => setVarianteForm({ ...varianteForm, esVariantePredeterminada: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Predeterminada</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="variante-descripcion">Descripcion (opcional)</label>
                <textarea
                  id="variante-descripcion"
                  className="input"
                  value={varianteForm.descripcion}
                  onChange={(e) => setVarianteForm({ ...varianteForm, descripcion: e.target.value })}
                  rows="2"
                  placeholder="Dejar vacio para usar la del producto base"
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowVarianteModal(false); resetVarianteForm() }} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Crear Variante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agrupar Variantes */}
      {showAgruparModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <h2 className="text-heading-3 mb-4">Agrupar Productos como Variantes</h2>
            <form onSubmit={handleAgruparVariantes} className="space-y-4 overflow-y-auto flex-1">
	              <div>
	                <label className="label" htmlFor="agrupar-producto-base">Producto Base *</label>
	                <select
	                  id="agrupar-producto-base"
	                  className="input"
	                  value={agruparForm.productoBaseId}
	                  onChange={(e) => setAgruparForm({ ...agruparForm, productoBaseId: e.target.value, productosSeleccionados: [] })}
	                  required
                >
                  <option value="">Seleccionar producto base...</option>
                  {productos.filter(p => !p.productoBaseId).map((prod) => (
                    <option key={prod.id} value={prod.id}>{prod.nombre}</option>
                  ))}
                </select>
                <p className="input-hint">
                  Este sera el producto principal que agrupa las variantes
                </p>
              </div>

              {agruparForm.productoBaseId && (
                <div>
                  <label className="label">Seleccionar Variantes</label>
                  <div className="border border-border-default rounded-xl max-h-60 overflow-y-auto">
                    {productosDisponiblesParaAgrupar.map((prod) => {
                      const isSelected = agruparForm.productosSeleccionados.some(p => p.id === prod.id)
                      const selectedProd = agruparForm.productosSeleccionados.find(p => p.id === prod.id)

                      return (
                        <div key={prod.id} className={`p-3 border-b border-border-default last:border-b-0 ${isSelected ? 'bg-primary-50' : ''}`}>
                          <div className="flex items-center gap-3">
	                            <input
	                              type="checkbox"
	                              aria-label={`Seleccionar ${prod.nombre} como variante`}
	                              checked={isSelected}
	                              onChange={(e) => {
	                                if (e.target.checked) {
	                                  setAgruparForm({
                                    ...agruparForm,
                                    productosSeleccionados: [
                                      ...agruparForm.productosSeleccionados,
                                      { id: prod.id, nombre: prod.nombre, nombreVariante: '', multiplicadorInsumos: '1.0' }
                                    ]
                                  })
                                } else {
                                  setAgruparForm({
                                    ...agruparForm,
                                    productosSeleccionados: agruparForm.productosSeleccionados.filter(p => p.id !== prod.id)
                                  })
                                }
                              }}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <span className="font-medium text-text-primary">{prod.nombre}</span>
                              <span className="text-sm text-text-secondary ml-2">
                                ${parseFloat(prod.precio).toLocaleString('es-AR')}
                              </span>
                            </div>
                          </div>

	                          {isSelected && (
	                            <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
	                              <input
	                                type="text"
	                                className="input text-sm"
	                                aria-label={`Nombre de variante para ${prod.nombre}`}
	                                placeholder="Nombre variante (ej: Doble)"
	                                value={selectedProd?.nombreVariante || ''}
	                                onChange={(e) => {
	                                  setAgruparForm({
                                    ...agruparForm,
                                    productosSeleccionados: agruparForm.productosSeleccionados.map(p =>
                                      p.id === prod.id ? { ...p, nombreVariante: e.target.value } : p
                                    )
                                  })
                                }}
                              />
	                              <input
	                                type="number"
	                                step="0.1"
	                                className="input text-sm"
	                                aria-label={`Multiplicador de insumos para ${prod.nombre}`}
	                                placeholder="Multiplicador"
	                                value={selectedProd?.multiplicadorInsumos || '1.0'}
	                                onChange={(e) => {
	                                  setAgruparForm({
                                    ...agruparForm,
                                    productosSeleccionados: agruparForm.productosSeleccionados.map(p =>
                                      p.id === prod.id ? { ...p, multiplicadorInsumos: e.target.value } : p
                                    )
                                  })
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowAgruparModal(false); resetAgruparForm() }} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={!agruparForm.productoBaseId || agruparForm.productosSeleccionados.length === 0}
                >
                  Agrupar Variantes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

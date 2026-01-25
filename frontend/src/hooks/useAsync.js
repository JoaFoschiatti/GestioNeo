import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook para manejar operaciones asíncronas con estado.
 *
 * Proporciona un patrón consistente para:
 * - Ejecutar funciones async con manejo automático de loading/error
 * - Cancelar requests pendientes con AbortController
 * - Ejecutar callbacks en éxito/error
 * - Evitar actualizaciones de estado en componentes desmontados
 *
 * @param {Function} asyncFn - Función asíncrona a ejecutar.
 *   Recibe como primer argumento un objeto `{ signal }` para AbortController.
 *   Los argumentos adicionales de `execute()` se pasan después.
 * @param {Object} [options] - Opciones de configuración
 * @param {boolean} [options.immediate=true] - Si true, ejecuta al montar el componente
 * @param {Function} [options.onSuccess] - Callback cuando la operación es exitosa
 * @param {Function} [options.onError] - Callback cuando hay error
 *
 * @returns {Object} Estado y funciones del hook
 * @returns {any} returns.data - Datos retornados por asyncFn (null inicial)
 * @returns {boolean} returns.loading - True mientras se ejecuta la operación
 * @returns {Error|null} returns.error - Error si la operación falló
 * @returns {Function} returns.execute - Función para ejecutar/re-ejecutar manualmente
 * @returns {Function} returns.setData - Setter para actualizar data manualmente
 *
 * @example
 * // Cargar datos al montar el componente
 * const { data: productos, loading, error } = useAsync(
 *   async ({ signal }) => {
 *     const response = await api.get('/productos', { signal });
 *     return response.data;
 *   }
 * );
 *
 * if (loading) return <Spinner />;
 * if (error) return <p>Error: {error.message}</p>;
 * return <Lista items={productos} />;
 *
 * @example
 * // Ejecutar manualmente (ej: submit de formulario)
 * const { execute: guardar, loading } = useAsync(
 *   async ({ signal }, datos) => {
 *     const response = await api.post('/productos', datos, { signal });
 *     return response.data;
 *   },
 *   {
 *     immediate: false, // No ejecutar al montar
 *     onSuccess: (data) => {
 *       toast.success('Guardado!');
 *       navigate(`/productos/${data.id}`);
 *     },
 *     onError: (err) => {
 *       console.error('Error guardando:', err);
 *     }
 *   }
 * );
 *
 * const handleSubmit = (formData) => guardar(formData);
 *
 * @example
 * // Re-ejecutar después de una acción
 * const { data, execute: recargar } = useAsync(fetchProductos);
 *
 * const handleDelete = async (id) => {
 *   await api.delete(`/productos/${id}`);
 *   recargar(); // Recarga la lista
 * };
 *
 * @example
 * // Con AbortController (se cancela automáticamente al desmontar)
 * const { data } = useAsync(async ({ signal }) => {
 *   // Si el componente se desmonta antes de completar,
 *   // la request se cancela y no hay error de memoria
 *   const response = await fetch('/api/data', { signal });
 *   return response.json();
 * });
 */
export default function useAsync(asyncFn, options = {}) {
  const { immediate = true, onSuccess, onError } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const execute = useCallback(async (...args) => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn({ signal: controller.signal }, ...args)
      if (!controller.signal.aborted) {
        setData(result)
        setLoading(false)
        onSuccessRef.current?.(result)
      }
      return result
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err)
        setLoading(false)
        onErrorRef.current?.(err)
      }
      return null
    }
  }, [asyncFn])

  useEffect(() => {
    if (immediate) {
      execute()
    }
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [execute, immediate])

  return { data, loading, error, execute, setData }
}

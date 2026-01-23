import { useCallback, useEffect, useRef, useState } from 'react'

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

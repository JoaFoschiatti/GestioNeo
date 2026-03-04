import { useEffect, useState } from 'react'

export default function useDebouncedValue(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    if (delayMs === 0) {
      setDebouncedValue(value)
      return undefined
    }
    const id = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debouncedValue
}

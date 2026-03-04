import { useState, useRef, useCallback } from 'react'

const GRID = 16
const snap = (val) => Math.round(val / GRID) * GRID

function constrainToAxis(start, end) {
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  if (dx > dy) {
    return { x: end.x, y: start.y }
  }
  return { x: start.x, y: end.y }
}

export default function ParedSVG({
  paredes = [],
  modo = 'mesas',
  onAgregarPared,
  onEliminarPared,
  disabled = false
}) {
  const [puntoInicio, setPuntoInicio] = useState(null)
  const [puntoActual, setPuntoActual] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  const svgRef = useRef(null)

  const getCoords = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: snap(e.clientX - rect.left),
      y: snap(e.clientY - rect.top)
    }
  }, [])

  const handleClick = (e) => {
    if (modo !== 'paredes' || disabled) return

    const point = getCoords(e)

    if (!puntoInicio) {
      setPuntoInicio(point)
    } else {
      let endPoint = point
      if (shiftHeld) {
        endPoint = constrainToAxis(puntoInicio, point)
      }

      // Ignore zero-length walls
      if (puntoInicio.x === endPoint.x && puntoInicio.y === endPoint.y) return

      onAgregarPared({
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        x1: puntoInicio.x,
        y1: puntoInicio.y,
        x2: endPoint.x,
        y2: endPoint.y,
        grosor: 8
      })
      setPuntoInicio(null)
      setPuntoActual(null)
    }
  }

  const handleMouseMove = (e) => {
    if (!puntoInicio || modo !== 'paredes') return
    const point = getCoords(e)
    setPuntoActual(shiftHeld ? constrainToAxis(puntoInicio, point) : point)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    setPuntoInicio(null)
    setPuntoActual(null)
  }

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Shift') setShiftHeld(true)
    if (e.key === 'Escape') {
      setPuntoInicio(null)
      setPuntoActual(null)
    }
  }, [])

  const handleKeyUp = useCallback((e) => {
    if (e.key === 'Shift') setShiftHeld(false)
  }, [])

  const isActive = modo === 'paredes'

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: isActive ? 'all' : 'none',
        zIndex: isActive ? 10 : 1,
        cursor: isActive ? 'crosshair' : 'default'
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      tabIndex={isActive ? 0 : -1}
    >
      {/* Existing walls */}
      {paredes.map(p => (
        <g key={p.id}>
          <line
            x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
            stroke="#475569"
            strokeWidth={p.grosor || 8}
            strokeLinecap="round"
          />
          {/* Wider invisible hit area for hover detection */}
          {isActive && !disabled && (
            <line
              x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
              stroke="transparent"
              strokeWidth={Math.max((p.grosor || 8) + 12, 20)}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          )}
          {/* Delete button at midpoint */}
          {hoveredId === p.id && isActive && !disabled && (
            <g
              onClick={(e) => {
                e.stopPropagation()
                onEliminarPared(p.id)
                setHoveredId(null)
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={(p.x1 + p.x2) / 2}
                cy={(p.y1 + p.y2) / 2}
                r={10}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={(p.x1 + p.x2) / 2}
                y={(p.y1 + p.y2) / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={14}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                ×
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Preview line while drawing */}
      {puntoInicio && puntoActual && (
        <line
          x1={puntoInicio.x} y1={puntoInicio.y}
          x2={puntoActual.x} y2={puntoActual.y}
          stroke="#3b82f6"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray="8 4"
          opacity={0.7}
        />
      )}

      {/* Start point indicator */}
      {puntoInicio && (
        <circle
          cx={puntoInicio.x} cy={puntoInicio.y}
          r={5}
          fill="#3b82f6"
          stroke="white"
          strokeWidth={2}
        />
      )}
    </svg>
  )
}

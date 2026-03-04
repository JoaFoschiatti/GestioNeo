import { getCategoryEmoji } from './utils'

export default function CategoryNav({ categorias, categoriaActiva, setCategoriaActiva }) {
  return (
    <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
          <button
            onClick={() => setCategoriaActiva('all')}
            className={`category-pill ${categoriaActiva === 'all' ? 'category-pill-active' : 'category-pill-inactive'}`}
          >
            <span className="text-lg">🍽️</span>
            <span>Todos</span>
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`category-pill ${categoriaActiva === cat.id ? 'category-pill-active' : 'category-pill-inactive'}`}
            >
              <span className="text-lg">{getCategoryEmoji(cat.nombre)}</span>
              <span>{cat.nombre}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

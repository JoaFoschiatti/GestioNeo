export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-primary-600">GestioNeo</h1>
        </div>
      </header>

      {/* Contenido */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          GestioNeo - Sistema de Gestión
        </div>
      </footer>
    </div>
  )
}

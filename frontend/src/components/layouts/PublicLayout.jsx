export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="bg-surface border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Comanda</h1>
        </div>
      </header>

      {/* Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border-subtle mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-text-tertiary text-sm">
          Comanda - Sistema de Gestion
        </div>
      </footer>
    </div>
  )
}

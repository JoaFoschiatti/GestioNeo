export default function PublicLayout({ children }) {
  return (
    <div className="public-shell">
      <header className="public-shell__header">
        <div className="public-shell__header-inner">
          <div className="public-shell__brand">
            <img src="/comanda-logo.png" alt="Comanda" className="public-shell__brand-mark" />
            <div>
              <p className="public-shell__brand-label">Pedido online</p>
              <h1 className="public-shell__brand-title">Comanda</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="public-shell__footer">
        <div className="public-shell__footer-inner">
          <span>Comanda - carta digital y pedidos del local</span>
        </div>
      </footer>
    </div>
  )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { OfflineProvider } from './context/OfflineContext'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // New content available — could prompt user to reload
      if (confirm('Hay una nueva versión disponible. ¿Actualizar?')) {
        window.location.reload()
      }
    },
    onOfflineReady() {
      console.info('App lista para uso offline')
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OfflineProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </OfflineProvider>
  </React.StrictMode>,
)

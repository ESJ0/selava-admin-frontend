import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { CatalogPage } from './pages/CatalogPage'
import { NewOrderPage } from './pages/NewOrderPage'
import { useAuth } from './store/auth'
import './App.css'

function ProtectedApp() {
  const token = useAuth((state) => state.token)
  if (!token) return <Navigate to="/login" replace />
  return <Layout><Routes>
    <Route path="/servicios" element={<CatalogPage kind="servicios" />} />
    <Route path="/tipos-prenda" element={<CatalogPage kind="tipos-prenda" />} />
    <Route path="/metodos-pago" element={<CatalogPage kind="metodos-pago" />} />
    <Route path="/pedidos/nuevo" element={<NewOrderPage />} />
    <Route path="*" element={<Navigate to="/servicios" replace />} />
  </Routes></Layout>
}

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<ProtectedApp />} /></Routes>
}

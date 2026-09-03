import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CatalogPage } from './pages/CatalogPage'
import { LoginPage } from './pages/LoginPage'
import { NewOrderPage } from './pages/NewOrderPage'
import { useAuth } from './store/auth'
import './App.css'

function AdminApp() {
  return <Layout><Routes>
    <Route path="/servicios" element={<CatalogPage kind="servicios" />} />
    <Route path="/tipos-prenda" element={<CatalogPage kind="tipos-prenda" />} />
    <Route path="/metodos-pago" element={<CatalogPage kind="metodos-pago" />} />
    <Route path="/pedidos/nuevo" element={<NewOrderPage />} />
    <Route path="*" element={<Navigate to="/servicios" replace />} />
  </Routes></Layout>
}

function ProtectedApp() {
  const token = useAuth((state) => state.token)
  if (!token) return <Navigate to="/login" replace />
  return <AdminApp />
}

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<ProtectedApp />} /></Routes>
}

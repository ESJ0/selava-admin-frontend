import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CatalogPage } from './pages/CatalogPage'
import { LoginPage } from './pages/LoginPage'
import { NewOrderPage } from './pages/NewOrderPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrderLookupPage } from './pages/OrderLookupPage'
import { useAuth } from './store/auth'
import './App.css'

function AdminApp() {
  const token = useAuth(state => state.token)
  const roleId = useAuth(state => state.roleId)
  if (!token) return <Navigate to="/login" replace />
  return <Layout><Routes>
    <Route path="/servicios" element={<CatalogPage kind="servicios" />} />
    <Route path="/tipos-prenda" element={<CatalogPage kind="tipos-prenda" />} />
    <Route path="/metodos-pago" element={<CatalogPage kind="metodos-pago" />} />
    <Route path="/pedidos/nuevo" element={<NewOrderPage />} />
    <Route path="/pedidos" element={<OrderLookupPage />} />
    <Route path="/pedidos/:pedidoId" element={<OrderDetailPage />} />
    <Route path="/operario/pedidos/:pedidoId" element={<OrderDetailPage operatorMode />} />
    <Route path="*" element={<Navigate to={roleId === 3 ? '/pedidos' : '/servicios'} replace />} />
  </Routes></Layout>
}

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<AdminApp />} /></Routes>
}

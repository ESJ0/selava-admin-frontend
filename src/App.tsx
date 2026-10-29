import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CatalogPage } from './pages/CatalogPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { LoginPage } from './pages/LoginPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { InventoryPage } from './pages/InventoryPage'
import { NewOrderPage } from './pages/NewOrderPage'
import { PromotionsPage } from './pages/PromotionsPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrderLookupPage } from './pages/OrderLookupPage'
import { OrdersByStatusReportPage } from './pages/OrdersByStatusReportPage'
import { SalesReportPage } from './pages/SalesReportPage'
import { SupplyConsumptionReportPage } from './pages/SupplyConsumptionReportPage'
import { UsersPage } from './pages/UsersPage'
import { useAuth } from './store/auth'
import './App.css'

function AdminApp() {
  const token = useAuth(state => state.token)
  const roleId = useAuth(state => state.roleId)
  if (!token) return <Navigate to="/login" replace />
  const allowed = (roles: number[], element: React.ReactNode) => roles.includes(roleId ?? 0) ? element : <Navigate to="/pedidos" replace />
  return <Layout><Routes>
    <Route path="/servicios" element={allowed([1, 2], <CatalogPage kind="servicios" />)} />
    <Route path="/clientes" element={allowed([1, 2], <ClientsPage />)} />
    <Route path="/clientes/:clientId" element={allowed([1, 2], <ClientDetailPage />)} />
    <Route path="/tipos-prenda" element={allowed([1, 2], <CatalogPage kind="tipos-prenda" />)} />
    <Route path="/promociones" element={allowed([1, 2], <PromotionsPage />)} />
    <Route path="/metodos-pago" element={allowed([1], <CatalogPage kind="metodos-pago" />)} />
    <Route path="/insumos" element={allowed([1, 2], <InventoryPage />)} />
    <Route path="/usuarios" element={allowed([1], <UsersPage />)} />
    <Route path="/pedidos/nuevo" element={allowed([1, 2], <NewOrderPage />)} />
    <Route path="/pedidos" element={<OrderLookupPage />} />
    <Route path="/pedidos/:pedidoId" element={<OrderDetailPage />} />
    <Route path="/reportes/ventas" element={allowed([1], <SalesReportPage />)} />
    <Route path="/reportes/pedidos-por-estado" element={allowed([1], <OrdersByStatusReportPage />)} />
    <Route path="/reportes/consumo-insumos" element={allowed([1], <SupplyConsumptionReportPage />)} />
    <Route path="/operario/pedidos/:pedidoId" element={allowed([3], <OrderDetailPage operatorMode />)} />
    <Route path="*" element={<Navigate to="/pedidos" replace />} />
  </Routes></Layout>
}

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/*" element={<AdminApp />} /></Routes>
}

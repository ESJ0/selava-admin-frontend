import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CatalogPage } from './pages/CatalogPage'
import { NewOrderPage } from './pages/NewOrderPage'
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

export default function App() {
  return <Routes><Route path="/login" element={<Navigate to="/servicios" replace />} /><Route path="/*" element={<AdminApp />} /></Routes>
}

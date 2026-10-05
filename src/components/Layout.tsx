import { Bell, Boxes, ChartColumnBig, ChartPie, ChevronDown, ClipboardList, CreditCard, LogOut, Menu, PackageSearch, PackagePlus, Search, Shirt, Sparkles, Users, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

const catalogLinks = [
  { to: '/tipos-prenda', label: 'Tipos de prenda', icon: Shirt },
  { to: '/servicios', label: 'Tipos de servicio', icon: Sparkles },
  { to: '/insumos', label: 'Insumos', icon: Boxes },
  { to: '/metodos-pago', label: 'Métodos de pago', icon: CreditCard },
]
const reportLinks = [
  { to: '/reportes/ventas', label: 'Reporte de ventas', icon: ChartColumnBig },
  { to: '/reportes/pedidos-por-estado', label: 'Pedidos por estado', icon: ChartPie },
  { to: '/reportes/consumo-insumos', label: 'Consumo de insumos', icon: PackageSearch },
]
export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(location.pathname.startsWith('/pedidos'))
  const logout = useAuth((state) => state.logout); const roleId = useAuth((state) => state.roleId)
  const roleName = roleId === 3 ? 'Operario' : roleId === 2 ? 'Recepcionista' : 'Administrador'
  return <div className="app-shell">
    <header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="main-sidebar">{open ? <X /> : <Menu />}</button>
      <div className="brand"><span className="brand-mark">✦</span><span>SELAVA</span></div>
      <div className="profile"><Bell size={20}/><span className="avatar">{roleName.slice(0, 2).toUpperCase()}</span><span><b>{roleName}</b><small>SELAVA</small></span></div></header>
    <aside id="main-sidebar" className={`sidebar ${open ? 'open' : ''}`}><nav aria-label="Menú principal">
      <section className="nav-section" aria-labelledby="operation-nav-title">
        <h2 id="operation-nav-title">Operación</h2>
        {roleId === 3 ? <NavLink to="/pedidos" onClick={() => setOpen(false)}><ClipboardList size={20}/>Pedidos</NavLink> : <>
          <section className="nav-group" aria-label="Pedidos">
            <button className={`nav-group-toggle ${location.pathname.startsWith('/pedidos') ? 'active' : ''}`} type="button" aria-expanded={ordersOpen} aria-controls="orders-submenu" onClick={() => setOrdersOpen((current) => !current)}><ClipboardList size={20}/><span>Pedidos</span><ChevronDown className={ordersOpen ? 'rotated' : ''} size={18}/></button>
            {ordersOpen && <div id="orders-submenu" className="nav-submenu">
              <NavLink to="/pedidos/nuevo" onClick={() => setOpen(false)}><PackagePlus size={18}/>Nuevo pedido</NavLink>
              <NavLink to="/pedidos" end onClick={() => setOpen(false)}><Search size={18}/>Consultar pedidos</NavLink>
            </div>}
          </section>
          <NavLink to="/clientes" onClick={() => setOpen(false)}><Users size={20}/>Clientes</NavLink>
        </>}
      </section>
      {roleId !== 3 && <section className="nav-section" aria-labelledby="catalog-nav-title">
        <h2 id="catalog-nav-title">Catálogos</h2>
        {catalogLinks.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={20}/>{label}</NavLink>)}
      </section>}
      {roleId === 1 && <section className="nav-section" aria-labelledby="reports-nav-title">
        <h2 id="reports-nav-title">Reportes</h2>
        {reportLinks.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={20}/>{label}</NavLink>)}
      </section>}
    </nav>
      <button className="logout" onClick={logout}><LogOut size={20}/> Cerrar sesión</button></aside>
    <main className="content">{children}</main>
  </div>
}

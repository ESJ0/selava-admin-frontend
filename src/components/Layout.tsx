import { Bell, ChevronDown, ClipboardList, CreditCard, LogOut, Menu, PackagePlus, Search, Shirt, Sparkles, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

const adminLinks = [
  { to: '/tipos-prenda', label: 'Tipos de prenda', icon: Shirt },
  { to: '/servicios', label: 'Tipos de servicio', icon: Sparkles },
  { to: '/metodos-pago', label: 'Métodos de pago', icon: CreditCard },
]
export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(location.pathname.startsWith('/pedidos'))
  const logout = useAuth((state) => state.logout); const roleId = useAuth((state) => state.roleId)
  const links = roleId === 3 ? [{ to: '/pedidos', label: 'Pedidos', icon: ClipboardList }] : adminLinks
  const roleName = roleId === 3 ? 'Operario' : roleId === 2 ? 'Recepcionista' : 'Administrador'
  return <div className="app-shell">
    <header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Abrir menú">{open ? <X /> : <Menu />}</button>
      <div className="brand"><span className="brand-mark">✦</span><span>SELAVA</span></div>
      <div className="profile"><Bell size={20}/><span className="avatar">{roleName.slice(0, 2).toUpperCase()}</span><span><b>{roleName}</b><small>SELAVA</small></span></div></header>
    <aside className={`sidebar ${open ? 'open' : ''}`}><nav>{links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={20}/>{label}</NavLink>)}
      {roleId !== 3 && <section className="nav-group" aria-label="Pedidos">
        <button className={`nav-group-toggle ${location.pathname.startsWith('/pedidos') ? 'active' : ''}`} type="button" aria-expanded={ordersOpen} aria-controls="orders-submenu" onClick={() => setOrdersOpen((current) => !current)}><ClipboardList size={20}/><span>Pedidos</span><ChevronDown className={ordersOpen ? 'rotated' : ''} size={18}/></button>
        {ordersOpen && <div id="orders-submenu" className="nav-submenu">
          <NavLink to="/pedidos" end onClick={() => setOpen(false)}><Search size={18}/>Consultar pedidos</NavLink>
          <NavLink to="/pedidos/nuevo" onClick={() => setOpen(false)}><PackagePlus size={18}/>Nuevo pedido</NavLink>
        </div>}
      </section>}
    </nav>
      <button className="logout" onClick={logout}><LogOut size={20}/> Cerrar sesión</button></aside>
    <main className="content">{children}</main>
  </div>
}

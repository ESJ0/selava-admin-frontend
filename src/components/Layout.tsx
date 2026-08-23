import { Bell, CreditCard, LogOut, Menu, PackagePlus, Shirt, Sparkles, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../store/auth'

const links = [
  { to: '/servicios', label: 'Servicios', icon: Sparkles },
  { to: '/tipos-prenda', label: 'Tipos de prenda', icon: Shirt },
  { to: '/metodos-pago', label: 'Métodos de pago', icon: CreditCard },
  { to: '/pedidos/nuevo', label: 'Nuevo pedido', icon: PackagePlus },
]
export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false); const logout = useAuth((state) => state.logout)
  return <div className="app-shell">
    <header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Abrir menú">{open ? <X /> : <Menu />}</button>
      <div className="brand"><span className="brand-mark">✦</span><span>SELAVA</span></div>
      <div className="profile"><Bell size={20}/><span className="avatar">AP</span><span><b>Andrea Paz</b><small>Administrador</small></span></div></header>
    <aside className={`sidebar ${open ? 'open' : ''}`}><nav>{links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={20}/>{label}</NavLink>)}</nav>
      <button className="logout" onClick={logout}><LogOut size={20}/> Cerrar sesión</button></aside>
    <main className="content">{children}</main>
  </div>
}

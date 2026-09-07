import { Bell, ClipboardList, CreditCard, LogOut, Menu, PackagePlus, Shirt, Sparkles, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../store/auth'

const adminLinks = [
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/servicios', label: 'Servicios', icon: Sparkles },
  { to: '/tipos-prenda', label: 'Tipos de prenda', icon: Shirt },
  { to: '/metodos-pago', label: 'Métodos de pago', icon: CreditCard },
  { to: '/pedidos/nuevo', label: 'Nuevo pedido', icon: PackagePlus },
]
export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false); const logout = useAuth((state) => state.logout); const roleId = useAuth((state) => state.roleId)
  const links = roleId === 3 ? [{ to: '/pedidos', label: 'Pedidos', icon: ClipboardList }] : adminLinks
  const roleName = roleId === 3 ? 'Operario' : roleId === 2 ? 'Recepcionista' : 'Administrador'
  return <div className="app-shell">
    <header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Abrir menú">{open ? <X /> : <Menu />}</button>
      <div className="brand"><span className="brand-mark">✦</span><span>SELAVA</span></div>
      <div className="profile"><Bell size={20}/><span className="avatar">{roleName.slice(0, 2).toUpperCase()}</span><span><b>{roleName}</b><small>SELAVA</small></span></div></header>
    <aside className={`sidebar ${open ? 'open' : ''}`}><nav>{links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={20}/>{label}</NavLink>)}</nav>
      <button className="logout" onClick={logout}><LogOut size={20}/> Cerrar sesión</button></aside>
    <main className="content">{children}</main>
  </div>
}

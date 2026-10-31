import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import { useAuth } from '../store/auth'
import { calendarDay, isActiveOrder, roleLabel, startOfDay, todayText } from '../utils/adminFormat'
import {
  BarsIcon, BellIcon, CalendarIcon, CardIcon, CheckIcon, ChevronDownIcon, ClipboardIcon, ClockIcon, DashboardIcon, DropIcon, FlaskIcon,
  LogoutIcon, MenuIcon, PieIcon, PlusIcon, SearchIcon, ShirtIcon, TagIcon, UserCogIcon, UsersIcon, WavesIcon,
} from './admin/icons'

const catalogLinks = [
  { to: '/tipos-prenda', label: 'Tipos de prenda', Icon: ShirtIcon },
  { to: '/promociones', label: 'Promociones', Icon: TagIcon },
  { to: '/servicios', label: 'Tipos de servicio', Icon: WavesIcon },
  { to: '/insumos', label: 'Insumos', Icon: FlaskIcon },
  { to: '/metodos-pago', label: 'Métodos de pago', Icon: CardIcon },
]
const reportLinks = [
  { to: '/reportes/ventas', label: 'Reporte de ventas', Icon: BarsIcon },
  { to: '/reportes/pedidos-por-estado', label: 'Pedidos por estado', Icon: PieIcon },
  { to: '/reportes/consumo-insumos', label: 'Consumo de insumos', Icon: DropIcon },
]

const linkClass = ({ isActive }: { isActive: boolean }) => `ad-si${isActive ? ' on' : ''}`

function OrderAlerts() {
  const orders = useOrdersOverview((state) => state.orders)
  const load = useOrdersOverview((state) => state.load)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 120_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const { overdue, noDate } = useMemo(() => {
    const today = startOfDay()
    const active = orders.filter(isActiveOrder)
    return {
      overdue: active.filter((order) => { const due = calendarDay(order.fecha_entrega_estimada); return due !== null && due < today }).length,
      noDate: active.filter((order) => !order.fecha_entrega_estimada).length,
    }
  }, [orders])
  const count = (overdue ? 1 : 0) + (noDate ? 1 : 0)

  return <div ref={box} style={{ position: 'relative' }}>
    <button className="ad-ib" type="button" aria-label={count ? `Alertas: ${count}` : 'Alertas'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <BellIcon className="ad-bell" size={22} />
      {count > 0 && <span className="ad-badge" aria-hidden="true"><i /><b>{count}</b></span>}
    </button>
    {open && <div className="ad-drop" role="dialog" aria-label="Alertas">
      <p>Necesitan atención</p>
      {count === 0 && <div className="ad-alert ok"><span className="ad-ai"><CheckIcon size={20} /></span><span style={{ fontSize: 14 }}>Todo al día: no hay pedidos vencidos ni sin fecha.</span></div>}
      {overdue > 0 && <Link className="ad-alert late" to="/pedidos" onClick={() => setOpen(false)}><span className="ad-ai"><ClockIcon size={20} /></span><span style={{ fontSize: 14 }}><strong>{overdue} {overdue === 1 ? 'pedido' : 'pedidos'}</strong> con entrega vencida</span></Link>}
      {noDate > 0 && <Link className="ad-alert nodate" to="/pedidos" style={{ marginTop: 6 }} onClick={() => setOpen(false)}><span className="ad-ai"><CalendarIcon size={20} /></span><span style={{ fontSize: 14 }}><strong>{noDate} {noDate === 1 ? 'pedido' : 'pedidos'}</strong> sin fecha de entrega</span></Link>}
    </div>}
  </div>
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(true)
  const logout = useAuth((state) => state.logout)
  const roleId = useAuth((state) => state.roleId)
  const roleName = roleLabel(roleId)
  const close = () => setOpen(false)
  const inOrders = location.pathname.startsWith('/pedidos') || location.pathname.startsWith('/operario')

  return <div className="ad-shell">
    <aside id="main-sidebar" className={`ad-side${open ? ' open' : ''}`} aria-label="Menú de administración">
      <Link className="ad-logo" to={roleId === 3 ? '/pedidos' : '/inicio'} onClick={close} aria-label="SeLava, ir al inicio">
        <span className="ad-logo-mark" aria-hidden="true" />
        <span className="ad-disp ad-logo-name">Se<span>Lava</span></span>
        <span className="ad-logo-tag">{roleId === 3 ? 'OPERARIO' : 'ADMIN'}</span>
      </Link>
      <nav aria-label="Menú principal">
        {roleId !== 3 && <NavLink className={linkClass} to="/inicio" onClick={close}><DashboardIcon />Inicio</NavLink>}
        <section aria-labelledby="operation-nav-title">
          <h2 className="ad-sec" id="operation-nav-title">Operación</h2>
          {roleId === 3 ? <NavLink className={linkClass} to="/pedidos" onClick={close}><ClipboardIcon />Pedidos</NavLink> : <>
            <section aria-label="Pedidos">
              <button className={`ad-si${inOrders && !ordersOpen ? ' on' : ''}`} type="button" aria-expanded={ordersOpen} aria-controls="orders-submenu" onClick={() => setOrdersOpen((value) => !value)}>
                <ClipboardIcon /><span>Pedidos</span><ChevronDownIcon className="ad-chev" size={16} style={{ transform: `rotate(${ordersOpen ? 180 : 0}deg)` }} />
              </button>
              {ordersOpen && <div id="orders-submenu" className="ad-sub">
                <NavLink className={linkClass} to="/pedidos/nuevo" onClick={close}><PlusIcon size={18} />Nuevo pedido</NavLink>
                <NavLink className={({ isActive }) => linkClass({ isActive: isActive || /^\/pedidos\/\d+/.test(location.pathname) })} to="/pedidos" end onClick={close}><SearchIcon size={18} />Consultar pedidos</NavLink>
              </div>}
            </section>
            <NavLink className={linkClass} to="/clientes" onClick={close}><UsersIcon />Clientes</NavLink>
          </>}
        </section>
        {roleId !== 3 && <section aria-labelledby="catalog-nav-title">
          <h2 className="ad-sec" id="catalog-nav-title">Catálogos</h2>
          {catalogLinks.filter((link) => roleId === 1 || link.to !== '/metodos-pago').map(({ to, label, Icon }) => <NavLink key={to} className={linkClass} to={to} onClick={close}><Icon />{label}</NavLink>)}
        </section>}
        {roleId === 1 && <section aria-labelledby="admin-nav-title"><h2 className="ad-sec" id="admin-nav-title">Administración</h2><NavLink className={linkClass} to="/usuarios" onClick={close}><UserCogIcon />Usuarios</NavLink></section>}
        {roleId === 1 && <section aria-labelledby="reports-nav-title">
          <h2 className="ad-sec" id="reports-nav-title">Reportes</h2>
          {reportLinks.map(({ to, label, Icon }) => <NavLink key={to} className={linkClass} to={to} onClick={close}><Icon />{label}</NavLink>)}
        </section>}
      </nav>
      <button className="ad-si ad-logout" type="button" onClick={logout}><LogoutIcon />Cerrar sesión</button>
    </aside>
    <div className={`ad-backdrop${open ? ' open' : ''}`} onClick={close} aria-hidden="true" />

    <div className="ad-body">
      <header className="ad-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ad-ib ad-menu-btn" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="main-sidebar"><MenuIcon /></button>
          <div>
            <p className="ad-top-date">{todayText()}</p>
            <p className="ad-disp ad-top-title">{roleId === 3 ? 'Panel de operación' : 'Panel de administración'}</p>
          </div>
        </div>
        <div className="ad-top-right">
          <OrderAlerts />
          <div className="ad-user"><span>{roleName.slice(0, 2).toUpperCase()}</span><span><b>{roleName}</b><small>SELAVA</small></span></div>
        </div>
      </header>
      <main className="ad-main">{children}</main>
    </div>
  </div>
}

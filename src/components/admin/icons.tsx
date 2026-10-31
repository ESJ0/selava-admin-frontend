import type { ReactNode, SVGProps } from 'react'

type IconProps = { size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>

function Svg({ paths, size = 20, strokeWidth = 1.9, ...props }: IconProps & { paths: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths}</svg>
}

/** Ícono a partir de un trazado SVG suelto (24×24). */
export function PathIcon({ d, size = 20, strokeWidth = 1.9 }: { d: string; size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

export function DashboardIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>} /> }
export function ClipboardIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>} /> }
export function ChevronDownIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<path d="M6 9l6 6 6-6" />} /> }
export function ChevronLeftIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<path d="M15 6l-6 6 6 6" />} /> }
export function ChevronRightIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<path d="M9 6l6 6-6 6" />} /> }
export function PlusIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<path d="M12 5v14M5 12h14" />} /> }
export function SearchIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>} /> }
export function UsersIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5" /></>} /> }
export function ShirtIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" />} /> }
export function TagIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>} /> }
export function WavesIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />} /> }
export function FlaskIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><path d="M9 3h6v4l3 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10l3-3z" /><path d="M6 14h12" /></>} /> }
export function CardIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>} /> }
export function UserCogIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><circle cx="10" cy="8" r="4" /><path d="M3 21c1.2-4 4-6 7-6 1.4 0 2.7.4 3.8 1.1" /><circle cx="18" cy="17" r="2.5" /><path d="M18 13v1.5M18 19.5V21M14 17h1.5M20.5 17H22" /></>} /> }
export function BarsIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />} /> }
export function PieIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>} /> }
export function DropIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />} /> }
export function LogoutIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>} /> }
export function BellIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></>} /> }
export function ClockIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} /> }
export function CalendarIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>} /> }
export function ArrowRightIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<path d="M5 12h14M13 6l6 6-6 6" />} /> }
export function ArrowLeftIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<path d="M19 12H5M11 6l-6 6 6 6" />} /> }
export function EyeIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><path d="M2.5 12C3.5 10.5 7 6 12 6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6s-8.5-4.5-9.5-6z" /><circle cx="12" cy="12" r="3" /></>} /> }
export function CloseIcon(props: IconProps) { return <Svg strokeWidth={2.4} {...props} paths={<path d="M6 6l12 12M18 6L6 18" />} /> }
export function CheckIcon(props: IconProps) { return <Svg strokeWidth={2.6} {...props} paths={<path d="M5 12.5l4.5 4.5L19 7.5" />} /> }
export function CopyIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>} /> }
export function ListIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />} /> }
export function GridIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>} /> }
export function InfoIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></>} /> }
export function AlertIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>} /> }
export function RefreshIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />} /> }
export function FilterIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<path d="M4 6h16M7 12h10M10 18h4" />} /> }
export function SpinnerIcon(props: IconProps) { return <Svg strokeWidth={2.6} {...props} paths={<path d="M12 3a9 9 0 0 1 9 9" />} /> }
export function PhoneIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />} /> }
export function MailIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>} /> }
export function UserIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>} /> }
export function NoteIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<path d="M4 4h16v12H8l-4 4z" />} /> }
export function XCircleIcon(props: IconProps) { return <Svg strokeWidth={2.2} {...props} paths={<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>} /> }
export function EditIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>} /> }
export function PowerIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<><path d="M12 3v9" /><path d="M6.3 6.3a8 8 0 1 0 11.4 0" /></>} /> }
export function MenuIcon(props: IconProps) { return <Svg strokeWidth={2} {...props} paths={<path d="M4 6h16M4 12h16M4 18h16" />} /> }
export function ReceiptIcon(props: IconProps) { return <Svg strokeWidth={1.9} {...props} paths={<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 8h6M9 12h6M9 16h3" />} /> }
export function BasketIcon(props: IconProps) { return <Svg strokeWidth={1.8} {...props} paths={<path d="M3 10h18l-2 10H5zM7 10l3-6M17 10l-3-6M9 14v3M12 14v3M15 14v3" />} /> }
export function RugIcon(props: IconProps) { return <Svg strokeWidth={1.8} {...props} paths={<path d="M4 6h12a4 4 0 0 1 0 8H4zM16 10H4M4 14v4h12" />} /> }
export function PantsIcon(props: IconProps) { return <Svg strokeWidth={1.8} {...props} paths={<path d="M7 3h10l1 18h-4.5L12 10l-1.5 11H6zM7 7h10" />} /> }


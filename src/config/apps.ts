import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Database,
  Factory,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Home,
  LayoutDashboard,
  LineChart,
  LucideIcon,
  MapPin,
  Pencil,
  TableProperties,
  TrendingUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppId = 'pulse' | 'ole' | 'fsms' | 'ebuild' | 'iebaseline';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** If true, only show when sidebar is expanded (e.g. sub-items) */
  sub?: boolean;
}

export interface AppConfig {
  id: AppId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind color class for the accent dot / badge */
  color: string;
  /** bg color for the icon container in the switcher */
  iconBg: string;
  navItems: NavItem[];
}

// ─── App Definitions ──────────────────────────────────────────────────────────

export const APPS: AppConfig[] = [
  {
    id: 'pulse',
    label: 'IE Pulse',
    description: 'Production monitoring dashboard',
    icon: Activity,
    color: 'text-blue-500',
    iconBg: 'bg-blue-500/15',
    navItems: [
      { label: 'Overview',        to: '/',           icon: Home },
      { label: 'Plants / Layouts', to: '/plants',    icon: MapPin },
      { label: 'Workcells',       to: '/workcells',  icon: Factory },
      { label: 'Reports',         to: '/reports',    icon: LineChart },
      { label: 'Documents',       to: '/documents',  icon: FileText },
    ],
  },
  {
    id: 'ole',
    label: 'OLE Analyzer',
    description: 'Overall line efficiency analytics',
    icon: TrendingUp,
    color: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
    navItems: [
      { label: 'OLE Overview',  to: '/ole',            icon: Home },
      { label: '4Q Generator',  to: '/ole/4q',         icon: FileSpreadsheet },
      { label: 'SMH Status',    to: '/ole/smh-status', icon: FlaskConical },
      { label: 'API Test',      to: '/ole-mart-api',   icon: Database },
    ],
  },
  {
    id: 'fsms',
    label: 'FSMS',
    description: 'Floor space management system',
    icon: Building2,
    color: 'text-violet-500',
    iconBg: 'bg-violet-500/15',
    navItems: [
      { label: 'Plants',        to: '/plants',       icon: MapPin },
      { label: 'Floor Map',      to: '/floor-map',    icon: ClipboardList },
      { label: 'Layout Editor',  to: '/fsms/editor',  icon: Pencil },
      { label: 'Bay Management', to: '/fsms/bays',    icon: TableProperties },
    ],
  },
  {
    id: 'ebuild',
    label: 'eBuild Plan',
    description: 'Demand & output planning',
    icon: CalendarDays,
    color: 'text-orange-500',
    iconBg: 'bg-orange-500/15',
    navItems: [
      { label: 'Build Plan', to: '/ebuild', icon: Home },
    ],
  },
  {
    id: 'iebaseline',
    label: 'IE Baseline',
    description: 'Learn everything about IE Baseline',
    icon: BookOpen,
    color: 'text-orange-500',
    iconBg: 'bg-orange-500/15',
    navItems: [
      { label: 'Overview', to: '/iebaseline', icon: Home },
      { label: 'Edit', to: '/iebaseline/edit', icon: Pencil },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getApp = (id: AppId): AppConfig =>
  APPS.find(a => a.id === id) ?? APPS[0];

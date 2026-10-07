import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Truck,
  Users,
  MapPin,
  Package,
  Fuel,
  Wrench,
  Boxes,
  Droplets,
  DollarSign,
  Settings,
  Bell,
  FileText,
  ShoppingCart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Palmtree,
  Bus,
  PackageCheck,
  BookOpen,
  UserCog,
  KeyRound,
  Building2,
  ReceiptText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useRevisionAlerts } from '@/hooks/useRevisions';
import { useEffect, useRef } from 'react';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/', module: 'dashboard' },
  { key: 'vehicles', icon: Truck, path: '/vehicles', module: 'vehicles' },
  { key: 'liveMap', icon: MapPin, path: '/live-map', module: 'live_map' },
  { key: 'drivers', icon: Users, path: '/drivers', module: 'drivers' },
  { key: 'personnel', icon: UserCog, path: '/personnel', module: 'personnel' },
  { key: 'rental', icon: KeyRound, path: '/location-vehicules', module: 'rental' },
  { key: 'transportTouristique', icon: Palmtree, path: '/transport-touristique', module: 'transport_touristique' },
  { key: 'transportVoyageurs', icon: Bus, path: '/transport-voyageurs', module: 'transport_voyageurs' },
  { key: 'transportTMS', icon: PackageCheck, path: '/transport-tms', module: 'transport_tms' },
  { key: 'transportBTP', icon: Truck, path: '/transport-btp', module: 'transport_btp' },
  { key: 'missions', icon: Package, path: '/missions', module: 'missions' },
  { key: 'stock', icon: Boxes, path: '/stock', module: 'stock' },
  { key: 'fuel', icon: Fuel, path: '/fuel', module: 'fuel' },
  { key: 'oil', icon: Droplets, path: '/oil', module: 'oil' },
  { key: 'citerne', icon: Droplets, path: '/citerne', module: 'citerne' },
  { key: 'revisions', icon: FileText, path: '/revisions', module: 'revisions' },
  { key: 'maintenance', icon: Wrench, path: '/maintenance', module: 'maintenance' },
  { key: 'clients', icon: Users, path: '/clients', module: 'clients' },
  { key: 'societe', icon: Building2, path: '/societe', module: 'societe' },
  { key: 'facturation', icon: ReceiptText, path: '/facturation', module: 'facturation' },
  { key: 'fournisseurs', icon: Building2, path: '/fournisseurs', module: 'fournisseurs' },
  { key: 'achats', icon: ShoppingCart, path: '/achats', module: 'achats' },
  { key: 'finance', icon: DollarSign, path: '/finance', module: 'finance' },
  { key: 'comptabilite', icon: BookOpen, path: '/comptabilite', module: 'comptabilite' },
  { key: 'reports', icon: FileText, path: '/reports', module: 'reports' },
  { key: 'alerts', icon: Bell, path: '/alerts', module: 'alerts', badge: 4 },
  { key: 'settings', icon: Settings, path: '/settings' },
];

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { moduleSettings } = useAppSettings();
  const { data: revAlerts = [] } = useRevisionAlerts();
  const navScrollRef = useRef<HTMLElement | null>(null);
  const dueOverdueCount = (revAlerts as any[]).filter((a) => !a.ack && (a.status === 'due' || a.status === 'overdue')).length;

  const handleSignOut = async () => {
    const { error } = await signOut();
    navigate('/auth', { replace: true });
    if (error) {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la déconnexion: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const filteredNavItems = navItems.filter(item => {
    if (!item.module || !moduleSettings) return true;
    return moduleSettings[item.module as keyof typeof moduleSettings] !== false;
  });

  const computedNavItems = filteredNavItems.map((item) =>
    item.key === 'alerts' ? { ...item, badge: dueOverdueCount } : item
  );

  useEffect(() => {
    const navEl = navScrollRef.current;
    if (!navEl) return;

    try {
      const saved = sessionStorage.getItem('sidebar-scroll-top');
      if (saved) navEl.scrollTop = Number(saved) || 0;
    } catch {
      // ignore storage failures
    }

    const onScroll = () => {
      try {
        sessionStorage.setItem('sidebar-scroll-top', String(navEl.scrollTop));
      } catch {
        // ignore storage failures
      }
    };

    navEl.addEventListener('scroll', onScroll);
    return () => {
      onScroll();
      navEl.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const navEl = navScrollRef.current;
    if (!navEl) return;
    const activeEl = navEl.querySelector('.nav-item-active') as HTMLElement | null;
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }, [location.pathname, collapsed]);

  return (
    <aside
      className={cn(
        'fixed top-0 h-screen flex flex-col z-50 bg-[#070B16] text-slate-200 shadow-[10px_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 border-r border-white/[0.07]',
        collapsed ? 'w-20' : 'w-64',
        isRTL ? 'right-0 border-l border-white/[0.07] border-r-0' : 'left-0 border-r border-white/[0.07]'
      )}
    >
      {/* Logo Header */}
      <div className="h-16 flex items-center px-4 border-b border-white/[0.07] bg-[#070B16]">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0B1020] shadow-[0_0_15px_rgba(85,214,232,0.25)] border border-cyan-500/30">
            <img src="/sftm-logo.png" alt="SFTM" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">SFTM</h1>
              <p className="text-[10px] text-cyan-400/80 uppercase font-semibold tracking-widest">Fleet System</p>
            </div>
          )}
        </div>
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.05]"
            onClick={onToggle}
          >
            {isRTL ? (
              collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Company Selector */}
      <div className="px-3 py-3 border-b border-white/[0.07]">
        <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#0E1626] border border-white/[0.08] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)] hover:border-cyan-500/40 text-slate-200 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 flex items-center justify-center">
              <span className="text-xs font-bold text-cyan-400">TM</span>
            </div>
            {!collapsed && (
              <div className={cn('text-left', isRTL && 'text-right')}>
                <p className="text-xs font-bold text-slate-200">Trans Maroc SARL</p>
                <p className="text-[10px] text-cyan-400/70 font-medium">6 véhicules</p>
              </div>
            )}
          </div>
          {!collapsed && <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      {/* Navigation */}
      <nav ref={navScrollRef} className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-thin">
        <ul className="space-y-1">
          {computedNavItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;

            return (
              <li key={item.key}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'nav-item relative group',
                    collapsed && 'justify-center px-0',
                    isActive && 'nav-item-active'
                  )}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0 transition-colors', isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200')} />
                  {!collapsed && (
                    <span className="flex-1 truncate text-xs font-medium tracking-wide">{t(`nav.${item.key}`)}</span>
                  )}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold shadow-[0_0_10px_rgba(85,214,232,0.3)]">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <div
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-cyan-400 shadow-[0_0_10px_#55D6E8]',
                        isRTL ? '-left-2' : '-right-2'
                      )}
                    />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.07] bg-[#070B16]">
        <div className={cn('flex items-center gap-3 px-2 py-1 rounded-xl bg-[#0E1626]/80 border border-white/[0.06]', collapsed && 'justify-center px-0 bg-transparent border-0')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 shadow-[0_0_12px_rgba(85,214,232,0.3)] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-950">
              {user?.email?.substring(0, 2).toUpperCase() || 'U'}
            </span>
          </div>
          {!collapsed && (
            <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
              <p className="text-xs font-bold text-slate-200 truncate">
                {user?.email || 'Utilisateur'}
              </p>
              <p className="text-[10px] text-cyan-400/80 font-semibold uppercase">Administrateur</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg flex-shrink-0"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

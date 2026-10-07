import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: KPICardProps) {
  const borderAccents = {
    default: 'border-l-cyan-400',
    accent: 'border-l-purple-500',
    success: 'border-l-emerald-400',
    warning: 'border-l-amber-400',
    destructive: 'border-l-rose-500',
  };

  const iconBgClasses = {
    default: 'bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 shadow-[0_0_12px_rgba(85,214,232,0.3)]',
    accent: 'bg-purple-500/15 text-purple-400 border border-purple-400/30 shadow-[0_0_12px_rgba(124,77,255,0.3)]',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 shadow-[0_0_12px_rgba(69,212,131,0.3)]',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-400/30 shadow-[0_0_12px_rgba(255,159,67,0.3)]',
    destructive: 'bg-rose-500/15 text-rose-400 border border-rose-400/30 shadow-[0_0_12px_rgba(255,77,90,0.3)]',
  };

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121A2B] p-5 shadow-[8px_8px_18px_rgba(3,7,18,0.7),-4px_-4px_12px_rgba(255,255,255,0.025)] hover:shadow-[12px_12px_26px_rgba(3,7,18,0.85),-6px_-6px_16px_rgba(255,255,255,0.04)] hover:-translate-y-0.5 transition-all duration-300 border-l-4', borderAccents[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 truncate">{title}</p>
          <p className="text-2xl font-extrabold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 font-medium mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full border',
                  trend.isPositive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-[10px] text-slate-500 font-medium">vs mois dernier</span>
            </div>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3', iconBgClasses[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

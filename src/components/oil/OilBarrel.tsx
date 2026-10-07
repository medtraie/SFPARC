import { useId, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { motion, useSpring, useTransform } from 'framer-motion';

interface OilBarrelProps {
  fillPercentage: number;
  variant?: number;
}

function getStatus(fill: number) {
  if (fill > 70) return { label: 'Optimal', variant: 'success' as const };
  if (fill > 30) return { label: 'Moyen', variant: 'warning' as const };
  return { label: 'Bas', variant: 'destructive' as const };
}

const OIL_GRADIENTS = [
  { light: '#fef3c7', mid: '#facc15', dark: '#b45309' },
  { light: '#fffbeb', mid: '#eab308', dark: '#92400e' },
  { light: '#ffedd5', mid: '#fdba74', dark: '#c2410c' },
  { light: '#ecfdf3', mid: '#22c55e', dark: '#166534' },
  { light: '#e0f2fe', mid: '#0ea5e9', dark: '#0369a1' },
  { light: '#fee2e2', mid: '#f97373', dark: '#b91c1c' },
  { light: '#f5e9ff', mid: '#a855f7', dark: '#6b21a8' },
  { light: '#fef2f2', mid: '#f97316', dark: '#7c2d12' },
  { light: '#ecfeff', mid: '#22d3ee', dark: '#155e75' },
  { light: '#fdf2ff', mid: '#ec4899', dark: '#9d174d' },
  { light: '#eff6ff', mid: '#2563eb', dark: '#1d4ed8' },
];

export function OilBarrel({ fillPercentage, variant = 0 }: OilBarrelProps) {
  const clamped = Math.max(0, Math.min(100, fillPercentage));
  const status = getStatus(clamped);

  const gradientIndex =
    OIL_GRADIENTS.length > 0
      ? ((variant % OIL_GRADIENTS.length) + OIL_GRADIENTS.length) %
        OIL_GRADIENTS.length
      : 0;
  const colors = OIL_GRADIENTS[gradientIndex];
  const gradientId = useId();

  const spring = useSpring(clamped, {
    stiffness: 120,
    damping: 18,
    mass: 0.4,
  });

  const animatedHeight = useTransform(spring, (value) => (value / 100) * 120);
  const animatedY = useTransform(animatedHeight, (h) => 20 + 140 - h);

  const percentageText = useMemo(() => `${Math.round(clamped)}%`, [clamped]);

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.svg
        viewBox="0 0 120 180"
        className="drop-shadow-md w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-44"
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={colors.light} />
            <stop offset="50%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.dark} />
          </linearGradient>
        </defs>
        <motion.rect
          x="20"
          y="20"
          width="80"
          height="140"
          rx="20"
          ry="20"
          fill="#020617"
          stroke="#0f172a"
          strokeWidth="3"
          initial={{ opacity: 0, scaleY: 0.9 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transformOrigin="center"
          transition={{ duration: 0.35 }}
        />
        <motion.rect
          x="25"
          width="70"
          rx="18"
          ry="18"
          fill={`url(#${gradientId})`}
          style={{
            y: animatedY,
            height: animatedHeight,
          }}
        />
        <rect x="30" y="32" width="60" height="2" fill="#1f2937" opacity="0.6" />
        <rect x="30" y="62" width="60" height="2" fill="#1f2937" opacity="0.6" />
        <rect x="30" y="92" width="60" height="2" fill="#1f2937" opacity="0.6" />
        <rect x="30" y="122" width="60" height="2" fill="#1f2937" opacity="0.6" />
        <rect x="30" y="152" width="60" height="2" fill="#1f2937" opacity="0.6" />
        <motion.rect
          x="35"
          y="6"
          width="50"
          height="16"
          rx="8"
          ry="8"
          fill="#020617"
          stroke="#0f172a"
          strokeWidth="3"
          initial={{ y: -4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        />
      </motion.svg>
      <div className="flex flex-col items-center gap-1">
        <p className="text-2xl font-bold">{percentageText}</p>
        <Badge
          variant="outline"
          className={
            status.variant === 'success'
              ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
              : status.variant === 'warning'
              ? 'border-amber-500 text-amber-600 bg-amber-50'
              : 'border-red-500 text-red-600 bg-red-50'
          }
        >
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

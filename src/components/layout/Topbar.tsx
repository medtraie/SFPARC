import { useTranslation } from 'react-i18next';
import { Bell, Search, Globe, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme-provider';

export function Topbar() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <header className="h-16 border-b border-white/[0.07] bg-[#070B16]/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className={cn(
            'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/80',
            isRTL ? 'right-3.5' : 'left-3.5'
          )} />
          <Input
            type="search"
            placeholder={t('common.search')}
            className={cn(
              'w-full h-10 bg-[#0E1626] border border-white/[0.08] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)] rounded-full text-xs text-slate-200 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-cyan-400 focus-visible:border-cyan-400 transition-all',
              isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
            )}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl bg-[#0E1626] border border-white/[0.08] text-slate-300 hover:text-cyan-400 hover:bg-white/[0.05]">
              <Globe className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-[#0E1626] border-white/10 text-slate-200">
            <DropdownMenuItem onClick={() => toggleLanguage('fr')} className="focus:bg-cyan-500/20 focus:text-cyan-300">
              <span className="mr-2">🇫🇷</span> Français
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Display Mode */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl bg-[#0E1626] border border-white/[0.08] text-slate-300 hover:text-cyan-400 hover:bg-white/[0.05]" title="Mode d'affichage">
              {mode === 'dark' ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-[#0E1626] border-white/10 text-slate-200">
            <DropdownMenuItem onClick={() => setMode('dark')} className="focus:bg-cyan-500/20 focus:text-cyan-300">
              <Moon className="w-4 h-4 mr-2 text-cyan-400" />
              Mode sombre
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode('light')} className="focus:bg-cyan-500/20 focus:text-cyan-300">
              <Sun className="w-4 h-4 mr-2 text-amber-400" />
              Mode clair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl bg-[#0E1626] border border-white/[0.08] text-slate-300 hover:text-cyan-400 hover:bg-white/[0.05]">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_#FF4D5A]">
            4
          </span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2 h-9 rounded-xl bg-[#0E1626] border border-white/[0.08] hover:bg-white/[0.05]">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_10px_rgba(85,214,232,0.3)]">
                <span className="text-xs font-bold text-slate-950">MA</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-48 bg-[#0E1626] border-white/10 text-slate-200">
            <DropdownMenuItem className="focus:bg-cyan-500/20 focus:text-cyan-300">{t('user.profile')}</DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-cyan-500/20 focus:text-cyan-300">{t('user.settings')}</DropdownMenuItem>
            <DropdownMenuItem
              className="text-rose-400 focus:bg-rose-500/20 focus:text-rose-300"
              onSelect={async (e) => {
                e.preventDefault();
                const { error } = await signOut();
                navigate('/auth', { replace: true });
                if (error) {
                  toast.error(`Erreur lors de la déconnexion: ${error.message}`);
                }
              }}
            >
              {t('user.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

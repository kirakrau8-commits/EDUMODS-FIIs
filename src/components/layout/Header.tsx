import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Bell,
  RefreshCw,
  User,
  ChevronDown,
  Building2,
  ShieldCheck,
  CheckCircle,
  Menu,
  LogOut,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  activeModuleTitle: string;
  onOpenMobileMenu: () => void;
  onOpenUserModal: () => void;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModuleTitle,
  onOpenMobileMenu,
  onOpenUserModal,
  onOpenNotifications,
}) => {
  const {
    currentUser,
    preferences,
    toggleHideValues,
    refreshQuotes,
    isRefreshingQuotes,
    lastQuoteUpdate,
    dividends,
  } = usePortfolio();

  const { user, signOut } = useAuth();
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const pendingDividendsCount = dividends.filter((d) => d.status === 'PREVISTO').length;

  const handleRefresh = async () => {
    try {
      await refreshQuotes();
      setSyncFeedback('Cotações sincronizadas!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch {
      setSyncFeedback('Falha na sincronização.');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  return (
    <header className="h-16 bg-[#090D16] border-b border-[#1E293B] px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Zona 1: Logo e Menu Mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-white text-base md:text-lg flex items-center gap-1.5">
              EDUMODS <span className="text-emerald-400 font-bold">FIIs</span>
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-800 text-slate-400 text-sm font-medium">
          <span className="text-white font-semibold">{activeModuleTitle}</span>
        </div>
      </div>

      {/* Zona 2: Ações Globais */}
      <div className="flex items-center gap-2 md:gap-3">
        {syncFeedback && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
            <CheckCircle className="w-3.5 h-3.5" />
            {syncFeedback}
          </span>
        )}

        {/* Botão Atualizar Cotações */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshingQuotes}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          title={`Última atualização: ${lastQuoteUpdate}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshingQuotes ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRefreshingQuotes ? 'Atualizando...' : 'Atualizar Cotações'}</span>
        </button>

        {/* Toggle Ocultar Valores */}
        <button
          onClick={toggleHideValues}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            preferences.hideValues
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white'
          }`}
          title={preferences.hideValues ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
          aria-label={preferences.hideValues ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {preferences.hideValues ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Valores Ocultos</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Ocultar Valores</span>
            </>
          )}
        </button>

        {/* Notificações */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
          aria-label="Notificações e proventos"
        >
          <Bell className="w-4 h-4" />
          {pendingDividendsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        {/* Perfil & Menu da Conta */}
        <button
          onClick={onOpenUserModal}
          className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl bg-[#0F172A] border border-slate-700/80 hover:border-slate-600 transition-colors text-left"
          aria-label="Abrir menu da conta do usuário"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold border border-emerald-500/30">
            {user?.email ? user.email.charAt(0).toUpperCase() : currentUser.name.charAt(0)}
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
              {user?.email ? user.email.split('@')[0] : currentUser.name.split(' ')[0]}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium leading-none flex items-center gap-1">
              <ShieldCheck className="w-2.5 h-2.5" />
              {currentUser.plan}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Botão Sair (Logout Supabase) */}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-900/80 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-colors"
          title="Encerrar sessão Supabase Auth"
          aria-label="Sair do sistema"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
};

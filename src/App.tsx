import React, { useState } from 'react';
import { PortfolioProvider } from './context/PortfolioContext';
import { Header } from './components/layout/Header';
import { Sidebar, AppModuleId } from './components/layout/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { PortfolioView } from './components/views/PortfolioView';
import { DividendsView } from './components/views/DividendsView';
import { CalculatorsView } from './components/views/CalculatorsView';
import { DistributionView } from './components/views/DistributionView';
import { GoalsView } from './components/views/GoalsView';
import { ExploreView } from './components/views/ExploreView';
import { TransactionsView } from './components/views/TransactionsView';
import { SubscriptionsView } from './components/views/SubscriptionsView';
import { PropertiesMapView } from './components/views/PropertiesMapView';
import { ScheduleView } from './components/views/ScheduleView';
import { HealthRiskView } from './components/views/HealthRiskView';
import { ComparatorView } from './components/views/ComparatorView';
import { AlertsView } from './components/views/AlertsView';
import { GlossaryView } from './components/views/GlossaryView';
import { BackupView } from './components/views/BackupView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { PlansView } from './components/views/PlansView';
import { ChartsView } from './components/views/ChartsView';
import { TransactionModal } from './components/modals/TransactionModal';
import { AccountModal } from './components/modals/AccountModal';
import { NotificationsModal } from './components/modals/NotificationsModal';
import { OperationType } from './types/fii';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { Building2 } from 'lucide-react';

const MODULE_TITLES: Record<AppModuleId, string> = {
  inicio: 'Dashboard Estratégico',
  carteira: 'Minha Carteira',
  rendimentos: 'Calendário de Rendimentos & Proventos',
  metas: 'Metas Patrimoniais',
  calculadoras: 'Calculadoras Financeiras',
  distribuicao: 'Distribuição & Alocação',
  graficos: 'Evolução Patrimonial & Gráficos',
  explorar: 'Explorar FIIs na B3',
  operacoes: 'Histórico de Operações',
  subscricoes: 'Subscrições & Direitos',
  mapa: 'Mapa de Imóveis no Brasil',
  cronograma: 'Cronograma & Datas-Com',
  diagnostico: 'Diagnóstico de Saúde & Risco',
  fire: 'Independência Financeira (FIRE)',
  comparador: 'Comparador de Ativos',
  alertas: 'Alertas de Preço & Oportunidades',
  glossario: 'Glossário de Fundos Imobiliários',
  backup: 'Backup, Exportação & Notas',
  integracoes: 'Configurações de APIs & BRAPI',
  planos: 'Planos & Assinatura Comercial',
};

function MainApp() {
  const [activeModule, setActiveModule] = useState<AppModuleId>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modais
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalTicker, setTxModalTicker] = useState('');
  const [txModalType, setTxModalType] = useState<OperationType>('COMPRA');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleOpenTransaction = (ticker = '', type: OperationType = 'COMPRA') => {
    setTxModalTicker(ticker);
    setTxModalType(type);
    setIsTxModalOpen(true);
  };

  const renderActiveView = () => {
    switch (activeModule) {
      case 'inicio':
        return (
          <DashboardView
            onNavigate={(mod) => setActiveModule(mod)}
            onOpenTransactionModal={() => handleOpenTransaction('', 'COMPRA')}
          />
        );
      case 'carteira':
        return (
          <PortfolioView
            onOpenTransactionModal={(t, type) => handleOpenTransaction(t, type)}
            onNavigate={(mod) => setActiveModule(mod)}
          />
        );
      case 'rendimentos':
        return <DividendsView />;
      case 'metas':
      case 'fire':
        return <GoalsView />;
      case 'calculadoras':
        return <CalculatorsView />;
      case 'distribuicao':
        return <DistributionView />;
      case 'graficos':
        return <ChartsView />;
      case 'explorar':
        return (
          <ExploreView
            onOpenTransactionModal={(ticker) => handleOpenTransaction(ticker, 'COMPRA')}
          />
        );
      case 'operacoes':
        return (
          <TransactionsView
            onOpenTransactionModal={() => handleOpenTransaction('', 'COMPRA')}
          />
        );
      case 'subscricoes':
        return <SubscriptionsView />;
      case 'mapa':
        return <PropertiesMapView />;
      case 'cronograma':
        return <ScheduleView />;
      case 'diagnostico':
        return <HealthRiskView />;
      case 'comparador':
        return <ComparatorView />;
      case 'alertas':
        return <AlertsView />;
      case 'glossario':
        return <GlossaryView />;
      case 'backup':
        return <BackupView />;
      case 'integracoes':
        return <IntegrationsView />;
      case 'planos':
        return <PlansView />;
      default:
        return (
          <DashboardView
            onNavigate={(mod) => setActiveModule(mod)}
            onOpenTransactionModal={() => handleOpenTransaction('', 'COMPRA')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      <Header
        activeModuleTitle={MODULE_TITLES[activeModule]}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenUserModal={() => setIsAccountModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      <div className="flex-1 flex">
        <Sidebar
          activeModule={activeModule}
          onSelectModule={(mod) => setActiveModule(mod)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Modais Globais */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        defaultTicker={txModalTicker}
        defaultType={txModalType}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const { session, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#090D16] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-xl shadow-emerald-500/20 text-white font-bold mb-4 animate-pulse">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1">
          <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          <span>Verificando sessão segura...</span>
        </div>
        <span className="text-xs text-slate-500 font-mono">EDUMODS FIIs &bull; Supabase Auth</span>
      </div>
    );
  }

  // Sem sessão válida: exibe estritamente a tela de login
  if (!session || !user) {
    return <LoginView />;
  }

  // Sessão autenticada e válida: exibe a aplicação completa
  return (
    <PortfolioProvider>
      <MainApp />
    </PortfolioProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

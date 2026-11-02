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
import { AssistantView } from './components/views/AssistantView';
import { TransactionModal } from './components/modals/TransactionModal';
import { AddDividendModal } from './components/modals/AddDividendModal';
import { AccountModal } from './components/modals/AccountModal';
import { NotificationsModal } from './components/modals/NotificationsModal';
import { OperationType } from './types/fii';
import { AuthProvider } from './context/AuthContext';
import { Bot } from 'lucide-react';

const MODULE_TITLES: Record<AppModuleId, string> = {
  inicio: 'Dashboard Estratégico',
  carteira: 'Minha Carteira',
  rendimentos: 'Calendário de Rendimentos & Proventos',
  assistente: 'Assistente EDUMODS FIIs (Gemini)',
  metas: 'Metas Patrimoniais',
  calculadoras: 'Simulador de Juros Compostos & Bola de Neve',
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
  planos: 'Acesso Pessoal Completo',
};

function MainApp() {
  const [activeModule, setActiveModule] = useState<AppModuleId>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modais de Cadastro de Fundo e Cadastro de Provento (fluxos separados estilo Renda FII)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalTicker, setTxModalTicker] = useState('');
  const [txModalType, setTxModalType] = useState<OperationType>('COMPRA');

  const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
  const [divModalTicker, setDivModalTicker] = useState('');
  const [divModalQty, setDivModalQty] = useState<number | undefined>(undefined);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleOpenTransaction = (ticker = '', type: OperationType = 'COMPRA') => {
    setTxModalTicker(ticker);
    setTxModalType(type);
    setIsTxModalOpen(true);
  };

  const handleOpenAddDividend = (ticker = '', suggestedQty?: number) => {
    setDivModalTicker(ticker);
    setDivModalQty(suggestedQty);
    setIsDividendModalOpen(true);
  };

  const renderActiveView = () => {
    switch (activeModule) {
      case 'inicio':
        return (
          <DashboardView
            onNavigate={(mod) => setActiveModule(mod)}
            onOpenTransactionModal={() => handleOpenTransaction('', 'COMPRA')}
            onOpenAddDividendModal={(t, q) => handleOpenAddDividend(t, q)}
          />
        );
      case 'carteira':
        return (
          <PortfolioView
            onOpenTransactionModal={(t, type) => handleOpenTransaction(t, type)}
            onOpenAddDividendModal={(t, q) => handleOpenAddDividend(t, q)}
            onNavigate={(mod) => setActiveModule(mod)}
          />
        );
      case 'rendimentos':
        return (
          <DividendsView
            onOpenAddDividendModal={(t, q) => handleOpenAddDividend(t, q)}
          />
        );
      case 'assistente':
        return (
          <AssistantView
            onOpenTransactionModal={(t, type) => handleOpenTransaction(t, type)}
            onOpenAddDividendModal={(t, q) => handleOpenAddDividend(t, q)}
          />
        );
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
            onOpenAddDividendModal={(t, q) => handleOpenAddDividend(t, q)}
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

      {/* Botão Flutuante de Acesso Rápido ao Assistente */}
      {activeModule !== 'assistente' && (
        <button
          type="button"
          onClick={() => setActiveModule('assistente')}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-xl shadow-emerald-950/60 hover:shadow-emerald-500/30 transition-all cursor-pointer border border-emerald-400/30 group"
          title="Abrir Assistente Inteligente EDUMODS"
        >
          <Bot className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
          <span>Assistente IA</span>
        </button>
      )}

      {/* Modais Globais */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        defaultTicker={txModalTicker}
        defaultType={txModalType}
        onOpenAddDividend={(ticker, qty) => handleOpenAddDividend(ticker, qty)}
      />

      <AddDividendModal
        isOpen={isDividendModalOpen}
        onClose={() => setIsDividendModalOpen(false)}
        defaultTicker={divModalTicker}
        defaultQuantity={divModalQty}
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

export default function App() {
  return (
    <AuthProvider>
      <PortfolioProvider>
        <MainApp />
      </PortfolioProvider>
    </AuthProvider>
  );
}

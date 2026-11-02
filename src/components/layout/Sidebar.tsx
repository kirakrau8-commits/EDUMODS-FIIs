import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  CalendarDays,
  Target,
  Calculator,
  PieChart,
  LineChart,
  Search,
  History,
  MapPin,
  Clock,
  ShieldAlert,
  Flame,
  Scale,
  BellRing,
  BookOpen,
  Database,
  Sliders,
  Layers,
  X,
  Bot,
} from 'lucide-react';

export type AppModuleId =
  | 'inicio'
  | 'carteira'
  | 'rendimentos'
  | 'assistente'
  | 'metas'
  | 'calculadoras'
  | 'distribuicao'
  | 'graficos'
  | 'explorar'
  | 'operacoes'
  | 'subscricoes'
  | 'mapa'
  | 'cronograma'
  | 'diagnostico'
  | 'fire'
  | 'comparador'
  | 'alertas'
  | 'glossario'
  | 'backup'
  | 'integracoes'
  | 'planos';

interface SidebarProps {
  activeModule: AppModuleId;
  onSelectModule: (module: AppModuleId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavSection {
  title: string;
  items: {
    id: AppModuleId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  mobileOpen,
  onCloseMobile,
}) => {
  const navSections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { id: 'inicio', label: 'Início', icon: LayoutDashboard },
        { id: 'carteira', label: 'Minha Carteira', icon: Briefcase },
        { id: 'rendimentos', label: 'Rendimentos', icon: CalendarDays },
        { id: 'assistente', label: 'Assistente IA', icon: Bot, badge: 'IA' },
        { id: 'metas', label: 'Metas', icon: Target },
        { id: 'calculadoras', label: 'Juros Compostos', icon: Calculator, badge: 'Simulador' },
        { id: 'distribuicao', label: 'Distribuição', icon: PieChart },
      ],
    },
    {
      title: 'Análise & Mercado',
      items: [
        { id: 'graficos', label: 'Gráficos', icon: LineChart },
        { id: 'explorar', label: 'Explorar FIIs', icon: Search },
        { id: 'mapa', label: 'Mapa de Imóveis', icon: MapPin },
        { id: 'cronograma', label: 'Cronograma & Datas-Com', icon: Clock },
        { id: 'diagnostico', label: 'Saúde & Risco', icon: ShieldAlert },
        { id: 'fire', label: 'Independência Financeira', icon: Flame },
        { id: 'comparador', label: 'Comparador & Backtest', icon: Scale },
      ],
    },
    {
      title: 'Gestão & Sistema',
      items: [
        { id: 'operacoes', label: 'Operações', icon: History },
        { id: 'subscricoes', label: 'Subscrições & Direitos', icon: Layers },
        { id: 'alertas', label: 'Alertas', icon: BellRing },
        { id: 'glossario', label: 'Glossário', icon: BookOpen },
        { id: 'backup', label: 'Backup & Notas', icon: Database },
        { id: 'integracoes', label: 'APIs & BRAPI', icon: Sliders },
      ],
    },
  ];

  const handleItemClick = (id: AppModuleId) => {
    onSelectModule(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Overlay Mobile */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-16 z-50 lg:z-10 h-screen lg:h-[calc(100vh-4rem)] w-64 bg-[#090D16] border-r border-[#1E293B] flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header mobile da sidebar com botão fechar */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800">
          <span className="font-extrabold text-white text-base">
            EDUMODS <span className="text-emerald-400">FIIs</span>
          </span>
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links de navegação com scroll suave */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </span>
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-emerald-400'
                              : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé da sidebar com versão e status de uso pessoal */}
        <div className="p-3 border-t border-slate-800/80 bg-[#070A12]">
          <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
            <span>EDUMODS FIIs</span>
            <span className="font-mono text-[10px] text-emerald-400 font-semibold">Uso Pessoal</span>
          </div>
        </div>
      </aside>
    </>
  );
};

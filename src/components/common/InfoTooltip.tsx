import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: string;
  example?: string;
  formula?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'xs' | 'sm';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  description,
  example,
  formula,
  align = 'center',
  size = 'xs',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const alignClasses =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <span ref={containerRef} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex items-center justify-center rounded-full transition-colors focus:outline-hidden ${
          isOpen
            ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/40'
            : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80'
        } ${size === 'xs' ? 'w-4 h-4' : 'w-5 h-5'}`}
        aria-label={`Explicação sobre ${title}`}
        title={`Clique para entender: ${title}`}
      >
        <HelpCircle className={size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={title}
          className={`absolute z-50 bottom-full mb-2 w-72 sm:w-80 p-3.5 rounded-xl bg-[#0B111E] border border-slate-700 shadow-2xl text-left font-sans normal-case tracking-normal animate-in fade-in zoom-in-95 duration-150 ${alignClasses}`}
        >
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-white">{title}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
              aria-label="Fechar explicação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mt-2">{description}</p>

          {formula && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300">
              {formula}
            </div>
          )}

          {example && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200 leading-relaxed">
              <strong className="text-emerald-400 font-semibold">Exemplo prático: </strong>
              {example}
            </div>
          )}
        </div>
      )}
    </span>
  );
};

interface TabGuideItem {
  term: string;
  meaning?: string;
  definition?: string;
  example?: string;
}

interface TabGuideBannerProps {
  title: string;
  subtitle: string;
  items: TabGuideItem[];
  defaultExpanded?: boolean;
}

export const TabGuideBanner: React.FC<TabGuideBannerProps> = ({
  title,
  subtitle,
  items,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl bg-[#0B1221] border border-slate-800/90 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">{title}</span>
            <span className="text-[11px] text-slate-400 block">{subtitle}</span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] font-semibold text-emerald-400 shrink-0">
          <span>{isExpanded ? 'Ocultar explicação' : 'Entenda esta aba'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-950/40">
          {items.map((item) => (
            <div
              key={item.term}
              className="p-3 rounded-xl bg-[#0F172A] border border-slate-800/90 space-y-1"
            >
              <span className="text-xs font-bold text-emerald-400 block">{item.term}</span>
              <p className="text-xs text-slate-300 leading-relaxed">{item.meaning || item.definition}</p>
              {item.example && (
                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60">
                  {item.example}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

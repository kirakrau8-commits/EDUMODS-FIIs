import React, { useState } from 'react';
import { BellRing, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, Edit2, Check, X } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL } from '../../utils/formatters';

interface AlertItem {
  id: string;
  ticker: string;
  type: 'PRECO_TETO' | 'PVP_MAXIMO' | 'PROVENTO_MINIMO';
  thresholdValue: number;
  isActive: boolean;
}

export const AlertsView: React.FC = () => {
  const { preferences, updatePreferences } = usePortfolio();

  const [alerts, setAlerts] = useState<AlertItem[]>([
    { id: 'alt_1', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 155.0, isActive: true },
    { id: 'alt_2', ticker: 'MXRF11', type: 'PVP_MAXIMO', thresholdValue: 1.02, isActive: true },
    { id: 'alt_3', ticker: 'KNIP11', type: 'PROVENTO_MINIMO', thresholdValue: 0.85, isActive: true },
  ]);

  const [newTicker, setNewTicker] = useState('XPML11');
  const [newType, setNewType] = useState<AlertItem['type']>('PRECO_TETO');
  const [newVal, setNewVal] = useState('100.00');

  // Inline edit state
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState<string>('');
  const [editType, setEditType] = useState<AlertItem['type']>('PRECO_TETO');

  const startEdit = (al: AlertItem) => {
    setEditingAlertId(al.id);
    setEditVal(String(al.thresholdValue));
    setEditType(al.type);
  };

  const saveEdit = (id: string) => {
    const parsed = parseFloat(editVal);
    if (!isNaN(parsed) && parsed > 0) {
      setAlerts(alerts.map(a => a.id === id ? { ...a, thresholdValue: parsed, type: editType } : a));
    }
    setEditingAlertId(null);
  };

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newVal);
    if (!newTicker || isNaN(val)) return;

    setAlerts([
      ...alerts,
      {
        id: `alt_${Date.now()}`,
        ticker: newTicker.toUpperCase().trim(),
        type: newType,
        thresholdValue: val,
        isActive: true,
      },
    ]);
  };

  const handleToggle = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)));
  };

  const handleDelete = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Monitoramento de Oportunidades
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Alertas de Preço & Oportunidades
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Defina limites de compra (preço-teto e P/VP máximo) para receber avisos imediatos quando um fundo entrar em faixa de oportunidade.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulário Novo Alerta */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Criar Novo Alerta</h2>
          <form onSubmit={handleAddAlert} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Ticker do Fundo</label>
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder="Ex: HGLG11"
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Tipo de Condição</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as AlertItem['type'])}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              >
                <option value="PRECO_TETO">Cotação abaixo do Preço-Teto (R$)</option>
                <option value="PVP_MAXIMO">P/VP menor ou igual ao Limite</option>
                <option value="PROVENTO_MINIMO">Provento por cota acima de (R$)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Valor Limite / Gatilho</label>
              <input
                type="number"
                step="0.01"
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md transition-colors"
            >
              Ativar Alerta
            </button>
          </form>
        </div>

        {/* Lista de Alertas Ativos */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Alertas Configurados ({alerts.length})
          </h2>
          <div className="space-y-2">
            {alerts.map((al) => {
              const isEditing = editingAlertId === al.id;

              if (isEditing) {
                return (
                  <div
                    key={al.id}
                    className="p-3 bg-slate-900 border border-emerald-500/50 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-sm">{al.ticker}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase">Editando Alerta</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Tipo</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as AlertItem['type'])}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                        >
                          <option value="PRECO_TETO">Preço-Teto (R$)</option>
                          <option value="PVP_MAXIMO">P/VP Máximo</option>
                          <option value="PROVENTO_MINIMO">Provento Mín. (R$)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Valor Gatilho</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingAlertId(null)}
                        className="px-2.5 py-1 text-slate-400 hover:text-white rounded flex items-center gap-1 text-[11px]"
                      >
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(al.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-1 text-[11px]"
                      >
                        <Check className="w-3 h-3" /> Salvar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={al.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">{al.ticker}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {al.type === 'PRECO_TETO'
                          ? 'Preço-Teto'
                          : al.type === 'PVP_MAXIMO'
                          ? 'P/VP Limite'
                          : 'Provento Mínimo'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Gatilho: <strong className="text-emerald-400 font-mono">{al.thresholdValue}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(al.id)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${
                        al.isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {al.isActive ? 'Ativo' : 'Pausado'}
                    </button>
                    <button
                      onClick={() => startEdit(al)}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar alerta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(al.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Excluir alerta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

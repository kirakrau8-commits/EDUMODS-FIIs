import React, { useState } from 'react';
import { X, User, Plus, Trash2, Shield, Lock, RotateCcw } from 'lucide-react';
import { usePortfolio, UserAccount } from '../../context/PortfolioContext';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    availableUsers,
    switchUser,
    createNewUserAccount,
    deleteAccount,
    resetPortfolioToDemo,
    clearPortfolioData,
  } = usePortfolio();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  if (!isOpen) return null;

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    createNewUserAccount(newName.trim(), newEmail.trim());
    setIsCreating(false);
    setNewName('');
    setNewEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Gerenciar Conta & Usuários</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal de contas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Conta Ativa Atual */}
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-emerald-400 tracking-wider">
                Conta Conectada
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Plano {currentUser.plan}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Isolamento total de dados ativado. Nenhum dado vaza para outras contas.</span>
            </div>
          </div>

          {/* Trocar de Conta / Perfis Disponíveis */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Alternar Entre Contas</span>
              <button
                onClick={() => setIsCreating(!isCreating)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Conta</span>
              </button>
            </div>

            {isCreating && (
              <form onSubmit={handleCreateAccount} className="p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-2.5 animate-in fade-in duration-100">
                <span className="text-xs font-semibold text-white block">Cadastrar Novo Usuário</span>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-hidden focus:border-emerald-500"
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-hidden focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                  >
                    Cadastrar e Entrar
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {availableUsers.map((user) => {
                const isSelected = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-slate-800/90 border-emerald-500/40 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => switchUser(user)}
                      className="flex items-center gap-2.5 text-left flex-1"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {user.role === 'admin' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
                      </div>
                    </button>

                    {availableUsers.length > 1 && !isSelected && (
                      <button
                        onClick={() => deleteAccount(user.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Excluir conta de teste"
                        aria-label={`Excluir conta ${user.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações de Dados da Carteira */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => {
                if (window.confirm('Deseja recarregar a carteira com dados demonstrativos pré-configurados?')) {
                  resetPortfolioToDemo();
                  onClose();
                }
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Restaurar Carteira Demo</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Atenção: deseja zerar todas as posições e histórico da conta atual?')) {
                  clearPortfolioData();
                  onClose();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              Zerar Dados da Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

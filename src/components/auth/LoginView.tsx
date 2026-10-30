import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Server,
  ArrowRight,
  Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabaseUrl } from '../../services/supabase';

export const LoginView: React.FC = () => {
  const { signInWithEmail, authError, isConfigured, clearAuthError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(!isConfigured);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    await signInWithEmail(email, password);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#090D16] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Luzes de fundo atmosféricas */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Simplificado */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 z-10">
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

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Supabase Auth & RLS Ativo</span>
        </div>
      </header>

      {/* Conteúdo Central: Card de Login */}
      <main className="w-full max-w-md mx-auto my-auto z-10 py-6">
        <div className="p-6 sm:p-8 bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl space-y-6">
          {/* Cabeçalho do Card */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Acesso à Carteira de FIIs
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Informe suas credenciais autorizadas para desbloquear o painel analítico e dados patrimoniais.
            </p>
          </div>

          {/* Aviso se Supabase não estiver configurado no ambiente */}
          {!isConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block text-amber-300">Variáveis de Ambiente Necessárias</strong>
                  <span>
                    Conecte seu projeto Supabase definindo <code>VITE_SUPABASE_URL</code> e{' '}
                    <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no seu arquivo <code>.env</code> ou painel de variáveis.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mensagens de Erro Traduzidas */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="leading-relaxed block">{authError}</span>
              </div>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="font-semibold text-slate-300 block">
                E-mail Cadastrado
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-500 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="investidor@exemplo.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="font-semibold text-slate-300 block">
                  Senha
                </label>
                <span className="text-[11px] text-slate-500">Acesso Restrito</span>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-500 pointer-events-none">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isSubmitting || !isConfigured}
              className={`w-full py-3 px-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                isSubmitting || !isConfigured
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando no Supabase...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Aviso Obrigatório: Cadastro Público Desabilitado */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cadastro Público Desativado</span>
            </div>
            <p className="leading-relaxed">
              O acesso é exclusivo a investidores autorizados. Caso não possua acesso, solicite o cadastro de suas credenciais ao administrador do projeto no Supabase.
            </p>
          </div>

          {/* Painel de Ajuda & Configuração Técnica */}
          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowConfigHelp(!showConfigHelp)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                Instruções de Conexão Supabase
              </span>
              {showConfigHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showConfigHelp && (
              <div className="mt-3 p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-slate-400 font-mono text-[10px]">Configuração Detectada:</span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      isConfigured
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {isConfigured ? 'Conectado' : 'Chaves Ausentes'}
                  </span>
                </div>

                <div className="space-y-1 font-mono text-[10px] text-slate-400">
                  <div>
                    <span className="text-slate-500">URL:</span> {supabaseUrl ? supabaseUrl : '(não configurado)'}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Para conectar com o seu próprio Supabase:
                  <br />
                  1. Abra seu projeto no{' '}
                  <span className="text-emerald-400 font-semibold">Supabase Dashboard</span>.
                  <br />
                  2. Em <strong>Project Settings &gt; API</strong>, copie a <strong>Project URL</strong> e a{' '}
                  <strong>anon/public key</strong>.
                  <br />
                  3. Defina as variáveis no <code>.env</code>:
                </p>

                <pre className="p-2 bg-black/60 rounded border border-slate-800 text-[10px] font-mono text-emerald-300 overflow-x-auto">
                  VITE_SUPABASE_URL="https://xxx.supabase.co"
                  <br />
                  VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."
                </pre>

                <p className="text-[10px] text-slate-400">
                  4. Crie seus usuários em <strong>Authentication &gt; Users &gt; Add user</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto py-3 text-center text-[11px] text-slate-500 z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800/60">
        <span>EDUMODS FIIs &copy; {new Date().getFullYear()} — Plataforma de Gestão de Fundos Imobiliários</span>
        <span className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-emerald-400" />
          Segurança de Nível Bancário com Row Level Security (RLS)
        </span>
      </footer>
    </div>
  );
};

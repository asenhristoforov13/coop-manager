
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Wallet, 
  CheckCircle2, 
  Settings, 
  ArrowUpCircle,
  Megaphone,
  Loader2, 
  Trash2,
  Receipt,
  Plus,
  BrainCircuit,
  Archive,
  LogOut,
  TrendingDown,
  TrendingUp,
  Filter
} from 'lucide-react';
import { INITIAL_APARTMENTS } from './constants';
import { Apartment, AppSettings, Expense, ExpenseCategory, Payment, User, UserRole } from './types';
import { generateNotice, analyzeFinances } from './services/geminiService';

const DEFAULT_SETTINGS: AppSettings = {
  pricePerResident: 10,
  pricePerPet: 5,
  fixedElevatorFee: 15,
  fixedFroFee: 20,
  cleaningFeePerResident: 5
};

const INITIAL_USERS: User[] = [
  { id: '1', email: 'admin', role: 'admin', registeredAt: new Date().toLocaleDateString('bg-BG') }
];

const UNIVERSAL_PASSWORD = '1234';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('coop_logged_in') === 'true');
  const [userRole, setUserRole] = useState<UserRole>(() => (localStorage.getItem('coop_user_role') as UserRole) || 'user');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'obligations' | 'settings' | 'expenses' | 'archive'>('dashboard');
  
  const [apartments, setApartments] = useState<Apartment[]>(() => {
    const saved = localStorage.getItem('coop_reset_apts');
    return saved ? JSON.parse(saved) : INITIAL_APARTMENTS;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('coop_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('coop_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem('coop_payments');
    return saved ? JSON.parse(saved) : [];
  });

  const [notices, setNotices] = useState<{id: string, text: string, date: string}[]>(() => {
    const saved = localStorage.getItem('coop_notices');
    return saved ? JSON.parse(saved) : [];
  });

  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('coop_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [noticeTopic, setNoticeTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const [newExpense, setNewExpense] = useState({
    category: ExpenseCategory.ELECTRICITY,
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  const isAdmin = userRole === 'admin';

  useEffect(() => { localStorage.setItem('coop_reset_apts', JSON.stringify(apartments)); }, [apartments]);
  useEffect(() => { localStorage.setItem('coop_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('coop_notices', JSON.stringify(notices)); }, [notices]);
  useEffect(() => { localStorage.setItem('coop_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('coop_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('coop_users', JSON.stringify(registeredUsers)); }, [registeredUsers]);

  const debtors = useMemo(() => apartments.filter(apt => apt.balance < 0).sort((a, b) => a.balance - b.balance), [apartments]);
  const totalDebt = useMemo(() => Math.abs(debtors.reduce((sum, apt) => sum + apt.balance, 0)), [debtors]);
  const totalFroFunds = useMemo(() => payments.reduce((sum, p) => sum + settings.fixedFroFee, 0), [payments, settings.fixedFroFee]);

  const monthlyReports = useMemo(() => {
    const reports: Record<string, { income: number; expenses: number }> = {};
    payments.forEach(p => {
      const parts = p.date.split('.');
      if (parts.length >= 2) {
        const key = `${parts[1]}.${parts[2].split(' ')[0]}`;
        if (!reports[key]) reports[key] = { income: 0, expenses: 0 };
        reports[key].income += p.amount;
      }
    });
    expenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
      if (!reports[key]) reports[key] = { income: 0, expenses: 0 };
      reports[key].expenses += e.amount;
    });
    return Object.entries(reports).sort((a, b) => b[0].localeCompare(a[0])).map(([name, data]) => ({ name, ...data }));
  }, [payments, expenses]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(() => {
      const user = registeredUsers.find(u => u.email.toLowerCase() === authEmail.trim().toLowerCase());
      if (user && authPassword === UNIVERSAL_PASSWORD) {
        setIsLoggedIn(true);
        setUserRole(user.role);
        localStorage.setItem('coop_logged_in', 'true');
        localStorage.setItem('coop_user_role', user.role);
      } else {
        alert("Грешен потребител или парола!");
      }
      setIsLoggingIn(false);
    }, 800);
  };

  const handleLogout = () => {
    if (confirm("Изход?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleApplyMonthlyCharges = () => {
    if (!isAdmin || !confirm("Желаете ли да начислите месечните такси на всички обекти?")) return;
    setApartments(prev => prev.map(apt => {
      let fee = apt.residents * settings.pricePerResident + settings.fixedFroFee + apt.residents * settings.cleaningFeePerResident;
      if (apt.hasPet) fee += settings.pricePerPet;
      if (apt.paysElevator) fee += settings.fixedElevatorFee;
      return { ...apt, balance: apt.balance - fee };
    }));
  };

  const handleMarkAsPaid = (aptId: string) => {
    const apt = apartments.find(a => a.id === aptId);
    if (!apt) return;
    const amount = Math.abs(apt.balance);
    setPayments(prev => [{ id: Math.random().toString(), apartmentId: apt.id, apartmentNumber: apt.number, owner: apt.owner, amount, date: new Date().toLocaleString('bg-BG') }, ...prev]);
    setApartments(prev => prev.map(a => a.id === aptId ? { ...a, balance: 0 } : a));
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.amount) return;
    setExpenses(prev => [{ id: Date.now().toString(), date: newExpense.date, category: newExpense.category, amount: parseFloat(newExpense.amount) }, ...prev]);
    setNewExpense({ ...newExpense, amount: '' });
  };

  const handleCreateNotice = async () => {
    if (!noticeTopic.trim()) return;
    setIsGenerating(true);
    try {
      const text = await generateNotice(noticeTopic);
      setNotices(prev => [{ id: Date.now().toString(), text, date: new Date().toLocaleDateString('bg-BG') }, ...prev]);
      setNoticeTopic('');
    } catch { alert("Грешка при AI"); } finally { setIsGenerating(false); }
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const result = await analyzeFinances(expenses, apartments);
      setAiAnalysis(result);
    } catch {
      alert("Неуспешен анализ.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 space-y-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-5 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-100">
                <Building2 size={42} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">CoopManager</h1>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Вход за управление</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Потребител (admin)" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
              <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Парола (1234)" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
              <button disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
                {isLoggingIn ? <Loader2 className="animate-spin mx-auto" /> : 'ВХОД'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 pb-24 md:pb-0">
      <aside className="fixed bottom-0 left-0 right-0 md:relative md:w-72 bg-white border-t md:border-t-0 md:border-r border-slate-200 p-3 md:p-8 flex flex-row md:flex-col shadow-2xl md:shadow-none z-50">
        <div className="hidden md:flex items-center gap-4 text-blue-600 mb-12">
          <Building2 size={36} />
          <h1 className="text-xl font-black tracking-tighter uppercase">CoopManager</h1>
        </div>
        <nav className="flex flex-row md:flex-col flex-1 w-full justify-around md:justify-start gap-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Табло' },
            ...(isAdmin ? [{ id: 'obligations', icon: Wallet, label: 'Такси' }, { id: 'expenses', icon: Receipt, label: 'Разходи' }] : []),
            { id: 'archive', icon: Archive, label: 'Архив' },
            ...(isAdmin ? [{ id: 'settings', icon: Settings, label: 'Още' }] : [])
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 p-3 md:p-5 rounded-2xl font-black transition-all flex-1 md:flex-none ${activeTab === t.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}>
              <t.icon size={20} />
              <span className="text-[9px] md:text-sm uppercase tracking-widest md:tracking-normal">{t.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="hidden md:flex items-center justify-center gap-3 p-5 mt-auto rounded-2xl font-black text-rose-500 hover:bg-rose-50 transition-all">
          <LogOut size={20} />
          <span className="text-xs uppercase tracking-widest">Изход</span>
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-16 overflow-y-auto custom-scrollbar">
        {activeTab === 'dashboard' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="grid grid-cols-2 gap-6 md:gap-10">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-blue-500/5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Фонд ФРО</p>
                <p className="text-3xl font-black text-blue-600">{totalFroFunds.toFixed(2)} лв.</p>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-rose-500/5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Общи Дългове</p>
                <p className="text-3xl font-black text-rose-600">{totalDebt.toFixed(2)} лв.</p>
              </div>
            </header>

            <section className="bg-blue-50/50 p-8 md:p-10 rounded-[3.5rem] border border-blue-100 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-blue-800 flex items-center gap-4"><BrainCircuit className="text-blue-500" /> AI Финансов Анализ</h3>
                <button 
                  onClick={handleAiAnalysis} 
                  disabled={isAnalyzing}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <ArrowUpCircle size={16} />} 
                  {isAnalyzing ? 'Анализиране...' : 'Старт Анализ'}
                </button>
              </div>
              {aiAnalysis && (
                <div className="bg-white p-8 rounded-[2rem] border border-blue-100 shadow-sm text-slate-700 leading-relaxed animate-in fade-in slide-in-from-top-2">
                  <p className="whitespace-pre-wrap font-medium">{aiAnalysis}</p>
                </div>
              )}
            </section>

            <section className="bg-amber-50/50 p-8 md:p-12 rounded-[3.5rem] border border-amber-100 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-amber-800 flex items-center gap-4"><Megaphone className="text-amber-500" /> Обяви от УС</h3>
                {isAdmin && (
                  <div className="flex gap-2">
                    <input value={noticeTopic} onChange={e => setNoticeTopic(e.target.value)} placeholder="Тема..." className="px-6 py-3 rounded-2xl border border-amber-200 outline-none text-sm bg-white w-32 md:w-auto" />
                    <button onClick={handleCreateNotice} disabled={isGenerating} className="bg-amber-600 text-white p-4 rounded-2xl shadow-lg hover:bg-amber-700 transition-all">
                      {isGenerating ? <Loader2 className="animate-spin" /> : <Plus />}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid gap-4">
                {notices.length === 0 ? <p className="text-amber-400 text-sm font-bold text-center py-4">Няма текущи обяви</p> : notices.map(n => (
                  <div key={n.id} className="bg-white p-8 rounded-[2rem] border border-amber-100 shadow-sm relative group">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">{n.date}</p>
                    <p className="text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">{n.text}</p>
                    {isAdmin && <button onClick={() => setNotices(prev => prev.filter(x => x.id !== n.id))} className="absolute top-6 right-6 text-slate-200 hover:text-rose-500 transition-all"><Trash2 size={18}/></button>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'expenses' && isAdmin && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
             <header className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
                <h2 className="text-2xl font-black">Добави Разход</h2>
                <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as ExpenseCategory})} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                    {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <input type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} placeholder="Сума (лв.)" className="p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                  <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                  <button type="submit" className="bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">ДОБАВИ</button>
                </form>
             </header>

             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                    <tr><th className="p-8 pl-12">Дата</th><th className="p-8">Категория</th><th className="p-8 text-right pr-12">Сума</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-all group">
                        <td className="p-8 pl-12 font-medium">{new Date(exp.date).toLocaleDateString('bg-BG')}</td>
                        <td className="p-8"><span className="px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full">{exp.category}</span></td>
                        <td className="p-8 text-right pr-12 font-black text-rose-500">-{exp.amount.toFixed(2)} лв.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-black">Месечни Отчети</h2>
            <div className="grid gap-6">
              {monthlyReports.map(report => (
                <div key={report.name} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      {report.name.split('.')[0]}
                    </div>
                    <div>
                      <p className="text-xl font-black text-slate-800">Период: {report.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Обобщена статистика</p>
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1 flex items-center justify-end gap-2"><TrendingUp size={12}/> Приходи</p>
                      <p className="text-2xl font-black text-emerald-600">+{report.income.toFixed(2)} лв.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1 flex items-center justify-end gap-2"><TrendingDown size={12}/> Разходи</p>
                      <p className="text-2xl font-black text-rose-600">-{report.expenses.toFixed(2)} лв.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'obligations' && isAdmin && (
           <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
             <header className="flex flex-col md:flex-row justify-between items-center bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl gap-6">
                <div>
                  <h2 className="text-2xl font-black">Такси</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Всички апартаменти</p>
                </div>
                <button onClick={handleApplyMonthlyCharges} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 w-full md:w-auto justify-center">
                  <Plus /> Начисли Такси
                </button>
             </header>
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50">
                    <tr><th className="p-8 pl-12">Обект</th><th className="p-8 text-right">Салдо</th><th className="p-8 text-center pr-12">Действие</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {apartments.map(apt => (
                      <tr key={apt.id} className="hover:bg-slate-50 transition-all">
                        <td className="p-8 pl-12 font-black text-lg">Ап. {apt.number} <span className="text-[10px] text-slate-300 font-bold ml-2 uppercase">{apt.owner}</span></td>
                        <td className={`p-8 text-right font-black ${apt.balance < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{apt.balance.toFixed(2)} лв.</td>
                        <td className="p-8 text-center pr-12">
                          {apt.balance < 0 ? (
                            <button onClick={() => handleMarkAsPaid(apt.id)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">Платено</button>
                          ) : (
                            <CheckCircle2 className="text-emerald-400 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}

        {activeTab === 'settings' && isAdmin && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-top-4">
            <header className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl text-center">
              <Settings size={48} className="mx-auto text-blue-600 mb-6" />
              <h2 className="text-2xl font-black">Ценоразпис</h2>
              <p className="text-slate-400 font-medium">Тези стойности се използват при автоматичното начисляване.</p>
            </header>
            
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl grid gap-6">
              {[
                { label: 'Такса на човек', key: 'pricePerResident' },
                { label: 'Такса за любимец', key: 'pricePerPet' },
                { label: 'Такса асансьор (фикс)', key: 'fixedElevatorFee' },
                { label: 'Такса почистване /човек', key: 'cleaningFeePerResident' },
                { label: 'Фонд Ремонт (апартамент)', key: 'fixedFroFee' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl">
                  <span className="font-black text-xs uppercase text-slate-500 tracking-widest">{item.label}</span>
                  <input 
                    type="number" 
                    value={(settings as any)[item.key]} 
                    onChange={e => setSettings({...settings, [item.key]: parseFloat(e.target.value) || 0})}
                    className="w-24 text-right bg-transparent font-black text-blue-600 outline-none focus:text-blue-800"
                  />
                </div>
              ))}
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em] pt-8 text-center uppercase">Промените се записват автоматично</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

import { useState, useMemo, useCallback } from 'react';
import { useClients, getCurrentMonthKey } from './hooks/useClients';
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';
import LoginPage from './components/LoginPage';
import SettingsPage from './components/SettingsPage';
import Modal from './components/Modal';
import { Users, CheckCircle2, Circle, Plus, Wallet, Trash2, Download, LogOut, Settings } from 'lucide-react';
import { cn } from './lib/utils';

// ─── Authenticated App ─────────────────────────────────────────────────────────
function AppContent({ user, logout, settings, updateSettings }) {
  const { clients, addClient, togglePayment, removeClient, resetPayments } = useClients(true);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list'); // 'list' | 'calendar' | 'history' | 'settings'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonthKey());

  const currentMonth = getCurrentMonthKey();

  const getRealPrice = useCallback((price, method) => {
    if (!price || price <= 0) return 0;
    if (method === 'Square') return Math.max(0, price * (1 - 0.033) - 0.30);
    return price;
  }, []);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [daysInMonth, firstDayOfMonth]);

  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      options.push({ key, label });
    }
    return options;
  }, []);

  const filteredClients = useMemo(() => {
    const activeMonth = view === 'history' ? historyMonth : currentMonth;
    return clients.filter(c => {
      const isPaid = !!c.payments[activeMonth];
      if (filter === 'paid') return isPaid;
      if (filter === 'unpaid') return !isPaid;
      if (filter === 'zelle') return c.paymentMethod === 'Zelle';
      if (filter === 'square') return c.paymentMethod === 'Square';
      return true;
    }).sort((a, b) => (a.paymentDay || 0) - (b.paymentDay || 0));
  }, [clients, filter, currentMonth, historyMonth, view]);

  const stats = useMemo(() => {
    const activeMonth = view === 'history' ? historyMonth : currentMonth;
    const paidClients = clients.filter(c => c.payments[activeMonth]);
    const unpaidClients = clients.filter(c => !c.payments[activeMonth]);
    return {
      total: clients.length,
      paid: paidClients.length,
      paidMoney: paidClients.reduce((s, c) => s + getRealPrice(c.price || 0, c.paymentMethod), 0),
      unpaidMoney: unpaidClients.reduce((s, c) => s + getRealPrice(c.price || 0, c.paymentMethod), 0),
    };
  }, [clients, currentMonth, historyMonth, view, getRealPrice]);

  const handleReset = () => {
    if (window.confirm('Reset all payments for this month?')) resetPayments(currentMonth);
  };

  const handleExportPDF = () => {
    if (!window.jspdf) { alert('PDF library loading…'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const monthLabel = monthOptions.find(m => m.key === historyMonth)?.label || historyMonth;
    doc.setFontSize(22); doc.setTextColor(79, 70, 229);
    doc.text('Alyx — Monthly Report', 14, 22);
    doc.setFontSize(11); doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${monthLabel}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);
    doc.setDrawColor(226, 232, 240); doc.line(14, 42, 196, 42);
    doc.setFontSize(10); doc.setTextColor(30, 41, 59);
    doc.text(`Total: ${stats.total}  |  Paid: ${stats.paid}`, 14, 52);
    doc.text(`Collected (Net): $${stats.paidMoney.toFixed(2)}  |  Pending (Net): $${stats.unpaidMoney.toFixed(2)}`, 14, 58);
    doc.autoTable({
      startY: 65,
      head: [['Customer', 'Method', 'Price', 'Net', 'Status']],
      body: clients.map(c => {
        const paid = !!c.payments[historyMonth];
        return [c.name, c.paymentMethod || '-', `$${parseFloat(c.price||0).toFixed(2)}`, `$${getRealPrice(c.price, c.paymentMethod).toFixed(2)}`, paid ? 'PAID' : 'UNPAID'];
      }).sort((a, b) => a[0].localeCompare(b[0])),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9 }
    });
    doc.save(`Alyx_Report_${historyMonth}.pdf`);
  };

  const validateForm = (fd) => {
    const errors = {};
    const name = fd.get('name')?.trim();
    const price = parseFloat(fd.get('price'));
    const day = parseInt(fd.get('day'), 10);

    if (!name) errors.name = 'Name is required';
    if (isNaN(price) || price <= 0) errors.price = 'Enter a valid price greater than 0';
    if (isNaN(day) || day < 1 || day > 31) errors.day = 'Day must be between 1 and 31';
    return errors;
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errors = validateForm(fd);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    addClient({
      name: fd.get('name').trim(),
      paymentMethod: fd.get('method'),
      paymentDay: parseInt(fd.get('day'), 10),
      price: parseFloat(fd.get('price')),
    });
    setIsAddModalOpen(false);
    e.target.reset();
  };

  const NAV_TABS = [
    { id: 'list', label: 'List' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <div className="alyx-gradient pb-32 pt-10 px-6 sm:px-10 rounded-b-[2rem] shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <span className="text-white font-black text-lg">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Alyx</h1>
              <p className="text-white/70 text-xs mt-0.5">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-white text-indigo-600 py-2.5 px-4 rounded-full font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add</span>
            </button>
            <button
              onClick={() => setView(v => v === 'settings' ? 'list' : 'settings')}
              title="Settings"
              className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-colors', view === 'settings' ? 'bg-white text-indigo-600' : 'bg-white/20 hover:bg-white/30 text-white')}
            >
              <Settings size={18} />
            </button>
            <button onClick={logout} title="Sign out" className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-20">

        {view === 'settings' ? (
          <SettingsPage settings={settings} updateSettings={updateSettings} addClient={addClient} />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Customers', value: stats.total, icon: <Users size={18} />, color: 'text-slate-400' },
                { label: 'Paid', value: stats.paid, icon: <CheckCircle2 size={18} />, color: 'text-emerald-400' },
                { label: 'Collected', value: `$${stats.paidMoney.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, icon: <Wallet size={18} />, color: 'text-indigo-400', accent: true },
                { label: 'Pending', value: `$${stats.unpaidMoney.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, icon: <Circle size={18} />, color: 'text-rose-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                  <div className="flex items-end justify-between mt-2">
                    <p className={cn('text-2xl font-bold', stat.accent ? 'text-indigo-600' : stat.label === 'Paid' ? 'text-emerald-600' : 'text-slate-800')}>{stat.value}</p>
                    <span className={stat.color}>{stat.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col space-y-4 mb-8">
              <div className="flex items-center justify-between gap-2">
                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                  {NAV_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id)} className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all', view === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50')}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {view !== 'history' && (
                  <button onClick={handleReset} className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 hover:bg-rose-100 px-4 py-2.5 rounded-xl transition-colors border border-rose-100 shrink-0">Reset</button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-2 px-2">
                {view === 'history' ? (
                  <>
                    <select value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} className="bg-white border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-sm font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none flex-1 max-w-xs">
                      {monthOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                    </select>
                    <button onClick={handleExportPDF} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0">
                      <Download size={16} /> PDF
                    </button>
                  </>
                ) : (
                  ['all','paid','unpaid','zelle','square'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={cn('px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-tight transition-all whitespace-nowrap border shadow-sm', filter === f ? 'bg-slate-800 text-white border-slate-800 scale-105' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200')}>
                      {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : f === 'unpaid' ? 'Unpaid' : f === 'zelle' ? 'Zelle' : 'Square'}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Calendar View */}
            {view === 'calendar' ? (
              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 overflow-hidden mb-10">
                <div className="grid grid-cols-7 mb-4 pb-2 border-b border-slate-50">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarDays.map((day, idx) => {
                    const dayClients = filteredClients.filter(c => c.paymentDay === day);
                    return (
                      <div key={idx} className={cn('min-h-[70px] sm:min-h-[90px] rounded-xl p-1 sm:p-2 transition-all group', day ? 'bg-slate-50/50 hover:bg-slate-100/50 border border-transparent' : 'opacity-0 pointer-events-none')}>
                        {day && (
                          <>
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600">{day}</span>
                            <div className="mt-1 space-y-0.5">
                              {dayClients.map(c => {
                                const paid = !!c.payments[currentMonth];
                                return (
                                  <button key={c.id} onClick={() => togglePayment(c.id, currentMonth)}
                                    className={cn('w-full p-0.5 rounded text-[8px] font-medium truncate flex items-center gap-1 transition-all', paid ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-700 border border-slate-200 shadow-sm')}
                                    title={`${c.name} - ${paid ? 'Paid' : 'Unpaid'}`}>
                                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', paid ? 'bg-emerald-500' : 'bg-rose-500')} />
                                    <span className="truncate">{c.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* List / History View */
              <div className="space-y-3 mb-10">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4"><Users size={32} /></div>
                    <h3 className="text-slate-700 font-semibold text-lg">No customers found</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      {view === 'history' ? `No payments for ${monthOptions.find(m => m.key === historyMonth)?.label}.` : 'Add your first customer to get started.'}
                    </p>
                  </div>
                ) : (
                  filteredClients.map(client => {
                    const activeMonth = view === 'history' ? historyMonth : currentMonth;
                    const isPaid = !!client.payments[activeMonth];
                    return (
                      <div key={client.id} className={cn('bg-white rounded-2xl p-4 shadow-sm border transition-all hover:shadow-md flex items-center justify-between gap-4', isPaid ? 'border-emerald-100' : 'border-slate-100')}>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => view !== 'history' && togglePayment(client.id, currentMonth)}
                            disabled={view === 'history'}
                            className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90', isPaid ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200')}
                          >
                            <CheckCircle2 size={isPaid ? 24 : 20} className={isPaid ? '' : 'opacity-30'} />
                          </button>
                          <div>
                            <h3 className="font-semibold text-slate-800">{client.name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border', client.paymentMethod === 'Zelle' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-blue-50 text-blue-700 border-blue-100')}>
                                <Wallet size={10} />
                                {client.paymentMethod} · ${parseFloat(client.price||0).toLocaleString()}
                                {client.paymentMethod === 'Square' && (
                                  <span className="opacity-60 ml-1 lowercase italic font-normal">(${getRealPrice(client.price, client.paymentMethod).toFixed(2)})</span>
                                )}
                              </span>
                              <span className="text-slate-400 text-[10px] italic">Day {client.paymentDay || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('hidden sm:flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                            {isPaid ? 'PAID' : 'UNPAID'}
                          </span>
                          {view !== 'history' && (
                            <button
                              onClick={() => window.confirm(`Delete ${client.name}?`) && removeClient(client.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setFormErrors({}); }} title="New Customer">
        <form onSubmit={handleAddSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input name="name" type="text" placeholder="e.g. John Doe" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
            {formErrors.name && <p className="text-rose-500 text-xs mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price ($)</label>
            <input name="price" type="number" placeholder="150.00" step="0.01" min="0.01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
            {formErrors.price && <p className="text-rose-500 text-xs mt-1">{formErrors.price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Day (1–31)</label>
            <input name="day" type="number" min="1" max="31" placeholder="15" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
            {formErrors.day && <p className="text-rose-500 text-xs mt-1">{formErrors.day}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
            <select name="method" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none text-sm">
              <option value="Zelle">Zelle</option>
              <option value="Square">Square</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] shadow-md text-sm">
            Save Customer
          </button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, login, logout } = useAuth();
  const { settings, updateSettings } = useSettings();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={login} />;

  return <AppContent user={user} logout={logout} settings={settings} updateSettings={updateSettings} />;
}

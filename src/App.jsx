import { useState, useMemo } from 'react';
import { useClients, getCurrentMonthKey } from './hooks/useClients';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import { Users, CheckCircle2, Circle, Plus, Wallet, Trash2, X, Download, History, LogOut } from 'lucide-react';
import { cn } from './lib/utils';

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, token, loading: authLoading, login, logout } = useAuth();
  const { clients, addClient, togglePayment, removeClient, resetPayments } = useClients();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonthKey());

  // Auth gate — must be after all hooks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <LoginPage onLogin={login} />;
  }
  
  const currentMonth = getCurrentMonthKey();

  // Square Fee Helper (3.3% + $0.30)
  const getRealPrice = (price, method) => {
    if (!price || price <= 0) return 0;
    if (method === 'Square') {
      const net = price * (1 - 0.033) - 0.30;
      return Math.max(0, net);
    }
    return price;
  };

  // Calendar Logic
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay(); // 0 is Sunday
  
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [daysInMonth, firstDayOfMonth]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all payments for this month? This action cannot be undone.')) {
      resetPayments(currentMonth);
    }
  };

  // Month selector for history (last 12 months)
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
      const pMethod = c.paymentMethod || c.payment_method;
      
      if (filter === 'paid') return isPaid;
      if (filter === 'unpaid') return !isPaid;
      if (filter === 'zelle') return pMethod === 'Zelle';
      if (filter === 'square') return pMethod === 'Square';
      return true;
    }).sort((a, b) => (a.paymentDay || a.payment_day) - (b.paymentDay || b.payment_day));
  }, [clients, filter, currentMonth, historyMonth, view]);

  const stats = useMemo(() => {
    const activeMonth = view === 'history' ? historyMonth : currentMonth;
    const total = clients.length;
    const paidClients = clients.filter(c => c.payments[activeMonth]);
    const unpaidClients = clients.filter(c => !c.payments[activeMonth]);
    
    const paidMoney = paidClients.reduce((sum, c) => {
      const pMethod = c.paymentMethod || c.payment_method;
      return sum + getRealPrice(c.price || 0, pMethod);
    }, 0);
    const unpaidMoney = unpaidClients.reduce((sum, c) => {
      const pMethod = c.paymentMethod || c.payment_method;
      return sum + getRealPrice(c.price || 0, pMethod);
    }, 0);

    return {
      total,
      paid: paidClients.length,
      unpaid: total - paidClients.length,
      paidMoney,
      unpaidMoney
    };
  }, [clients, currentMonth, historyMonth, view]);

  // PDF Generation Logic
  const handleExportPDF = () => {
    if (!window.jspdf) {
      alert("PDF library is still loading. Please try again in a few seconds.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const monthLabel = monthOptions.find(m => m.key === historyMonth)?.label || historyMonth;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text("MamiApp monthly report", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Period: ${monthLabel}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);

    // Summary Stats
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(14, 42, 196, 42);

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(`Total Customers: ${stats.total}`, 14, 52);
    doc.text(`Paid: ${stats.paid}`, 60, 52);
    doc.text(`Collected (Net): $${stats.paidMoney.toFixed(2)}`, 110, 52);
    doc.text(`Pending (Net): $${stats.unpaidMoney.toFixed(2)}`, 110, 58);

    // Table
    const tableHeaders = [["Customer", "Method", "Original Price", "Net Income", "Status"]];
    const tableData = clients.map(c => {
      const pMethod = c.paymentMethod || c.payment_method || '-';
      const isPaid = !!c.payments[historyMonth];
      const real = getRealPrice(c.price, pMethod);
      return [
        c.name,
        pMethod,
        `$${parseFloat(c.price || 0).toFixed(2)}`,
        `$${real.toFixed(2)}`,
        isPaid ? "PAID" : "UNPAID"
      ];
    }).sort((a, b) => a[0].localeCompare(b[0]));

    doc.autoTable({
      startY: 65,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9 }
    });

    doc.save(`MamiApp_Report_${historyMonth}.pdf`);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    addClient({
      name: fd.get('name'),
      paymentMethod: fd.get('method'),
      paymentDay: parseInt(fd.get('day'), 10),
      price: parseFloat(fd.get('price') || 0)
    });
    setIsAddModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 pb-32 pt-10 px-6 sm:px-10 rounded-b-[2rem] shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Customer Records</h1>
            <p className="text-violet-200 mt-1">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-white text-indigo-600 py-2.5 px-5 rounded-full font-medium shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">New Customer</span>
            </button>
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-20">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium">Customers</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <Users size={20} className="text-slate-400 mb-1" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium">Paid</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
              <CheckCircle2 size={20} className="text-emerald-400 mb-1" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Collected (Net)</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-indigo-600">${stats.paidMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <Wallet size={20} className="text-indigo-400 mb-1" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pending (Net)</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-rose-500">${stats.unpaidMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <Circle size={20} className="text-rose-400 mb-1" />
            </div>
          </div>
        </div>

        {/* Filters and View Toggles */}
        <div className="flex flex-col space-y-5 mb-8">
          {/* Top Row: View Toggle & Reset */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
              <button 
                onClick={() => setView('list')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  view === 'list' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                List
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  view === 'calendar' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                Calendar
              </button>
              <button 
                onClick={() => setView('history')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  view === 'history' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <History size={16} />
                History
              </button>
            </div>

            {view !== 'history' && (
              <button
                onClick={handleReset}
                className="text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2.5 rounded-xl transition-colors border border-rose-100 shadow-sm shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Bottom Row: Month Selector (if history) or Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-2 px-2">
            {view === 'history' ? (
              <div className="flex items-center gap-3 w-full">
                <select
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-sm font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none flex-1 max-w-xs"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleExportPDF}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Download size={18} />
                  Download PDF Report
                </button>
              </div>
            ) : (
              ['all', 'paid', 'unpaid', 'zelle', 'square'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-tight transition-all whitespace-nowrap border shadow-sm",
                    filter === f 
                      ? "bg-slate-800 text-white border-slate-800 scale-105" 
                      : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                  )}
                >
                  {f === 'all' && 'All'}
                  {f === 'paid' && 'Paid'}
                  {f === 'unpaid' && 'Unpaid'}
                  {f === 'zelle' && 'Zelle'}
                  {f === 'square' && 'Square'}
                </button>
              ))
            )}
          </div>
        </div>

        {/* View Content */}
        {view === 'calendar' ? (
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 overflow-hidden mb-10">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-50 pb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((day, idx) => {
                const dayClients = filteredClients.filter(c => (c.paymentDay || c.payment_day) === day);
                return (
                  <div key={idx} className={cn(
                    "min-h-[70px] sm:min-h-[100px] rounded-xl sm:rounded-2xl p-1 sm:p-2 transition-all relative group",
                    day ? "bg-slate-50/50 hover:bg-slate-100/50 border border-transparent" : "opacity-0 pointer-events-none"
                  )}>
                    {day && (
                      <>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 group-hover:text-indigo-600">{day}</span>
                        <div className="mt-1 space-y-1">
                          {dayClients.map(client => {
                            const isPaid = !!client.payments[currentMonth];
                            return (
                              <button
                                key={client.id}
                                onClick={() => view !== 'history' && togglePayment(client.id, currentMonth)}
                                className={cn(
                                  "w-full text-left p-0.5 sm:p-1 rounded-md text-[8px] sm:text-[10px] font-medium truncate flex items-center gap-1 transition-all active:scale-95",
                                  isPaid 
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                                    : "bg-white text-slate-700 border border-slate-200 shadow-sm"
                                )}
                                title={`${client.name} - ${isPaid ? 'Paid' : 'Unpaid'}`}
                              >
                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isPaid ? "bg-emerald-500" : "bg-rose-500")} />
                                <span className="truncate">{client.name}</span>
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
          <div className="space-y-4 mb-10">
            {filteredClients.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4">
                  <Users size={32} />
                </div>
                <h3 className="text-slate-700 font-medium text-lg">No customers found</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {view === 'history' ? `There are no payments registered for ${monthOptions.find(m => m.key === historyMonth)?.label}.` : 'Add your first customer to get started.'}
                </p>
              </div>
            ) : (
              filteredClients.map(client => {
                const activeMonth = view === 'history' ? historyMonth : currentMonth;
                const isPaid = !!client.payments[activeMonth];
                const pMethod = client.paymentMethod || client.payment_method || 'Unknown';
                const pDay = client.paymentDay || client.payment_day || '-';
                
                return (
                  <div 
                    key={client.id} 
                    className={cn(
                      "bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all hover:shadow-md flex items-center justify-between gap-4",
                      isPaid ? "border-emerald-100 bg-emerald-50/10" : "border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => view !== 'history' && togglePayment(client.id, currentMonth)}
                        disabled={view === 'history'}
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm active:scale-90",
                          isPaid ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        )}
                      >
                        <CheckCircle2 size={isPaid ? 28 : 24} className={isPaid ? "" : "opacity-30"} />
                      </button>
                      <div>
                        <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                          {client.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className={cn(
                            "flex flex-wrap items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight shadow-sm border",
                            pMethod === 'Zelle' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            pMethod === 'Square' ? "bg-blue-50 text-blue-700 border-blue-100" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            <Wallet size={12} />
                            {pMethod} - ${parseFloat(client.price || 0).toLocaleString()}
                            {pMethod === 'Square' && (
                              <span className="opacity-60 ml-1 text-[9px] lowercase italic border-l border-blue-200 pl-1">
                                (${getRealPrice(client.price, pMethod).toFixed(2)} real)
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 text-xs font-medium bg-white px-2 py-1 rounded-lg border border-slate-100 italic">
                            Paid on day {pDay}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "hidden sm:flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        isPaid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {isPaid ? "PAID" : "UNPAID"}
                      </div>
                      {view !== 'history' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete ${client.name}?`)) {
                              removeClient(client.id);
                            }
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Customer">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input 
              required
              name="name"
              type="text" 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
            <select 
              name="method"
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none"
            >
              <option value="Zelle">Zelle</option>
              <option value="Square">Square</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price / Rate ($)</label>
            <input 
              required
              name="price"
              type="number" 
              step="0.01"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. 150.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Day (1 to 31)</label>
            <input 
              required
              name="day"
              type="number" 
              min="1"
              max="31"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. 15"
            />
          </div>
          <button 
            type="submit"
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            Save Customer
          </button>
        </form>
      </Modal>

    </div>
  );
}

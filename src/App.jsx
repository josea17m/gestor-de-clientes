import { useState, useMemo } from 'react';
import { useClients, getCurrentMonthKey } from './hooks/useClients';
import { Users, CheckCircle2, Circle, Plus, Wallet, Trash2, X } from 'lucide-react';
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
  const { clients, addClient, togglePayment, removeClient, resetPayments } = useClients();
  const [filter, setFilter] = useState('all'); // 'all', 'paid', 'unpaid'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const currentMonth = getCurrentMonthKey();

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de que quieres reiniciar todos los pagos de este mes? Esta acción no se puede deshacer.')) {
      resetPayments(currentMonth);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const isPaid = !!c.payments[currentMonth];
      const pMethod = c.paymentMethod || c.payment_method;
      
      if (filter === 'paid') return isPaid;
      if (filter === 'unpaid') return !isPaid;
      if (filter === 'zelle') return pMethod === 'Zelle';
      if (filter === 'square') return pMethod === 'Square';
      return true;
    }).sort((a, b) => a.paymentDay - b.paymentDay);
  }, [clients, filter, currentMonth]);

  const stats = useMemo(() => {
    const total = clients.length;
    const paidClients = clients.filter(c => c.payments[currentMonth]);
    const unpaidClients = clients.filter(c => !c.payments[currentMonth]);
    
    const paidMoney = paidClients.reduce((sum, c) => sum + (c.price || 0), 0);
    const unpaidMoney = unpaidClients.reduce((sum, c) => sum + (c.price || 0), 0);

    return {
      total,
      paid: paidClients.length,
      unpaid: total - paidClients.length,
      paidMoney,
      unpaidMoney
    };
  }, [clients, currentMonth]);

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
            <h1 className="text-3xl font-bold text-white tracking-tight">Registro de Clientes</h1>
            <p className="text-violet-200 mt-1">Control de pagos mensuales</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-white text-indigo-600 py-2.5 px-5 rounded-full font-medium shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-20">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium">Clientes</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <Users size={20} className="text-slate-400 mb-1" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium">Pagados</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
              <CheckCircle2 size={20} className="text-emerald-400 mb-1" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium">Recaudado</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-indigo-600">${stats.paidMoney.toLocaleString()}</p>
              <Wallet size={20} className="text-indigo-400 mb-1" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium">Por Recaudar</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-bold text-rose-500">${stats.unpaidMoney.toLocaleString()}</p>
              <Circle size={20} className="text-rose-400 mb-1" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:pb-0">
            {['all', 'paid', 'unpaid', 'zelle', 'square'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  filter === f 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
              >
                {f === 'all' && 'Todos'}
                {f === 'paid' && 'Pagados'}
                {f === 'unpaid' && 'Pendientes'}
                {f === 'zelle' && 'Zelle'}
                {f === 'square' && 'Square'}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-lg transition-colors border border-rose-100"
          >
            Reiniciar Mes
          </button>
        </div>

        {/* List */}
        <div className="space-y-4">
          {filteredClients.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4">
                <Users size={32} />
              </div>
              <h3 className="text-slate-700 font-medium text-lg">No hay clientes aquí</h3>
              <p className="text-slate-500 text-sm mt-1">
                {filter === 'all' ? 'Añade tu primer cliente pulsando "Nuevo Cliente".' : 'Cambia de filtro para ver otros clientes.'}
              </p>
            </div>
          ) : (
            filteredClients.map(client => {
              const isPaid = !!client.payments[currentMonth];
              // Safety fallback for properties (handle both camelCase and snake_case)
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
                      onClick={() => togglePayment(client.id, currentMonth)}
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
                          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-tight shadow-sm border",
                          pMethod === 'Zelle' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          pMethod === 'Square' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          pMethod === 'Cash' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                        )}>
                          <Wallet size={12} />
                          {pMethod} - ${parseFloat(client.price || 0).toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-xs font-medium bg-white px-2 py-1 rounded-lg border border-slate-100 italic">
                          Paga el día {pDay}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "hidden sm:flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      isPaid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {isPaid ? "PAGADO" : "PENDIENTE"}
                    </div>
                    {/* Delete button option just to have complete management */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`¿Seguro que deseas eliminar a ${client.name}?`)) {
                          removeClient(client.id);
                        }
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Eliminar cliente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nuevo Cliente">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
            <input 
              required
              name="name"
              type="text" 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Precio / Tarifa Mensual ($)</label>
            <input 
              required
              name="price"
              type="number" 
              step="0.01"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="Ej. 150.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Día de Pago (1 al 31)</label>
            <input 
              required
              name="day"
              type="number" 
              min="1"
              max="31"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="Ej. 15"
            />
          </div>
          <button 
            type="submit"
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            Guardar Cliente
          </button>
        </form>
      </Modal>

    </div>
  );
}

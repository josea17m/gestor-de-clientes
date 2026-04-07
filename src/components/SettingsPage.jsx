import { useState, useRef } from 'react';
import { Moon, Sun, Palette, Upload, FileSpreadsheet, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const ACCENT_COLORS = [
  { id: 'violet', label: 'Violet', from: '#7c3aed', to: '#4f46e5' },
  { id: 'blue',   label: 'Blue',   from: '#2563eb', to: '#0284c7' },
  { id: 'rose',   label: 'Rose',   from: '#e11d48', to: '#db2777' },
  { id: 'emerald',label: 'Emerald',from: '#059669', to: '#0d9488' },
  { id: 'amber',  label: 'Amber',  from: '#d97706', to: '#ea580c' },
  { id: 'sky',    label: 'Sky',    from: '#0284c7', to: '#0891b2' },
];

export default function SettingsPage({ settings, updateSettings, addClient }) {
  const fileRef = useRef(null);
  const [importRows, setImportRows] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportSuccess(false);
    setImportRows(null);

    if (!window.XLSX) {
      setImportError('Excel library is still loading. Try again in a moment.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = window.XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

        const rows = raw.map(row => {
          // Support both English and Spanish headers
          const name = String(row.Name || row.name || row.Nombre || row.nombre || '').trim();
          const method = String(row.Method || row.method || row.Método || row.metodo || row.Payment || 'Zelle').trim();
          const day = parseInt(row.Day || row.day || row.Día || row.dia || row['Payment Day'] || 1);
          const price = parseFloat(row.Price || row.price || row.Precio || row.precio || 0);

          // Normalize payment method
          const normalizedMethod = method.toLowerCase().includes('square') ? 'Square' : 'Zelle';

          return { name, paymentMethod: normalizedMethod, paymentDay: isNaN(day) ? 1 : day, price: isNaN(price) ? 0 : price };
        }).filter(r => r.name.length > 0);

        if (rows.length === 0) {
          setImportError('No valid rows found. Make sure the file has a "Name" column.');
          return;
        }
        setImportRows(rows);
      } catch (err) {
        setImportError('Failed to parse file. Make sure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!importRows || importing) return;
    setImporting(true);
    for (const row of importRows) {
      await addClient(row);
    }
    setImporting(false);
    setImportSuccess(true);
    setImportRows(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      handleFileChange({ target: fileRef.current });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6 mb-10">

      {/* Appearance */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Palette size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Appearance</h2>
            <p className="text-xs text-slate-500">Customize how Alyx looks</p>
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {settings.darkMode ? <Moon size={18} className="text-indigo-600" /> : <Sun size={18} className="text-amber-500" />}
            <div>
              <p className="font-semibold text-slate-800 text-sm">Dark Mode</p>
              <p className="text-xs text-slate-500">{settings.darkMode ? 'Dark theme active' : 'Light theme active'}</p>
            </div>
          </div>
          {/* Toggle Switch */}
          <button
            onClick={() => updateSettings({ darkMode: !settings.darkMode })}
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner',
              settings.darkMode ? 'bg-indigo-600' : 'bg-slate-200'
            )}
          >
            <span className={cn(
              'inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-300',
              settings.darkMode ? 'translate-x-6' : 'translate-x-1'
            )} />
          </button>
        </div>

        {/* Accent Color */}
        <div className="pt-4">
          <p className="font-semibold text-slate-800 text-sm mb-3">Accent Color</p>
          <div className="grid grid-cols-6 gap-2">
            {ACCENT_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => updateSettings({ accentColor: color.id })}
                title={color.label}
                className={cn(
                  'relative h-10 rounded-xl transition-all duration-200',
                  settings.accentColor === color.id
                    ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                )}
                style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
              >
                {settings.accentColor === color.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {ACCENT_COLORS.map(color => (
              <p key={color.id} className={cn('text-[10px] text-center flex-1 text-slate-400', settings.accentColor === color.id && 'font-bold text-slate-700')}>
                {color.label}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Import from Excel */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FileSpreadsheet size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Import from Excel</h2>
            <p className="text-xs text-slate-500">Upload a .xlsx or .csv file to add customers in bulk</p>
          </div>
        </div>

        {/* Template info */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-2">Required columns:</p>
          <div className="flex flex-wrap gap-2">
            {['Name', 'Method (Zelle/Square)', 'Day (1-31)', 'Price'].map(col => (
              <span key={col} className="bg-white text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-lg font-mono shadow-sm">{col}</span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Spanish headers also supported: Nombre, Método, Día, Precio</p>
        </div>

        {/* Drop Zone */}
        {!importRows && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <Upload size={28} className="mx-auto text-slate-300 group-hover:text-indigo-400 transition-colors mb-3" />
            <p className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">Click or drag & drop your file here</p>
            <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv supported</p>
          </div>
        )}

        {/* Error */}
        {importError && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm">{importError}</p>
          </div>
        )}

        {/* Success */}
        {importSuccess && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-4">
            <CheckCircle2 size={18} className="shrink-0" />
            <p className="text-sm font-semibold">Customers imported successfully!</p>
          </div>
        )}

        {/* Preview */}
        {importRows && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">{importRows.length} customers ready to import</p>
              <button onClick={() => { setImportRows(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Method</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Day</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5 text-slate-800 font-medium">{row.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', row.paymentMethod === 'Square' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700')}>
                            {row.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{row.paymentDay}</td>
                        <td className="px-4 py-2.5 text-slate-600">${row.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importRows.length > 8 && (
                <div className="px-4 py-2 bg-slate-50 text-xs text-slate-400 text-center">
                  ... and {importRows.length - 8} more
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</>
                ) : (
                  <><CheckCircle2 size={18} /> Import {importRows.length} Customers</>
                )}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
              >
                Choose different file
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl alyx-gradient flex items-center justify-center shadow-md">
            <span className="text-white font-black text-lg">A</span>
          </div>
          <div>
            <p className="font-black text-slate-900 text-lg tracking-tight">Alyx</p>
            <p className="text-xs text-slate-400">Customer payment management</p>
          </div>
        </div>
      </div>

    </div>
  );
}

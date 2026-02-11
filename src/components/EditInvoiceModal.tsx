import { useState, useEffect } from 'react';
import { X, Save, FileText, AlertCircle, HelpCircle } from 'lucide-react';

interface EditInvoiceModalProps {
  invoice: any;
  onClose: () => void;
  onSave: (updatedInvoice: any) => void;
}

// Słownik kodów GTU z opisami dla użytkownika
const GTU_CODES = [
  { code: '', label: 'Brak (Towary/Usługi ogólne)' },
  { code: 'GTU_01', label: 'GTU_01: Napoje alkoholowe' },
  { code: 'GTU_02', label: 'GTU_02: Paliwa i oleje napędowe' },
  { code: 'GTU_03', label: 'GTU_03: Oleje opałowe i smarowe' },
  { code: 'GTU_04', label: 'GTU_04: Wyroby tytoniowe' },
  { code: 'GTU_05', label: 'GTU_05: Odpady, złom, surowce wtórne' },
  { code: 'GTU_06', label: 'GTU_06: Urządzenia elektroniczne (tonery, folie)' },
  { code: 'GTU_07', label: 'GTU_07: Pojazdy i części samochodowe' },
  { code: 'GTU_08', label: 'GTU_08: Metale szlachetne i biżuteria' },
  { code: 'GTU_09', label: 'GTU_09: Leki i wyroby medyczne' },
  { code: 'GTU_10', label: 'GTU_10: Budynki, budowle i grunty' },
  { code: 'GTU_11', label: 'GTU_11: Uprawnienia do emisji gazów' },
  { code: 'GTU_12', label: 'GTU_12: Usługi niematerialne (Doradcze, Prawne, Zarządcze, Marketingowe)' },
  { code: 'GTU_13', label: 'GTU_13: Usługi transportowe i magazynowe' }
];

export function EditInvoiceModal({ invoice, onClose, onSave }: EditInvoiceModalProps) {
  // Kopiujemy dane faktury do stanu lokalnego edycji
  const [formData, setFormData] = useState({
    ...invoice,
    // Upewniamy się, że amount jest liczbą
    amount: typeof invoice.amount === 'number' ? invoice.amount : parseFloat(invoice.amount || 0),
    // Domyślnie brak GTU
    gtu_code: invoice.gtu_code || ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Prosta walidacja
    if (!formData.invoice_number) return alert("Numer faktury jest wymagany!");
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* Nagłówek */}
        <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-white">
              <FileText className="text-blue-500" size={24}/> Edycja Faktury
            </h3>
            <p className="text-xs text-gray-500 mt-1">ID: {invoice.id} • Edycja manualna danych</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
            <X size={24} />
          </button>
        </div>

        {/* Formularz */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Sekcja 1: Podstawowe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Numer Faktury</label>
              <input 
                type="text" 
                value={formData.invoice_number || ''} 
                onChange={(e) => handleChange('invoice_number', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Data Wystawienia</label>
              <input 
                type="date" 
                value={formData.date || ''} 
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Sekcja 2: Kontrahent */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 space-y-3">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-400 mb-2">Dane Kontrahenta</h4>
            <div>
              <label className="block text-xs font-bold uppercase text-blue-700/70 dark:text-blue-400/70 mb-1">Nazwa</label>
              <input 
                type="text" 
                value={formData.contractor_name || ''} 
                onChange={(e) => handleChange('contractor_name', e.target.value)}
                className="w-full p-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold uppercase text-blue-700/70 dark:text-blue-400/70 mb-1">NIP</label>
                    <input 
                        type="text" 
                        value={formData.contractor_nip || ''} 
                        onChange={(e) => handleChange('contractor_nip', e.target.value)}
                        className="w-full p-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-mono"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-blue-700/70 dark:text-blue-400/70 mb-1">Adres</label>
                    <input 
                        type="text" 
                        value={formData.contractor_address || ''} 
                        onChange={(e) => handleChange('contractor_address', e.target.value)}
                        className="w-full p-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-sm"
                    />
                </div>
            </div>
          </div>

          {/* Sekcja 3: Kwoty i JPK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Kwota Brutto (PLN)</label>
                <input 
                    type="number" 
                    step="0.01"
                    value={formData.amount} 
                    onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg font-mono font-bold text-lg text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
             
             {/* NOWOŚĆ: WYBÓR KODU GTU */}
             <div>
                <label className="block text-xs font-bold uppercase text-amber-600 mb-1 flex items-center gap-1">
                    Kod GTU (Tylko Sprzedaż) <HelpCircle size={12}/>
                </label>
                <select 
                    value={formData.gtu_code} 
                    onChange={(e) => handleChange('gtu_code', e.target.value)}
                    className="w-full p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm font-bold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                >
                    {GTU_CODES.map((gtu) => (
                        <option key={gtu.code} value={gtu.code}>
                            {gtu.label}
                        </option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Wybierz odpowiedni kod, jeśli faktura dokumentuje sprzedaż towarów wrażliwych lub usług specjalnych.</p>
             </div>
          </div>

          {/* Notatki */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Notatki / Opis zdarzenia</label>
            <textarea 
                rows={3}
                value={formData.notes || ''} 
                onChange={(e) => handleChange('notes', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-sm">
            Anuluj
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all active:scale-95 text-sm">
            <Save size={18} /> Zapisz Zmiany
          </button>
        </div>

      </div>
    </div>
  );
}
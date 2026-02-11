import { 
  Check, X, Edit2, Trash2, Code, RotateCcw, 
  ShieldCheck, RefreshCcw, MapPin, Paperclip, FileText, ExternalLink, 
  Square, CheckSquare, MessageSquare, Save, History // <--- DODANO History
} from 'lucide-react';
import { useRef, useState } from 'react'; 
import { supabase } from '../lib/supabase';

interface InvoiceTableProps {
  invoices: any[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (invoice: any) => void;
  onRevert: (id: number) => void;
  onGetUPO: (id: number) => void;
  onUploadAttachment: (invoiceId: number, file: File) => void;
  onUpdateNote: (id: number, note: string) => void;
  onShowHistory?: (invoice: any) => void; // <--- DODANO DO INTERFEJSU (NAPRAWIA BŁĄD)
  onViewXML?: (invoice: any) => void;
  loading: boolean;
}

export function InvoiceTable({ 
  invoices, selectedIds, onToggleSelect, onSelectAll, 
  onApprove, onReject, onDelete, onEdit, 
  onRevert, onGetUPO, onUploadAttachment, onUpdateNote, onShowHistory, onViewXML, loading 
}: InvoiceTableProps) {
  const fileInputRef = useRef<{ [key: number]: HTMLInputElement | null }>({});
  
  // --- STANY DO EDYCJI NOTATKI ---
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Sprawdzamy, czy wszystkie ZATWIERDZONE faktury są zaznaczone
  const approvedInvoices = invoices.filter(i => i.status === 'approved');
  const isAllSelected = approvedInvoices.length > 0 && approvedInvoices.every(i => selectedIds.includes(i.id));

  const handleViewAttachment = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('invoice-attachments')
        .createSignedUrl(path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error("Błąd generowania linku:", err);
      alert("Błąd dostępu do pliku.");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Synchronizacja danych...</div>;
  if (invoices.length === 0) return <div className="p-8 text-center text-gray-500 font-medium">Brak faktur do wyświetlenia.</div>;

  return (
    <div className="overflow-x-auto min-h-[400px]">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase text-[10px] tracking-widest border-b dark:border-gray-700">
          <tr>
            <th className="px-6 py-4 w-10 text-center">
              <button 
                onClick={onSelectAll} 
                title="Zaznacz wszystkie zatwierdzone" 
                className="text-blue-600 hover:scale-110 transition-transform"
              >
                {isAllSelected ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
            </th>

            <th className="px-6 py-4">Dokument & UPO</th>
            <th className="px-6 py-4">Kontrahent & Załączniki</th>
            <th className="px-6 py-4">Adres Siedziby</th>
            <th className="px-6 py-4 text-right">Kwota Brutto</th>
            <th className="px-6 py-4">Status AI</th>
            <th className="px-6 py-4 text-right">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {invoices.map((inv) => {
            const isSelected = selectedIds.includes(inv.id);
            const isApproved = inv.status === 'approved';

            return (
              <tr 
                key={inv.id} 
                className={`transition-colors group ${
                  isSelected 
                    ? 'bg-blue-50/80 dark:bg-blue-900/20' 
                    : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
                }`}
              >
                {/* 0. KOLUMNA CHECKBOX */}
                <td className="px-6 py-4 text-center">
                  <button 
                    disabled={!isApproved} 
                    onClick={() => onToggleSelect(inv.id)}
                    className={`transition-colors ${
                      !isApproved 
                        ? 'text-gray-200 dark:text-gray-800 cursor-not-allowed' 
                        : isSelected ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'
                    }`}
                  >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </td>

                {/* 1. DOKUMENT */}
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{inv.invoice_number}</span>
                    <div className="flex items-center gap-2">
                      {inv.upo_status === 'received' ? (
                        <div className="flex items-center gap-1 text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-500/20 font-bold">
                          <ShieldCheck size={10} /> {inv.upo_reference}
                        </div>
                      ) : (
                        <button onClick={() => onGetUPO(inv.id)} className="text-[9px] text-gray-400 hover:text-blue-600 underline flex items-center gap-1">
                          <RefreshCcw size={10} className={inv.upo_status === 'pending' ? 'animate-spin' : ''} /> 
                          {inv.upo_status === 'pending' ? 'Pobieranie...' : 'Pobierz UPO'}
                        </button>
                      )}
                    </div>
                  </div>
                </td>

                {/* 2. KONTRAHENT + NOTATKI */}
                <td className="px-6 py-4">
                  <div className="flex flex-col relative">
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-base">{inv.contractor_name}</div>
                    
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      {/* Załączniki */}
                      {inv.attachments?.map((at: any) => (
                        <button 
                          key={at.id}
                          onClick={() => handleViewAttachment(at.storage_path)}
                          className="flex items-center gap-1 text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <FileText size={10} /> {at.file_name} <ExternalLink size={8} />
                        </button>
                      ))}
                      
                      {/* Przycisk dodawania pliku */}
                      <button 
                        onClick={() => fileInputRef.current[inv.id]?.click()}
                        className="flex items-center gap-1 text-[9px] text-blue-600 hover:text-blue-800 font-bold active:scale-95 transition-transform"
                      >
                        <Paperclip size={12} /> Dodaj plik
                      </button>
                      <input 
                        type="file" className="hidden" 
                        ref={el => fileInputRef.current[inv.id] = el}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadAttachment(inv.id, file);
                        }}
                      />

                      {/* --- SEKCJA NOTATKI --- */}
                      <div className="relative ml-2">
                        {editingNoteId === inv.id ? (
                          // *** TRYB EDYCJI (DUŻE OKNO) ***
                          <div className="absolute left-0 top-6 z-50 w-72 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-blue-100 dark:border-gray-600 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
                              <MessageSquare size={12}/> Edycja Notatki
                            </h4>
                            <textarea 
                              autoFocus
                              value={tempNote} 
                              onChange={(e) => setTempNote(e.target.value)}
                              className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3 min-h-[100px] text-gray-700 dark:text-gray-200 resize-none shadow-inner"
                              placeholder="Wpisz treść notatki dla księgowości..."
                            />
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingNoteId(null)} 
                                className="px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                              >
                                Anuluj
                              </button>
                              <button 
                                onClick={() => { onUpdateNote(inv.id, tempNote); setEditingNoteId(null); }} 
                                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all"
                              >
                                <Save size={12}/> Zapisz
                              </button>
                            </div>
                          </div>
                        ) : (
                          // *** TRYB PODGLĄDU (PRZYCISK) ***
                          <button 
                            onClick={() => { setEditingNoteId(inv.id); setTempNote(inv.notes || ''); }}
                            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md transition-all border ${
                              inv.notes 
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' 
                                : 'text-gray-300 hover:text-blue-500 border-transparent hover:bg-blue-50 dark:hover:bg-gray-800'
                            }`}
                            title={inv.notes}
                          >
                            <MessageSquare size={12} className={inv.notes ? 'fill-amber-200 dark:fill-amber-900' : ''} /> 
                            {inv.notes 
                              ? (inv.notes.length > 15 ? inv.notes.substring(0, 15) + '...' : inv.notes)
                              : 'Notatka'}
                          </button>
                        )}
                      </div>

                      {/* --- PRZYCISK HISTORII (DODANO) --- */}
                      {onShowHistory && (
                        <button 
                          onClick={() => onShowHistory(inv)} 
                          title="Pokaż historię zmian" 
                          className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-blue-600 transition-colors ml-2 font-medium"
                        >
                          <History size={12} /> Historia
                        </button>
                      )}

                    </div>
                  </div>
                </td>

                {/* 3. ADRES */}
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 max-w-[220px]">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5 text-blue-500" />
                    <span>
                      {inv.contractor_address || inv.buyer_address_on_invoice || <span className="italic opacity-50">Brak danych adresowych</span>}
                    </span>
                  </div>
                </td>

                {/* 4. KWOTA */}
                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">
                  {inv.amount?.toFixed(2)} PLN
                </td>

                {/* 5. STATUS (POPRAWIONY WYGLĄD) */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    inv.status === 'approved' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' 
                      : inv.status === 'rejected' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800' 
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                  }`}>
                    {inv.ai_reason || 'ANALIZA ZAKOŃCZONA'}
                  </span>
                  {inv.status !== 'review' && (
                    <button onClick={() => onRevert(inv.id)} className="block mt-1 text-[9px] text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                      <RotateCcw size={10} /> Cofnij
                    </button>
                  )}
                </td>

                {/* 6. AKCJE */}
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    {onViewXML && (
                      <button onClick={() => onViewXML(inv)} title="Podgląd XML" className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Code size={16} /></button>
                    )}
                    <button onClick={() => onEdit(inv)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                    {inv.status === 'review' && (
                      <>
                        <button onClick={() => onApprove(inv.id)} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg"><Check size={16} /></button>
                        <button onClick={() => onReject(inv.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><X size={16} /></button>
                      </>
                    )}
                    <button onClick={() => onDelete(inv.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
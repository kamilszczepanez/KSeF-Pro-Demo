import { useEffect, useState, useCallback, useMemo } from 'react'; 
import { 
  Moon, Sun, Cloud, Loader2, Send, Building2, 
  RefreshCw, LogOut, ScanLine, Save, AlertCircle, Key, FileText, ShieldCheck, HelpCircle, X,
  Search, BarChart3, TrendingUp, PieChart, Printer, FileSpreadsheet, History, User, Briefcase
} from 'lucide-react';
import { InvoiceTable } from './InvoiceTable';
import { analyzeInvoiceWithAI } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { FileDropZone } from './FileDropZone';
import { EditInvoiceModal } from './EditInvoiceModal';
import { JPKModule } from './JPKModule'; 
import { VATCalculator } from './VATCalculator';
import { KSeFIntegration } from './KSeFIntegration';
import { XMLViewerModal } from './XMLViewerModal';

// --- KONFIGURACJA PRZYSZŁOŚCIOWA ---
const ENABLE_KSEF_POLLING = true; 

export function InvoiceDashboard() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // --- STANY DLA FILTRÓW ---
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');

  // Stany UI
  const [showProfile, setShowProfile] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showReports, setShowReports] = useState(false); 
  
  // --- STANY HISTORII ---
  const [historyModalInvoice, setHistoryModalInvoice] = useState<any>(null);
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [globalLogs, setGlobalLogs] = useState<any[]>([]);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanningFileName, setScanningFileName] = useState('');
  
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [showJPK, setShowJPK] = useState(false);
  const [viewingXML, setViewingXML] = useState<any>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [ksefToken, setKsefToken] = useState(import.meta.env.VITE_KSEF_TOKEN || '');
  
  const [ksefMode, setKsefMode] = useState<'sandbox' | 'production'>('sandbox');

  // --- ZMIANA: Dodano business_type do stanu profilu ---
  const [companyProfile, setCompanyProfile] = useState({ 
    name: "Twoja Firma", 
    address: "Adres Firmy", 
    nip: "1111111111",
    business_type: "",
    ksef_token: "" // <--- Dodaj to pole
  });
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // --- LOGIKA FILTROWANIA ---
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.contractor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase())); 
      
      const matchesAmount = minAmount === '' || (inv.amount >= parseFloat(minAmount));
      
      return matchesSearch && matchesAmount;
    });
  }, [invoices, searchQuery, minAmount]);

  // --- LOGIKA RAPORTÓW ---
  const reportStats = useMemo(() => {
    const approved = invoices.filter(i => i.status === 'approved');
    const rejected = invoices.filter(i => i.status === 'rejected');
    const approvedCost = approved.reduce((sum, i) => sum + (i.amount || 0), 0);
    const rejectedCost = rejected.reduce((sum, i) => sum + (i.amount || 0), 0);
    const auditMissingJPK = approved.filter(i => !i.is_in_jpk);
    const rejectionReasons: Record<string, number> = {};
    rejected.forEach(i => {
        const reason = i.ai_reason || 'Brak uzasadnienia';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    });
    return { approvedCost, rejectedCost, auditMissingJPK, rejectionReasons, approvedCount: approved.length, rejectedCount: rejected.length };
  }, [invoices]);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Pobieramy rekord przypisany do zalogowanego ID użytkownika
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    if (data) {
      setCompanyProfile({ 
        name: data.company_name || "", 
        address: data.company_address || "", 
        nip: data.company_nip || "",
        business_type: data.business_type || "",
        ksef_token: data.ksef_token || "" 
      });
      
      // Jeśli użytkownik ma zapisany token, ustawiamy go dla synchronizacji KSeF
      if (data.ksef_token) {
        setKsefToken(data.ksef_token);
      }
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, attachments:invoice_attachments(*)')
      .order('id', { ascending: false });
    if (error) console.error('Błąd pobierania:', error.message);
    else if (data) setInvoices(data);
  }, []);

  const logActivity = async (action: string, details: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('activity_logs').insert({ user_id: user.id, action, details });
  };

  const fetchGlobalLogs = async () => {
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setGlobalLogs(data);
  };

  const updateInvoiceStatus = async (id: number, newStatus: string, actionName: string) => {
    try {
      const invoice = invoices.find(i => i.id === id);
      if (!invoice) return;
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || 'System';
      const newHistoryEntry = {
        date: new Date().toISOString(),
        action: actionName,
        user: userEmail,
        status_from: invoice.status,
        status_to: newStatus
      };
      const currentHistory = invoice.history && Array.isArray(invoice.history) ? invoice.history : [];
      const updatedHistory = [...currentHistory, newHistoryEntry];
      const updateData: any = { status: newStatus, history: updatedHistory };
      if (newStatus === 'approved') updateData.ai_reason = 'Zatwierdzono przez użytkownika';
      if (newStatus === 'review') updateData.ai_reason = 'Przywrócono do weryfikacji';
      const { error } = await supabase.from('invoices').update(updateData).eq('id', id);
      if (error) throw error;
      await logActivity(actionName, `Faktura: ${invoice.invoice_number}`);
      fetchInvoices();
    } catch (e: any) { alert("Błąd aktualizacji: " + e.message); }
  };

  const handleUpdateNote = async (id: number, note: string) => {
    try {
      const invoice = invoices.find(i => i.id === id);
      const { data: { user } } = await supabase.auth.getUser();
      const newHistoryEntry = { date: new Date().toISOString(), action: "Edycja notatki", user: user?.email || 'System' };
      const currentHistory = invoice.history && Array.isArray(invoice.history) ? invoice.history : [];
      await supabase.from('invoices').update({ notes: note, history: [...currentHistory, newHistoryEntry] }).eq('id', id);
      fetchInvoices(); 
    } catch (error: any) { alert("Błąd zapisu notatki: " + error.message); }
  };

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return alert("Brak danych do eksportu.");
    const headers = ["Data Wystawienia", "Numer Faktury", "Kontrahent", "NIP", "Adres", "Kwota Brutto", "Status", "Wysłano JPK", "Notatki"];
    const rows = filteredInvoices.map(inv => [
      inv.date || "", inv.invoice_number || "BRAK", `"${inv.contractor_name || ""}"`, inv.contractor_nip || "", `"${inv.contractor_address || ""}"`,
      inv.amount?.toFixed(2).replace('.', ',') || "0,00", inv.status === 'approved' ? 'Zatwierdzona' : inv.status === 'rejected' ? 'Odrzucona' : 'Do weryfikacji',
      inv.is_in_jpk ? 'TAK' : 'NIE', `"${inv.notes || ""}"`
    ]);
    const csvContent = ["\uFEFF" + headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `Faktury_Eksport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handlePrintRejected = () => {
    const rejected = invoices.filter(i => i.status === 'rejected');
    if (rejected.length === 0) return alert("Brak odrzuconych faktur!");
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const total = rejected.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    printWindow.document.write(`<html><head><title>Raport NKUP</title></head><body><h1>RAPORT NKUP</h1><ul>${rejected.map(i => `<li>${i.invoice_number} - ${i.amount} PLN (${i.ai_reason})</li>`).join('')}</ul><div>Suma: ${total} PLN</div><script>window.onload=function(){window.print();window.close();}</script></body></html>`);
    printWindow.document.close();
  };

  const handlePrintFullReport = () => {
    const approved = invoices.filter(i => i.status === 'approved');
    const rejected = invoices.filter(i => i.status === 'rejected');
    const approvedTotal = approved.reduce((sum, i) => sum + (i.amount || 0), 0);
    const rejectedTotal = rejected.reduce((sum, i) => sum + (i.amount || 0), 0);
    const dateStr = new Date().toLocaleString();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Raport Kontrolny</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body><h1>Raport Kontrolny</h1><p>${dateStr}</p><h3>Zatwierdzone: ${approvedTotal.toFixed(2)} PLN</h3><h3>Odrzucone: ${rejectedTotal.toFixed(2)} PLN</h3><script>window.onload=function(){window.print();window.close();}</script></body></html>`);
    printWindow.document.close();
  };

  const toggleSelect = (id: number) => { setSelectedInvoiceIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };
  const selectAllApproved = () => {
    const approved = invoices.filter(i => i.status === 'approved');
    const allSelected = approved.length > 0 && approved.every(i => selectedInvoiceIds.includes(i.id));
    setSelectedInvoiceIds(allSelected ? [] : approved.map(i => i.id));
  };
  const getInvoicesForJPK = () => {
    if (selectedInvoiceIds.length > 0) return invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
    return invoices.filter(inv => inv.status === 'approved');
  };

  useEffect(() => {
    fetchInvoices(); fetchProfile();
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode, fetchInvoices, fetchProfile]);

  useEffect(() => {
    if (!ksefToken || !ENABLE_KSEF_POLLING) return; 
    handleKsefSync(true);
    const intervalId = setInterval(() => { handleKsefSync(true); }, 90000);
    return () => clearInterval(intervalId);
  }, [ksefToken]);

  const handleDeleteInvoice = async (id: number) => {
    const inv = invoices.find(i => i.id === id);
    if (!confirm("Czy na pewno chcesz trwale usunąć tę fakturę?")) return;
    try {
      setIsSyncing(true);
      await logActivity('Usunięto fakturę', `Numer: ${inv?.invoice_number}, Kontrahent: ${inv?.contractor_name}`);
      if (inv?.attachments?.length > 0) {
        const filePaths = inv.attachments.map((at: any) => at.storage_path);
        await supabase.storage.from('invoice-attachments').remove(filePaths);
      }
      const { error: dbError } = await supabase.from('invoices').delete().eq('id', id);
      if (dbError) throw dbError;
      setSelectedInvoiceIds(prev => prev.filter(itemId => itemId !== id));
      await fetchInvoices();
    } catch (error: any) { alert("Błąd podczas usuwania: " + error.message); } finally { setIsSyncing(false); }
  };

  const handleUploadAttachment = async (invoiceId: number, file: File) => {
    try {
      setIsSyncing(true);
      const filePath = `${invoiceId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('invoice-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('invoice_attachments').insert({
        invoice_id: invoiceId, file_name: file.name, file_type: file.type,
        file_size: file.size, storage_path: filePath
      });
      if (dbError) throw dbError;
      await fetchInvoices();
    } catch (error: any) { alert("Błąd wgrywania: " + error.message); } finally { setIsSyncing(false); }
  };

  const processAndSaveInvoice = async (inv: any, isXmlImport = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let dataToSave = { 
        ...inv, 
        user_id: user.id, 
        history: [{ date: new Date().toISOString(), action: 'Utworzono dokument', user: user.email }] 
    };

    const isPdf = !isXmlImport && (inv.file_type === 'application/pdf' || (inv.imageBase64 && inv.imageBase64.startsWith('data:application/pdf')));

    if (isXmlImport) {
       // --- XML (KSeF) + AI ---
       try {
         const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
         
         // Wewnątrz funkcji processAndSaveInvoice:
const aiResult = await analyzeInvoiceWithAI({ 
  invoice_text: inv.xmlContent,
  // Używamy dynamicznych danych z profilu:
  correct_buyer_address: companyProfile.address, 
  correct_buyer_name: companyProfile.name
});

         dataToSave.status = aiResult.analysis?.status || 'review';
         dataToSave.ai_reason = aiResult.analysis?.ai_reason || 'Analiza XML zakończona';
         dataToSave.risk_score = aiResult.analysis?.risk_level === 'high' ? 100 : (aiResult.analysis?.risk_level === 'medium' ? 50 : 0);
         
         // USUNIĘTO: Kod, który dopisywał kategorię do notatek
         // if (aiResult.analysis?.category) { ... } -> TEGO JUŻ NIE MA

       } catch (err) {
         console.error("Błąd AI przy XML:", err);
         dataToSave.status = 'review'; 
         dataToSave.ai_reason = 'XML poprawny, ale błąd analizy AI';
       }

    } else if (isPdf) {
       // --- PDF (Ręczny) ---
       dataToSave.status = 'review';
       dataToSave.ai_reason = 'Dokument PDF (Wymaga ręcznego przepisania)';
       dataToSave.risk_score = 0;
       dataToSave.amount = 0.00;
       dataToSave.contractor_name = "Wczytano PDF";
    } else {
       // --- OBRAZ (Skaner) ---
       try {
         const aiResult: any = await analyzeInvoiceWithAI({ 
             ...inv, 
             correct_buyer_address: companyProfile.address, 
             correct_buyer_name: companyProfile.name 
         });
         dataToSave = { ...dataToSave, ...aiResult.extracted_data, status: aiResult.analysis?.status || 'review', ai_reason: aiResult.analysis?.ai_reason };
       } catch (err) {
         console.error("Błąd AI:", err);
         dataToSave.status = 'review';
         dataToSave.ai_reason = 'Błąd połączenia z AI';
       }
    }

    const { imageBase64, xmlContent, ...finalData } = dataToSave;
    if (typeof finalData.amount === 'number' && isNaN(finalData.amount)) finalData.amount = 0.00;

    const { error } = await supabase.from('invoices').insert([finalData]);
    if (error) { console.error("Błąd zapisu:", error); alert("Błąd: " + error.message); } 
    else { await logActivity('Dodano dokument', `Metoda: ${isXmlImport ? 'XML + AI' : (isPdf ? 'PDF (Ręczny)' : 'AI Skaner')}`); fetchInvoices(); }
  };

  const handleFileDrop = async (file: File, type: 'image' | 'xml') => {
    if (!file) return;
    setScanningFileName(file.name); setIsScanning(true); setScanProgress(10); 
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (type === 'image') {
        if (isPdf) { alert("Skaner AI obsługuje tylko pliki JPG/PNG."); setIsScanning(false); return; }
        setScanProgress(30);
        const b64 = await new Promise<string>((r) => { const reader = new FileReader(); reader.onload = () => r(reader.result as string); reader.readAsDataURL(file); });
        setScanProgress(50);
        
        // --- NAPRAWA: Usunięto file_type i dodano rzutowanie na any ---
        const aiResult: any = await analyzeInvoiceWithAI({ imageBase64: b64 });
        
        setScanProgress(80);
        // --- NAPRAWA: Zabezpieczenie przed brakiem danych (extracted_data) ---
        const d: any = aiResult.extracted_data || {};
        
        const flatData = {
          invoice_number: d.header?.invoice_number || d.invoice_number,
          date: d.header?.date || d.date,
          contractor_name: d.parties?.seller?.name || d.contractor_name,
          contractor_nip: d.parties?.seller?.nip || d.contractor_nip,
          contractor_address: d.parties?.seller?.address || d.contractor_address,
          buyer_address_on_invoice: d.parties?.buyer?.address || d.buyer_address_on_invoice,
          amount: d.totals?.gross_total || d.amount,
          currency: d.totals?.currency || d.currency || 'PLN',
          items: d.items || [],
          aiAnalysis: aiResult.analysis,
          imageBase64: b64,
          file_type: file.type,
          status: 'approved'
        };
        await processAndSaveInvoice(flatData, false); 
      }
      else if (type === 'xml') {
        setScanProgress(30);
        if (isPdf) {
            const b64 = await new Promise<string>((r) => { const reader = new FileReader(); reader.onload = () => r(reader.result as string); reader.readAsDataURL(file); });
            setScanProgress(60);
            await processAndSaveInvoice({ imageBase64: b64, date: new Date().toISOString().split('T')[0], file_type: file.type, contractor_name: "Dokument PDF" }, false); 
        } else {
            const text = await file.text();
            const doc = new DOMParser().parseFromString(text, "text/xml");
            const getTagValue = (parent: Element | Document, tag: string) => { const el = parent.getElementsByTagName(tag)[0]; return el ? el.textContent || "" : ""; }
            const podmiot1 = doc.getElementsByTagName("Podmiot1")[0];
            const name = podmiot1 ? (getTagValue(podmiot1, "Nazwa") || getTagValue(podmiot1, "PelnaNazwa")) : "XML";
            const nip = podmiot1 ? getTagValue(podmiot1, "NIP") : "";
            let addressString = "";
            const adresNode = podmiot1?.getElementsByTagName("Adres")[0];
            const adresPolNode = adresNode?.getElementsByTagName("AdresPol")[0];
            if (adresPolNode) {
                const ulica = getTagValue(adresPolNode, "Ulica");
                const nrDomu = getTagValue(adresPolNode, "NrDomu");
                const nrLokalu = getTagValue(adresPolNode, "NrLokalu");
                const kod = getTagValue(adresPolNode, "KodPocztowy");
                const miasto = getTagValue(adresPolNode, "Miejscowosc");
                
                // Budujemy pełny adres: Ulica Dom/Lokal, Kod Miasto
                addressString = `${ulica} ${nrDomu}${nrLokalu ? '/' + nrLokalu : ''}, ${kod} ${miasto}`
                    .trim()
                    .replace(/^,/, "")
                    .trim();
            }
            const amount = parseFloat(doc.getElementsByTagName("P_15")[0]?.textContent?.replace(',','.') || "0");
            const date = (getTagValue(doc, "P_1") || new Date().toISOString()).split('T')[0];
            const invNumber = getTagValue(doc, "P_2") || "XML-NR";
            setScanProgress(80);
            await processAndSaveInvoice({ contractor_name: name, contractor_nip: nip, contractor_address: addressString, amount, invoice_number: invNumber, date, xmlContent: text }, true);
        }
      }
      setScanProgress(100);
    } catch (e: any) { alert("Błąd: " + e.message); } 
    finally { setTimeout(() => { setIsScanning(false); setScanProgress(0); }, 500); }
  };

  const handleKsefSync = async (silent = false) => {
        if (!silent) setIsSyncing(true);
        
        try {
          if (!ksefToken) { 
              if (!silent) alert("Błąd: Najpierw wprowadź i zapisz token.");
              return; 
          }
    
          const nipToUse = companyProfile.nip.replace(/-/g, '').trim();
          
          if (!nipToUse || nipToUse.length !== 10) { 
              if (!silent) alert(`Błąd: Nieprawidłowy NIP.`);
              return; 
          }
    
          // --- MIEJSCE NA TWOJE TESTY ---
          
          // OPCJA 1: Wersja "Brudna" (z ogonem) - obecnie aktywna
          const tokenToSend = ksefToken.split('|')[0].trim();

      console.log("Wysyłam token (CZYSTY):", tokenToSend); // Zobacz w konsoli co leci
    
          const { error: invokeError } = await supabase.functions.invoke('ksef-sync', { 
              body: { nip: nipToUse, ksefToken: tokenToSend } 
          });
    
          if (invokeError) throw invokeError;
    
          await fetchInvoices();
    
        } catch (err: any) { 
          console.error("KSeF Error:", err.message); 
          if (!silent) alert(`Błąd połączenia: ${err.message}`); 
        } finally { 
          if (!silent) setIsSyncing(false); 
        }
     };
  
  const stats = {
    total: invoices?.length || 0,
    review: invoices?.filter(i => i.status === 'review').length || 0,
    approved: invoices?.filter(i => i.status === 'approved').length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors p-8 text-left text-gray-900 dark:text-gray-100 font-sans relative overflow-x-hidden">
      
      {editingInvoice && <EditInvoiceModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} onSave={async (u: any) => { await supabase.from('invoices').update(u).eq('id', u.id); await logActivity('Edycja ręczna', `Faktura: ${u.invoice_number}`); fetchInvoices(); setEditingInvoice(null); }} />}
      {viewingXML && <XMLViewerModal invoice={viewingXML} onClose={() => setViewingXML(null)} />}
      {showJPK && <JPKModule invoices={getInvoicesForJPK()} onClose={() => setShowJPK(false)} onSend={async () => { const ids = getInvoicesForJPK().map(i => i.id); if (!ids.length) return; await supabase.from('invoices').update({ is_in_jpk: true }).in('id', ids); await logActivity('Wysłano JPK', `Ilość: ${ids.length}`); alert("Sukces!"); await fetchInvoices(); setShowJPK(false); }} />}
      
      {/* --- MODAL HISTORII --- */}
      {historyModalInvoice && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              <div><h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-white"><History size={18} className="text-blue-500"/> Historia Dokumentu</h3><p className="text-xs text-gray-500">{historyModalInvoice.invoice_number}</p></div>
              <button onClick={() => setHistoryModalInvoice(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20">
              {historyModalInvoice.history && historyModalInvoice.history.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {[...historyModalInvoice.history].reverse().map((entry: any, index: number) => (
                    <div key={index} className="p-4 hover:bg-white dark:hover:bg-gray-800 transition-colors flex gap-3">
                      <div className="flex flex-col items-center"><div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${index === 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div><div className="w-px bg-gray-200 dark:bg-gray-700 flex-1 my-1"></div></div>
                      <div className="flex-1"><p className="text-sm font-bold text-gray-800 dark:text-gray-100">{entry.action}</p><div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium"><span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded"><User size={10}/> {entry.user}</span><span>{new Date(entry.date).toLocaleString()}</span></div>{entry.status_from && entry.status_to && (<p className="text-[10px] text-gray-400 mt-1">Status: <span className="line-through">{entry.status_from}</span> ➝ <span className="text-blue-500 font-bold">{entry.status_to}</span></p>)}</div>
                    </div>
                  ))}
                </div>
              ) : (<div className="p-12 text-center text-gray-400 text-xs">Brak historii.</div>)}
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 text-center border-t dark:border-gray-700"><button onClick={() => setHistoryModalInvoice(null)} className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest">Zamknij</button></div>
          </div>
        </div>
      )}

      {/* --- MODAL LOGÓW GLOBALNYCH --- */}
      {showGlobalHistory && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <div><h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-white"><History size={18} className="text-blue-500"/> Dziennik Zdarzeń</h3><p className="text-xs text-gray-500">Ostatnie akcje w systemie</p></div>
              <button onClick={() => setShowGlobalHistory(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20">
              {globalLogs.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {globalLogs.map((log: any) => (
                    <div key={log.id} className="p-4 hover:bg-white dark:hover:bg-gray-800 transition-colors flex gap-3">
                      <div className="flex flex-col items-center"><div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${log.action.includes('Usunięto') ? 'bg-red-500' : 'bg-blue-500'}`}></div><div className="w-px bg-gray-200 dark:bg-gray-700 flex-1 my-1"></div></div>
                      <div className="flex-1"><p className="text-sm font-bold text-gray-800 dark:text-gray-100">{log.action}</p><p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{log.details}</p><div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500"><span>{new Date(log.created_at).toLocaleString()}</span></div></div>
                    </div>
                  ))}
                </div>
              ) : (<div className="p-12 text-center text-gray-400 text-xs">Brak logów systemowych.</div>)}
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 text-center border-t dark:border-gray-700"><button onClick={() => setShowGlobalHistory(false)} className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white uppercase tracking-widest">Zamknij</button></div>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
          <ScanLine size={64} className="text-blue-400 animate-pulse mb-8" />
          <h2 className="text-3xl font-bold mb-2">Przetwarzanie: {scanningFileName}</h2>
          <div className="w-96 bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${scanProgress}%` }}></div>
          </div>
          <p className="mt-4 text-gray-400 text-sm animate-pulse">Analiza wizualna i weryfikacja danych...</p>
        </div>
      )}

      {showReports && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border dark:border-gray-700 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <div><h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-blue-600" /> Centrum Kontroli</h2><p className="text-xs text-gray-500 mt-1">Analiza wydatków i audyt</p></div>
              <button onClick={() => setShowReports(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-xl border border-green-100 dark:border-green-800 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Zatwierdzone</p><p className="text-3xl font-black">{reportStats.approvedCost.toFixed(2)} zł</p></div>
                  <TrendingUp size={24} className="text-green-600"/>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-100 dark:border-red-800 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Odrzucone</p><p className="text-3xl font-black">{reportStats.rejectedCost.toFixed(2)} zł</p></div>
                  <PieChart size={24} className="text-red-600"/>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border dark:border-gray-700">
                  <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2 text-sm"><FileText size={16} /> Audyt JPK</h3>
                  {reportStats.auditMissingJPK.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">{reportStats.auditMissingJPK.map(inv => (<div key={inv.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-l-4 border-l-amber-500 border-gray-100 dark:border-gray-700 text-xs"><div><span className="font-bold block text-gray-800 dark:text-gray-200">{inv.invoice_number}</span><span className="text-gray-500">{inv.contractor_name}</span></div><span className="font-mono font-bold">{inv.amount?.toFixed(2)} zł</span></div>))}</div>
                  ) : (<div className="text-center py-8 text-green-500 flex flex-col items-center"><ShieldCheck size={40} className="mb-2 opacity-50"/><span className="text-xs font-bold">Wszystkie w JPK!</span></div>)}
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border dark:border-gray-700">
                  <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2 text-sm"><X size={16} /> Przyczyny Odrzuceń</h3>
                  <div className="space-y-3">{Object.entries(reportStats.rejectionReasons).map(([reason, count]) => (<div key={reason} className="flex items-center text-xs"><div className="flex-1"><div className="flex justify-between mb-1"><span className="font-medium">{reason}</span><span className="font-bold">{count} szt.</span></div><div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div className="bg-red-500 h-2 rounded-full" style={{ width: `${(count / reportStats.rejectedCount) * 100}%` }}></div></div></div></div>))}</div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/80 border-t dark:border-gray-700 flex justify-end gap-2">
              <button onClick={handlePrintFullReport} className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Drukuj Pełny Raport</button>
              <button onClick={handlePrintRejected} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200"><Printer size={14} /> Drukuj NKUP</button>
              <button onClick={() => setShowReports(false)} className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PANEL POMOCY --- */}
      {/* --- PANEL POMOCY (PRZEWODNIK SYSTEMOWY) --- */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 z-50 border-l dark:border-gray-700 flex flex-col ${showHelp ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Nowy Nagłówek: Profesjonalny Błękit */}
        <div className="p-6 bg-blue-600 text-white shadow-lg">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-black text-xl flex items-center gap-2 tracking-tight">
              <HelpCircle size={22} /> Przewodnik
            </h3>
            <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          <p className="text-[10px] uppercase font-bold text-blue-100 tracking-widest opacity-90">Inteligentny Asystent KSeF 2.0</p>
        </div>

        {/* Rozbudowana Treść Instrukcji */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          <section>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Building2 size={14}/>
              </div>
              1. Dane Podatnika
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Uzupełnij profil firmy, w tym <strong>Branżę</strong>. AI wykorzystuje te informacje, by zrozumieć specyfikę Twoich wydatków i precyzyjniej wykrywać błędy.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Key size={14}/>
              </div>
              2. Połączenie KSeF
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Wprowadź token z Portalu Podatnika. Automat będzie co <strong>90 sekund</strong> sprawdzał serwery Ministerstwa i pobierał nowe dokumenty bezpośrednio do bazy.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <ShieldCheck size={14}/>
              </div>
              3. Audyt i Weryfikacja
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Każdy dokument przechodzi audyt. Zielony status to pełna zgodność. Czerwony oznacza wydatek nieuzasadniony dla Twojej działalności.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <BarChart3 size={14}/>
              </div>
              4. Raporty i JPK
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Gotowe faktury eksportuj do <strong>JPK_V7M</strong> lub generuj raporty kontrolne dla biura rachunkowego.
            </p>
          </section>

        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 text-center text-[9px] text-gray-400 uppercase tracking-widest font-bold">© 2026 KSeF Assistant Pro</div>
      </div>

      {/* --- GŁÓWNY UKŁAD DASHBOARDU --- */}
      <div className={`max-w-7xl mx-auto transition-all duration-300 ${showHelp ? 'mr-80' : ''}`}>
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Dashboard KSeF <span className="text-[10px] uppercase bg-blue-600 text-white px-3 py-1 rounded-full font-bold shadow-sm">2026 PRO</span>
            </h1>
            <p className="text-gray-500 text-sm">Zalogowany jako: <span className="font-bold text-blue-600">{companyProfile.name || "Ustaw nazwę firmy"}</span></p>
          </div>
          
          <div className="flex gap-2">
            {ENABLE_KSEF_POLLING && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-800 text-xs font-bold animate-pulse">
                <ShieldCheck size={16} /> AUTO-UPO: ON
              </div>
            )}
            
            {/* Przycisk Pomocy: Zmieniony z amber na błękit/neutralny */}
            <button 
              onClick={() => setShowHelp(!showHelp)} 
              className={`p-2 border rounded-lg shadow-sm transition-all ${
                showHelp 
                ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <HelpCircle size={20} />
            </button>

            <button onClick={() => { fetchGlobalLogs(); setShowGlobalHistory(true); }} className="p-2 bg-white dark:bg-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" title="Globalny Dziennik Zdarzeń"><History size={20} /></button>
            <button onClick={() => setShowIntegrations(!showIntegrations)} className="p-2 bg-white dark:bg-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"><Key size={20} /></button>
            <button onClick={() => setShowProfile(!showProfile)} className="p-2 bg-white dark:bg-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"><Building2 size={20} /></button>
            <button onClick={() => { if (!ksefToken) { setShowIntegrations(true); alert("Wprowadź najpierw Token Autoryzacyjny KSeF."); } else { handleKsefSync(false); } }} className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-md transition-all font-bold ${ksefToken ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'}`}>{isSyncing ? <Loader2 className="animate-spin" size={20} /> : <Cloud size={20} />} {ksefToken ? 'KSeF: Połączono' : 'Połącz z KSeF 2.0'}</button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white dark:bg-gray-800 rounded-lg text-yellow-500 shadow-sm transition-colors">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>

        {showIntegrations && (<div className="mb-8"><div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4 flex items-center justify-between"><span className="text-sm text-yellow-800 font-bold">Tryb Pracy:</span><select value={ksefMode} onChange={(e) => setKsefMode(e.target.value as any)} className="bg-white border border-yellow-300 rounded px-2 py-1 text-sm font-bold"><option value="sandbox">Sandbox</option><option value="production">Produkcja</option></select></div><KSeFIntegration onTokenChange={setKsefToken} /></div>)}
        
        {/* --- SEKCJA PROFILU FIRMY (Z NOWYM POLEM BRANŻY) --- */}
        {showProfile && (
            <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-lg animate-in slide-in-from-top">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2"><Building2 size={18} /> Ustawienia Podatnika</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input value={companyProfile.name} onChange={(e) => setCompanyProfile({...companyProfile, name: e.target.value})} className="p-2 rounded border dark:bg-gray-800 dark:border-gray-700 text-sm" placeholder="Nazwa firmy" />
                    <input value={companyProfile.nip} onChange={(e) => setCompanyProfile({...companyProfile, nip: e.target.value})} className="p-2 rounded border dark:bg-gray-800 dark:border-gray-700 text-sm" placeholder="NIP" />
                    <input value={companyProfile.address} onChange={(e) => setCompanyProfile({...companyProfile, address: e.target.value})} className="p-2 rounded border dark:bg-gray-800 dark:border-gray-700 text-sm" placeholder="Adres" />
                </div>
                
                {/* --- NOWE POLE DLA AI --- */}
                <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50">
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Briefcase size={16} className="text-blue-500"/> Branża / Typ działalności (Dla AI)
                    </label>
                    <input
                        type="text"
                        value={companyProfile.business_type}
                        onChange={(e) => setCompanyProfile({...companyProfile, business_type: e.target.value})}
                        placeholder="np. Firma Budowlana, Programista Freelancer, Sklep Spożywczy..."
                        className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <ShieldCheck size={12}/> To kluczowa informacja dla AI. Dzięki temu zrozumie, że zakup cementu w firmie IT jest podejrzany, a w budowlance normalny.
                    </p>
                </div>

                <button 
                    onClick={async () => { 
                        setIsSavingProfile(true); 
                        const { data: { user } } = await supabase.auth.getUser(); 
                        
                        if (user) {
                            // --- NAPRAWIONY ZAPIS DO BAZY ---
                            const updates = {
                                id: user.id, 
                                company_name: companyProfile.name, 
                                company_address: companyProfile.address, 
                                company_nip: companyProfile.nip,
                                business_type: companyProfile.business_type // <--- TO JEST KLUCZOWE
                            };

                            const { error } = await supabase.from('profiles').upsert(updates);
                            
                            if (error) {
                                alert("Błąd zapisu: " + error.message);
                            }
                        }
                        
                        setIsSavingProfile(false); 
                        setShowProfile(false); 
                        fetchProfile(); 
                    }} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"
                >
                    {isSavingProfile ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Zapisz profil
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border shadow-sm"><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Wszystkie</p><p className="text-3xl font-bold mt-1">{stats.total}</p></div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border-l-4 border-purple-500 shadow-sm"><p className="text-[10px] text-purple-600 uppercase font-bold tracking-widest">Weryfikacja</p><p className="text-3xl font-bold mt-1 text-purple-600">{stats.review}</p></div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border-l-4 border-green-500 shadow-sm"><p className="text-[10px] text-green-600 uppercase font-bold tracking-widest">Zatwierdzone</p><p className="text-3xl font-bold mt-1 text-green-600">{stats.approved}</p></div>
          <button onClick={() => setShowJPK(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-700 flex flex-col items-center justify-center transition-all active:scale-95"><div className="flex items-center gap-2"><Send size={18} /> GENERUJ JPK {selectedInvoiceIds.length > 0 ? `(${selectedInvoiceIds.length})` : ''}</div><span className="text-[10px] opacity-80 font-normal">Format JPK_V7M (2026)</span></button>
          <button onClick={() => setShowReports(true)} className="bg-gray-800 dark:bg-white dark:text-black text-white px-4 py-2 rounded-lg font-bold shadow-md hover:opacity-90 flex flex-col items-center justify-center transition-all active:scale-95 border dark:border-gray-200"><div className="flex items-center gap-2"><BarChart3 size={18} /> RAPORTY</div><span className="text-[10px] opacity-80 font-normal">Analiza i Audyt</span></button>
          <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-emerald-700 flex flex-col items-center justify-center transition-all active:scale-95"><div className="flex items-center gap-2"><FileSpreadsheet size={18} /> EKSPORT CSV</div><span className="text-[10px] opacity-80 font-normal">Dla Księgowości</span></button>
        </div>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1"><VATCalculator /></div>
          <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><FileText size={120} /></div>
            <h3 className="text-blue-700 dark:text-blue-400 font-bold mb-2 flex items-center gap-2"><AlertCircle size={20} /> Asystent Księgowy AI</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic z-10">Uruchomiono tryb FA(3). Od 1 lutego 2026 r. każdy dokument może zawierać załączniki binarne. System automatycznie czyści dane po usunięciu wpisu.</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FileDropZone title="Skaner AI (JPG/PNG)" description="Tylko obrazy" accept={['image/*']} iconType="ai" onFileDrop={(f) => handleFileDrop(f, 'image')} disabled={isScanning} />
          <FileDropZone title="Import Plików (XML/PDF)" description="XML (KSeF) lub PDF (Ręczny)" accept={['.xml', '.pdf']} iconType="xml" onFileDrop={(f) => handleFileDrop(f, 'xml')} disabled={isScanning} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 shadow-sm overflow-hidden font-sans">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Dokumenty</h2>
            <div className="flex items-center gap-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input type="text" placeholder="Szukaj..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-1.5 bg-gray-50 dark:bg-gray-900 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <input type="number" placeholder="Min kwota" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-24 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border rounded-lg text-xs outline-none" />
              <button onClick={fetchInvoices} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><RefreshCw size={16} /></button>
            </div>
          </div>

          <InvoiceTable 
            invoices={filteredInvoices} 
            selectedIds={selectedInvoiceIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAllApproved}
            onApprove={(id) => updateInvoiceStatus(id, 'approved', 'Zatwierdzono')} 
            onReject={(id) => updateInvoiceStatus(id, 'rejected', 'Odrzucono')} 
            onRevert={(id) => updateInvoiceStatus(id, 'review', 'Cofnięto')} 
            onDelete={handleDeleteInvoice}
            onEdit={setEditingInvoice} 
            onViewXML={setViewingXML} 
            onGetUPO={async (id) => { const inv = invoices.find(i => i.id === id); await supabase.from('invoices').update({ upo_status: 'pending' }).eq('id', id); await logActivity('Pobieranie UPO', `${inv?.invoice_number}`); fetchInvoices(); }} 
            onUploadAttachment={handleUploadAttachment}
            onUpdateNote={handleUpdateNote} 
            onShowHistory={(invoice: any) => setHistoryModalInvoice(invoice)}
            loading={isSyncing} 
          />
        </div>
      </div>
    </div>
  );
}
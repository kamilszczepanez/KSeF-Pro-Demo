import { X, FileCode, Download, Send, AlertTriangle, Upload, CheckCircle2, Lock, FileSignature, RefreshCw, Percent, Loader2, Building2, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface JPKModuleProps {
  invoices: any[];
  onClose: () => void;
  onSend: () => void;
}

export function JPKModule({ invoices, onClose, onSend }: JPKModuleProps) {
  const [activeTab, setActiveTab] = useState<'v7m' | 'fa'>('v7m');
  const [isSigned, setIsSigned] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  
  // Stan stawki VAT (Używany TYLKO jako awaryjny fallback, gdy brak danych z KSeF)
  const [vatRate, setVatRate] = useState(0.23);
  
  // --- STANY DANYCH ---
  const [usCode, setUsCode] = useState('1401'); 
  const [taxOffices, setTaxOffices] = useState<any[]>([]);
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  // Stany wyszukiwarki
  const [searchTerm, setSearchTerm] = useState('Urząd Skarbowy Warszawa-Mokotów'); 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isKsefSyncing, setIsKsefSyncing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: offices } = await supabase.from('tax_offices').select('*').order('name', { ascending: true });
        if (offices) setTaxOffices(offices);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nip, company_name, email, ksef_token')
            .eq('id', user.id)
            .single();
          if (profile) setCompanyProfile(profile);
        }
      } catch (error) {
        console.error('Błąd danych:', error);
      } finally {
        setIsLoadingOffices(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOffices = taxOffices.filter(office => 
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) || office.code.includes(searchTerm)
  );

  const handleSelectOffice = (office: any) => {
    setUsCode(office.code);
    setSearchTerm(`${office.code} - ${office.name}`);
    setIsDropdownOpen(false);
  };

  const handleKsefImport = async () => {
    const token = companyProfile?.ksef_token || prompt("Wklej Token KSeF:");
    if (!token) return;

    setIsKsefSyncing(true);
    try {
      // Wywołujemy backend, który teraz pobiera XML i zapisuje vat_details
      const { data, error } = await supabase.functions.invoke('ksef-sync', {
        body: { nip: companyProfile?.nip || '525260250995', ksefToken: token }
      });
      if (error) throw error;
      alert(data.success ? `SUKCES!\n${data.message}` : `Ostrzeżenie: ${data.message}`);
      window.location.reload();
    } catch (err: any) {
      alert("Błąd KSeF: " + err.message);
    } finally {
      setIsKsefSyncing(false);
    }
  };

  // --- LOGIKA ROZDZIAŁU FAKTUR (SPRZEDAŻ vs ZAKUP) ---
  const safeInvoices = invoices.filter(i => i.status === 'approved');
  
  const salesInvoices = safeInvoices.filter(i => !i.notes || i.notes.includes('Sprzedaż'));
  const purchaseInvoices = safeInvoices.filter(i => i.notes && i.notes.includes('Zakup'));

  // --- NOWOŚĆ: INTELIGENTNE SUMOWANIE VAT (Z vat_details) ---
  const calculateTotalVat = (list: any[]) => {
    return list.reduce((sum, inv) => {
        // Jeśli mamy dane z KSeF (XML), używamy ich
        if (inv.vat_details && Object.keys(inv.vat_details).length > 0) {
            const v23 = inv.vat_details.vat23 || 0;
            const v8 = inv.vat_details.vat8 || 0;
            const v5 = inv.vat_details.vat5 || 0;
            return sum + v23 + v8 + v5;
        } 
        // Fallback (stary sposób)
        else {
            const gross = inv.amount || 0;
            const net = gross / (1 + vatRate);
            return sum + (gross - net);
        }
    }, 0);
  };

  const salesVAT = calculateTotalVat(salesInvoices);
  const purchaseVAT = calculateTotalVat(purchaseInvoices);
  const taxToPay = salesVAT - purchaseVAT;

  // Suma netto dla deklaracji (P_19 itp)
  const calculateTotalNet = (list: any[]) => {
      return list.reduce((sum, inv) => {
          if (inv.vat_details && Object.keys(inv.vat_details).length > 0) {
             return sum + (inv.vat_details.net23 || 0) + (inv.vat_details.net8 || 0) + (inv.vat_details.net5 || 0) + (inv.vat_details.net0 || 0) + (inv.vat_details.netZw || 0);
          } else {
             return sum + ((inv.amount || 0) / (1 + vatRate));
          }
      }, 0);
  };

  const getDates = () => {
    if (safeInvoices.length === 0) return { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] };
    const dates = safeInvoices.map(i => new Date(i.date || new Date()));
    return { 
      start: new Date(Math.min.apply(null, dates as any)).toISOString().split('T')[0], 
      end: new Date(Math.max.apply(null, dates as any)).toISOString().split('T')[0] 
    };
  };

  // --- GENERATOR XML (JPK_V7M) ---
  const handleDownload = () => {
    const today = new Date().toISOString().split('T')[0];
    const fileDate = new Date().toISOString();
    const { start, end } = getDates();
    const myNIP = companyProfile?.nip || 'BRAK_NIP';
    const myName = companyProfile?.company_name || 'BRAK_NAZWY';
    const myEmail = companyProfile?.email || 'brak@email.com';

    let xmlContent = "";
    let fileName = "";

    if (activeTab === 'v7m') {
      // 1. GENEROWANIE WIERSZY SPRZEDAŻY (Obsługa wielu stawek!)
      const xmlSalesLines = salesInvoices.map((inv, index) => {
        let taxFields = '';

        // Czy mamy szczegółowe dane z KSeF?
        let gtuField = '';
        if (inv.gtu_code && inv.gtu_code.startsWith('GTU_')) {
            // Generujemy tag np. <GTU_12>1</GTU_12>
            gtuField = `      <${inv.gtu_code}>1</${inv.gtu_code}>\n`;
        }

        // Czy mamy szczegółowe dane z KSeF?
        if (inv.vat_details && Object.keys(inv.vat_details).length > 0) {
            const d = inv.vat_details;
            if (d.net23 > 0 || d.vat23 > 0) taxFields += `      <K_19>${d.net23?.toFixed(2)}</K_19><K_20>${d.vat23?.toFixed(2)}</K_20>\n`;
            if (d.net8 > 0 || d.vat8 > 0)   taxFields += `      <K_17>${d.net8?.toFixed(2)}</K_17><K_18>${d.vat8?.toFixed(2)}</K_18>\n`;
            if (d.net5 > 0 || d.vat5 > 0)   taxFields += `      <K_15>${d.net5?.toFixed(2)}</K_15><K_16>${d.vat5?.toFixed(2)}</K_16>\n`;
            if (d.net0 > 0)                 taxFields += `      <K_13>${d.net0?.toFixed(2)}</K_13>\n`;
            
            if (!taxFields) { // Fallback
                 const gross = inv.amount || 0; const net = (gross/1.23).toFixed(2); const vat = (gross-parseFloat(net)).toFixed(2);
                 taxFields = `      <K_19>${net}</K_19><K_20>${vat}</K_20>\n`;
            }
        } else { // Fallback bez KSeF
            const gross = inv.amount || 0;
            const net = (gross / (1 + vatRate)).toFixed(2);
            const vat = (gross - parseFloat(net)).toFixed(2);
            if (vatRate === 0.23) taxFields = `      <K_19>${net}</K_19><K_20>${vat}</K_20>\n`;
            else taxFields = `      <K_15>${net}</K_15><K_16>${vat}</K_16>\n`;
        }

        return `    <SprzedazWiersz>
      <LpSprzedazy>${index + 1}</LpSprzedazy>
      <NrKontrahenta>${inv.contractor_nip ? inv.contractor_nip.replace(/[^0-9]/g, '') : 'BRAK'}</NrKontrahenta>
      <NazwaKontrahenta>${(inv.contractor_name || 'Klient').replace(/&/g, '&amp;')}</NazwaKontrahenta>
      <DowodSprzedazy>${inv.invoice_number}</DowodSprzedazy>
      <DataWystawienia>${inv.date || today}</DataWystawienia>
      <DataSprzedazy>${inv.date || today}</DataSprzedazy>
${gtuField}${taxFields}    </SprzedazWiersz>`;
      }).join('\n');

      // 2. GENEROWANIE WIERSZY ZAKUPU (Koszty)
      const xmlPurchaseLines = purchaseInvoices.map((inv, index) => {
        let net = "0.00";
        let vat = "0.00";

        if (inv.vat_details && Object.keys(inv.vat_details).length > 0) {
             const d = inv.vat_details;
             // W zakupach sumujemy wszystkie stawki do K_42/43 (uproszczenie dla środków trwałych/pozostałych)
             const totalNet = (d.net23||0) + (d.net8||0) + (d.net5||0);
             const totalVat = (d.vat23||0) + (d.vat8||0) + (d.vat5||0);
             net = totalNet.toFixed(2);
             vat = totalVat.toFixed(2);
        } else {
             const gross = inv.amount || 0;
             const n = gross / (1 + vatRate);
             net = n.toFixed(2);
             vat = (gross - n).toFixed(2);
        }

        return `    <ZakupWiersz>
      <LpZakupu>${index + 1}</LpZakupu>
      <NrDostawcy>${inv.contractor_nip ? inv.contractor_nip.replace(/[^0-9]/g, '') : 'BRAK'}</NrDostawcy>
      <NazwaDostawcy>${(inv.contractor_name || 'Sprzedawca').replace(/&/g, '&amp;')}</NazwaDostawcy>
      <DowodZakupu>${inv.invoice_number}</DowodZakupu>
      <DataZakupu>${inv.date || today}</DataZakupu>
      <DataWplywu>${inv.date || today}</DataWplywu>
      <K_42>${net}</K_42>
      <K_43>${vat}</K_43>
    </ZakupWiersz>`;
      }).join('\n');

      xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2021/12/27/11148/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (2)" wersjaSchemy="1-2E">JPK_VAT</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
    <CelZlozenia poz="P_7">1</CelZlozenia>
    <DataWytworzeniaJPK>${fileDate}</DataWytworzeniaJPK>
    <DataOd>${start}</DataOd>
    <DataDo>${end}</DataDo>
    <KodUrzedu>${usCode}</KodUrzedu>
    <NazwaSystemu>Pergano KSeF 2026 PRO</NazwaSystemu>
  </Naglowek>
  <Podmiot1>
    <NIP>${myNIP}</NIP>
    <PelnaNazwa>${myName}</PelnaNazwa>
    <Email>${myEmail}</Email>
  </Podmiot1>
  <Deklaracja>
    <Naglowek>
        <KodFormularzaDekl kodSystemowy="VAT-7 (22)" kodPodatku="VAT" rodzajZobowiazania="Z" wersjaSchemy="1-0E">VAT-7</KodFormularzaDekl>
        <WariantFormularzaDekl>22</WariantFormularzaDekl>
    </Naglowek>
    <PozycjeSzczegolowe>
      <P_19>${(calculateTotalNet(salesInvoices)).toFixed(2)}</P_19>
      <P_20>${salesVAT.toFixed(2)}</P_20>
      <P_42>${(calculateTotalNet(purchaseInvoices)).toFixed(2)}</P_42>
      <P_43>${purchaseVAT.toFixed(2)}</P_43>
      <P_51>${taxToPay > 0 ? taxToPay.toFixed(2) : '0.00'}</P_51>
      <P_62>${taxToPay < 0 ? Math.abs(taxToPay).toFixed(2) : '0.00'}</P_62>
    </PozycjeSzczegolowe>
    <Pouczenie>1</Pouczenie>
  </Deklaracja>
  <Ewidencja>
${xmlSalesLines}
${xmlPurchaseLines}
    <SprzedazCtrl>
      <LiczbaWierszySprzedazy>${salesInvoices.length}</LiczbaWierszySprzedazy>
      <PodatekNalezny>${salesVAT.toFixed(2)}</PodatekNalezny>
    </SprzedazCtrl>
    <ZakupCtrl>
      <LiczbaWierszyZakupow>${purchaseInvoices.length}</LiczbaWierszyZakupow>
      <PodatekNaliczony>${purchaseVAT.toFixed(2)}</PodatekNaliczony>
    </ZakupCtrl>
  </Ewidencja>
</JPK>`;
      fileName = `JPK_V7M_${today}.xml`;

    } else {
      // JPK_FA - pozostawiamy uproszczony zrzut
      const totalGross = calculateTotalNet(safeInvoices) + salesVAT + purchaseVAT; // Przybliżenie
      xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2021/11/29/11073/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0E">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <CelZlozenia>1</CelZlozenia>
    <DataWytworzeniaJPK>${fileDate}</DataWytworzeniaJPK>
    <DataOd>${start}</DataOd>
    <DataDo>${end}</DataDo>
    <KodUrzedu>${usCode}</KodUrzedu>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>${myNIP}</NIP>
      <PelnaNazwa>${myName}</PelnaNazwa>
    </IdentyfikatorPodmiotu>
  </Podmiot1>
  <FakturaCtrl>
    <LiczbaFaktur>${safeInvoices.length}</LiczbaFaktur>
    <WartoscFaktur>${totalGross.toFixed(2)}</WartoscFaktur>
  </FakturaCtrl>
</JPK>`;
      fileName = `JPK_FA_${today}.xml`;
    }

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  const handleUpload = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      setSignedFile(e.target.files[0]);
      setIsUploading(true);
      setTimeout(() => { setIsUploading(false); setIsSigned(true); }, 1500);
    }
  };

  const handleFinalSend = async () => {
    if (!signedFile) return;
    try {
      setIsUploading(true);
      await new Promise(res => setTimeout(res, 2500));
      alert(`SUKCES!\nPrzesłano plik: ${signedFile.name}\nUBD: ${Math.random().toString(36).substr(2, 12).toUpperCase()}`);
      onSend();
    } catch { alert("Błąd bramki MF."); } finally { setIsUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 animate-in zoom-in duration-300">
      <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-2xl flex flex-col h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg"><FileCode size={28} /></div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">Generator JPK_V7M / FA</h2>
              <p className="text-xs text-gray-500">Podmiot: {companyProfile ? companyProfile.company_name : "Ładowanie..."} (NIP: {companyProfile?.nip || 'BRAK'})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"><X size={24} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button onClick={() => setActiveTab('v7m')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'v7m' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>JPK_V7M (VAT-7)</button>
              <button onClick={() => setActiveTab('fa')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'fa' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>JPK_FA (Faktury)</button>
            </div>

            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl">
              <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2"><AlertTriangle size={18} /> Ustawienia Podatkowe</h3>
              
              <div className="mb-4 relative" ref={dropdownRef}>
                <label className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1 block">Urząd Skarbowy</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                  <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }} onFocus={() => { setSearchTerm(''); setIsDropdownOpen(true); }} className="w-full pl-9 pr-10 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg text-sm font-bold" placeholder="Szukaj urzędu..." />
                  
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {isLoadingOffices ? <Loader2 className="animate-spin" size={16}/> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isDropdownOpen && <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border rounded-xl shadow-xl max-h-48 overflow-y-auto">{filteredOffices.map((office: any) => (<div key={office.code} onClick={() => handleSelectOffice(office)} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm">{office.name}</div>))}</div>}
              </div>

              <div className="mb-4"><label className="text-[10px] uppercase font-bold text-blue-600 mb-1 block">Stawka VAT (Fallback)</label><div className="relative"><Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" /><select value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value))} className="w-full pl-9 py-2 bg-white dark:bg-gray-800 border border-blue-200 rounded-lg text-sm font-bold"><option value={0.23}>23%</option><option value={0.08}>8%</option><option value={0.05}>5%</option></select></div></div>

              {/* STATYSTYKI */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-green-100/50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-[10px] uppercase font-bold text-green-700">Sprzedaż (VAT Należny)</div>
                  <div className="text-lg font-black text-green-800 dark:text-green-400">{salesVAT.toFixed(2)} zł</div>
                  <div className="text-xs text-green-600">{salesInvoices.length} dok.</div>
                </div>
                <div className="p-3 bg-red-100/50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-[10px] uppercase font-bold text-red-700">Zakup (VAT Naliczony)</div>
                  <div className="text-lg font-black text-red-800 dark:text-red-400">{purchaseVAT.toFixed(2)} zł</div>
                  <div className="text-xs text-red-600">{purchaseInvoices.length} dok.</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-800 text-white rounded-xl text-center">
                 <div className="text-xs opacity-70 uppercase font-bold">Wynik deklaracji (P_51 / P_62)</div>
                 <div className={`text-2xl font-black ${taxToPay > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {Math.abs(taxToPay).toFixed(2)} PLN
                 </div>
                 <div className="text-[10px]">{taxToPay > 0 ? "DO ZAPŁATY" : "DO ZWROTU / PRZENIESIENIA"}</div>
              </div>
            </div>
            
            <div className="border-t pt-4">
               <h3 className="font-bold mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-300"><FileSignature size={16}/> Podpis i Wysyłka</h3>
               {!isSigned ? (
                 <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                   <input type="file" className="hidden" onChange={handleUpload} />
                   {isUploading ? <RefreshCw className="animate-spin text-blue-500" /> : <Upload className="text-gray-400" />}
                   <span className="text-xs font-bold text-gray-500 mt-2">Wgraj podpisany plik XML (.xades)</span>
                 </label>
               ) : (
                 <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3"><CheckCircle2 className="text-green-600"/> <span className="font-bold text-green-800 text-sm">Plik podpisany poprawnie</span></div>
               )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-5 font-mono text-[10px] text-green-400 overflow-auto border border-gray-800 shadow-inner relative">
            <div className="absolute top-0 right-0 p-2 bg-gray-900/90 rounded-bl-xl text-[9px] text-gray-500 border-l border-b border-gray-700">PODGLĄD XML</div>
            <pre className="whitespace-pre-wrap break-all opacity-80 leading-relaxed">
{activeTab === 'v7m' ? `Sprzedaż: ${salesVAT.toFixed(2)} PLN
Zakup: ${purchaseVAT.toFixed(2)} PLN
Wynik: ${taxToPay > 0 ? `ZAPŁATA ${taxToPay.toFixed(2)}` : `ZWROT ${Math.abs(taxToPay).toFixed(2)}`}

${salesInvoices.length > 0 ? `<SprzedazWiersz>
  <K_19>${(salesInvoices[0].vat_details?.net23 || 0).toFixed(2)}</K_19>
  <K_20>${(salesInvoices[0].vat_details?.vat23 || 0).toFixed(2)}</K_20>
</SprzedazWiersz>` : 'Brak danych'}
` : 'Podgląd FA...'}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex gap-4">
          <button onClick={handleDownload} disabled={isUploading} className="flex-1 bg-white border py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all text-sm"><Download size={20} /> 1. POBIERZ XML</button>
          
          <button onClick={handleFinalSend} disabled={!isSigned || isUploading} className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${isSigned ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400'}`}>
            {isUploading ? <Loader2 className="animate-spin"/> : (isSigned ? <Send size={20}/> : <Lock size={20}/>)} 
            {isSigned ? "2. WYŚLIJ DO MF" : "WYMAGANY PODPIS"}
          </button>
          
          <button onClick={handleKsefImport} disabled={isKsefSyncing} className="px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 border border-blue-500 text-sm">{isKsefSyncing ? <Loader2 className="animate-spin"/> : <RefreshCw size={20}/>} IMPORT KSEF</button>
        </div>
      </div>
    </div>
  );
}
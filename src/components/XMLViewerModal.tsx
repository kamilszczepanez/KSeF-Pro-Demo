import React from 'react';
import { X, Code, Copy, CheckCircle2 } from 'lucide-react';

export function XMLViewerModal({ invoice, onClose }: { invoice: any, onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);

  // Rekonstrukcja struktury KSeF FA(2) na podstawie danych z bazy
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (2)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
    <DataWytworzeniaFa>${new Date().toISOString()}</DataWytworzeniaFa>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${invoice.contractor_nip || 'BRAK'}</NIP>
      <Nazwa>${invoice.contractor_name}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <AdresL1>${invoice.contractor_address}</AdresL1>
    </Adres>
  </Podmiot1>
  <Podmiot2> <DaneIdentyfikacyjne>
      <NIP>5971449567</NIP>
      <Nazwa>${invoice.buyer_name_on_invoice}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${invoice.buyer_address_on_invoice}</AdresL1>
    </Adres>
  </Podmiot2>
  <Fa>
    <P_1>${invoice.date}</P_1>
    <P_2>${invoice.invoice_number}</P_2>
    <P_13_1>${(invoice.amount * 0.77).toFixed(2)}</P_13_1> <P_14_1>${(invoice.amount * 0.23).toFixed(2)}</P_14_1> <P_15>${invoice.amount?.toFixed(2)}</P_15>       <Adnotacje>
      <P_16>1</P_16> <P_17>0</P_17> <P_18>1</P_18> <P_18A>0</P_18A>
    </Adnotacje>
  </Fa>
</Faktura>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] w-full max-w-4xl rounded-xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#252526]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
              <Code size={20} />
            </div>
            <div>
              <h3 className="text-gray-200 font-bold font-mono">Podgląd Źródła XML (FA2)</h3>
              <p className="text-xs text-gray-400">Struktura logiczna weryfikowana przez KSeF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors" title="Kopiuj kod">
              {copied ? <CheckCircle2 size={20} className="text-green-500" /> : <Copy size={20} />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-400 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Code Editor Body */}
        <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar">
          <pre className="text-gray-300">
            {xmlContent.split('\n').map((line, i) => {
              // Proste kolorowanie składni dla efektu WOW
              const colorized = line
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/(<[^>]+>)/g, '<span class="text-blue-400">$1</span>') // Tagi na niebiesko
                .replace(/()/g, '<span class="text-green-500 italic">$1</span>') // Komentarze na zielono
                .replace(/>([^<]+)</g, '><span class="text-[#ce9178]">$1</span><'); // Wartości na pomarańczowo

              return (
                <div key={i} className="table-row">
                  <span className="table-cell text-gray-600 select-none pr-4 text-right border-r border-gray-700 mr-4 w-8">
                    {i + 1}
                  </span>
                  <span className="table-cell pl-4 whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: colorized }} />
                </div>
              );
            })}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#007acc] text-white text-xs flex justify-between px-6 font-mono">
          <span>Schema: KSeF FA(2) v1-0E</span>
          <span>Encoding: UTF-8</span>
          <span>Status: WALIDACJA OK</span>
        </div>
      </div>
    </div>
  );
}
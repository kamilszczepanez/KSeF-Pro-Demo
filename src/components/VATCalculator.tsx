import { useState, useEffect } from 'react';
import { Calculator, Percent, Coins } from 'lucide-react';

export function VATCalculator() {
  const [netto, setNetto] = useState<string>('');
  const [vatRate, setVatRate] = useState<number>(23);
  const [results, setResults] = useState({ vat: '0.00', gross: '0.00' });

  useEffect(() => {
    const n = parseFloat(netto) || 0;
    const v = vatRate || 0;
    
    // Logika matematyczna
    const vatAmount = n * (v / 100);
    const grossAmount = n + vatAmount;

    setResults({
      vat: vatAmount.toFixed(2),
      gross: grossAmount.toFixed(2)
    });
  }, [netto, vatRate]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
        <Calculator size={20} />
        <h3 className="font-bold uppercase tracking-wider text-sm">Szybki Kalkulator VAT</h3>
      </div>

      <div className="space-y-4">
        {/* Kwota Netto */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Kwota Netto (PLN)</label>
          <div className="relative">
            <input
              type="number"
              value={netto}
              onChange={(e) => setNetto(e.target.value)}
              placeholder="Wpisz kwotę..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <Coins className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Stawka VAT */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 flex justify-between">
            Stawka VAT (%)
            <span className="text-blue-500 italic">Rekomendowane: 23%</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <Percent className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Wyniki */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Kwota VAT:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{results.vat} PLN</span>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-gray-900 dark:text-white font-bold">Kwota Brutto:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{results.gross} PLN</span>
          </div>
        </div>
      </div>
    </div>
  );
}
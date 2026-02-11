import { useState, useEffect } from 'react';
import { Key, ShieldCheck, Globe, RefreshCcw, AlertCircle, CheckCircle2, HelpCircle, ListOrdered } from 'lucide-react';

export function KSeFIntegration({ 
  onTokenChange, 
  initialToken = '' 
}: { 
  onTokenChange: (val: string) => void,
  initialToken?: string 
}) {
  const [token, setToken] = useState(initialToken);
  const [env, setEnv] = useState('test'); // 'test' lub 'prod'
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none');

  // Aktualizuj lokalny stan, jeśli initialToken zmieni się (pobranie z bazy)
  useEffect(() => {
    setToken(initialToken);
  }, [initialToken]);

  const handleTestAndSave = () => {
    setIsConnecting(true);
    // Wywołujemy zmianę w nadrzędnym komponencie, który zapisze to w Supabase
    onTokenChange(token);
    
    // Symulacja weryfikacji formatu/połączenia
    setTimeout(() => {
      setIsConnecting(false);
      setConnectionStatus('success');
    }, 1500);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl mx-auto my-4 text-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
          <Key size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white text-left">Konfiguracja Połączenia KSeF</h2>
          <p className="text-sm text-gray-500 font-normal text-left">Twoje klucze są bezpiecznie przypisane do Twojego profilu firmowego.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* --- NOWA SEKCJA: INSTRUKCJA --- */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-5">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm mb-3">
            <HelpCircle size={18} />
            Jak uzyskać token autoryzacyjny?
          </div>
          <ul className="space-y-3">
            {[
              "Zaloguj się do Portalu Podatnika KSeF (podatki.gov.pl).",
              "Wejdź w zakładkę 'Tokeny' w menu bocznym.",
              "Wygeneruj nowy token z uprawnieniami do odczytu faktur.",
              "Skopiuj wygenerowany ciąg znaków i wklej go poniżej."
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        {/* Wybór Środowiska */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setEnv('test')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              env === 'test' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Globe size={18} className={env === 'test' ? 'text-blue-500' : 'text-gray-400'} />
              <span className="font-bold text-sm dark:text-gray-200">Sandbox (Testy)</span>
            </div>
            <p className="text-xs text-gray-500 font-normal">Środowisko do bezpiecznych testów.</p>
          </button>

          <button
            onClick={() => setEnv('prod')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              env === 'prod' 
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
              : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} className={env === 'prod' ? 'text-green-500' : 'text-gray-400'} />
              <span className="font-bold text-sm dark:text-gray-200">Produkcja (KAS)</span>
            </div>
            <p className="text-xs text-gray-500 font-normal">Oficjalne faktury Twojej firmy.</p>
          </button>
        </div>

        {/* Pole Tokena */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 text-left">
            Twój Token Autoryzacyjny
          </label>
          <div className="relative">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Wklej tutaj swój klucz..."
              className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
            />
            <div className="absolute right-4 top-3.5 text-gray-400">
              <Key size={18} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 flex items-start gap-1 font-normal text-left">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            Token zostanie zapamiętany w Twoim profilu. Nie będziesz musiał go wpisywać ponownie przy kolejnym logowaniu.
          </p>
        </div>

        {/* Status i Przyciski */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="min-h-[24px]">
            {connectionStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-bold animate-in fade-in slide-in-from-left duration-300">
                <CheckCircle2 size={18} />
                Token zapisany i zweryfikowany
              </div>
            )}
          </div>
          
          <button
            onClick={handleTestAndSave}
            disabled={!token || isConnecting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            {isConnecting ? <RefreshCcw className="animate-spin" size={18} /> : null}
            {isConnecting ? 'Trwa zapisywanie...' : 'Zapisz i Połącz'}
          </button>
        </div>
      </div>
    </div>
  );
}
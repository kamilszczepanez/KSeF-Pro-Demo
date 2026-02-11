import { useEffect, useState } from 'react';
import { InvoiceDashboard } from './components/InvoiceDashboard';
import { AuthForm } from './components/AuthForm';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Sprawdź przy starcie, czy ktoś jest zalogowany
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Nasłuchuj zmian (np. jak ktoś kliknie "Wyloguj")
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Jeśli trwa ładowanie, pokaż pusty ekran (lub spinner)
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Ładowanie...</div>;

  // GLÓWNA DECYZJA:
  // Nie ma sesji? -> Pokaż formularz logowania
  // Jest sesja? -> Pokaż Dashboard
  if (!session) {
    return <AuthForm />;
  }

  return <InvoiceDashboard />;
}

export default App;
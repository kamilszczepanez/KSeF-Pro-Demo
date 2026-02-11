import { supabase } from '../lib/supabase';

export async function analyzeInvoiceWithAI(params: { 
  invoice_text?: string, 
  imageBase64?: string, 
  correct_buyer_address?: string,
  correct_buyer_name?: string 
}) {
  console.log("🚀 Wysyłanie do AI Cloud...");
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Użytkownik nie jest zalogowany");

  // Wywołujemy funkcję w chmurze
  const { data, error } = await supabase.functions.invoke('analyze-invoice', {
    body: {
      user_id: user.id,
      invoice_text: params.invoice_text || null, // Tekst dla XML
      imageBase64: params.imageBase64 || null,   // Obraz dla skanera
      correct_buyer_address: params.correct_buyer_address
    }
  });

  if (error) {
    console.error("Błąd chmury:", error);
    return {
      analysis: {
        status: 'review',
        risk_level: 'medium',
        ai_reason: 'Błąd połączenia z chmurą AI.'
      },
      extracted_data: {}
    };
  }

  // AI zwraca teraz wszystko w jednym obiekcie 'result'
  // Musimy to rozdzielić, żeby pasowało do Twojej tabeli
  return {
    analysis: {
        status: data.analysis?.status || 'review',
        risk_level: data.analysis?.risk_level || 'low',
        category: data.analysis?.category || 'Inne',
        ai_reason: data.analysis?.ai_reason || 'Analiza zakończona'
    },
    // Dane wyciągnięte z obrazka (OCR)
    extracted_data: {
        invoice_number: data.analysis?.invoice_number,
        date: data.analysis?.date,
        amount: data.analysis?.amount,
        contractor_name: data.analysis?.contractor_name,
        contractor_nip: data.analysis?.contractor_nip,
        contractor_address: data.analysis?.contractor_address
    }
  };
}
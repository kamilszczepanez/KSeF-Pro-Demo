import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Pobieramy dane (może przyjść tekst ALBO obrazek)
    const { invoice_text, imageBase64, user_id, correct_buyer_address } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Pobieramy branżę
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_type')
      .eq('id', user_id)
      .single()

    const industry = profile?.business_type || "Firma Ogólna";
    console.log(`[AI] Tryb: ${imageBase64 ? 'OBRAZ (Vision)' : 'TEKST (XML)'} | Branża: ${industry}`);

    let messages;
    
    // 2. Budujemy zapytanie w zależności od tego, co dostaliśmy
    if (imageBase64) {
        // --- SCENARIUSZ 1: OBRAZEK (OCR + ANALIZA) ---
        const systemPromptImg = `
          Jesteś zaawansowanym systemem OCR i Audytorem Podatkowym.
          Branża podatnika: "${industry}".
          
          TWOJE ZADANIE:
          1. Odczytaj z obrazka dane faktury (Numer, Data, Sprzedawca, NIP, Kwota Brutto).
          2. Przeanalizuj pozycje i oceń ryzyko podatkowe dla branży "${industry}".
          
          ZASADY RYZYKA:
          - Czy zakup pasuje do branży? (np. Budowlanka + Jabłka = WYSOKIE RYZYKO).
          - Jeśli tak -> Niskie ryzyko. Jeśli nie -> Wysokie.

          Zwróć JSON:
          {
            "invoice_number": "numer faktury",
            "date": "RRRR-MM-DD",
            "amount": 0.00 (jako liczba),
            "contractor_name": "nazwa sprzedawcy",
            "contractor_nip": "NIP sprzedawcy",
            "contractor_address": "adres sprzedawcy",
            "status": "review",
            "risk_level": "low" | "medium" | "high",
            "category": "Kategoria kosztu",
            "ai_reason": "[Branża: ${industry}] - Twoja ocena kosztu."
          }
        `;

        messages = [
            { role: 'system', content: systemPromptImg },
            { 
                role: 'user', 
                content: [
                    { type: "text", text: "Przeanalizuj to zdjęcie faktury:" },
                    { type: "image_url", image_url: { url: imageBase64 } }
                ] 
            }
        ];

    } else {
        // --- SCENARIUSZ 2: XML/TEKST (TYLKO ANALIZA) ---
        const systemPromptTxt = `
          Jesteś audytorem podatkowym. Branża: "${industry}".
          Adres profilu: "${correct_buyer_address}".
          
          ZADANIE:
          Oceń czy towar w treści XML pasuje do branży "${industry}".
          
          Zwróć JSON (tylko ocena, dane liczbowe mamy z XML):
          {
            "status": "review",
            "risk_level": "low" | "medium" | "high",
            "category": "Kategoria kosztu",
            "ai_reason": "[Branża: ${industry}] - Twoja ocena kosztu."
          }
        `;

        messages = [
            { role: 'system', content: systemPromptTxt },
            { role: 'user', content: `Faktura XML: ${invoice_text.substring(0, 4000)}` }
        ];
    }

    // 3. Wysyłamy do OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Ten model ma "oczy" (Vision)
        messages: messages,
        temperature: 0.0,
        max_tokens: 1000
      }),
    })

    const aiData = await openAIResponse.json()
    
    if (!aiData.choices) throw new Error("Błąd OpenAI: " + JSON.stringify(aiData));

    const content = aiData.choices[0].message.content.replace(/```json|```/g, '').trim()
    const result = JSON.parse(content)

    return new Response(JSON.stringify({ success: true, analysis: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Critical Error:", error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
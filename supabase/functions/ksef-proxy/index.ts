import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { nip } = await req.json()
    console.log(`[Proxy] Próba ostateczna dla NIP: ${nip}`)

    const KSEF_URL = "https://ksef-test.mf.gov.pl/api/online/Session/AuthorisationChallenge"

    const response = await fetch(KSEF_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // KLUCZ: Wymuszamy zamknięcie połączenia po tej operacji
        // To często pomaga na błędy 'stream error' w HTTP/2
        'Connection': 'close'
      },
      body: JSON.stringify({
        contextIdentifier: { 
          type: 'onw', // Dla NIP 1111111111
          identifier: nip 
        }
      })
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status
    })

  } catch (error) {
    console.error(`[Proxy] Firewall MF nadal blokuje:`, error.message)
    return new Response(JSON.stringify({ error: "Firewall Ministerstwa odrzucił połączenie z chmury." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502
    })
  }
})
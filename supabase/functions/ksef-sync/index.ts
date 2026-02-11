import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import forge from 'npm:node-forge@1.3.1'
import { request } from "node:https";
import { Buffer } from "node:buffer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- FUNKCJA POMOCNICZA: Wrapper na request HTTP ---
async function nodeFetch(url: string, method: string, headers: any, body: any) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyString = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : "";
    
    if (bodyString) headers['Content-Length'] = Buffer.byteLength(bodyString);

    const options = {
      hostname: urlObj.hostname, 
      path: urlObj.pathname + urlObj.search,
      method: method, 
      headers: headers, 
      agent: false, 
      // ZMIANA 1: Wydłużamy timeout do 2 minut (120000 ms)
      timeout: 120000, 
    };

    const req = request(options, (res) => {
      let chunks: any[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        resolve({
          ok: res.statusCode! >= 200 && res.statusCode! < 300,
          status: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => { try { return Promise.resolve(JSON.parse(data || '{}')); } catch(e) { return Promise.resolve({}); } }
        });
      });
    });
    req.on('error', (e) => reject(new Error(`Node Error: ${e.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error("KSeF Timeout (120s)")); });
    if (bodyString) req.write(bodyString);
    req.end();
  });
}

// --- FUNKCJA POMOCNICZA: Wyciąganie VAT z XML ---
function extractVatBreakdown(xml: string) {
  const getVal = (regex: RegExp) => {
    const match = xml.match(regex);
    return match ? parseFloat(match[1]) : 0;
  };

  return {
    vat23: getVal(/<P_14_1>([\d\.]+)<\/P_14_1>/),
    net23: getVal(/<P_13_1>([\d\.]+)<\/P_13_1>/),
    vat8:  getVal(/<P_14_2>([\d\.]+)<\/P_14_2>/),
    net8:  getVal(/<P_13_2>([\d\.]+)<\/P_13_2>/),
    vat5:  getVal(/<P_14_3>([\d\.]+)<\/P_14_3>/),
    net5:  getVal(/<P_13_3>([\d\.]+)<\/P_13_3>/),
    net0:  getVal(/<P_13_6>([\d\.]+)<\/P_13_6>/),
    currency: xml.match(/<KodWaluty>([A-Z]{3})<\/KodWaluty>/)?.[1] || 'PLN'
  };
}

// --- GŁÓWNA FUNKCJA SERWERA ---
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { nip, ksefToken } = await req.json();
    console.log(`[START] Łączę z KSeF dla NIP: ${nip}`);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const KSEF_API = "https://ksef-test.mf.gov.pl/api";
    const headers = { "Content-Type": "application/json", "Accept": "application/json", "Connection": "close" };

    // 1. Challenge
    const challengeRes: any = await nodeFetch(`${KSEF_API}/online/Session/AuthorisationChallenge`, "POST", { ...headers }, { contextIdentifier: { type: "onip", identifier: nip } });
    if (!challengeRes.ok) throw new Error(`Błąd Challenge: ${challengeRes.status}`);
    const { timestamp, challenge } = await challengeRes.json();

    // 2. Szyfrowanie Tokena
    const certString = "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";
    const pem = `-----BEGIN CERTIFICATE-----\n${certString.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
    const cert = forge.pki.certificateFromPem(pem);
    const encryptedToken = forge.util.encode64(cert.publicKey.encrypt(`${ksefToken}|${timestamp}`, 'RSA-OAEP', { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha256.create() } }));

    // 3. InitToken (Logowanie)
    const initRes: any = await nodeFetch(`${KSEF_API}/online/Session/InitToken`, "POST", { ...headers }, {
        context: { challenge, identifier: { identifier: nip, type: "onip" }, documentType: { service: "KSeF", formCode: "FA", formVersion: "2" }, token: encryptedToken }
    });
    if (!initRes.ok) throw new Error(`InitToken Error: ${initRes.status}`);
    const sessionToken = (await initRes.json()).sessionToken.token;

    console.log("✅ Zalogowano pomyślnie.");

    // 4. Sync - ZMIANA 2: LIMIT 50 (Szybciej)
    const dateFrom = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); 
    const endDate = new Date(); endDate.setDate(endDate.getDate() + 1);
    
    // Ustawiamy PageSize=50 (lżejsze zapytanie)
    const syncRes: any = await nodeFetch(`${KSEF_API}/online/Query/Invoice/Sync?PageSize=50&PageOffset=0`, "POST", { ...headers, "SessionToken": sessionToken }, {
        queryCriteria: { subjectType: "subject1", type: "incremental", acquisitionTimestampThresholdFrom: dateFrom, acquisitionTimestampThresholdTo: endDate.toISOString() }
    });

    const rawData = await syncRes.json();
    const items = rawData.invoiceHeaderList || [];
    console.log(`📥 Pobrałem listę ${items.length} faktur.`);

    // 5. PĘTLA + FILTR + SZPIEG
    const invoices = [];
    
    for (const inv of items) {
        const buyerNip = inv.subjectTo?.issuedByIdentifier?.identifier;
        const ref = inv.invoiceReferenceNumber;

        // FILTR ANTY-ZWIS: Tylko faktury na NIP 2222222222
        if (buyerNip !== '2222222222') {
             continue; 
        }

        console.log(`[SZPIEG] 🎯 ZNALAZŁEM FAKTURĘ: ${ref}`);

        // Logika Kontrahenta
        const isSales = (inv.subjectBy?.issuedByIdentifier?.identifier === nip);
        let contractorName = isSales ? inv.subjectTo?.issuedByName : inv.subjectBy?.issuedByName;
        if (!contractorName) contractorName = "Klient/Sprzedawca";

        // Pobieranie XML
        let vatDetails = {};
        try {
           const xmlRes: any = await nodeFetch(
               `${KSEF_API}/common/Invoice/KSeF/${ref}`, "GET", { ...headers, "SessionToken": sessionToken }, null
           );
           if (xmlRes.ok) {
               vatDetails = extractVatBreakdown(await xmlRes.text());
           }
        } catch (e) {}

        invoices.push({
            invoice_number: ref,
            contractor_name: contractorName,
            contractor_nip: isSales ? inv.subjectTo?.issuedByIdentifier?.identifier : inv.subjectBy?.issuedByIdentifier?.identifier,
            amount: inv.gross ? parseFloat(inv.gross) : parseFloat(inv.net),
            currency: inv.currency || 'PLN',
            date: inv.invoicingDate,
            status: 'approved',
            source: 'KSEF_IMPORT',
            notes: isSales ? `[KSeF] Sprzedaż` : `[KSeF] Zakup`,
            vat_details: vatDetails
        });
    }

    // Zapis
    if (invoices.length > 0) {
        await supabase.from('invoices').upsert(invoices, { onConflict: 'invoice_number' });
    }

    return new Response(JSON.stringify({ success: true, count: invoices.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: `BŁĄD: ${err.message}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
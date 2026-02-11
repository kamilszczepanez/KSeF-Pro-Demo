// src/services/ksefService.ts

const KSEF_API_URL = "https://ksef-test.mf.gov.pl/api/online";

export const ksefService = {
  /**
   * Krok 1: Zapytanie o Challenge (Wyzwanie)
   * To pierwsza rzecz, o którą musimy poprosić Ministerstwo, 
   * aby udowodnić, że mamy prawo się zalogować.
   */
  async getAuthorisationChallenge(nip: string) {
    console.log(`[KSeF] Pukanie do bram MF dla NIP: ${nip}...`);

    try {
      const response = await fetch(`${KSEF_API_URL}/Session/AuthorisationChallenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          contextIdentifier: {
            type: 'onw', // onw = osoba niefizyczna / firma
            identifier: nip,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.exception?.exceptionDetailList?.[0]?.description || 'Błąd KSeF');
      }

      const data = await response.json();
      console.log('✅ [KSeF] Sukces! Otrzymano Challenge:', data.challengeIdentifier);
      return data.challengeIdentifier;
    } catch (error) {
      console.error('❌ [KSeF] Błąd połączenia:', error);
      throw error;
    }
  }
};
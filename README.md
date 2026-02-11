

# 🧾 Asystent KSeF - Demo Dashboard

Aplikacja webowa służąca do integracji z Krajowym Systemem e-Faktur (KSeF) w środowisku testowym. Umożliwia uwierzytelnianie, pobieranie listy faktur oraz podgląd szczegółów (XML) wraz z rozbiciem stawek VAT.

> **Wersja:** Demo / Proof of Concept (PoC)
> **Status:** 🟢 Działa (Integracja z Supabase Edge Functions)

## 🚀 Możliwości

* **Autoryzacja KSeF:** Pełny proces logowania (`AuthorisationChallenge` -> `InitToken`) z szyfrowaniem tokena RSA po stronie serwera (Edge Function).
* **Synchronizacja Faktur:** Pobieranie faktur przyrostowych z API KSeF.
* **Filtracja:** Inteligentne filtrowanie faktur po stronie backendu (np. tylko dla konkretnego NIP-u nabywcy), aby ominąć limity wydajnościowe środowiska testowego.
* **Parsowanie XML:** Automatyczne pobieranie treści faktury i wyciąganie kluczowych danych (Netto/VAT dla stawek 23%, 8%, 5%).
* **Baza Danych:** Zapisywanie pobranych faktur w bazie PostgreSQL (Supabase) w celu stworzenia historii.
* **Obsługa Błędów:** System odporny na "Timeouty" API Ministerstwa (wydłużony czas oczekiwania, mniejsze paczki danych).

## 🛠️ Stack Technologiczny

**Frontend:**
* React (Vite)
* TypeScript
* Tailwind CSS (UI)

**Backend (Serverless):**
* **Supabase:** Baza danych (PostgreSQL) + Auth.
* **Supabase Edge Functions (Deno):**
    * Obsługa CORS (Proxy dla API KSeF).
    * Szyfrowanie RSA (`node-forge`).
    * Logika biznesowa synchronizacji.

## ⚙️ Wymagania

Aby uruchomić projekt lokalnie, potrzebujesz:
1.  **Node.js** (v18+)
2.  **Supabase CLI** (do zarządzania funkcjami backendowymi)
3.  **Docker Desktop** (wymagany tylko jeśli chcesz testować funkcje lokalnie przez `supabase functions serve`).

## 📥 Instalacja i Uruchomienie

### 1. Frontend (Aplikacja React)

```bash
# Sklonuj repozytorium
git clone [twoj-url-repo]

# Wejdź do katalogu
cd project

# Zainstaluj zależności
npm install

# Uruchom aplikację deweloperską
npm run dev

## Vad jag bygger

### 1. Adress + område (gata, postnr, ort + område-dropdown)

**Databas (migration):**
- `tenants` får nya kolumner: `street`, `postal_code`, `city`, `area_id` (FK).
- Migrerar befintlig `address` → `street` automatiskt; `address`-kolumnen behålls (deprecated) tills allt är migrerat.
- Ny tabell `areas` (`id`, `name`, `created_at`) — admin hanterar listan. RLS: admin full åtkomst, inloggade får läsa.

**UI:**
- Ny sida `/admin/areas` (CRUD: lägg till, byt namn, ta bort om tomt).
- Hyresgästformulär (nytt + redigera): separata fält Gata, Postnr, Ort + dropdown Område (med "Nytt område…" inline).
- Hyresgästlista (`/admin/tenants`): ny kolumn **Område** + filter-chips ovanför tabellen ("Alla", "Stava (5)", "Norrtälje (13)" …) som filtrerar listan.
- Ärendelista (`/admin/tickets` & `/tickets`): visar område-badge per rad + filter på område.
- Dashboard (admin): kort "Hyresgäster per område" (lista med antal, klick → filtrerad hyresgästlista).

### 2. Prioritet på ärenden — endast admin

- Tar bort prioritetsväljaren från hyresgästens "Nytt ärende"-formulär. Hyresgäst väljer bara kategori + titel + beskrivning.
- Nya ärenden får `priority = 'normal'` som default.
- Admin kan sätta/ändra prioritet i ärendets detaljvy (finns redan, säkerställs).
- Hyresgäst ser prioriteten read-only när admin har satt den.

### 3. Personlig dashboard-hälsning

- Admin-dashboard: "Välkommen tillbaka, **{förnamn}**" istället för "Hyresvärd". Hämtar från `profiles.full_name` (eller email-prefix som fallback).
- Hyresgäst-dashboard: samma mönster.

### 4. Mobilanpassning (admin + hyresgäst)

- AppShell: sidomenyn blir en hamburgermeny under 768px (Sheet-komponent).
- Alla tabeller (`hyresgäster`, `ärenden`, `hyror`, `meddelanden`) får card-layout på mobil (`md:hidden` cards + `hidden md:table`).
- Formulär: full bredd, större touch-targets, knappar `w-full sm:w-auto`.
- Dashboard-kort: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

### 5. Mail-notiser

**Setup:** Lovable Emails (inbyggt) — sätter upp e-postdomän + transactional templates.

**Triggers (alla via serverFn, idempotenta):**
- **Nytt ärende** → mail till alla admins.
- **Nytt meddelande** → mail till mottagaren (admin eller hyresgäst) om meddelandet inte lästs inom ~5 min (pg_cron-batch så vi inte spammar vid aktiv chatt).
- **Ny faktura** → mail till hyresgäst (manuell trigger, se punkt 6).
- **Påminnelse obetald hyra** → pg_cron varje morgon, skickar 3 dagar efter förfallodatum + en gång till efter 10 dagar.

**Per-hyresgäst på/av** (frivilligt men föreslås): `tenants.notify_email boolean default true`.

### 6. Fakturaflöde (300 hyresgäster)

- "Skapa månadens hyror"-knapp genererar `rent_invoices` för alla aktiva hyresgäster (idempotent på (tenant_id, period)).
- **Skickar INTE mail automatiskt.** Efter generering visas en lista "X fakturor klara att skickas" med knapp "Skicka mail till alla" + per-rad "Skicka".
- ServerFn `sendInvoiceEmails` köar via Lovable Emails queue (klarar 300 utan tidsgräns).
- Status per faktura: `email_sent_at` kolumn så admin ser vad som skickats.

### 7. Övrigt jag rekommenderar för 300 hyresgäster

Föreslås men implementeras bara om du tycker det låter bra (säg till så lägger jag till i bygget):

- **Bulk-import CSV** av hyresgäster (initial uppladdning av 300 stycken).
- **Sök överallt** (global sökruta i headern: hyresgäst, ärende, lägenhet).
- **Excel-export** av hyror/fakturor per månad (för bokföring).
- **Anteckningsfält per ärende** för admins (intern, syns inte för hyresgäst).
- **"Mina ärenden"-filter på admin** (tilldelade till mig) om flera admins.
- **Snabbåtgärder från ärendelistan** (ändra status utan att öppna).
- **Statistik på dashboard**: obetalda hyror denna månad, öppna ärenden per område, äldsta öppna ärendet.

### Frågor om notiser/fakturering

- **Notiser går via mail.** Push-notiser i mobilen kräver PWA + native — inte med i denna runda om du inte vill.
- **Fakturor skickas inte automatiskt** — du klickar "Skicka" när du är redo (säkrare för 300 mottagare).

## Teknisk sammanfattning

- Migrations: `areas` + nya `tenants`-kolumner + `rent_invoices.email_sent_at` + `notify_email`.
- ServerFns: `sendTicketCreatedEmail`, `sendNewMessageEmail`, `sendInvoiceEmails`, `sendOverdueReminders`.
- pg_cron: `process-overdue-rents` dagligen 08:00, `process-unread-messages` var 5:e minut.
- Email infra: `setup_email_infra` + `scaffold_transactional_email` + 4 templates (ärende, meddelande, faktura, påminnelse).
- Mobil: `useIsMobile` + `Sheet` för nav + responsiva tabell-cards.

## Vad jag behöver innan implementation

1. **Område-tabell** — okej att jag skapar tom lista och du fyller på själv via `/admin/areas`? Eller vill du att jag seedar med några exempel (Stava, Norrtälje, Lervik)?
2. **E-postdomän** — har du redan en domän du vill skicka från (t.ex. `noreply@dittforetag.se`), eller ska jag använda Lovables standarddomän tills vidare?
3. **"Övrigt"-listan** under punkt 7 — vill du ha allt, inget, eller markera vilka jag ska ta med nu?

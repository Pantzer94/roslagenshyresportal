## Vad jag hittade vid genomgång

Koden ser i grunden korrekt ut för alla fem punkterna — RLS, FK-cascade (alla relevanta tabeller har `ON DELETE CASCADE` mot `tenants`), enums och defaults stämmer. Att felen ändå inträffar i UI:t pekar på små men avgörande detaljer. Planen nedan både fixar de mest sannolika orsakerna och lägger till en saknad funktion (admin-styrt e-postbyte).

### 1. Admin kan inte öppna/svara på meddelanden
Trolig orsak: I `_authenticated.messages.tsx` renderar admin-vyn en lista där varje konversation är en `<Link to="/messages/$tenantId">`. Men sidan ligger på samma route (`/messages`), och när man navigerar till `/messages/<id>` byts hela rutan — det fungerar tekniskt, men det finns ingen visuell respons om query-cachen för `admin-conversations` "blockerar" navigeringen i mobil-vy (Link inuti scrollbar div). Åtgärd:
- Byt `<Link>` mot `useNavigate()` på rad-klick för säkerhet, och behåll Link semantiskt.
- Säkerställ att `/messages/$tenantId` faktiskt mountas: läs ut `tenant` via `useQuery` med tydligt fallback ("Hittades inte") och visa felet om RLS skulle blockera.
- Lägg till en explicit "Öppna" knapp per rad så det är glasklart vad som händer.

### 2. Hyresgäst kan inte skapa nya ärenden
Trolig orsak: Hyresgästens `tenants.user_id` är inte länkad (registrering med annan e-post-casing eller efter att admin ändrat e-post). Då tar `tickets/new` toast: "Din profil är inte kopplad till en hyresgäst.". Åtgärd:
- Lägg till case-insensitiv backup-länkning vid första `/dashboard`-laddning för hyresgäst: om `tenants.user_id IS NULL` men `lower(email) = lower(auth.email)` så UPDATE tenant.user_id = auth.uid().
- Visa tydligare felmeddelande i UI som ber hyresgästen kontakta hyresvärden om kopplingen saknas.
- Kontrollera att "Nytt ärende"-knappen syns korrekt i `/tickets`-listan (lägg in i header om saknas).

### 3. Hyresvärd kan inte ladda upp dokument
Trolig orsak: Storage-policyn för bucket `documents` är `ALL` för admin — fungerar. Men `documents`-tabellens INSERT kräver `uploaded_by = auth.uid()`. Om `useAuth().user` är `undefined` vid klick (race) blir `user!.id` `undefined` → 23502 NOT NULL eller policyfel. Åtgärd:
- Hämta `auth.getUser()` direkt vid uppladdning istället för att lita på hook-state.
- Visa råa Supabase-felmeddelandet i toast så vi ser exakt vad som händer om det fortfarande felar.

### 4. Ta bort hyresgäst + flagga/anteckning
Koden finns redan (röd knapp med AlertDialog, Switch + Textarea). Om de "inte funkar" är trolig orsak att klicket inom `<Card>` propagerar eller att raden i `admin/tenants`-listan har `onClick` som tar över. Åtgärd:
- Stoppa eventbubblning på rad-onClick så att andra interaktioner inte konkurrerar.
- Bekräfta att Spara-knappen faktiskt skickar `flagged` + `flag_note` (verifierat — ser korrekt ut, men lägg in toast som syns alltid).
- Lägg till `e.stopPropagation()` runt AlertDialogTrigger och Spara.

### 5. Vad händer om hyresgästen byter e-post?
Idag: tenant.email och auth.users.email är två separata fält. Om hyresgästen byter sin login-e-post i Supabase Auth (t.ex. via "Min profil") så uppdateras INTE `tenants.email`, och eftersom `handle_new_user` bara används vid registrering så blir det ingen ny koppling. De kan fortfarande logga in (auth fungerar på `user_id`), men admin ser fel e-post i listan.

Åtgärd:
- Hyresgästen får INTE byta login-e-post själv i UI (dölj/blockera fältet i `/profile` för rollen tenant).
- Admin kan byta hyresgästens e-post på två sätt:
  a) **Bara visningsdata** (vanligast): ändra i `tenants.email`. Påverkar inte login.
  b) **Login-e-post**: ny server-funktion `adminUpdateTenantEmail(tenant_id, new_email)` som via `supabaseAdmin.auth.admin.updateUserById()` byter både auth-e-post och tenants.email i en transaktion.
- Lägg en DB-trigger: om `tenants.user_id` är `NULL` och någon registrerar sig med matchande e-post, koppla auto (redan finns i `handle_new_user`). Behåll.
- Dokumentera i UI: liten info-text vid e-postfältet "Detta är endast visningsadress. Använd 'Byt login-e-post' för att ändra inloggningen."

## Tekniska detaljer

- Ny serverFn: `src/lib/admin.functions.ts` → `adminUpdateTenantEmail` (middleware: `requireSupabaseAuth` + admin-check via `has_role`). Använder `supabaseAdmin.auth.admin.updateUserById` + UPDATE på `tenants`.
- Ingen ny migration nödvändig för buggfixarna. Eventuellt trigger som speglar `auth.users.email`-ändringar till `tenants.email` (valbart — frågar nedan).
- Inga schemaändringar för flag/delete (kolumnerna finns).

## Frågor jag behöver svar på innan implementation

1. Vill du att admin ska kunna byta hyresgästens **login-e-post** (kräver Admin API) eller räcker det att admin kan ändra visningsadressen i `tenants` och hyresgästen själv byter sin login i sitt konto?
2. För "delete tenant" — vill du behålla själva auth-kontot (de kan logga in men har ingen tenant-koppling) eller ska vi även radera auth.users-kontot (helt borttaget)?
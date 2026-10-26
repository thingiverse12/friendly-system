# Implementationsstatus

Status per 2026-10-26. Definition av klart: en användare kan öppna sajten,
starta ett fall, säkra och koppla bevis, förhöra misstänkta, lämna en
anklagelse och få en sammanhängande lösning – med fungerande multiplayer.

## Funktioner som är helt implementerade och verifierade

| Område (masterpromptens kapitel) | Status |
| --- | --- |
| Responsiv noir-design, navigation, exempeldata (4) | ✅ Mobil/surfplatta/desktop, sidomeny + mobil bottennav |
| Starta utredning: snabbstart + avancerade inställningar, sammanfattning, privata rumskoder (5) | ✅ |
| Falltyper och svenska miljöer, påhittade personer (6) | ✅ Två fullständiga fall; fem miljöer och fem typer i datamodellen |
| Låst fallmodell: hemlig kedja, alibin, kunskap, lögner, betydelser (7, steg 1–4) | ✅ Persistens, validering och versionslås |
| Förhör: fria frågor, föreslagna frågor, beviskonfrontation, lögner utan automatiskt skuldstänk (8) | ✅ Deterministisk motor + valfri extern AI |
| Utredningspanel: bevis, personer, tidslinje, anteckningar, källstatus (9) | ✅ Fem källstatusnivåer |
| Interaktiv bevisbräda med kopplingar, motivering, klassificering, tryckalternativ på mobil (10) | ✅ |
| Fyra svårighetsgrader, tre ledtrådsnivåer, assistent utan facittillgång (11) | ✅ Grader påverkar vägledning, inte facit |
| Slutlig anklagelse, bedömning, fullständig lösning, alternativa teorier, gissningsgräns (12) | ✅ |
| Multiplayer: privata rum, kod/länk, samarbete, tävling, dolda teorier, host-kick, host-migrering, återanslutning (13) | ✅ WS + REST |
| Poängsystem, serversidig verifiering, realistiskt/tävling, tidsbonus (14) | ✅ |
| Feltålighet: autospar, idempotens, polling-fallback, reservsvar, versionsläge (17) | ✅ |
| Fallbyggare: editor, testläge, versioner, valideringsrapport, publiceringsspärr, privata utkast (18) | ✅ |
| QA: kontroll A (logik), B (oberoende utredare), C (alternativa lösningar), D (injektion/namnskydd), E (rapport) (19) | ✅ Deterministiska tester; ej en matematisk garanti – markeras i UI |
| Community: sök/filter, betyg, favoriter, spoilers, rapporter, moderatorvy, kvalitetsstatus, versionslås (20) | ✅ |
| Konton, scrypt, sessioner, RBAC, privat profil, export, raderingsbegäran, facitskydd (21) | ✅ |
| Hybrid-AI, budgetar/kvoter, cacheliknande kostnadskontroll, gratis fallback (22) | ✅ |
| Statistik och prestationer, integritetsfokuserade aggregat (23) | ✅ |
| Datamodell (24) och de tio säkerhetsreglerna (25) | ✅ Se `docs/ARKITEKTUR.md`, tester i `tests/` |
| Testsvit (26): enhet, integration, säkerhet, hela spelcykeln | ✅ 29 automatiska tester + två rökskript |
| Kampanj (15): kontinuitet, sparad status, val som journalförs | ✅ Struktur + två spelbara kapitel |
| Ljud (16): textbaserat/filmiskt läge, separat av/på, webbläsar-TTS | ✅ Berättarröst via Web Speech API |

## Delvis implementerat / medvetna begränsningar

- **AI-genererade nya fall från en knapp (7):** den kontrollerade
  processen (lösning först → offentligt material → validering → lås) finns
  som schema, builderflöde och valideringstjänst, men ingen knapp som skapar
  ett helt nytt dokument med en extern språkmodell. Fallbyggaren är manuell
  med AI-stöd i förhören. Att lägga till en genererande provider är en
  avgränsad utbyggnad bakom `ai/provider.js`.
- **Extern AI-leverantör:** adaptern för OpenAI-kompatibla endpoints är
  byggd men har inte verifierats mot en levande tjänst i denna miljö (ingen
  nyckel). Den lokala motorn är standard och täcker hela spelflödet.
- **Kampanj:** två fullständiga kapitel finns; kapitel 3–5 visas ärligt som
  "kommer snart". Tidigare val journalförs men ännu finns ingen förgrenad
  berättelsereglermotor.
- **Community:** sök, filter, betyg, favoriter, kommentarer och moderering är
  komplett. Egna skaparsidor och topplistor finns inte som egna sidor
  (sortering efter betyg/popularitet i katalogen fungerar). Moderatorroller
  tilldelas via `scripts/make-mod.mjs` och får en egen moderatorvy.
- **Ljud:** ingen komponerad musik/ljudfiler; filmiskt läge använder
  webbläsarens inbyggda talsyntes. Alla ledtrådar finns alltid i text.
- **Innehållssäkerhet (D):** grundläggande mönstertvätt för promptinjektion
  och en namnlista; en fullständig innehållsmodereringspipeline ingår inte.
- **Belastningstester och skalning:** SQLite med WAL är lämpligt för
  små–medelstora installationer. Flera instanser med delad databas kräver
  en extern databas (tjänstelagret är SQL-baserat och flyttbart).
- **E-postflöden** för integritetsbegäranden är manuella (`privacy_requests`).
- **Webbläsartester:** automatiserade UI-tester (Playwright etc.) finns inte;
  manuell kontroll rekommenderas för tillgänglighet på fysiska enheter.

## Verifierade säkerhetspåståenden (i test)

- Facit och hemliga modeller finns inte i offentliga API-svar.
- Facit nekas före korrekt anklagelse även via direkt API-anrop.
- Användare kan inte läsa varandras privata teorier i tävlingsläge.
- Poäng kan inte sättas av klienten – inga sådana endpoints existerar.
- Ej godkända fall kan inte startas som vanliga rum.
- Borttagna rummedlemmar och icke-värdar nekas behörighetsstyrda handlingar.
- Injektionsliknande text i fallinnehåll ger valideringsvarning.
- Idempotenta upprepningar skapar inte dubbletter.

## Kända tekniska begränsningar

- `node:sqlite` är markerat experimentellt i Node 22 (startflagga
  `--experimental-sqlite` ingår i alla script).
- Sessionsdatabasen är filbaserad; säkerhetskopiera hela `data/`.

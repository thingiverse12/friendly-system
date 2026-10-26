# Mordgåtan – AI-drivet mordgåtespel för webben

> *Sanningen ligger i detaljerna.*

Mordgåtan är ett fullständigt, spelbart mordgåtespel för webbläsaren. En spelare
eller en grupp vänner samlar bevis, förhör misstänkta, analyserar tidslinjer,
kopplar samband på en interaktiv bevisbräda och lämnar en slutlig anklagelse –
allt mot en versionslåst, hemlig fallmodell som aldrig läcker till klienten.

## Funktioner i korthet

- **Komplett spelcykel**: snabbstart → utredningspanel → bevis → förhör → bevisbräda → anklagelse → fullständig lösning.
- **Två kompletta, kvalitetssäkrade officiella fall** (*Hotell Silversolen*, *Döden i skärgården*) med låsta facit, realistiska svenska miljöer och påhittade personer.
- **Tre lägen**: enspelare, samarbete (delad utredning) och tävling (privata teorier, dolda anklagelser, serverpoäng).
- **AI-förhör** med en inbyggd deterministisk motor som standard, samt en valfri OpenAI-kompatibel modell. Svar valideras och faller alltid tillbaka på säkra reservsvar – motorn hittar aldrig på nya fakta.
- **Avancerad fallbyggare** med versionshantering, automatisk logikvalidering (kontroll A–D), oberoende "AI-utredare", testläge och publiceringsspärr.
- **Community**: sökbar katalog, filter, betyg, favoriter, spoilerkommentarer, rapportering och moderering.
- **Säkerhet i grunden**: scrypt-lösenord, httpOnly-sessioner, RBAC, hemliga facit i separata tabeller, idempotenta operationer, auditlogg och integritetsexport/radering.
- **Responsiv** för mobil, surfplatta och desktop med tangentbordsstöd, skärmläsar-etiketter och källstatus på alla uppgifter.

## Teknikstack

| Lager | Val |
| --- | --- |
| Klient | React 18, React Router 6, Vite, vanilla CSS (designsystem i `client/src/styles`) |
| Server | Node.js 22, Express 4, inbyggd SQLite (`node:sqlite`) |
| Realtid | WebSocket (`ws`) – närvaro och händelsesignaler |
| Autentisering | scrypt + slumpade sessionstoken (httpOnly-cookie) |
| AI | Pluggbar provider: lokal deterministisk motor eller OpenAI-kompatibel endpoint |
| Tester | inbyggda testlöparen `node:test` (29 tester) + rökskript |

## Komma igång

Kräver Node.js ≥ 22.5 (använder det inbyggda SQLite-stödet).

```bash
npm install
npm run dev        # Vite (5173) + API/WS (8787), med automatisk omstart
# eller produktionsbygge:
npm run build
npm start
```

Demokonto (skapas automatiskt): **demo / demopass123**

## Testning

```bash
npm test                 # 29 automatiska tester (validering, poäng, AI-motor, integration, säkerhet)
node scripts/smoke.mjs   # manuell helflödes-rökning (kräver server på 8787)
node scripts/smoke2.mjs  # byggare, multiplayer, community, WebSocket
```

## Konfiguration

Se [`.env.example`](./.env.example) och [`docs/DRIFTSATTNING.md`](./docs/DRIFTSATTNING.md).
Utan AI-nycklar används den lokala, kostnadsfria motorn – hela spelet förblir spelbart.

## Dokumentation

- [Arkitektur och datamodell](docs/ARKITEKTUR.md)
- [Driftsättning och miljövariabler](docs/DRIFTSATTNING.md)
- [Implementationsstatus och kvarvarande arbete](docs/STATUS.md)

## Projektstruktur

```
server/src/        Express-API, WebSocket, databas, AI, speltjänster
server/src/cases/  Officiella falldokument (offentligt material + hemliga modeller)
client/src/        React-klient, sidor, designsystem
shared/            Delade konstanter mellan klient och server
tests/             Automatiserad testsvit
scripts/           Dev-start och rökskript
```

#!/usr/bin/env python3
"""Generates supabase/seed/0002_seed.sql from the verified content below.

Run:  python3 supabase/seed/content.py > supabase/seed/0002_seed.sql
Content is written in Swedish for school years 7-9 (and introductory gymnasiet).
Question answer formats (server-only):
  mcq      -> index into options
  tf       -> true/false
  fill     -> list of accepted answers (case/whitespace-insensitive)
  numeric  -> {"value": n, "tol": x}
  match    -> for each left item, the index of the matching right item
  short    -> list of keywords; any keyword contained in the answer counts
"""
import json

SUBJECTS = [
    ("matematik", "Matematik", "➗", "#3b82f6", 1),
    ("kemi", "Kemi", "⚗️", "#19c37d", 2),
    ("fysik", "Fysik", "⚡", "#f59e0b", 3),
    ("biologi", "Biologi", "🧬", "#22c55e", 4),
    ("historia", "Historia", "🏛️", "#a855f7", 5),
    ("geografi", "Geografi", "🌍", "#06b6d4", 6),
    ("svenska", "Svenska", "📖", "#ec4899", 7),
    ("engelska", "Engelska", "🇬🇧", "#ef4444", 8),
    ("spanska", "Spanska", "🇪🇸", "#f97316", 9),
]

# subject -> list of chapters: (year, title, [lessons], [questions])
# lesson: (title, body_markdown)
# question: (difficulty, qtype, prompt, options, answer, explanation)
CONTENT = {}

CONTENT["matematik"] = [
    (8, "Tal och procent", [
        ("Procent – grunderna", """
**Procent** betyder *hundradel*. 25 % är alltså 25/100 = 0,25.

### Tre vanliga frågor
1. **Delen:** Vad är 20 % av 150?  → 0,20 · 150 = **30**
2. **Andelen:** Hur många procent är 30 av 150? → 30/150 = 0,2 = **20 %**
3. **Det hela:** 30 är 20 % av vad? → 30 / 0,20 = **150**

### Förändringsfaktor
En höjning med 15 % motsvarar faktorn **1,15**. En sänkning med 15 % motsvarar **0,85**.
Exempel: 800 kr · 0,85 = 680 kr.

> Tips: Flera förändringar efter varandra multipliceras. +20 % och sedan −20 % ger 1,2 · 0,8 = 0,96, alltså 4 % *lägre* än från början.
"""),
        ("Bråk, decimaltal och procent", """
Samma tal kan skrivas på tre sätt:

| Bråk | Decimal | Procent |
|------|---------|---------|
| 1/2 | 0,5 | 50 % |
| 1/4 | 0,25 | 25 % |
| 3/4 | 0,75 | 75 % |
| 1/5 | 0,2 | 20 % |
| 1/3 | 0,333… | 33,3 % |

### Omvandla
- Bråk → decimal: dividera täljaren med nämnaren (3/4 = 3 ÷ 4 = 0,75).
- Decimal → procent: multiplicera med 100 (0,75 → 75 %).
- Procent → bråk: skriv över 100 och förkorta (40 % = 40/100 = 2/5).

### Förkorta och förlänga
12/16 kan förkortas med 4 till 3/4. Värdet ändras inte – bara skrivsättet.
"""),
    ], [
        ("easy", "mcq", "Vad är 25 % av 200?", ["25", "50", "75", "100"], 1, "25 % = en fjärdedel. 200 / 4 = 50."),
        ("easy", "tf", "3/4 är lika med 0,75.", None, True, "3 ÷ 4 = 0,75, vilket är 75 %."),
        ("easy", "numeric", "Vad är 7 · 8?", None, {"value": 56, "tol": 0}, "7 · 8 = 56."),
        ("easy", "fill", "Vad kallas ett heltal större än 1 som bara är delbart med 1 och sig självt?", None, ["primtal"], "Exempel på primtal: 2, 3, 5, 7, 11, 13."),
        ("medium", "numeric", "Lös ekvationen 3x + 5 = 20. Vad är x?", None, {"value": 5, "tol": 0}, "3x = 20 − 5 = 15, så x = 15/3 = 5."),
        ("medium", "mcq", "Ett par skor kostar 800 kr och priset sänks med 15 %. Vad blir det nya priset?", ["120 kr", "680 kr", "720 kr", "650 kr"], 1, "Förändringsfaktorn är 0,85. 800 · 0,85 = 680 kr."),
        ("medium", "numeric", "Vad är medelvärdet av talen 4, 8, 9 och 11?", None, {"value": 8, "tol": 0}, "(4 + 8 + 9 + 11) / 4 = 32 / 4 = 8."),
        ("medium", "tf", "Arean av en triangel beräknas som basen gånger höjden delat med två.", None, True, "A = (b · h) / 2."),
        ("hard", "numeric", "En cirkel har radien 5 cm. Hur stor är omkretsen i cm? (avrunda till heltal)", None, {"value": 31, "tol": 1}, "O = 2 · π · r = 2 · 3,14 · 5 ≈ 31,4 cm."),
        ("hard", "mcq", "Ett pris höjs först med 20 % och sänks sedan med 20 %. Jämfört med startpriset är det nya priset…", ["Samma", "4 % lägre", "4 % högre", "40 % lägre"], 1, "1,20 · 0,80 = 0,96 → 4 % lägre än från början."),
        ("hard", "numeric", "Lös ekvationen 2(x − 3) = x + 4. Vad är x?", None, {"value": 10, "tol": 0}, "2x − 6 = x + 4 → 2x − x = 4 + 6 → x = 10."),
        ("hard", "match", "Para ihop varje ekvation med sin lösning.", {"left": ["x² = 49", "2x = 18", "x / 4 = 3", "x − 7 = 1"], "right": ["x = 12", "x = 7", "x = 8", "x = 9"]}, [1, 3, 0, 2], "x² = 49 → x = 7 (positiv lösning), 2x = 18 → x = 9, x/4 = 3 → x = 12, x − 7 = 1 → x = 8."),
        ("expert", "numeric", "En rätvinklig triangel har kateterna 9 cm och 12 cm. Hur lång är hypotenusan i cm?", None, {"value": 15, "tol": 0}, "Pythagoras sats: 9² + 12² = 81 + 144 = 225, √225 = 15."),
        ("expert", "mcq", "10 000 kr sätts in på ett konto med 5 % ränta per år (ränta på ränta). Hur mycket finns efter 2 år?", ["11 000 kr", "11 025 kr", "10 500 kr", "12 000 kr"], 1, "10 000 · 1,05² = 10 000 · 1,1025 = 11 025 kr."),
        ("expert", "numeric", "Ekvationssystemet x + y = 10 och x − y = 4. Vad är x?", None, {"value": 7, "tol": 0}, "Addera ekvationerna: 2x = 14 → x = 7 (och y = 3)."),
        ("expert", "numeric", "Hur många procent är 36 av 240?", None, {"value": 15, "tol": 0}, "36 / 240 = 0,15 = 15 %."),
    ]),
    (8, "Algebra och ekvationer", [
        ("Lösa ekvationer", """
En **ekvation** är en likhet med ett okänt tal, oftast kallat *x*.
Målet är att få *x* ensamt på ena sidan.

### Balansmetoden
Det du gör på ena sidan måste du göra på andra sidan.

```
3x + 5 = 20
3x     = 15      (−5 på båda sidor)
 x     = 5       (÷3 på båda sidor)
```

### Kontrollera
Sätt in svaret i ursprungsekvationen: 3 · 5 + 5 = 20 ✔

### Parenteser
Multiplicera in först: 2(x − 3) = 2x − 6.

### Vanliga fel
- Att glömma byta tecken när en term flyttas över.
- Att bara dela ena sidan med ett tal.
"""),
    ], []),
]

CONTENT["kemi"] = [
    (8, "Atomer och periodiska systemet", [
        ("Atomens byggnad", """
Allt runt omkring oss är uppbyggt av **atomer**. En atom består av:

- **Protoner** (+) i kärnan
- **Neutroner** (neutrala) i kärnan
- **Elektroner** (−) som rör sig runt kärnan i *elektronskal*

### Atomnummer och masstal
- **Atomnummer** = antalet protoner. Det bestämmer vilket grundämne det är. Kol har alltid 6 protoner.
- **Masstal** = protoner + neutroner. Klor med 17 protoner och 18 neutroner har masstalet 35.

### Isotoper
Atomer av samma grundämne med olika antal neutroner kallas isotoper (t.ex. kol-12 och kol-14).

### Joner
Om en atom tar upp eller lämnar ifrån sig elektroner blir den laddad – en **jon**. Na⁺ har lämnat en elektron, Cl⁻ har tagit upp en.
"""),
        ("Periodiska systemet", """
**Periodiska systemet** ordnar grundämnena efter atomnummer.

- **Perioder** (rader) visar antalet elektronskal.
- **Grupper** (kolumner) samlar ämnen med lika många elektroner i yttersta skalet – de har därför liknande egenskaper.

### Viktiga grupper
| Grupp | Namn | Exempel | Egenskap |
|-------|------|---------|----------|
| 1 | Alkalimetaller | Na, K | Mycket reaktiva |
| 17 | Halogener | F, Cl | Reaktiva icke-metaller |
| 18 | Ädelgaser | He, Ne, Ar | Reagerar nästan aldrig |

### Varför är ädelgaser så stabila?
Deras yttersta elektronskal är **fullt**. Andra atomer strävar efter samma sak – det kallas **oktettregeln** och förklarar varför atomer bildar bindningar.
"""),
    ], [
        ("easy", "mcq", "Vilken kemisk beteckning har vatten?", ["H₂O", "CO₂", "O₂", "NaCl"], 0, "Vatten består av två väteatomer och en syreatom: H₂O."),
        ("easy", "tf", "Guld har den kemiska beteckningen Au.", None, True, "Au kommer från latinets *aurum*."),
        ("easy", "fill", "Vad kallas den minsta delen av ett grundämne som fortfarande har ämnets egenskaper?", None, ["atom", "en atom"], "Ordet atom kommer från grekiskans *atomos* – odelbar."),
        ("easy", "mcq", "Vilken partikel i atomen har negativ laddning?", ["Proton", "Neutron", "Elektron", "Jon"], 2, "Elektronerna är negativa, protonerna positiva och neutronerna neutrala."),
        ("medium", "mcq", "En lösning med pH 7 är…", ["Sur", "Basisk", "Neutral", "Starkt sur"], 2, "pH under 7 är surt, över 7 basiskt och exakt 7 neutralt – som rent vatten."),
        ("medium", "tf", "Natriumklorid (NaCl) hålls ihop av kovalenta bindningar.", None, False, "NaCl är ett salt med **jonbindning** mellan Na⁺ och Cl⁻."),
        ("medium", "numeric", "Kol har atomnummer 6. Hur många protoner har en kolatom?", None, {"value": 6, "tol": 0}, "Atomnumret är alltid lika med antalet protoner."),
        ("medium", "mcq", "Vilken gas bildas när zink reagerar med saltsyra?", ["Syrgas", "Vätgas", "Koldioxid", "Kvävgas"], 1, "Zn + 2HCl → ZnCl₂ + H₂. Vätgasen kan testas med knallgasprovet."),
        ("hard", "mcq", "Balansera reaktionen: __ H₂ + O₂ → 2 H₂O. Vilken koefficient ska stå framför H₂?", ["1", "2", "3", "4"], 1, "2 H₂ + O₂ → 2 H₂O ger 4 H och 2 O på båda sidor."),
        ("hard", "match", "Para ihop bindningstypen med ett exempel.", {"left": ["Jonbindning", "Kovalent bindning", "Metallbindning"], "right": ["Koppar (Cu)", "Natriumklorid (NaCl)", "Vatten (H₂O)"]}, [1, 2, 0], "Salter har jonbindning, molekyler som vatten har kovalent bindning och metaller har metallbindning."),
        ("hard", "fill", "Vilket gruppnummer i periodiska systemet har ädelgaserna?", None, ["18", "grupp 18"], "Ädelgaserna (He, Ne, Ar, Kr, Xe, Rn) står längst till höger i grupp 18."),
        ("hard", "tf", "En exoterm reaktion avger energi, oftast i form av värme.", None, True, "Förbränning är ett typiskt exempel på en exoterm reaktion."),
        ("expert", "mcq", "En atom har 17 protoner och 18 neutroner. Vad är dess masstal?", ["17", "18", "35", "36"], 2, "Masstal = protoner + neutroner = 17 + 18 = 35 (klor-35)."),
        ("expert", "mcq", "Varför är ädelgaserna så lite reaktiva?", ["De har fullt yttre elektronskal", "De är tunga", "De saknar elektroner", "De är metaller"], 0, "Ett fullt yttre skal är energimässigt stabilt – atomen behöver varken ta upp eller lämna elektroner."),
        ("expert", "numeric", "Vattens molmassa är 18 g/mol. Hur många mol är 36 g vatten?", None, {"value": 2, "tol": 0}, "n = m / M = 36 / 18 = 2 mol."),
        ("expert", "fill", "Vad kallas reaktionen när en syra och en bas reagerar och bildar salt och vatten?", None, ["neutralisation", "neutralisering", "en neutralisation"], "Exempel: HCl + NaOH → NaCl + H₂O."),
    ]),
    (8, "Kemiska reaktioner", [
        ("Kemiska bindningar", """
Atomer binder till varandra för att få fulla yttre elektronskal.

### Jonbindning
En metall **lämnar** elektroner till en icke-metall. Det bildas positiva och negativa **joner** som dras till varandra. Exempel: **NaCl** (koksalt). Salter har höga smältpunkter och leder ström när de är lösta i vatten.

### Kovalent bindning (molekylbindning)
Två icke-metaller **delar** på elektronpar. Exempel: **H₂O**, **CO₂**, **O₂**. Molekyler har ofta låga smält- och kokpunkter.

### Metallbindning
Metallatomer delar ett "hav" av fria elektroner. Därför leder metaller ström och värme och går att böja.

### Snabbtest
- Metall + icke-metall → jonbindning
- Icke-metall + icke-metall → kovalent bindning
- Metall + metall → metallbindning
"""),
        ("Syror och baser", """
### pH-skalan
pH går från 0 till 14.
- **pH < 7** surt (citron ≈ 2, magsaft ≈ 1,5)
- **pH = 7** neutralt (rent vatten)
- **pH > 7** basiskt (tvål ≈ 10, lut ≈ 14)

### Vad är en syra?
En syra avger **vätejoner (H⁺)** i vatten. Vanliga syror: saltsyra HCl, svavelsyra H₂SO₄, kolsyra H₂CO₃.

### Vad är en bas?
En bas tar upp H⁺ eller avger **hydroxidjoner (OH⁻)**. Vanliga baser: natriumhydroxid NaOH, ammoniak NH₃.

### Neutralisation
Syra + bas → **salt + vatten**.
HCl + NaOH → NaCl + H₂O

### Indikatorer
BTB är gul i sur lösning, grön i neutral och blå i basisk.
"""),
    ], []),
]

CONTENT["fysik"] = [
    (8, "Kraft och rörelse", [
        ("Hastighet och acceleration", """
### Hastighet
Hastighet = sträcka / tid, **v = s / t**.
Enheten är m/s eller km/h. 1 m/s = 3,6 km/h.

Exempel: 120 km på 2 h → 60 km/h.

### Acceleration
Acceleration är hur snabbt hastigheten ändras: **a = Δv / t** (enhet m/s²).
Ett föremål som faller fritt accelererar med ungefär **9,8 m/s²** (ofta avrundat till 10).
Efter 3 sekunder: v = 10 · 3 = 30 m/s.

### Diagram
I ett **s–t-diagram** betyder brant linje hög hastighet.
I ett **v–t-diagram** betyder brant linje stor acceleration, och arean under kurvan är sträckan.
"""),
        ("Newtons lagar", """
### Första lagen – tröghetslagen
Ett föremål behåller sin rörelse (eller vila) tills en kraft påverkar det. Det är därför du åker framåt när bussen bromsar.

### Andra lagen – kraftekvationen
**F = m · a**
Kraft (N) = massa (kg) · acceleration (m/s²).
5 kg som accelererar 3 m/s² kräver 15 N.

### Tredje lagen – kraft och motkraft
Varje kraft har en lika stor motriktad kraft. När du hoppar trycker du på jorden – och jorden trycker tillbaka.

### Tyngdkraft
Tyngd = m · g, där g ≈ 9,8 N/kg. En massa på 2 kg har tyngden ≈ 19,6 N.
"""),
    ], [
        ("easy", "mcq", "Vilken är SI-enheten för kraft?", ["Joule", "Newton", "Watt", "Volt"], 1, "Kraft mäts i newton (N), uppkallad efter Isaac Newton."),
        ("easy", "tf", "Ljud färdas snabbare än ljus.", None, False, "Ljus färdas ca 300 000 km/s, ljud bara ca 340 m/s i luft."),
        ("easy", "numeric", "En bil kör 120 km på 2 timmar. Vad är medelhastigheten i km/h?", None, {"value": 60, "tol": 0}, "v = s / t = 120 / 2 = 60 km/h."),
        ("easy", "fill", "Vad kallas kraften som drar föremål mot jorden?", None, ["gravitation", "tyngdkraft", "gravitationskraft", "tyngdkraften", "gravitationen"], "Tyngdkraften (gravitationen) verkar mellan alla massor."),
        ("medium", "numeric", "Ohms lag: Spänningen är 12 V och resistansen 4 Ω. Hur stor är strömmen i ampere?", None, {"value": 3, "tol": 0}, "I = U / R = 12 / 4 = 3 A."),
        ("medium", "mcq", "Vilken av dessa är en förnybar energikälla?", ["Kol", "Olja", "Vindkraft", "Naturgas"], 2, "Vind, sol, vatten och biobränsle är förnybara – de tar inte slut."),
        ("medium", "tf", "Ljusets hastighet i vakuum är ungefär 300 000 km/s.", None, True, "Exakt värde: 299 792 458 m/s."),
        ("medium", "mcq", "Newtons första lag handlar om…", ["Tröghet", "Kraft = massa · acceleration", "Kraft och motkraft", "Gravitation"], 0, "Första lagen kallas tröghetslagen."),
        ("hard", "numeric", "F = m · a. En massa på 5 kg accelererar med 3 m/s². Hur stor är kraften i newton?", None, {"value": 15, "tol": 0}, "F = 5 · 3 = 15 N."),
        ("hard", "numeric", "En lampa drar 2 A vid 230 V. Vilken effekt har den i watt?", None, {"value": 460, "tol": 0}, "P = U · I = 230 · 2 = 460 W."),
        ("hard", "mcq", "Varför ser vi blixten innan vi hör åskan?", ["Ljus färdas mycket snabbare än ljud", "Ljud färdas snabbare än ljus", "Blixten uppstår före åskan", "Åskan sker längre bort"], 0, "Ljuset når oss nästan omedelbart; ljudet tar ca 3 s per kilometer."),
        ("hard", "match", "Para ihop storheten med rätt enhet.", {"left": ["Energi", "Effekt", "Spänning", "Resistans"], "right": ["Ohm", "Watt", "Joule", "Volt"]}, [2, 1, 3, 0], "Energi i joule, effekt i watt, spänning i volt, resistans i ohm."),
        ("expert", "numeric", "Ett föremål faller fritt från vila (g ≈ 10 m/s²). Vilken hastighet i m/s har det efter 3 sekunder? (bortse från luftmotstånd)", None, {"value": 30, "tol": 0}, "v = g · t = 10 · 3 = 30 m/s."),
        ("expert", "numeric", "Lägesenergi: E = m · g · h. m = 2 kg, h = 5 m, g = 9,8. Hur många joule? (heltal)", None, {"value": 98, "tol": 1}, "E = 2 · 9,8 · 5 = 98 J."),
        ("expert", "mcq", "Två motstånd på 6 Ω och 3 Ω parallellkopplas. Vad blir ersättningsresistansen?", ["9 Ω", "4,5 Ω", "2 Ω", "1 Ω"], 2, "1/R = 1/6 + 1/3 = 1/6 + 2/6 = 3/6 → R = 2 Ω."),
        ("expert", "mcq", "Vilket påstående om trycket i en vätska stämmer?", ["Det ökar med djupet", "Det minskar med djupet", "Det är konstant", "Det beror bara på kärlets form"], 0, "p = ρ · g · h – ju djupare, desto större tryck."),
    ]),
    (9, "Elektricitet", [
        ("Ohms lag", """
### Tre storheter
- **Spänning U** (volt, V) – "trycket" som driver strömmen
- **Ström I** (ampere, A) – hur många laddningar som passerar per sekund
- **Resistans R** (ohm, Ω) – motståndet mot strömmen

### Ohms lag
**U = R · I**, alltså I = U / R och R = U / I.

Exempel: 12 V över 4 Ω ger I = 12 / 4 = 3 A.

### Effekt
**P = U · I** (watt). En lampa på 230 V som drar 2 A har effekten 460 W.

### Serie- och parallellkoppling
- **Serie:** samma ström överallt, resistanserna adderas (R = R₁ + R₂).
- **Parallell:** samma spänning över grenarna, 1/R = 1/R₁ + 1/R₂. Ersättningsresistansen blir *mindre* än den minsta.
"""),
    ], []),
]

CONTENT["biologi"] = [
    (8, "Cellen och genetik", [
        ("Cellen", """
Alla levande organismer är uppbyggda av **celler**.

### Delar i en djurcell
- **Cellmembran** – styr vad som kommer in och ut
- **Cellkärna** – innehåller DNA
- **Mitokondrier** – cellens "kraftverk", frigör energi ur socker (cellandning)
- **Ribosomer** – bygger proteiner

### Växtcellen har dessutom
- **Cellvägg** av cellulosa
- **Kloroplaster** med klorofyll för **fotosyntesen**
- **Vakuol** som lagrar vatten

### Fotosyntes och cellandning
Fotosyntes: koldioxid + vatten + ljusenergi → socker + syre
Cellandning: socker + syre → koldioxid + vatten + energi

De två processerna är varandras motsatser och håller igång livet på jorden.
"""),
        ("DNA och arv", """
### DNA
**DNA** (deoxiribonukleinsyra) är molekylen som bär den genetiska informationen. Den är formad som en dubbelspiral.

- En **gen** är en bit DNA som är receptet på ett protein.
- **Kromosomer** är hoppackat DNA. Människan har **46** kromosomer (23 par) i kroppscellerna och 23 i könscellerna.

### Dominanta och recessiva anlag
Varje egenskap styrs av två anlag (ett från varje förälder).
- **Dominant** anlag (B) syns alltid.
- **Recessivt** anlag (b) syns bara om båda är recessiva (bb).

### Korsningsschema Bb × Bb
|   | B | b |
|---|---|---|
| **B** | BB | Bb |
| **b** | Bb | bb |

25 % BB, 50 % Bb, 25 % bb. Om b = blå ögon får 1 av 4 barn blå ögon.

### Mutationer
Förändringar i DNA. De flesta är harmlösa, några skadliga – och några ger fördelar som evolutionen kan bygga vidare på.
"""),
    ], [
        ("easy", "mcq", "Vilken del av cellen kallas ofta cellens kraftverk?", ["Cellkärnan", "Mitokondrien", "Ribosomen", "Cellmembranet"], 1, "I mitokondrierna sker cellandningen som frigör energi."),
        ("easy", "tf", "Växter utför fotosyntes.", None, True, "I kloroplasterna omvandlas ljusenergi till kemisk energi i socker."),
        ("easy", "fill", "Vilken gas tar växterna upp från luften vid fotosyntesen?", None, ["koldioxid", "co2", "co₂"], "Koldioxid + vatten + ljus → socker + syre."),
        ("easy", "mcq", "Vilket organ pumpar runt blodet i kroppen?", ["Lungorna", "Levern", "Hjärtat", "Njurarna"], 2, "Hjärtat är en muskel som slår ungefär 70 gånger per minut i vila."),
        ("medium", "mcq", "Hur många kromosomer har en vanlig mänsklig kroppscell?", ["23", "46", "48", "92"], 1, "46 kromosomer i 23 par. Könscellerna har 23."),
        ("medium", "tf", "Bakterier är mindre än virus.", None, False, "Virus är mycket mindre än bakterier och kan inte föröka sig på egen hand."),
        ("medium", "mcq", "Vad kallas en organism som bryter ner döda växter och djur?", ["Producent", "Konsument", "Nedbrytare", "Rovdjur"], 2, "Nedbrytare (t.ex. svampar och bakterier) återför näringsämnen till kretsloppet."),
        ("medium", "fill", "Vad kallas läran om ärftlighet?", None, ["genetik", "ärftlighetslära", "genetiken"], "Genetiken grundades av Gregor Mendel och hans ärtförsök."),
        ("hard", "mcq", "Två brunögda föräldrar bär båda anlaget Bb. Hur stor är sannolikheten att ett barn får blå ögon (bb)?", ["0 %", "25 %", "50 %", "75 %"], 1, "Korsningsschemat ger BB, Bb, Bb, bb → 1 av 4 = 25 %."),
        ("hard", "match", "Para ihop blodets delar med deras uppgift.", {"left": ["Röda blodkroppar", "Vita blodkroppar", "Blodplättar"], "right": ["Får blodet att levra sig", "Transporterar syre", "Bekämpar infektioner"]}, [1, 2, 0], "Röda = syre (hemoglobin), vita = immunförsvar, blodplättar = koagulering."),
        ("hard", "tf", "Vid vanlig celldelning (mitos) får dottercellerna hälften så många kromosomer som modercellen.", None, False, "Vid mitos får dottercellerna lika många kromosomer. Halvering sker vid meios (bildning av könsceller)."),
        ("hard", "mcq", "Vad menas med en art?", ["Organismer som kan få fertil avkomma tillsammans", "Organismer med samma färg", "Alla djur i ett område", "Organismer som äter samma föda"], 0, "Häst och åsna kan få mulor, men mulor är sterila – därför är häst och åsna olika arter."),
        ("expert", "mcq", "Varför är antibiotikaresistens ett exempel på evolution?", ["Bakterier med resistensgener överlever och förökar sig", "Bakterierna lär sig undvika medicinen", "Antibiotikan muterar", "Människor blir immuna"], 0, "Naturligt urval: de bakterier som råkar vara motståndskraftiga överlever behandlingen och för generna vidare."),
        ("expert", "fill", "Vilken molekyl bär cellens genetiska information?", None, ["dna", "deoxiribonukleinsyra"], "DNA finns i cellkärnan och är uppbyggt av kvävebaserna A, T, C och G."),
        ("expert", "mcq", "I näringskedjan gräs → hare → räv: ungefär hur stor del av energin förs vidare till nästa nivå?", ["100 %", "50 %", "10 %", "1 %"], 2, "Tumregeln är att ca 10 % förs vidare – resten används till rörelse, värme och går förlorad."),
        ("expert", "tf", "Enzymer förbrukas i de reaktioner de påskyndar.", None, False, "Enzymer är katalysatorer och kan användas om och om igen."),
    ]),
    (8, "Ekologi", [
        ("Ekosystem och näringskedjor", """
Ett **ekosystem** är allt levande i ett område tillsammans med den icke-levande miljön (vatten, ljus, jord).

### Näringskedja
gräs → hare → räv
- **Producenter** (växter) bygger socker med fotosyntes.
- **Konsumenter** äter andra organismer (växtätare, rovdjur, toppkonsumenter).
- **Nedbrytare** (svampar, bakterier, maskar) återför näring till jorden.

### Näringsväv
I verkligheten äter djur flera olika saker – kedjorna hänger ihop i en väv. Om en art försvinner påverkas många andra.

### Energi
Bara ungefär **10 %** av energin går vidare till nästa nivå. Därför finns det många fler harar än rävar.

### Kretslopp
Kol, kväve och vatten cirkulerar mellan luft, mark och organismer. Människan påverkar kolets kretslopp genom att bränna fossila bränslen.
"""),
    ], []),
]

CONTENT["historia"] = [
    (8, "Revolutionernas tid", [
        ("Franska revolutionen", """
### Bakgrund (1780-talet)
Frankrike var indelat i tre **stånd**: prästerskapet, adeln och tredje ståndet (alla andra – 97 % av befolkningen). Bara tredje ståndet betalade skatt. Staten var skuldsatt efter krig, skördarna slog fel och brödpriserna steg.

### Upplysningens idéer
Tänkare som Voltaire, Rousseau och Montesquieu ifrågasatte kungens makt och talade om frihet, förnuft och folkets rätt.

### 1789
- Kungen kallar till **ständermöte**.
- Tredje ståndet bildar **Nationalförsamlingen**.
- **14 juli:** Stormningen av **Bastiljen**, ett fängelse i Paris, blir revolutionens symbol.
- Augusti: Deklarationen om människans och medborgarens rättigheter.

### Skräckväldet
1793 avrättas kung Ludvig XVI. Under Robespierre giljotineras tusentals.

### Följder
Napoleon tar makten 1799. Idéerna om **frihet, jämlikhet och broderskap** sprids över Europa.
"""),
        ("Industriella revolutionen", """
### Var och när?
Började i **Storbritannien** i slutet av 1700-talet och spreds till Europa och USA under 1800-talet. Sverige industrialiserades främst efter 1870.

### Varför just Storbritannien?
Kol och järn, kolonier som gav råvaror och marknader, kapital, och uppfinningar som **ångmaskinen** (James Watt) och **spinnmaskinen**.

### Vad förändrades?
- Produktion flyttade från hem och verkstäder till **fabriker**.
- **Urbanisering** – människor flyttade till städerna.
- **Järnvägar** band ihop länder.
- En ny **arbetarklass** växte fram, ofta med långa dagar, låga löner och **barnarbete**.

### Följder på sikt
Fackföreningar, arbetarrörelsen, högre levnadsstandard – men också miljöproblem och början på de utsläpp som driver dagens klimatförändring.
"""),
    ], [
        ("easy", "mcq", "Vilket år bröt franska revolutionen ut?", ["1689", "1789", "1848", "1914"], 1, "Bastiljen stormades den 14 juli 1789."),
        ("easy", "tf", "Andra världskriget slutade år 1945.", None, True, "Tyskland kapitulerade i maj 1945 och Japan i september 1945."),
        ("easy", "mcq", "Vilken svensk kung kallades 'Lejonet från Norden' och stupade vid Lützen 1632?", ["Gustav Vasa", "Gustav II Adolf", "Karl XII", "Karl XIV Johan"], 1, "Gustav II Adolf ledde Sverige in i trettioåriga kriget."),
        ("easy", "fill", "Vilken stad var huvudstad i Romarriket?", None, ["rom", "roma"], "Enligt sägnen grundades Rom år 753 f.Kr."),
        ("medium", "mcq", "Vad var Bastiljen?", ["Ett fängelse i Paris", "Ett slott i Versailles", "En kyrka", "Ett parlament"], 0, "Stormningen av Bastiljen den 14 juli 1789 är Frankrikes nationaldag."),
        ("medium", "mcq", "Vilket år blev Sverige medlem i EU?", ["1989", "1995", "2001", "2004"], 1, "Efter en folkomröstning 1994 gick Sverige med den 1 januari 1995."),
        ("medium", "tf", "Första världskriget började år 1914.", None, True, "Kriget utlöstes av skotten i Sarajevo i juni 1914 och varade till 1918."),
        ("medium", "mcq", "I vilket land började den industriella revolutionen?", ["Frankrike", "Tyskland", "Storbritannien", "USA"], 2, "Storbritannien hade kol, järn, kapital och kolonier."),
        ("hard", "match", "Para ihop årtalet med händelsen.", {"left": ["1789", "1917", "1945", "1989"], "right": ["Berlinmurens fall", "Franska revolutionen", "Ryska revolutionen", "FN bildas"]}, [1, 2, 3, 0], "1789 franska revolutionen, 1917 ryska revolutionen, 1945 FN bildas, 1989 Berlinmurens fall."),
        ("hard", "mcq", "Vad innebar det kalla kriget?", ["En maktkamp mellan USA och Sovjetunionen utan direkt krig mellan dem", "Ett krig i Arktis", "Ett krig mellan Sverige och Norge", "En extremt kall vinter 1945"], 0, "Kalla kriget pågick ca 1947–1991 med kapprustning, rymdkapplöpning och ställföreträdande krig."),
        ("hard", "fill", "Vad kallas den ideologi som Hitler och NSDAP stod för?", None, ["nazism", "nationalsocialism", "nazismen", "nationalsocialismen"], "Nationalsocialismen byggde på rasism, antisemitism och ledarkult."),
        ("hard", "tf", "Sverige deltog med egna soldater i strid under andra världskriget.", None, False, "Sverige var formellt neutralt, även om man gjorde eftergifter åt Tyskland och senare åt de allierade."),
        ("expert", "mcq", "Vilken var en viktig orsak till franska revolutionen?", ["Statsskuld och orättvis beskattning av tredje ståndet", "Pesten", "Att kolonierna blev självständiga", "Napoleons kröning"], 0, "Frankrike var bankrutt efter krig och bara tredje ståndet betalade skatt."),
        ("expert", "mcq", "Vad var Versaillesfreden 1919?", ["Fredsavtalet efter första världskriget", "Avtalet som avslutade andra världskriget", "Frankrikes nya grundlag", "En handelsöverenskommelse"], 0, "Tyskland fick ta på sig skulden, betala skadestånd och avstå landområden – vilket bidrog till missnöje."),
        ("expert", "short", "Nämn en viktig följd av den industriella revolutionen.", None, ["urbanisering", "fabrik", "städer", "staden", "barnarbete", "arbetarklass", "järnväg", "miljö", "utsläpp", "fackförening", "befolkning", "ångmaskin", "löner", "massproduktion"], "Exempel: urbanisering, fabriksarbete, arbetarklass, järnvägar, barnarbete, miljöpåverkan."),
        ("expert", "mcq", "Vad var upplysningen?", ["En idéströmning på 1700-talet som betonade förnuft, vetenskap och frihet", "En religiös väckelse på 1500-talet", "Elektrifieringen av Europa", "En konststil under renässansen"], 0, "Upplysningens idéer låg bakom både amerikanska och franska revolutionen."),
    ]),
    (9, "1900-talet", [
        ("Världskrigen", """
### Första världskriget 1914–1918
**Orsaker:** nationalism, allianser, kapprustning och imperialism. **Utlösande händelse:** skotten i Sarajevo 1914.
Skyttegravskrig på västfronten. Ca 10 miljoner soldater dog. **Versaillesfreden 1919** gav Tyskland skulden.

### Mellankrigstiden
Börskrasch 1929 → depression och arbetslöshet. Missnöje banade väg för diktaturer: Mussolini i Italien, Hitler i Tyskland (1933), Stalin i Sovjetunionen.

### Andra världskriget 1939–1945
Börjar med Tysklands anfall på Polen 1 september 1939.
Viktiga vändpunkter: Stalingrad 1943, D-dagen 1944. **Förintelsen** – nazisternas folkmord på ca 6 miljoner judar samt romer, funktionsnedsatta och andra.
Kriget slutar i Europa i maj 1945 och i Asien efter atombomberna över Hiroshima och Nagasaki.

### Efter kriget
**FN** bildas 1945. **Kalla kriget** mellan USA och Sovjet delar världen fram till Berlinmurens fall 1989 och Sovjetunionens upplösning 1991.
"""),
    ], []),
]

CONTENT["geografi"] = [
    (7, "Kartan och världen", [
        ("Kartor och koordinater", """
### Skala
Skalan 1:50 000 betyder att 1 cm på kartan är 50 000 cm = 500 m i verkligheten.
2 cm → 1 km.

### Koordinater
- **Breddgrader (latitud)** går runt jorden parallellt med ekvatorn (0°). Nordpolen är 90° N.
- **Längdgrader (longitud/meridianer)** går från pol till pol. Nollmeridianen går genom Greenwich i London.
Stockholm ligger ungefär på 59° N, 18° Ö.

### Höjdkurvor
Linjer som binder ihop punkter på samma höjd. Täta kurvor = brant terräng.

### Olika kartor
Topografiska kartor visar terräng, tematiska kartor visar t.ex. befolkning eller klimat.
"""),
        ("Klimat och klimatzoner", """
### Väder och klimat
**Väder** är det som händer just nu. **Klimat** är genomsnittet över lång tid (minst 30 år).

### Klimatzoner
- **Tropisk zon** nära ekvatorn – varmt året om, regnskog eller savann.
- **Subtropisk zon** – heta somrar, t.ex. Medelhavsklimat och öknar som Sahara.
- **Tempererad zon** – fyra årstider. Här ligger större delen av Europa och Sverige.
- **Polar zon** – kallt året om, tundra och is.

### Vad påverkar klimatet?
1. **Breddgrad** – solens vinkel.
2. **Höjd över havet** – kallare högre upp.
3. **Närhet till hav** – havet jämnar ut temperaturen (maritimt klimat). Inlandet får varmare somrar och kallare vintrar (kontinentalt klimat).
4. **Havsströmmar** – Golfströmmen gör Norden mycket mildare än andra platser på samma breddgrad.
"""),
    ], [
        ("easy", "mcq", "Vilken är Norges huvudstad?", ["Bergen", "Oslo", "Stockholm", "Helsingfors"], 1, "Oslo ligger längst in i Oslofjorden."),
        ("easy", "tf", "Sahara är världens största varma öken.", None, True, "Sahara i Nordafrika är nästan lika stor som hela USA."),
        ("easy", "fill", "Vilken flod rinner genom Egypten och mynnar i Medelhavet?", None, ["nilen", "nile"], "Nilen är ca 6 650 km lång och räknas traditionellt som världens längsta flod."),
        ("easy", "mcq", "Hur många världsdelar brukar man räkna med?", ["5", "6", "7", "8"], 2, "Afrika, Antarktis, Asien, Europa, Nordamerika, Oceanien och Sydamerika."),
        ("medium", "mcq", "Vilket hav ligger mellan Sverige och Finland?", ["Nordsjön", "Östersjön", "Atlanten", "Medelhavet"], 1, "Östersjön är ett bräckt innanhav med låg salthalt."),
        ("medium", "tf", "Ekvatorn går genom Brasilien.", None, True, "Ekvatorn passerar norra Brasilien, bland annat nära Amazonflodens mynning."),
        ("medium", "mcq", "Vad kallas linjerna på en karta som visar höjdskillnader?", ["Höjdkurvor", "Breddgrader", "Meridianer", "Skala"], 0, "Ju tätare höjdkurvor, desto brantare terräng."),
        ("medium", "fill", "Vilken är Sveriges största sjö?", None, ["vänern"], "Vänern är också EU:s största sjö."),
        ("hard", "numeric", "Kartans skala är 1:50 000. Hur många kilometer i verkligheten motsvarar 2 cm på kartan?", None, {"value": 1, "tol": 0}, "2 cm · 50 000 = 100 000 cm = 1 000 m = 1 km."),
        ("hard", "match", "Para ihop huvudstaden med landet.", {"left": ["Tokyo", "Kairo", "Lima", "Canberra"], "right": ["Australien", "Peru", "Japan", "Egypten"]}, [2, 3, 1, 0], "Tokyo–Japan, Kairo–Egypten, Lima–Peru, Canberra–Australien (inte Sydney!)."),
        ("hard", "mcq", "Vad orsakar de flesta jordbävningar?", ["Rörelser i jordskorpans plattor", "Starka vindar", "Månens dragningskraft", "Havsströmmar"], 0, "Spänningar byggs upp där plattorna möts och utlöses plötsligt."),
        ("hard", "tf", "Golfströmmen gör klimatet i Norden varmare än det annars skulle vara.", None, True, "Varmt vatten från Mexikanska golfen förs upp mot Nordatlanten."),
        ("expert", "mcq", "Varför har Stockholm kallare vintrar än Glasgow trots ungefär samma breddgrad?", ["Stockholm har ett mer kontinentalt klimat med mindre påverkan av Atlanten", "Stockholm ligger högre över havet", "Det regnar mer i Stockholm", "Stockholm ligger närmare polcirkeln"], 0, "Glasgow värms av Atlanten och Golfströmmen; Stockholm påverkas mer av det kalla inlandet."),
        ("expert", "mcq", "Vad menas med urbanisering?", ["Att människor flyttar från landsbygd till städer", "Att städer blir grönare", "Att befolkningen minskar", "Att man bygger nya vägar"], 0, "Idag bor över hälften av jordens befolkning i städer."),
        ("expert", "fill", "Vilken världsdel har flest invånare?", None, ["asien"], "Asien har runt 4,7 miljarder invånare – ungefär 60 % av jordens befolkning."),
        ("expert", "mcq", "Vad är grundvatten?", ["Vatten som finns i marken under markytan", "Vatten i sjöar", "Regnvatten", "Havsvatten"], 0, "Grundvattnet fyller porer och sprickor i marken och är viktig dricksvattenkälla."),
    ]),
]

CONTENT["svenska"] = [
    (7, "Språkets byggstenar", [
        ("Ordklasser", """
Ord delas in i **ordklasser** efter hur de fungerar.

| Ordklass | Beskriver | Exempel |
|----------|-----------|---------|
| **Substantiv** | saker, personer, platser | hus, Lisa, glädje |
| **Verb** | vad någon gör eller vad som händer | springa, är, tänkte |
| **Adjektiv** | hur något är | röd, stor, glad |
| **Adverb** | hur, när, var något sker | snabbt, igår, här |
| **Pronomen** | ersätter substantiv | hon, den, vi, hen |
| **Prepositioner** | läge och riktning | på, under, till |
| **Konjunktioner** | binder ihop | och, men, eftersom |
| **Räkneord** | antal och ordning | tre, femte |

### Knep
- Kan du sätta *en/ett* framför? → substantiv.
- Kan du sätta *att* framför? → verb.
- Kan du böja *stor – större – störst*? → adjektiv.
"""),
        ("Satsdelar och skiljetecken", """
### Satsdelar
- **Subjekt** – den som gör något. *Hunden* jagar katten.
- **Predikat** – verbet, det som görs. Hunden *jagar* katten.
- **Objekt** – den som utsätts. Hunden jagar *katten*.

Fråga "Vem/vad + predikat?" för att hitta subjektet.

### Huvudsats och bisats
En **huvudsats** kan stå själv: *Vi gick hem.*
En **bisats** kan inte stå själv: *…eftersom det regnade.*

### De / dem
- **De** = subjekt (de gick hem). Testa med *vi*.
- **Dem** = objekt (jag såg dem). Testa med *oss*.

### Skiljetecken
- Punkt, frågetecken, utropstecken avslutar meningar.
- Kommatecken skiljer satser och uppräkningar.
- Direkt anföring markeras med **citattecken** eller **pratminus (–)**.
"""),
    ], [
        ("easy", "mcq", "Vilken ordklass tillhör ordet 'springa'?", ["Substantiv", "Verb", "Adjektiv", "Adverb"], 1, "Du kan sätta 'att' framför: att springa → verb."),
        ("easy", "tf", "'Hus' är ett substantiv.", None, True, "Det går att säga 'ett hus' – alltså ett substantiv."),
        ("easy", "mcq", "Vilket av orden är ett adjektiv?", ["springer", "bil", "glad", "och"], 2, "Glad beskriver hur någon är och kan kompareras: glad – gladare – gladast."),
        ("easy", "fill", "Vad kallas ordklassen som beskriver hur något är, till exempel 'röd' och 'stor'?", None, ["adjektiv"], "Adjektiv böjs efter substantivet: en röd bil, ett rött hus."),
        ("medium", "mcq", "Vilken mening är korrekt skriven?", ["Dom gick hem.", "De gick hem.", "Dem gick hem.", "Di gick hem."], 1, "'De' är subjekt i meningen (jämför: vi gick hem)."),
        ("medium", "tf", "En synonym är ett ord med motsatt betydelse.", None, False, "Synonymer betyder ungefär samma sak (glad – lycklig). Motsatsord kallas antonymer."),
        ("medium", "mcq", "Vad är subjekt i meningen 'Hunden jagar katten'?", ["Hunden", "jagar", "katten", "Det finns inget subjekt"], 0, "Vem jagar? Hunden. Subjektet är den som utför handlingen."),
        ("medium", "fill", "Vad kallas ord med motsatt betydelse, till exempel varm – kall?", None, ["antonym", "antonymer", "motsatsord"], "Antonym kommer från grekiskans *anti* (mot) och *onyma* (namn)."),
        ("hard", "mcq", "Vilket skiljetecken används för att visa direkt anföring (att någon säger något)?", ["Citattecken eller pratminus", "Semikolon", "Kolon", "Parentes"], 0, "– Hej, sa hon. Eller: \"Hej\", sa hon."),
        ("hard", "match", "Para ihop stilfiguren med exemplet.", {"left": ["Metafor", "Liknelse", "Besjälning", "Ironi"], "right": ["Säger motsatsen till vad man menar", "Hon är en klippa", "Vinden viskade", "Stark som en björn"]}, [1, 3, 2, 0], "Metafor = bildligt utan 'som', liknelse = med 'som', besjälning = ger döda ting liv, ironi = motsatsen."),
        ("hard", "tf", "'Hen' är ett könsneutralt pronomen som finns med i Svenska Akademiens ordlista.", None, True, "Hen togs med i SAOL 2015."),
        ("hard", "mcq", "Vilken av följande är en bisats?", ["eftersom det regnade", "Det regnade.", "Regnet öste ner.", "Vi gick hem."], 0, "En bisats kan inte stå ensam och inleds ofta med ord som eftersom, att, som, när."),
        ("expert", "mcq", "Vad kännetecknar en argumenterande text?", ["Tes, argument och motargument", "Rim och vers", "Dialog och scenanvisningar", "En kronologisk berättelse"], 0, "Du tar ställning (tes), ger skäl (argument) och bemöter invändningar (motargument)."),
        ("expert", "mcq", "En flicka har brunt hår. Vilket alternativ är rätt skrivet?", ["en brun hårig flicka", "en brunhårig flicka", "en brun-hårig flicka", "en brunthårig flicka"], 1, "Sammansatta ord skrivs ihop. 'Brun hårig' skulle betyda en hårig flicka som är brun."),
        ("expert", "short", "Förklara kort skillnaden mellan 'de' och 'dem'.", None, ["subjekt", "objekt", "vi", "oss", "den som gör", "utsätts"], "De är subjektsform (de gick = vi gick), dem är objektsform (jag såg dem = jag såg oss)."),
        ("expert", "fill", "Vilken svensk författare skrev romanen 'Röda rummet' (1879)?", None, ["strindberg", "august strindberg"], "Röda rummet brukar kallas den första moderna svenska romanen."),
    ]),
]

CONTENT["engelska"] = [
    (7, "Grammar", [
        ("Tenses – verbens tidsformer", """
### Present simple
Vanor och fakta. *She **plays** tennis on Mondays.* Lägg till **-s** i tredje person singular (he/she/it).
Negation: *He **doesn't** like tea.* (inte "don't" i tredje person)

### Present continuous
Pågår just nu. *I **am reading**.* (am/is/are + -ing)

### Past simple
Avslutat förr. *They **went** home.* Regelbundna verb får **-ed**: *walked*. Oregelbundna måste läras in: go → went, eat → ate, see → saw.

### Present perfect
Har hänt, med koppling till nu. *I **have seen** that film.* (have/has + perfekt particip: seen, eaten, gone)

### Future
*I **will** call you.* / *I **am going to** study.*

### Conditional (if-satser)
*If I **were** rich, I **would** travel.* I formell engelska används *were* för alla personer i overkliga villkor. *Was* hörs i vardagligt tal.
"""),
        ("Irregular verbs", """
De vanligaste oregelbundna verben – lär dig dem i tre former:

| Infinitiv | Past simple | Past participle | Svenska |
|-----------|-------------|-----------------|---------|
| be | was/were | been | vara |
| go | went | gone | gå |
| eat | ate | eaten | äta |
| see | saw | seen | se |
| take | took | taken | ta |
| write | wrote | written | skriva |
| speak | spoke | spoken | tala |
| come | came | come | komma |
| run | ran | run | springa |
| buy | bought | bought | köpa |
| think | thought | thought | tänka |
| know | knew | known | veta |

### Oregelbundna plural
child → **children**, man → **men**, woman → **women**, foot → **feet**, tooth → **teeth**, mouse → **mice**.
"""),
    ], [
        ("easy", "mcq", "What is 'hund' in English?", ["cat", "dog", "horse", "bird"], 1, "Hund = dog."),
        ("easy", "tf", "'I am' is correct English.", None, True, "I am, you are, he/she/it is, we are, they are."),
        ("easy", "fill", "Translate to English: 'tack'", None, ["thanks", "thank you", "thankyou"], "Thanks / thank you."),
        ("easy", "mcq", "Choose the correct form: 'She ___ a student.'", ["am", "is", "are", "be"], 1, "Third person singular (he/she/it) takes 'is'."),
        ("medium", "mcq", "What is the past tense of 'go'?", ["goed", "went", "gone", "going"], 1, "Go – went – gone. 'Gone' is the past participle."),
        ("medium", "tf", "'Childs' is the plural of 'child'.", None, False, "The plural is 'children'."),
        ("medium", "fill", "What is the past tense of 'eat'?", None, ["ate"], "Eat – ate – eaten."),
        ("medium", "mcq", "Which sentence is correct?", ["He don't like tea.", "He doesn't like tea.", "He not like tea.", "He doesn't likes tea."], 1, "Third person singular uses 'doesn't' + base form of the verb."),
        ("hard", "mcq", "Choose the most formal/correct option: 'If I ___ rich, I would travel the world.'", ["am", "was", "were", "be"], 2, "Unreal conditionals use 'were' for all persons in formal English. 'Was' is common in speech."),
        ("hard", "match", "Match each word with its synonym.", {"left": ["big", "happy", "fast", "cold"], "right": ["quick", "large", "chilly", "glad"]}, [1, 3, 0, 2], "big–large, happy–glad, fast–quick, cold–chilly."),
        ("hard", "fill", "Complete with the past participle: 'I have ___ that film.' (see)", None, ["seen"], "See – saw – seen. Present perfect = have/has + past participle."),
        ("hard", "tf", "'Their', 'there' and 'they're' mean the same thing.", None, False, "Their = deras, there = där, they're = they are. They sound the same but mean different things."),
        ("expert", "mcq", "Which word is a synonym of 'reluctant'?", ["eager", "unwilling", "careful", "tired"], 1, "Reluctant = unwilling, hesitant. Eager is the opposite."),
        ("expert", "mcq", "Which sentence is in the passive voice?", ["The cake was eaten by Tom.", "Tom ate the cake.", "Tom is eating cake.", "Tom will eat cake."], 0, "Passive: be + past participle. The subject (the cake) receives the action."),
        ("expert", "short", "Explain the difference between 'fewer' and 'less'.", None, ["count", "uncount", "räknebar", "oräknebar", "plural", "number", "amount", "mängd", "antal"], "'Fewer' is used with countable nouns (fewer cars), 'less' with uncountable nouns (less water)."),
        ("expert", "fill", "Complete the idiom: 'It's raining cats and ___.'", None, ["dogs"], "It means it is raining very heavily."),
    ]),
]

CONTENT["spanska"] = [
    (7, "Grunderna", [
        ("Hälsningsfraser", """
### Hälsa och ta farväl
- **Hola** – hej
- **Buenos días** – god morgon
- **Buenas tardes** – god eftermiddag
- **Buenas noches** – god kväll / god natt
- **Adiós** / **Hasta luego** – hejdå / vi ses

### Artighet
- **Gracias** – tack · **De nada** – varsågod
- **Por favor** – snälla/tack (vid förfrågan)
- **Perdón** – ursäkta

### Presentera dig
- **Me llamo Ana.** – Jag heter Ana.
- **¿Cómo te llamas?** – Vad heter du?
- **¿Cuántos años tienes?** – Hur gammal är du? (ordagrant: hur många år har du)
- **Tengo trece años.** – Jag är tretton år.
- **Soy de Suecia.** – Jag är från Sverige.

### Räkneord 1–10
uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez
"""),
        ("Verb i presens", """
Spanska verb slutar på **-ar**, **-er** eller **-ir**. Ändelsen visar vem som gör något – därför behövs oftast inget pronomen.

### hablar (tala) – -ar
| | |
|---|---|
| yo | habl**o** |
| tú | habl**as** |
| él/ella | habl**a** |
| nosotros | habl**amos** |
| vosotros | habl**áis** |
| ellos/ellas | habl**an** |

### vivir (bo) – -ir
viv**o**, viv**es**, viv**e**, viv**imos**, viv**ís**, viv**en**

### ser och estar – två sätt att säga "vara"
- **ser** = permanenta egenskaper, ursprung, yrke. *Soy sueco.* *Ella es alta.*
- **estar** = tillfälliga tillstånd och plats. *Estoy cansado.* *Madrid está en España.*

### gustar
*Me gusta el libro* (jag gillar boken) men *me gusta**n** los libros* – verbet böjs efter det man gillar, som är subjekt i satsen.
"""),
    ], [
        ("easy", "mcq", "Vad betyder 'hola'?", ["hej", "hejdå", "tack", "ja"], 0, "Hola är den vanligaste hälsningen."),
        ("easy", "tf", "'Gracias' betyder tack.", None, True, "Svaret på gracias är ofta 'de nada' – varsågod."),
        ("easy", "fill", "Vad heter 'vatten' på spanska?", None, ["agua", "el agua"], "Agua är femininum men får artikeln *el* i singular eftersom ordet börjar på betonat a."),
        ("easy", "mcq", "Vilket är räkneordet för 3?", ["dos", "tres", "cuatro", "cinco"], 1, "uno, dos, tres, cuatro, cinco…"),
        ("medium", "mcq", "'Yo ___ español.' (hablar)", ["hablo", "hablas", "habla", "hablamos"], 0, "Första person singular av -ar-verb slutar på -o."),
        ("medium", "tf", "'Buenas noches' betyder god morgon.", None, False, "Buenas noches = god kväll/god natt. God morgon = buenos días."),
        ("medium", "fill", "Vad heter 'röd' på spanska (maskulin form)?", None, ["rojo"], "Rojo (mask.), roja (fem.)."),
        ("medium", "mcq", "Vilken artikel passar: '___ casa'", ["el", "la", "los", "un"], 1, "Casa är femininum singular → la casa."),
        ("hard", "match", "Para ihop veckodagarna.", {"left": ["lunes", "miércoles", "viernes", "domingo"], "right": ["fredag", "söndag", "måndag", "onsdag"]}, [2, 3, 0, 1], "lunes=måndag, martes=tisdag, miércoles=onsdag, jueves=torsdag, viernes=fredag, sábado=lördag, domingo=söndag."),
        ("hard", "mcq", "'Nosotros ___ en Madrid.' (vivir)", ["vivo", "vives", "vive", "vivimos"], 3, "Nosotros-formen av -ir-verb slutar på -imos."),
        ("hard", "fill", "Vad betyder '¿Cuántos años tienes?'", None, ["hur gammal", "hur många år"], "Ordagrant 'hur många år har du' – spanskan använder tener (ha) för ålder."),
        ("hard", "tf", "Spanska adjektiv står oftast efter substantivet.", None, True, "Un coche rojo – en röd bil."),
        ("expert", "mcq", "'Ella ___ cansada.' Välj rätt form av ser/estar.", ["es", "está", "son", "están"], 1, "Trötthet är ett tillfälligt tillstånd → estar."),
        ("expert", "mcq", "Preteritum: 'Ayer yo ___ al cine.' (ir)", ["voy", "fui", "iba", "iré"], 1, "Fui är preteritum av både ir och ser. Ayer (igår) signalerar avslutad dåtid."),
        ("expert", "fill", "Vad är plural av 'el lápiz' (pennan)?", None, ["los lápices", "lápices", "los lapices", "lapices"], "Ord på -z byter till -ces i plural."),
        ("expert", "mcq", "'Me gustan los libros' – varför heter det 'gustan' och inte 'gusta'?", ["För att 'los libros' är plural och fungerar som subjekt", "För att 'me' är plural", "För att det är dåtid", "För att det är artigare"], 0, "Gustar böjs efter det som gillas: me gusta el libro, me gustan los libros."),
    ]),
]

ACHIEVEMENTS = [
    ("first_game", "Första spelet", "Spela klart ditt första spel.", "🎮", 1),
    ("first_lesson", "Bokmalen", "Läs klart din första lektion.", "📖", 2),
    ("streak_3", "Tre i rad", "Var aktiv tre dagar i rad.", "🔥", 3),
    ("streak_7", "Veckan är din", "Var aktiv sju dagar i rad.", "🏮", 4),
    ("level_5", "Apprentice", "Nå nivå 5.", "🎓", 5),
    ("level_10", "Scholar", "Nå nivå 10.", "🏅", 6),
    ("correct_100", "Hundraklubben", "Svara rätt på 100 frågor.", "💯", 7),
    ("blackjack_21", "Exakt 21", "Få exakt 21 i Knowledge Blackjack.", "🃏", 8),
    ("all_subjects", "Allvetare", "Spela i minst sex olika ämnen.", "🌐", 9),
    ("class_joined", "Lagspelare", "Gå med i en klass.", "🏫", 10),
    ("expert_10", "Expertläge", "Svara rätt på 10 expertfrågor.", "👑", 11),
    ("daily_5", "Dagens hjälte", "Klara fem dagliga utmaningar.", "📅", 12),
]

COSMETICS = [
    ("av_fox", "avatar", "Räv", "🦊", 0, 1, 1),
    ("av_owl", "avatar", "Uggla", "🦉", 150, 1, 2),
    ("av_wolf", "avatar", "Varg", "🐺", 150, 1, 3),
    ("av_panda", "avatar", "Panda", "🐼", 200, 1, 4),
    ("av_lion", "avatar", "Lejon", "🦁", 250, 3, 5),
    ("av_robot", "avatar", "Robot", "🤖", 300, 3, 6),
    ("av_dragon", "avatar", "Drake", "🐉", 400, 5, 7),
    ("av_unicorn", "avatar", "Enhörning", "🦄", 500, 5, 8),
    ("av_wizard", "avatar", "Trollkarl", "🧙", 600, 8, 9),
    ("av_crown", "avatar", "Kronan", "👑", 800, 10, 10),
    ("th_noir", "theme", "Casino Noir", "noir", 0, 1, 20),
    ("th_emerald", "theme", "Emerald Room", "emerald", 300, 3, 21),
    ("th_royal", "theme", "Royal Gold", "royal", 400, 6, 22),
    ("th_violet", "theme", "Velvet Violet", "violet", 400, 6, 23),
    ("fr_gold", "frame", "Guldram", "gold", 500, 5, 30),
    ("fr_emerald", "frame", "Smaragdram", "emerald", 300, 3, 31),
]


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def j(v):
    return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"


def main():
    out = ["-- Generated by supabase/seed/content.py – do not edit by hand", "begin;"]
    for sid, name, icon, color, sort in SUBJECTS:
        out.append(f"insert into subjects(id,name,icon,color,sort) values ({q(sid)},{q(name)},{q(icon)},{q(color)},{sort}) on conflict (id) do update set name=excluded.name, icon=excluded.icon, color=excluded.color, sort=excluded.sort;")
    for sid, chapters in CONTENT.items():
        for ci, (year, title, lessons, questions) in enumerate(chapters):
            out.append(f"with ch as (insert into chapters(subject_id,year,title,sort) values ({q(sid)},{year},{q(title)},{ci+1}) returning id)")
            parts = []
            for li, (lt, body) in enumerate(lessons):
                parts.append(f"insert into lessons(chapter_id,title,body,sort) select id,{q(lt)},{q(body.strip())},{li+1} from ch")
            for (diff, qt, prompt, options, answer, expl) in questions:
                opts = j(options) if options is not None else "null"
                parts.append(f"insert into questions(subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation) select {q(sid)},id,{q(diff)},{q(qt)},{q(prompt)},{opts},{j(answer)},{q(expl)} from ch")
            # chain CTE inserts
            if parts:
                cte = out.pop()
                stmt = cte
                for pi, p in enumerate(parts[:-1]):
                    stmt += f", i{pi} as ({p})"
                stmt += " " + parts[-1] + ";"
                out.append(stmt)
    for aid, name, desc, icon, sort in ACHIEVEMENTS:
        out.append(f"insert into achievements(id,name,description,icon,sort) values ({q(aid)},{q(name)},{q(desc)},{q(icon)},{sort}) on conflict (id) do nothing;")
    for cid, kind, name, value, price, minlvl, sort in COSMETICS:
        out.append(f"insert into cosmetics(id,kind,name,value,price,min_level,sort) values ({q(cid)},{q(kind)},{q(name)},{q(value)},{price},{minlvl},{sort}) on conflict (id) do nothing;")
    out.append("commit;")
    print("\n".join(out))


if __name__ == "__main__":
    main()

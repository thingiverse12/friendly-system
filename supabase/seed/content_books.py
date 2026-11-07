#!/usr/bin/env python3
"""Extra verified content transcribed from the uploaded textbook pages.

Run:  python3 supabase/seed/content_books.py > supabase/seed/0004_books.sql

Sources (scanned pages, re-written in our own words):
  * Idrott och hälsa – kost: "Vitaminer" / "Mineraler" / "Kosttillskott" (s. 24–27)
  * Kemi – "Kolets kemi": Kolatomen (100–104), Kolväten (108–115),
    Förbränning och fossila bränslen (118–122), Alkoholer (125–128),
    Organiska syror och estrar (131–139)
  * Historia – "Världshandel, industrialisering och revolutioner":
    Nya samhällsklasser 1750–1900 (75), Politiska ideologier (76–77)

Same tuple formats as content.py. Chapter sort numbers start at 10 so they
land after the chapters that already exist for the subject.
"""
import json

SUBJECTS = [
    ("idrott", "Idrott och hälsa", "🏃", "#14b8a6", 10),
]

# subject -> list of (year, title, sort, [lessons], [questions])
CONTENT = {}

# ---------------------------------------------------------------------------
# IDROTT OCH HÄLSA – KOST
# ---------------------------------------------------------------------------
CONTENT["idrott"] = [
    (8, "Kost: vitaminer och mineraler", 1, [
        ("Vitaminer – fettlösliga (A, D, E, K)", """
För att vi ska må bra behöver kroppen olika slags **vitaminer**. Det räcker med mycket små mängder, men de är *livsnödvändiga* – alla vitaminer har olika uppgifter i kroppen. Äter du varierat får du i dig alla vitaminer du behöver; de flesta av oss behöver inga vitamintabletter.

Vitamin **C, E, B2 (riboflavin)** och **karoten** är dessutom **antioxidanter** – de skyddar cellerna mot skadliga ämnen som kallas *fria radikaler*.

### Två huvudgrupper
- **Fettlösliga vitaminer** – A, D, E och K. Transporteras i kroppen via fettet och **kan lagras** i kroppen.
- **Vattenlösliga vitaminer** – B och C. **Kan inte lagras** utan transporteras runt med vattnet i kroppen.

### Vitamin A (retinol, karoten)
- Finns i inälvsmat, ost, ägg och matfett. I grönsaker och rotfrukter finns **karoten** (en antioxidant) som kroppen omvandlar till vitamin A – framför allt i mörkgröna eller rödgula grönsaker (t.ex. morot).
- Behövs för **syn, hud och slemhinnor**.
- Brist ger minskad motståndskraft mot infektioner och sämre mörkerseende. Svår brist kan göra att man blir blind.

### Vitamin D (kalciferol)
- Finns i fet fisk (lax, sill, makrill), kött, ägg, mjölk, matfett och svamp. Huden bildar dessutom vitamin D när **solens UV-strålar** träffar den – även när det är molnigt. Var därför ute en stund varje dag.
- Reglerar **kalkbalansen** i skelett och tänder.
- Ett av de vitaminer som är lättast att få brist på, särskilt för veganer och den som sällan är utomhus. Brist ger **benskörhet**; svår brist hos barn kan göra att skelettet missformas.

### Vitamin E (tokoferol)
- Finns i frön, vetegroddar, vegetabiliska matoljor, margarin, avokado, mjölk, ägg, fullkorn och gröna bladgrönsaker.
- Är en **antioxidant**. Brist är ovanligt.

### Vitamin K (kinoner)
- Finns i kål, gröna bladgrönsaker, kött, lever, ägg och mejeriprodukter.
- Behövs för att **blodet ska kunna koagulera** (levra sig). Brist är ovanligt.
"""),
        ("Vitaminer – vattenlösliga (B och C)", """
De vattenlösliga vitaminerna – **B-vitaminerna och vitamin C** – kan inte lagras i kroppen. Därför behöver vi få i oss dem regelbundet.

### B-vitaminer
Det finns flera olika B-vitaminer med olika funktioner. Äter man varierat är risken för brist liten.

| Vitamin | Finns i | Behövs för |
|---|---|---|
| **Tiamin (B1)** | bönor, ärter, spannmål, griskött, inälvsmat | ämnesomsättningen |
| **Riboflavin (B2)** – antioxidant | mjölkprodukter, kött, fågel, ägg | ämnesomsättningen |
| **Niacin** | fisk, kyckling, kött, jordnötter, spannmål | ämnesomsättningen |
| **Pyridoxin (B6)** | nästan allt vi äter | proteinomsättningen och nervsystemet |
| **Kobalamin (B12)** | **bara animaliska livsmedel** | blodbildningen – brist kan ge **anemi** (blodbrist) |
| **Folat** | lever, mörkgröna bladgrönsaker, kål, bönor, linser, frukt, bär, fullkorn, mjölk | att bilda **nya celler och röda blodkroppar** |

> Eftersom B12 bara finns i animaliska livsmedel behöver **veganer ta tillskott** av vitamin B12.

### Vitamin C (askorbinsyra)
- Fungerar som **antioxidant** och finns i de flesta grönsaker, frukter och bär. Särskilt mycket i **svarta vinbär, citrusfrukter, kiwi, paprika, broccoli och brysselkål**.
- Underlättar **järnupptaget** och behövs för att bygga upp ben och broskvävnad.
- Brist är ovanligt men kan ge ökad risk för infektioner och trötthet.
- Vitamin C är **känsligt för syre och värme**. För att bevara det: **koka först upp vattnet**, lägg sedan ner grönsaker, potatis eller rotfrukter.
"""),
        ("Mineraler", """
Precis som vitaminer behöver vi **mineraler** i små mängder, men de är livsnödvändiga eftersom kroppen **inte själv kan bilda dem**. Mineralerna **selen och zink** fungerar som antioxidanter.

### Järn
- Finns i inälvsmat, blodpudding, kött, fisk, musslor, ägg, baljväxter, bladgrönsaker, fullkorn, spenat, banan och torkad frukt.
- Behövs för att **transportera syre** ut till kroppens vävnader via blodet.
- Brist: man blir **trött, orkeslös och blek**; arbetsförmåga och immunförsvar försämras. Många tonåringar och kvinnor har järnbrist.
- **Vitamin C** till måltiden *ökar* upptaget av järn. **Kaffe och te** *minskar* det.

### Kalcium
- Finns i de flesta livsmedel, framför allt **mjölkprodukter och fisk**.
- Behövs för att bygga **skelett och tänder**, för nervfunktionen och för att blodet ska kunna koagulera.
- Brist ger **benskörhet (osteoporos)** och kan hämma tillväxten hos barn.

### Fosfor
- Finns i mejeriprodukter, ost, baljväxter och kött.
- Behövs för skelett och tänder, syra/bas-balansen och energiproduktionen. Brist är mycket ovanligt.

### Natrium
- Finns i kött, fisk, spannmålsprodukter och **salt**.
- Behövs för syra/bas-balansen och vatten/saltbalansen. Brist är ovanligt men kan uppstå vid långvarig magsjuka eller kraftig svettning.
- Det är lätt att få i sig **för mycket**: i Sverige får många i sig **dubbelt så mycket salt** som vi behöver – genom att salta maten och via färdigmat och salta snacks.

### Kalium
- Finns i mjölkprodukter, potatis, grönsaker och frukt (t.ex. banan).
- Behövs för nerv- och muskelfunktion, för att reglera blodtrycket och för syra/bas-balansen. Brist (t.ex. vid långvarig diarré) ger trötthet och depression.

### Jod
- Finns i fisk, skaldjur, ägg och **jodberikat salt**.
- Behövs för **sköldkörteln** som deltar i energiomsättningen. Brist kan ge **struma**.

### Zink
- Finns i mejeriprodukter, kött, musslor, fullkorn och nötter.
- Behövs för energiomsättningen och immunförsvaret. Brist hos barn ger försämrad tillväxt och utveckling; hos vuxna försämrad sårläkning och hudförändringar.

### Selen
- Antioxidant som finns i fisk, inälvsmat och mjölkprodukter.
- Behövs för immunförsvaret och för att skydda cellerna mot oxidation. Brist är ovanligt men anses kunna öka risken för vissa cancerformer.
"""),
        ("Kosttillskott – vem behöver det?", """
**Kosttillskott** är vitaminer och mineraler i koncentrerad form. De flesta av oss behöver **inget extra** kosttillskott – höga doser kan till och med vara **skadliga** för kroppen.

### Vad säger forskningen?
- Den som äter mycket **grönsaker, rotfrukter och frukt** löper mindre risk att drabbas av sjukdomar, främst hjärt- och kärlsjukdomar och vissa cancerformer. Det kan bero på att frukt och grönt innehåller antioxidanter.
- Däremot visar **ingen forskning** att risken för sjukdomar minskar när man äter kosttillskott.

### Vissa grupper kan behöva tillskott under en begränsad tid
- **Vitamin D** till alla barn upp till **två års ålder**.
- **Vitamin D** till äldre som inte regelbundet vistas ute.
- **Folsyra** till kvinnor som funderar på att skaffa barn – låga halter folat vid graviditet ökar risken att få barn med ryggmärgsbråck.
- **Vitamin B12 och D** till veganer.

> **Folsyra och folat** är olika former av samma B-vitamin. *Folat* finns naturligt i mat, *folsyra* är konstgjort framställt och används vid berikning av livsmedel och i kosttillskott. Vegetarianer löper sällan risk för folatbrist.
"""),
    ], [
        ("easy", "mcq", "Vilka vitaminer är fettlösliga?", ["A, D, E och K", "B och C", "Alla vitaminer", "Bara vitamin C"], 0, "Fettlösliga vitaminer (A, D, E, K) transporteras med fettet och kan lagras i kroppen. B och C är vattenlösliga."),
        ("easy", "tf", "Vattenlösliga vitaminer kan lagras i kroppen.", None, False, "Vattenlösliga vitaminer (B och C) kan inte lagras utan transporteras runt med vattnet i kroppen."),
        ("easy", "mcq", "Vilket vitamin bildar huden när solens UV-strålar träffar den?", ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], 2, "Vitamin D bildas i huden av solljus – därför är det viktigt att vara ute en stund varje dag."),
        ("easy", "fill", "Vilket vitamin kallas också askorbinsyra? (skriv bokstaven)", None, ["c", "vitamin c"], "Askorbinsyra är ett annat namn på vitamin C."),
        ("easy", "mcq", "Vilken mineral behövs för att transportera syre i blodet?", ["Kalcium", "Järn", "Natrium", "Jod"], 1, "Järn behövs för att transportera syre ut till kroppens vävnader. Brist gör att man blir trött, orkeslös och blek."),
        ("easy", "tf", "Karoten i morötter kan omvandlas till vitamin A i kroppen.", None, True, "Karoten är en antioxidant som finns i mörkgröna och rödgula grönsaker och omvandlas till vitamin A."),
        ("medium", "mcq", "Vad kan svår brist på vitamin D leda till hos barn?", ["Struma", "Blodbrist", "Att skelettet missformas", "Nattblindhet"], 2, "Vitamin D reglerar kalkbalansen i skelettet. Brist ger benskörhet och svår brist hos barn kan göra att skelettet missformas."),
        ("medium", "mcq", "Vilket vitamin finns bara i animaliska livsmedel, så att veganer behöver tillskott?", ["B12 (kobalamin)", "B1 (tiamin)", "Vitamin C", "Vitamin E"], 0, "Kobalamin (B12) finns bara i animaliska livsmedel. Brist kan leda till anemi (blodbrist)."),
        ("medium", "tf", "Kaffe och te ökar kroppens upptag av järn.", None, False, "Tvärtom – kaffe och te minskar järnupptaget. Vitamin C till måltiden ökar det."),
        ("medium", "mcq", "Vilken mineral behöver sköldkörteln, och vad kan brist leda till?", ["Jod – struma", "Zink – benskörhet", "Selen – anemi", "Kalium – blindhet"], 0, "Jod behövs för sköldkörteln som deltar i energiomsättningen. Brist kan ge struma."),
        ("medium", "match", "Para ihop vitaminet med dess andra namn.", {"left": ["Vitamin A", "Vitamin D", "Vitamin E", "Vitamin C"], "right": ["Tokoferol", "Askorbinsyra", "Retinol", "Kalciferol"]}, [2, 3, 0, 1], "A = retinol, D = kalciferol, E = tokoferol, C = askorbinsyra."),
        ("medium", "fill", "Vilken mineral får många i Sverige i sig dubbelt så mycket av som de behöver – via saltad mat, färdigmat och snacks?", None, ["natrium", "salt"], "Natrium finns i salt. Många får i sig dubbelt så mycket som kroppen behöver."),
        ("medium", "mcq", "Vilket vitamin behövs för att blodet ska kunna koagulera?", ["Vitamin K", "Vitamin A", "Vitamin B6", "Vitamin E"], 0, "Vitamin K (kinoner) finns i kål och gröna bladgrönsaker och behövs för blodets koagulering."),
        ("medium", "short", "Nämn ett livsmedel som innehåller särskilt mycket vitamin C.", None, ["svarta vinbär", "vinbär", "citrus", "apelsin", "citron", "kiwi", "paprika", "broccoli", "brysselkål"], "Särskilt mycket vitamin C finns i svarta vinbär, citrusfrukter, kiwi, paprika, broccoli och brysselkål."),
        ("hard", "mcq", "Varför ska man koka upp vattnet först och sedan lägga i grönsakerna?", ["Vitamin C är känsligt för syre och värme och bevaras bättre", "Mineralerna försvinner annars", "Grönsakerna blir sötare", "De fettlösliga vitaminerna bryts annars ned"], 0, "Vitamin C är känsligt för syre och värme. Kortare tid i vattnet bevarar mer av vitaminet."),
        ("hard", "mcq", "Vilka två mineraler fungerar som antioxidanter?", ["Selen och zink", "Järn och kalcium", "Natrium och kalium", "Fosfor och jod"], 0, "Selen och zink är antioxidanter – de skyddar cellerna mot oxidation."),
        ("hard", "tf", "Forskning visar att risken för sjukdomar minskar när man äter kosttillskott.", None, False, "Ingen forskning visar det. Däremot minskar risken hos den som äter mycket grönsaker, rotfrukter och frukt."),
        ("hard", "mcq", "Vilken grupp rekommenderas tillskott av folsyra?", ["Kvinnor som funderar på att skaffa barn", "Alla barn under två år", "Äldre som sällan är utomhus", "Tonåringar som tränar mycket"], 0, "Låga halter folat vid graviditet ökar risken för ryggmärgsbråck hos barnet. Barn under två och äldre rekommenderas i stället vitamin D."),
        ("hard", "match", "Para ihop bristen med följden.", {"left": ["Järnbrist", "Kalciumbrist", "Brist på vitamin A", "Jodbrist"], "right": ["Struma", "Benskörhet", "Trötthet och blekhet", "Sämre mörkerseende"]}, [2, 1, 3, 0], "Järn → trötthet/blekhet, kalcium → benskörhet, vitamin A → sämre mörkerseende, jod → struma."),
        ("hard", "numeric", "Upp till vilken ålder (i år) rekommenderas vitamin D-tillskott till alla barn?", None, {"value": 2, "tol": 0}, "Alla barn rekommenderas vitamin D-droppar upp till två års ålder."),
    ]),
]

# ---------------------------------------------------------------------------
# KEMI – KOLETS KEMI
# ---------------------------------------------------------------------------
CONTENT["kemi"] = [
    (8, "Kolets kemi", 10, [
        ("Kolatomen – naturens byggsten", """
Det finns 92 sorters atomer naturligt och kol är bara en av dem. Ändå arbetar en stor del av världens kemister med ämnen som innehåller kol, eftersom kolatomer finns i så många ämnen: diamant, fossila bränslen, plast, papper, trä – och allt som är eller har varit levande.

### Kolatomen har fyra bindningar
Kol har atomnummer 6: **6 protoner** i kärnan och **6 elektroner** i två skal – 2 i det innersta och 4 i det yttersta. Det yttersta skalet har plats för 8 elektroner, så kolatomen har **4 lediga platser**. Väte har 1 elektron och 1 ledig plats.

Atomer vill ha fulla elektronskal. Genom att *dela* elektroner med andra atomer får de fulla yttre skal. En kolatom och fyra väteatomer delar elektroner så att alla får fulla skal – då bildas en **metanmolekyl**. Varje sådan bindning kallas **elektronparbindning**. Ritar vi atomerna med kemiska tecken och bindningarna som streck får vi en **strukturformel**:

```
    H
    |
H – C – H
    |
    H
```

Därför kan kolatomer bygga stora tredimensionella molekyler – vi känner till ungefär **20 miljoner** olika kolföreningar. Molekyler i levande organismer kallas **organiska föreningar**.

### Kolföreningar
Kemiska föreningar med kol och andra atomer (väte, syre, kväve, svavel …). Exempel: **koldioxid CO₂**, **kolmonoxid CO** (giftig) och **kolsyra H₂CO₃** som bildas när koldioxid reagerar med vatten (det är det som bubblar i kolsyrat vatten).

### Ämnen som består av enbart kolatomer
| Form | Struktur | Leder ström? | Egenskap |
|---|---|---|---|
| **Diamant** | kolatomer i pyramidform (tetraeder) | nej | naturens hårdaste ämne; bildas vid högt tryck och hög temperatur. Första syntetiska diamanten gjordes i Västerås 1954. |
| **Grafit** | tunna lager av sexhörningar, svaga bindningar mellan lagren | ja | lagren glider mot varandra → blyertspennor och smörjmedel |
| **Fulleren** | ett lager sexhörningar format som en boll | ja | bildas vid upphettning av grafit eller förbränning av t.ex. ved |
| **Grafen** | ett enda platt lager | ja | ca 100 gånger starkare än stål i förhållande till vikten → böjbara skärmar, elektronik |
| **Amorft kol** | kolatomer huller om buller | – | grillkol; **aktivt kol** binder andra ämnen → renar luft/vatten, används mot förgiftning |

**Brunkol** (ca 75 % kol) och **stenkol** (ca 90 % kol) är amorft kol som grävs upp och används som bränsle i kraftverk.
"""),
        ("Kolväten – alkaner, alkener och alkyner", """
En kolförening som bara består av **kol- och väteatomer** kallas **kolväte**. Kolväten är bränslen som bensin, diesel och fotogen – viktiga för industri och transporter sedan 1800-talet.

### Alkanserien
Kolväten med bara enkelbindningar kallas **alkaner**. För varje nytt kolväte i serien får molekylen en kolatom och två väteatomer till.

| Namn | Molekylformel | Kokpunkt | Fas i rumstemp. |
|---|---|---|---|
| Metan | CH₄ | −162 °C | gas |
| Etan | C₂H₆ | −89 °C | gas |
| Propan | C₃H₈ | −42 °C | gas |
| Butan | C₄H₁₀ | 0 °C | gas |
| Pentan | C₅H₁₂ | 36 °C | flytande |
| Hexan | C₆H₁₄ | 69 °C | flytande |
| Heptan | C₇H₁₆ | 98 °C | flytande |
| Oktan | C₈H₁₈ | 126 °C | flytande |
| … | … | … | … |
| Hexadekan | C₁₆H₃₄ | 287 °C | flytande |
| Heptadekan | C₁₇H₃₆ | 302 °C | fast |
| Eikosan | C₂₀H₄₂ | 343 °C | fast |

- **Metan** – enklaste kolvätet, en kraftfull växthusgas. Kallas **naturgas/fossilgas** när den kommer under marken och **biogas** (förnybar) när bakterier bryter ner t.ex. matrester.
- **Etan** – används framför allt för tillverkning av plast och kemikalier.
- **Propan + butan = gasol** (grillar, gasolkök, brännaren i kemisalen).
- **Pentan–oktan** är flytande och finns i bensin.

> Ju **längre kolkedja**, desto högre kokpunkt. Korta kedjor är gaser, medellånga vätskor och långa fasta ämnen.

### Tre sätt att beskriva en molekyl
- **Molekylformel** (C₄H₁₀) – vilka och hur många atomer.
- **Strukturformel** – hur atomerna sitter ihop, ritad platt med streck för bindningarna.
- **Molekylmodell** – kulor som visar molekylen i tre dimensioner.

Rita en strukturformel: 1) skriv ut kolatomerna (butan = 4 C), 2) sätt ut fyra bindningar på varje kol, 3) fyll alla lediga bindningar med H, 4) räkna → C₄H₁₀.

### Isomerer
Molekyler med **samma molekylformel men olika strukturformel** kallas **isomerer**. **n-butan** (rak kedja, kokpunkt 0 °C) och **isobutan** (grenad, kokpunkt −12 °C) är båda C₄H₁₀. Oktan har 18 olika isomerer.

### Alkener och alkyner
- **Alkener** har en **dubbelbindning** (två elektronpar) mellan två kolatomer, t.ex. **eten C₂H₄**. Ändelse *-en*.
- **Alkyner** har en **trippelbindning**, t.ex. **etyn C₂H₂** (acetylen, används vid svetsning). Ändelse *-yn*.
- Även alkener/alkyner kan ha isomerer: i **1-buten** sitter dubbelbindningen efter första kolet, i **2-buten** efter det andra.

Alkener och alkyner är **reaktiva**: en av elektronparbindningarna i dubbel-/trippelbindningen bryts lätt och binder till andra atomer. Därför kan kemister sätta ihop många **etenmolekyler** till jättelånga kedjor – **polyeten**, plasten i plastfolie. Eten utsöndras också från äpplen och får bananer att mogna snabbare.
"""),
        ("Förbränning och fossila bränslen", """
Flygplan, bussar, bilar och fartyg drivs av **fossila bränslen** – bensin, diesel, fotogen – som är blandningar av olika kolväten. När de förbränns bildas koldioxid.

### Förbränning kräver syre
- Vätgas + syrgas → vatten: **2 H₂ + O₂ → 2 H₂O**
- Kol + syrgas → koldioxid: **C + O₂ → CO₂**
- Kolväten innehåller både kol och väte, så det bildas **både koldioxid och vatten**:

**CH₄ + 2 O₂ → CO₂ + 2 H₂O**

Så balanserar du formeln: metanens fyra väten ger två vattenmolekyler; två vatten + en koldioxid innehåller fyra syreatomer → det behövs **två syrgasmolekyler**.

Samma sak gäller allt som innehåller kol och väte – trä, plast, mat, gummi, tyg – alltså allt som ursprungligen kommer från levande organismer.

### Kolkedjornas längd bestämmer antändbarhet
Ett bränsle måste vara i **gasform** för att blandas med syret och brinna – därför börjar lågan en bit ovanför bensinytan. Bensin har **kortare kolkedjor** än diesel, är mer lättflytande, övergår lättare till gas och är därför **lättare att antända**.

### Fossila bränslen bildas långsamt under marken
Döda djur och växter som hamnar under marken utan syre kan inte brytas ner. Pressas de ihop och värms upp under **miljontals år** bildas **olja, kol och naturgas**.

### Fraktionerad destillation separerar råolja
**Råolja** är en blandning av gasformiga, flytande och fasta kolväten. Den delas upp i **fraktioner** i ett destillationstorn:

1. Råoljan hettas upp till **400 °C** i en ugn – alla kolväten blir gas.
2. Gasen leds in nertill i ett **torn** som är 400 °C i botten och ca 20 °C högst upp.
3. Redan vid 400 °C kondenserar **smörjolja och asfalt**; vid 370 °C **tjockolja**.
4. Vid 300 °C blir **diesel** flytande, vid 200 °C **fotogen**, vid 150 °C **bensin**.
5. **Gasol** har lägst kokpunkt och är fortfarande gas vid 20 °C.
6. På varje nivå finns en ventil som släpper upp gas men hindrar vätskor från att rinna ner.

| Fraktion | Antal kolatomer | Används till |
|---|---|---|
| Gasol | 3–4 | grillar |
| Bensin | ca 5–10 | bilar, båtar – brinner lätt |
| Fotogen | ca 10–22 | fartyg, flygplan, förr lampor |
| Diesel | ca 11–14 | bilar, lastbilar, bussar, tåg – måste värmas innan den antänds |

### Krackning
Efterfrågan på bensin och diesel är större än andelen i råoljan, medan tunga oljor blir över. Därför **krackas** långa kolväten till kortare – t.ex. genom kraftig upphettning.
"""),
        ("Alkoholer", """
Alkohol i vardagligt tal är **etanol**, men det finns många alkoholer. De flesta är giftiga, färglösa vätskor med stark lukt, och många brinner lätt. De används som bakteriedödande medel, bränsle och lösningsmedel samt för tillverkning av läkemedel, plaster och hudkrämer.

### Så är alkoholer uppbyggda
Alkoholer liknar kolväten men har en eller flera **OH-grupper** (en syreatom bunden till en väteatom). Namnet är kolvätets namn + **-ol**:

- **Metan CH₄ → metanol CH₃OH**
- **Etan C₂H₆ → etanol C₂H₅OH**

Molekylformeln skrivs med OH-gruppen synlig (CH₃OH, inte CH₄O) för att visa att det är en alkohol.

### Metanol – träsprit
Brinner lätt och används som bränsle. **Mycket giftig**: kan skada synnerven, ge blindhet och i värsta fall döden. Kallas **träsprit** eftersom den kan framställas genom **torrdestillation** av trä (trä hettas upp utan syre). Numera framställs den oftast syntetiskt: **CO + 2 H₂ → CH₃OH**.

### Etanol – bränsle och bakteriedödare
Finns i alkoholhaltiga drycker. Används i handsprit, rengöringsmedel och som bränsle i spritkök. Blandas med **denatureringsmedel** som gör att man kräks om man dricker den – då kallas den **T-röd** eller **rödsprit**.
- Framställs genom **jäsning**: jästsvampar bryter ner druvsocker till etanol och koldioxid; destillation renar etanolen.
- Framställs även syntetiskt av eten och vatten: **C₂H₄ + H₂O → C₂H₅OH** (dubbelbindningen i eten gör reaktionen möjlig).
- Bränslet **E85** innehåller 85 % etanol och 15 % bensin.

### Alkoholer har lägre energiinnehåll än kolväten
Alkoholmolekyler har redan syreatomer bundna till sig och kan därför inte reagera med lika mycket syre som ett kolväte.

| Bränsle | Energiinnehåll |
|---|---|
| Metan | 55 MJ/kg |
| Etan | 48 MJ/kg |
| Bensin | 47 MJ/kg |
| Diesel | 45 MJ/kg |
| Etanol | 30 MJ/kg |
| Metanol | 23 MJ/kg |

### Flervärda alkoholer
- **Etandiol = glykol**, C₂H₄(OH)₂ – **tvåvärd** (två OH-grupper). Giftig. Används som frostskydd i bilars kylsystem: 50 % vatten + 50 % glykol fryser först vid −35 °C.
- **Propantriol = glycerol**, C₃H₅(OH)₃ – **trevärd** (tre OH-grupper). Livsviktig molekyl som bygger upp alla fetter. Håller kvar vatten → fuktbevarande i hudkrämer, salvor och marsipan.
"""),
        ("Organiska syror, estrar och tensider", """
Myror sprutar en sur vätska, inlagd gurka ligger i sur lag, omogen frukt smakar surt. Sura ämnen är vanliga i naturen som försvar mot djur, bakterier och mögelsvampar.

### Organiska syror
Växter som brännässla, harsyra och rabarber innehåller syror – **organiska syror**. De liknar kolväten och alkoholer men har en **karboxylgrupp, –COOH**: en kolatom med en OH-grupp och en dubbelbunden syreatom.

| Syra | Vardagsnamn | Formel | Finns i / används till |
|---|---|---|---|
| **Metansyra** | myrsyra | HCOOH | myror, brännässlor |
| **Etansyra** | ättiksyra | CH₃COOH | konservering (gurka), smaksättning, plast, trälim |
| **Propansyra** | propionsyra | C₂H₅COOH | hindrar mögel i djurfoder |
| **Stearinsyra** (18 C) och **palmitinsyra** (16 C) | – | – | stearinljus |

- Jämför etan C₂H₆ → etanol C₂H₅OH → etansyra CH₃COOH: alla har två kolatomer.
- **Varför sura?** Väteatomen i OH-gruppen avges i vatten: **CH₃COOH → CH₃COO⁻ + H⁺**. Bara en liten del av molekylerna släpper sin vätejon → organiska syror är **svaga syror**.
- Vin som står öppet blir surt: etanol + syre → etansyra + vatten (**C₂H₅OH + O₂ → CH₃COOH + H₂O**).
- Organiska syror med **6 kolatomer eller fler är fasta** i rumstemperatur. Stearin måste först smälta och bli gas i veken innan det brinner – därför tar det några sekunder att tända ett ljus.

### Estrar ger smak och lukt
Doften av mogen frukt kommer från **estrar**. En ester bildas när en **organisk syra reagerar med en alkohol** – det bildas också vatten:

**etanol + etansyra → etyletanoat + vatten** (C₂H₅OH + CH₃COOH → CH₃COOC₂H₅ + H₂O)

Konstgjorda estrar smaksätter mat, läsk och godis. De har exakt samma uppbyggnad som de naturliga, men naturliga smaker består av *många* ämnen och är därför svåra att återskapa.

**Katalysator**: ett ämne som gör att en reaktion går snabbare utan att själv förbrukas – t.ex. svavelsyra vid estertillverkning, eller katalysatorn i bilens avgasrör. Bindningen mellan syran och alkoholen kallas **esterbindning**.

- **Nitroglycerin** (glyceroltrinitrat, C₃H₅(NO₃)₃) är en ester av glycerol och salpetersyra – exploderar extremt lätt. **Alfred Nobel** uppfann **dynamit** genom att låta ett ämne suga upp nitroglycerinet så att det bara exploderar vid hög värme. Små mängder nitroglycerin används också som **hjärtmedicin** (vidgar blodkärlen).
- **Fetter är estrar**: glycerol + tre fettsyror → ett fett med tre esterbindningar. Smör är fast, olivolja flytande.

### Tensider – löser fett i vatten
- **Polära** molekyler (olika laddning i ändarna, t.ex. vatten) är **vattenlösliga = hydrofila**.
- **Opolära** molekyler (t.ex. fett) är **fettlösliga = hydrofoba**. Vatten kan inte lösa fett.
- En **tensid** har en opolär svans som liknar fett och ett polärt huvud som liknar vatten. Tensiderna kapslar in smuts med fett i små **bubblor** med den fettlösliga änden inåt och den vattenlösliga utåt – bubblan kan då sköljas bort med vatten. Så fungerar de flesta rengöringsmedel.
"""),
    ], [
        ("easy", "mcq", "Hur många bindningar kan en kolatom bilda?", ["2", "3", "4", "6"], 2, "Kol har fyra elektroner i yttersta skalet och fyra lediga platser – därför fyra bindningar."),
        ("easy", "fill", "Vad kallas det enklaste kolvätet, med en kolatom och fyra väteatomer?", None, ["metan"], "Metan, CH₄, är första ämnet i alkanserien."),
        ("easy", "mcq", "Vilket av ämnena är det hårdaste som finns i naturen?", ["Grafit", "Diamant", "Grafen", "Brunkol"], 1, "I diamant sitter kolatomerna i en extremt stark pyramidstruktur (tetraeder)."),
        ("easy", "tf", "Diamant leder elektricitet.", None, False, "Elektronerna kan inte röra sig genom diamant. Grafit, fulleren och grafen leder däremot ström."),
        ("easy", "mcq", "Vad bildas när ett kolväte förbränns fullständigt?", ["Koldioxid och vatten", "Bara vatten", "Kolmonoxid och vätgas", "Syrgas och kol"], 0, "Kolet blir koldioxid och vätet blir vatten, t.ex. CH₄ + 2 O₂ → CO₂ + 2 H₂O."),
        ("easy", "mcq", "Vilken grupp har alla alkoholer?", ["OH-grupp", "COOH-grupp", "NO₃-grupp", "CH₃-grupp"], 0, "Alkoholer har en eller flera OH-grupper. COOH är karboxylgruppen hos organiska syror."),
        ("easy", "tf", "Metanol kallas träsprit och är mycket giftig.", None, True, "Metanol kan framställas genom torrdestillation av trä. Förtäring kan ge blindhet och i värsta fall döden."),
        ("easy", "mcq", "Vilken molekylformel har propan?", ["CH₄", "C₂H₆", "C₃H₈", "C₄H₁₀"], 2, "Propan har 3 kolatomer och 8 väteatomer."),
        ("easy", "fill", "Vilken alkohol finns i öl och vin?", None, ["etanol"], "Etanol, C₂H₅OH, bildas när jästsvampar bryter ner druvsocker."),
        ("easy", "mcq", "Vad är gasol?", ["En blandning av propan och butan", "Ren metan", "Flytande bensin", "En alkohol"], 0, "Gasol är kolväten med 3–4 kolatomer – propan och butan – och används bl.a. i grillar."),
        ("medium", "mcq", "Vilka av ämnena leder elektricitet?", ["Grafit och grafen", "Diamant och grafit", "Bara diamant", "Inget av dem"], 0, "I grafit, grafen och fulleren kan elektronerna röra sig. I diamant kan de inte det."),
        ("medium", "mcq", "Vad kallas kolväten som har en dubbelbindning?", ["Alkaner", "Alkener", "Alkyner", "Alkoholer"], 1, "Alkaner har bara enkelbindningar, alkener en dubbelbindning (-en) och alkyner en trippelbindning (-yn)."),
        ("medium", "mcq", "Vad är isomerer?", ["Molekyler med samma molekylformel men olika strukturformel", "Molekyler med samma strukturformel men olika molekylformel", "Kolväten med trippelbindning", "Ämnen som bara består av kolatomer"], 0, "n-butan och isobutan är båda C₄H₁₀ men atomerna sitter ihop på olika sätt."),
        ("medium", "numeric", "Hur många väteatomer har hexan, alkanen med 6 kolatomer?", None, {"value": 14, "tol": 0}, "Alkaner har 2n + 2 väteatomer: 2 · 6 + 2 = 14, alltså C₆H₁₄."),
        ("medium", "tf", "Bensin är lättare att antända än diesel eftersom bensinens kolkedjor är kortare.", None, True, "Kortare kedjor gör bensinen mer lättflytande och den övergår lättare till gas – och bara gas kan brinna."),
        ("medium", "mcq", "Vad kallas metoden som delar upp råolja i fraktioner som bensin, fotogen och diesel?", ["Fraktionerad destillation", "Krackning", "Torrdestillation", "Jäsning"], 0, "Råoljan hettas upp till 400 °C och gaserna kondenserar på olika nivåer i ett torn beroende på kokpunkt."),
        ("medium", "mcq", "Vilken fraktion har lägst kokpunkt och är fortfarande gas högst upp i destillationstornet (20 °C)?", ["Gasol", "Bensin", "Diesel", "Asfalt"], 0, "Gasol (propan/butan) är gas i rumstemperatur. Bensin kondenserar vid ca 150 °C, diesel vid 300 °C."),
        ("medium", "mcq", "Varför kallas etanol som säljs som bränsle ofta T-röd?", ["Den blandas med denatureringsmedel som gör att man kräks om man dricker den", "Den är färgad röd av järn", "Den innehåller 85 % bensin", "Den framställs av rödbetor"], 0, "Denaturerad etanol (rödsprit/T-röd) går inte att dricka."),
        ("medium", "fill", "Etandiol har två OH-grupper och används som frostskydd i bilar. Vad kallas den i vardagen?", None, ["glykol"], "Glykol, C₂H₄(OH)₂, är en tvåvärd, giftig alkohol. 50/50 med vatten fryser först vid −35 °C."),
        ("medium", "mcq", "Vad bildas när en organisk syra reagerar med en alkohol?", ["En ester och vatten", "En alkan och koldioxid", "Ett salt", "Ett kolväte"], 0, "T.ex. etanol + etansyra → etyletanoat + vatten. Estrar ger frukt dess doft."),
        ("medium", "fill", "Vad kallas metansyra i vardagsspråk?", None, ["myrsyra"], "Metansyra (HCOOH) kallas myrsyra – myror använder den som försvar och den finns i brännässlor."),
        ("medium", "match", "Para ihop kolvätet med antalet kolatomer.", {"left": ["Metan", "Etan", "Propan", "Butan"], "right": ["3", "1", "4", "2"]}, [1, 3, 0, 2], "Met- = 1, et- = 2, prop- = 3, but- = 4."),
        ("medium", "mcq", "Vilket bränsle har högst energiinnehåll per kilogram?", ["Metan (55 MJ/kg)", "Bensin (47 MJ/kg)", "Etanol (30 MJ/kg)", "Metanol (23 MJ/kg)"], 0, "Alkoholer har lägre energiinnehåll eftersom molekylerna redan innehåller syre och inte kan reagera med lika mycket syre."),
        ("medium", "tf", "Fetter är estrar som bildas när glycerol reagerar med tre fettsyror.", None, True, "Ett fett har tre esterbindningar. Vilka fettsyror som ingår avgör om fettet är fast (smör) eller flytande (olivolja)."),
        ("medium", "short", "Vad kallas den fettlösliga änden på en tensidmolekyl?", None, ["hydrofob", "opolär"], "Den fettlösliga änden är hydrofob (vattenskyende) och opolär; den vattenlösliga är hydrofil och polär."),
        ("hard", "numeric", "Hur många syrgasmolekyler (O₂) behövs för att förbränna en metanmolekyl fullständigt?", None, {"value": 2, "tol": 0}, "CH₄ + 2 O₂ → CO₂ + 2 H₂O. Koldioxiden och de två vattenmolekylerna innehåller tillsammans fyra syreatomer."),
        ("hard", "mcq", "Varför är organiska syror svaga syror?", ["Bara en liten del av molekylerna släpper sina vätejoner i vatten", "De innehåller inget väte", "De är fasta i rumstemperatur", "De har en dubbelbindning"], 0, "CH₃COOH → CH₃COO⁻ + H⁺ sker bara för en liten del av molekylerna."),
        ("hard", "mcq", "Varför används krackning i oljeraffinaderier?", ["Råoljan ger för lite bensin och diesel jämfört med efterfrågan", "För att rena naturgas från svavel", "För att tillverka plast av eten", "För att göra etanol odrickbar"], 0, "Långa kolväten (tunga oljor) delas upp i kortare som bensin och diesel, t.ex. genom kraftig upphettning."),
        ("hard", "mcq", "Varför reagerar alkener och alkyner lättare än alkaner?", ["En av elektronparbindningarna i dubbel-/trippelbindningen bryts lätt och kan binda till andra atomer", "De har fler väteatomer", "De är tyngre molekyler", "De är alltid gaser"], 0, "Därför är de reaktiva och används t.ex. för att bygga polyeten av eten."),
        ("hard", "numeric", "Vid vilken temperatur (°C) kokar pentadekan, C₁₅H₃₂?", None, {"value": 270, "tol": 0}, "Enligt tabellen kokar pentadekan vid 270 °C och är flytande i rumstemperatur."),
        ("hard", "mcq", "Vilken form av kol kan en person som fått i sig gift äta för att minska skadorna?", ["Aktivt kol", "Grafen", "Brunkol", "Fulleren"], 0, "Aktivt kol är amorft kol som binder andra ämnen till sig – det används även för att rena luft och vatten."),
        ("hard", "match", "Para ihop ämnet med formeln.", {"left": ["Etanol", "Ättiksyra", "Eten", "Glycerol"], "right": ["C₂H₄", "CH₃COOH", "C₃H₅(OH)₃", "C₂H₅OH"]}, [3, 1, 0, 2], "Etanol C₂H₅OH, ättiksyra (etansyra) CH₃COOH, eten C₂H₄, glycerol C₃H₅(OH)₃."),
        ("hard", "mcq", "Vad är dynamit?", ["Nitroglycerin uppsuget i ett ämne så att det bara exploderar vid hög värme", "Ren flytande nitroglycerin", "Glycerol blandad med salt", "En ester av etanol och ättiksyra"], 0, "Alfred Nobel stabiliserade nitroglycerinet så att det inte exploderar av rörelse eller slag."),
        ("hard", "tf", "Grafen är ungefär hundra gånger starkare än stål i förhållande till sin vikt.", None, True, "Grafen är ett enda platt lager kolatomer, leder ström och kan användas i böjbara skärmar."),
        ("hard", "mcq", "Vilken reaktion används numera oftast för att framställa metanol?", ["CO + 2 H₂ → CH₃OH", "C₂H₄ + H₂O → C₂H₅OH", "CH₄ + 2 O₂ → CO₂ + 2 H₂O", "C₂H₅OH + O₂ → CH₃COOH + H₂O"], 0, "Kolmonoxid reagerar med vätgas och bildar metanol. Förr användes torrdestillation av trä."),
    ]),
]

# ---------------------------------------------------------------------------
# HISTORIA – VÄRLDSHANDEL, INDUSTRIALISERING OCH REVOLUTIONER
# ---------------------------------------------------------------------------
CONTENT["historia"] = [
    (8, "Världshandel, industrialisering och revolutioner", 10, [
        ("Nya samhällsklasser 1750–1900", """
Industrialiseringen och revolutionerna under 1700- och 1800-talen ledde till att **ståndssamhället avskaffades**. Allt färre tillhörde de gamla stånden (t.ex. bönder och borgare), inga grupper hade längre särskilda privilegier, **allas likhet inför lagen** infördes och det blev fritt att välja yrke.

I stället växte tre **samhällsklasser** fram. Inom en klass har människor liknande utbildning, ekonomi och makt.

### Arbetarklass
Industrialiseringen fick många att lämna landsbygden för städerna, där de kunde få arbete i fabriker eller hushåll. I slutet av 1800-talet var **de flesta människor arbetare** – utan politisk eller ekonomisk makt. På landsbygden fanns de allra fattigaste: jordbruksarbetarna.

### Medelklass
Världshandeln och industrialiseringen gjorde att medelklassen växte: rika handelsmän, bankirer, fabriksägare och välutbildade som läkare, advokater och ingenjörer – men även fattiga hantverkare och anställda inom tjänsteyrken. För att få **rösta** krävdes tillräckligt hög inkomst eller förmögenhet, och rösträtten gällde **bara män**.

### Överklass
En mycket liten del av befolkningen – de som har mest **kapital och makt**. I ståndssamhället motsvarades överklassen av adeln.

> Den belgiska socialistiska tidningens bild *"Pyramide à renverser"* (1890) visar det nya samhället som en pyramid: överst kungen ("jag regerar över er"), sedan kyrkan, militären och kapitalisterna – och längst ner folket som bär upp alla ("jag arbetar för er").
"""),
        ("Politiska ideologier", """
En **ideologi** är idéer om hur ett samhälle ska styras och hur pengarna ska fördelas. Ideologierna skiljer sig åt i synen på vilka problem som finns, hur samhället bör se ut och hur det bör förändras. De som växte fram under 1700- och 1800-talen ligger till grund för dagens partier.

### Liberalismen (*liber* = fri)
- Viktigaste frågan: **individens frihet**. Kyrkans och statens samarbete skulle upphöra.
- För fri- och rättigheter: yttrandefrihet, tryckfrihet, pressfrihet, näringsfrihet och rösträtt – men **från början emot rösträtt för kvinnor och fattiga**.
- Staten skulle inte blanda sig i ekonomin mer än nödvändigt: **handel utan tullar**, frihet att välja yrke och starta företag. Utbildning skulle ge alla samma möjligheter.
- Lockade först främst **medelklassen**.

### Socialismen (*socius* = kamrat)
- Målet: ett **klasslöst samhälle** där de ekonomiska skillnaderna är utjämnade.
- Lockade främst **arbetare**, som skulle gå samman: demonstrera, strejka och bilda **fackföreningar** och partier.
- Kvinnor tjänade mindre än män. Fackföreningarna såg kvinnors låga löner som ett hot mot männens jobb och **motarbetade ofta kvinnornas deltagande** i stället för att kämpa för lika lön – arbetarklassens intressen ansågs komma före jämställdheten.

### Kommunismen (*communis* = gemensam)
En variant av socialismen. Socialisterna trodde att det klasslösa samhället kunde nås genom förändringar – kommunisterna ansåg att det krävdes en **revolution**, eftersom makthavarna inte skulle ge upp makten frivilligt.

### Konservatismen (*conservare* = bevara)
- En reaktion på de snabba förändringarna: förändringar skulle ske **långsamt**. I början emot rösträtt, emot att makthavarna utmanades och emot revolutionärernas våld.
- Samhället sågs som en **familj**: staten, polisen och kyrkan var fadern; arbetare, bönder och kvinnor var barnen. Varje människa har sin plats.
- Lockade främst de som redan hade makt, men även fattiga som fått nog av revolutionerna. Många konservativa oroades av fattigdomen i städerna och arbetade med **välgörenhet**.

### Feminismen (*femina* = kvinna)
- Krävde **lika fri- och rättigheter för kvinnor och män**. Bildade föreningar, strejkade, demonstrerade, startade företag och arbetade med välgörenhet.
- Kritiserade kvinnomisshandel, att kvinnan hade hela ansvaret för hem och barn, att de mänskliga rättigheterna bara gällde män och att arbetarkvinnor fick **hälften av männens lön**.
- **Olympe de Gouges** (1748–1793) skrev en förklaring om kvinnornas rättigheter under franska revolutionen.
- Många liberaler, socialister och konservativa var överens om att kvinnor inte skulle arbeta utanför hemmet, delta i politiken eller bestämma över egna pengar utan fars eller makes tillstånd.

### Tidslinje
| År | Händelse |
|---|---|
| 1775–1783 | Amerikanska frihetskriget (revolutionen startar) |
| 1789–1799 | Franska revolutionen |
| 1791–1804 | Revolutionen på Haiti |
| 1793–1794 | Skräckväldet |
| 1799–1814 | Napoleontiden |
| 1807 | Slaveriet avskaffas i Storbritannien |
| 1848 | Uppror och revolutionsförsök i Europa |
| 1861–1865 | Amerikanska inbördeskriget – slaveriet avskaffas i USA |
"""),
    ], [
        ("easy", "mcq", "Vilka tre samhällsklasser ersatte ståndssamhället under 1800-talet?", ["Arbetarklass, medelklass och överklass", "Adel, präster och bönder", "Kungar, riddare och livegna", "Borgare, soldater och bönder"], 0, "Inom en samhällsklass har människor liknande utbildning, ekonomi och makt."),
        ("easy", "tf", "På 1800-talet fick bara män med tillräckligt hög inkomst eller förmögenhet rösta.", None, True, "Rösträtten var knuten till inkomst eller förmögenhet och gällde endast män."),
        ("easy", "mcq", "Vad betyder det latinska ordet liber, som liberalismen fått sitt namn av?", ["Fri", "Kamrat", "Bevara", "Kvinna"], 0, "Liber = fri. Liberalismens viktigaste fråga var individens frihet."),
        ("easy", "fill", "Vilken ideologi har fått sitt namn av det latinska ordet socius (kamrat)?", None, ["socialism", "socialismen"], "Socialismens mål var ett klasslöst samhälle."),
        ("easy", "mcq", "Vilken ideologi ville bevara samhället och ansåg att förändringar skulle ske långsamt?", ["Konservatismen", "Liberalismen", "Socialismen", "Feminismen"], 0, "Conservare = bevara. Konservatismen uppstod som en reaktion på de snabba förändringarna."),
        ("medium", "mcq", "Vilken grupp lockades först av liberalismens idéer?", ["Medelklassen", "Adeln", "Arbetarna", "Jordbruksarbetarna"], 0, "Liberalismen med sin frihandel och näringsfrihet lockade till en början främst medelklassen."),
        ("medium", "mcq", "Vad skilde kommunisterna från andra socialister?", ["Kommunisterna ansåg att det krävdes en revolution för att nå det klasslösa samhället", "Kommunisterna ville behålla samhällsklasserna", "Kommunisterna var emot fackföreningar", "Kommunisterna stödde kungen"], 0, "Socialisterna trodde på förändringar steg för steg; kommunisterna menade att makthavarna aldrig skulle ge upp makten frivilligt."),
        ("medium", "mcq", "Vem skrev en förklaring om kvinnornas rättigheter under franska revolutionen?", ["Olympe de Gouges", "Napoleon Bonaparte", "Marie Antoinette", "Karl Marx"], 0, "Olympe de Gouges (1748–1793) var en tidig feminist."),
        ("medium", "tf", "Fackföreningarna på 1800-talet kämpade oftast för att kvinnor skulle få lika lön som män.", None, False, "De såg kvinnornas låga löner som ett hot mot männens jobb och motarbetade ofta kvinnornas deltagande."),
        ("medium", "numeric", "Vilket år avskaffades slaveriet i Storbritannien?", None, {"value": 1807, "tol": 0}, "1807 i Storbritannien; i USA först efter inbördeskriget 1861–1865."),
        ("medium", "match", "Para ihop ideologin med det latinska ordet den fått sitt namn av.", {"left": ["Liberalism", "Socialism", "Konservatism", "Feminism"], "right": ["conservare = bevara", "femina = kvinna", "liber = fri", "socius = kamrat"]}, [2, 3, 0, 1], "Liber = fri, socius = kamrat, conservare = bevara, femina = kvinna."),
        ("medium", "mcq", "Hur såg konservatismen på samhället?", ["Som en familj där staten, polisen och kyrkan var fadern", "Som ett klasslöst kollektiv", "Som en fri marknad utan tullar", "Som en demokrati med allmän rösträtt"], 0, "Arbetarna, bönderna och kvinnorna var barnen i familjen – alla hade sin plats."),
        ("hard", "mcq", "Vad ville liberalerna när det gällde handeln?", ["Handeln skulle ske utan tullar", "Staten skulle äga all handel", "Bara adeln skulle få bedriva handel", "Handel med utlandet skulle förbjudas"], 0, "Liberalerna ville att staten skulle blanda sig i ekonomin så lite som möjligt."),
        ("hard", "match", "Para ihop händelsen med årtalen.", {"left": ["Franska revolutionen", "Napoleontiden", "Amerikanska inbördeskriget", "Revolutionen på Haiti"], "right": ["1861–1865", "1789–1799", "1791–1804", "1799–1814"]}, [1, 3, 0, 2], "Franska revolutionen 1789–1799, Napoleontiden 1799–1814, inbördeskriget 1861–1865, Haiti 1791–1804."),
        ("hard", "mcq", "Vilka räknades till medelklassen?", ["Fabriksägare, bankirer, läkare, advokater och ingenjörer", "Jordbruksarbetare", "Adeln", "Fabriksarbetare"], 0, "Även fattiga hantverkare och anställda i tjänsteyrken räknades dit."),
        ("hard", "tf", "I slutet av 1800-talet tillhörde de flesta människor arbetarklassen.", None, True, "Industrialiseringen gjorde att de flesta blev arbetare utan politisk eller ekonomisk makt."),
        ("hard", "short", "Vilken var liberalismens viktigaste fråga?", None, ["frihet", "individens frihet", "friheten"], "Liberalismens viktigaste fråga var individens frihet."),
        ("hard", "mcq", "Vilket år skedde uppror och revolutionsförsök i många europeiska länder, bl.a. i Berlin?", ["1848", "1789", "1807", "1865"], 0, "1848 var revolutionsåret i Europa – tavlan i boken visar soldater som skjuter mot revolutionärer i Berlin."),
    ]),
]


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def j(v):
    return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"


def main():
    out = ["-- Generated by supabase/seed/content_books.py – do not edit by hand", "begin;"]
    for sid, name, icon, color, sort in SUBJECTS:
        out.append(f"insert into subjects(id,name,icon,color,sort) values ({q(sid)},{q(name)},{q(icon)},{q(color)},{sort}) on conflict (id) do update set name=excluded.name, icon=excluded.icon, color=excluded.color, sort=excluded.sort;")
    for sid, chapters in CONTENT.items():
        for (year, title, sort, lessons, questions) in chapters:
            # idempotent: skip if a chapter with the same subject+title exists
            stmt = f"with ch as (insert into chapters(subject_id,year,title,sort) select {q(sid)},{year},{q(title)},{sort} where not exists (select 1 from chapters where subject_id={q(sid)} and title={q(title)}) returning id)"
            parts = []
            for li, (lt, body) in enumerate(lessons):
                parts.append(f"insert into lessons(chapter_id,title,body,sort) select id,{q(lt)},{q(body.strip())},{li+1} from ch")
            for (diff, qt, prompt, options, answer, expl) in questions:
                opts = j(options) if options is not None else "null"
                parts.append(f"insert into questions(subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation) select {q(sid)},id,{q(diff)},{q(qt)},{q(prompt)},{opts},{j(answer)},{q(expl)} from ch")
            for pi, p in enumerate(parts[:-1]):
                stmt += f", i{pi} as ({p})"
            stmt += " " + parts[-1] + ";"
            out.append(stmt)
    out.append("commit;")
    print("\n".join(out))


if __name__ == "__main__":
    main()

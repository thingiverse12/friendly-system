// ============================================================================
// OFFICIELLT FALL: Hotell Silversolen – misstänkt dödsfall under vinterstorm.
// Mindre men komplett och internt konsekvent fall (3 misstänkta).
// ============================================================================

export const hotellet = {
  slug: 'hotell-silversolen',
  title: 'Hotell Silversolen',
  caseType: 'suspicious_death',
  environment: 'hotel',
  difficulty: 'beginner',
  playtimeMin: 75,
  image: '/img/cases/hotellet.jpg',
  intro:
    'Snöstormen har isolerat fjällhotellet. På morgonen hittas hotellägaren död längst ner i trapphuset. En av de innestängda gästerna eller de anställda är skyldig.',
  briefing: [
    'Natten till den 3 december rasar en snöstorm över fjällhotellet Silversolen. Ingen kan ta sig in eller ut efter klockan 20.00.',
    'På morgonen hittas ägaren Margareta Silfver, 68, livlös längst ner i huvudtrappan. Personalen talar om en fallolycka – men den rättsmedicinska bedömningen och revorna i trappmattan får polisen att misstänka brott.',
    'Hotellet rymmer elva gäster och fyra anställda. Du ska identifiera vem som hade motiv, möjlighet och inget trovärdigt alibi.',
  ],
  locations: [
    { id: 'place_trapphus', name: 'Huvudtrappan', kind: 'place' },
    { id: 'place_bar', name: 'Hotellets bar', kind: 'place' },
    { id: 'place_kok', name: 'Storköket', kind: 'place' },
    { id: 'place_reception', name: 'Receptionen', kind: 'place' },
  ],
  persons: [
    {
      personId: 'margareta', kind: 'victim', name: 'Margareta Silfver', age: 68,
      roleTitle: 'Hotellägare (offret)', initials: 'MS', color: '#5b6b7d',
      publicProfile: {
        bakgrund: 'Margareta grundade Silversolen för 30 år sedan och styrde hotellet med fast hand. Senaste månaden hade hon börjat granska bokföringen extra noggrant.',
        yrke: 'Hotellägare', bor: 'Silversolen', relationer: 'Moster till Lina Silfver. Arbetsgivare till Per-Arne och David.',
        snabbfakta: [['Typ', 'Misstänkt dödsfall'], ['Miljö', 'Hotell, vinterstorm'], ['Svårighetsgrad', 'Nybörjare'], ['Misstänkta', '3']],
      },
      secret: { isCulprit: false },
    },
    {
      personId: 'perarne', kind: 'suspect', name: 'Per-Arne Holm', age: 58,
      roleTitle: 'Hotellchef', initials: 'PH', color: '#c8102e',
      publicProfile: {
        bakgrund: 'Per-Arne har varit hotellchef i 15 år och är den ende som har ett fullständigt huvudnyckelkort. Han har en repa på vänster hand som han förklarar som en köksolycka.',
        yrke: 'Hotellchef', bor: 'Personalbostaden', relationer: 'Närmaste medarbetare till offret.',
        snabbfakta: [['Yrke', 'Hotellchef'], ['Nyckelbehörighet', 'Huvudnyckel'], ['Relationer', 'Högra hand']],
      },
      secret: {
        isCulprit: true,
        knows: ['Att Margareta upptäckt att han fört över pengar från hotellkontot till ett privat konto i två år.', 'Att han använde huvudnyckeln 22.38 och mötte henne i trapphuset 22.45.'],
        believes: ['Att ingen kan bevisa att han var vid trappan eftersom kamerorna i korridoren varit ur funktion sedan stormen började.'],
        hides: ['Förskingringen på sammanlagt 1,4 miljoner kronor och att hans "köksolycka" uppstod i brottningskampen vid trappan.'],
        alibi: {
          claim: 'Jag var på kontoret med pappersarbete hela kvällen. Jag gick aldrig upp någon trappa.',
          truth: 'Huvudnyckelns logg visar användning 22.38 i Margarets korridor. Han mötte henne i trapphuset 22.45.',
          reliability: 'false', evidenceIds: ['h2_nyckel', 'h2_larm'],
        },
        suggestedQuestions: [
          'Var befann du dig mellan 22 och 23?',
          'Vad är det för repa på din hand?',
          'Hur kommer det sig att huvudnyckeln användes 22.38?',
          'Vad vet du om bokföringen?',
        ],
        questions: [
          { keywords: ['var', 'befann', 'kväll', 'kvällen', 'alibi', '22', '23'], answer: 'På mitt kontor bakom receptionen. Pappersarbete, kvitton och leverantörsfakturor. Ingen störde mig, men det är ju knappast mitt fel.', truthful: false },
          { keywords: ['repa', 'hand', 'sår', 'kli'], answer: 'Det där? Jag skar mig på en konservkant i köket på eftermiddagen. David såg det, fråga honom. (David bekräftar att såret fanns på kvällen – men inte hur det uppstod.)', truthful: false },
          { keywords: ['nyckel', 'huvudnyckel', 'kort', '22.38'], answer: 'Huvudnyckeln används hela tiden, av mig, för lås och larm. Exakt 22.38 minns jag inte. Den loggen säger inget om var jag gick.', truthful: false },
          { keywords: ['bokföring', 'pengar', 'konto', 'förskingring', 'ekonomi'], answer: 'Bokföringen är i sin ordning. Margareta skulle träffa revisorn i övermorgon, ja, men det var en rutinsak. (Han svarar snabbare än tidigare.)', truthful: false },
          { keywords: ['margareta', 'relation', 'chef'], answer: 'Vi hade våra meningsskiljaktigheter, som chefer emellan. Men jag har vigt 15 år av mitt liv åt det här hotellet.', truthful: true },
        ],
        evidenceReactions: {
          h2_nyckel: 'Okej. Jag lånade… jag var tvungen att låsa upp ett förråd. Det betyder inte att jag var i trapphuset.',
          h2_bokforing: 'Vem har gett er de där papprena? Det där är utdrag ur sitt sammanhang. (Han torkar sig över pannan.)',
          h2_mail: 'Hon hotade hela tiden med revisorn. Ett mejl är inget brott.',
          h2_matta: 'En matta kan slitas av vem som helst. Och repan på min hand är från köket.',
        },
        genericLines: ['Jag har inget att tillägga.', 'Det här är en tragisk olycka, inget annat.'],
      },
    },
    {
      personId: 'lina', kind: 'suspect', name: 'Lina Silfver', age: 29,
      roleTitle: 'Syskonbarn och arvtagare', initials: 'LS', color: '#6aa9ff',
      publicProfile: {
        bakgrund: 'Lina är Margaretas syskonbarn och enda arvtagare. Hon hade ett högljutt gräl med sin moster på eftermiddagen, hörbart i hela foajén.',
        yrke: 'Frilansjournalist', bor: 'Göteborg', relationer: 'Syskonbarn till offret.',
        snabbfakta: [['Yrke', 'Journalist'], ['Arv', 'Huvudarvtagare'], ['Relationer', 'Syskonbarn']],
      },
      secret: {
        isCulprit: false,
        knows: ['Att grälet handlade om att Margareta vägrat finansiera hennes tidningsprojekt.'],
        believes: ['Att Per-Arne dolde något i bokföringen – Margareta nämnde det under grälet.'],
        hides: ['Att hon druckit fyra drinkar i baren och var lätt berusad; hon skäms över att vittna onykter.'],
        alibi: {
          claim: 'Jag satt i baren från 22.00 till stängning 23.30. Flera gäster kan intyga det.',
          truth: 'Stämmer. Tre gäster och bartendern bekräftar att hon inte lämnade baren.',
          reliability: 'confirmed', evidenceIds: ['h2_bar'],
        },
        suggestedQuestions: ['Vad handlade grälet om?', 'Var befann du dig på kvällen?', 'Vem skulle ärva hotellet?', 'Vad sa Margareta om bokföringen?'],
        questions: [
          { keywords: ['gräl', 'bråk', 'argument', 'grälade'], answer: 'Vi bråkade om pengar – jag ville att hon skulle investera i mitt tidningsprojekt och hon sa nej. Jag sa dumma saker. Men jag älskade min moster. Jag gick därifrån och satte mig i baren.', truthful: true },
          { keywords: ['var', 'befann', 'kväll', 'kvällen', 'alibi', 'bar'], answer: 'Baren, 22.00 till 23.30. Jag var för arg och för full för att gå någonstans. Fråga bartendern, eller paret från Oslo som spelade kort med mig.', truthful: true },
          { keywords: ['ärva', 'arv', 'pengar', 'testamente'], answer: 'Ja, jag ärver hotellet. Tro nu inte att jag är girig – det har stått klart i tio år och jag har hela tiden vetat om det. Ett arv man redan räknar med är inget motiv att påskynda.', truthful: true },
          { keywords: ['bokföring', 'per-arne', 'revisor'], answer: 'Under grälet skrek Margareta att "min egen hotellchef lurar mig" och att revisorn skulle komma i övermorgon. Hon nämnde inget namn, men vem annars än Per-Arne har hand om pengarna?', truthful: true },
        ],
        evidenceReactions: {
          h2_bar: 'Där ser ni. Hela kvällen i baren. Jag kunde omöjligen vara i trapphuset.',
          h2_bokforing: 'Det där är exakt sånt hon menade. Per-Arne måste ha vetat att revisorn skulle avslöja honom.',
        },
        genericLines: ['Jag har inget mer att tillägga.', 'Fråga barpersonalen om ni inte tror mig.'],
      },
    },
    {
      personId: 'david', kind: 'suspect', name: 'David Orlov', age: 41,
      roleTitle: 'Köksmästare', initials: 'DO', color: '#f5a623',
      publicProfile: {
        bakgrund: 'David har varit köksmästare i tre år. Margareta anklagade honom förra året för att ha stulit från vinkällaren – en anklagelse som senare lades ner.',
        yrke: 'Köksmästare', bor: 'Personalbostaden', relationer: 'Tidigare misstänkt för stöld av offret.',
        snabbfakta: [['Yrke', 'Köksmästare'], ['Tidigare konflikt', 'Vinstöldanklagelse'], ['Relationer', 'Anställd']],
      },
      secret: {
        isCulprit: false,
        knows: ['Att Per-Arne skar sig i köket på eftermiddagen och senare bytte om till en mörk tröja.'],
        believes: ['Att Margaretas död var en olycka tills han hörde om mattan.'],
        hides: ['Att han faktiskt druckit en flaska vin från källaren i lördags – ett ringa brott han fruktar ska återuppväcka misstankarna.'],
        alibi: {
          claim: 'Jag var i köket hela kvällen. Köksdörren har en egen klocka i passersystemet som loggar allt.',
          truth: 'Stämmer. Passersystemet visar att köksdörren inte öppnades 21.55–23.10.',
          reliability: 'confirmed', evidenceIds: ['h2_kok'] },
        suggestedQuestions: ['Berätta om anklagelsen förra året.', 'Var befann du dig på kvällen?', 'Vad vet du om Per-Arnes sår?', 'Såg du något ovanligt?'],
        questions: [
          { keywords: ['anklagelse', 'stöld', 'vin', 'förra året'], answer: 'Hon anklagade mig för att stjäla vin. Det var en leverantör som slarvat, och det lades ner. Visst var jag förbannad – men jag stannade kvar och bevisade min oskuld genom att göra mitt jobb.', truthful: true },
          { keywords: ['var', 'befann', 'kväll', 'kvällen', 'alibi', 'kök'], answer: 'Köket, från 21 till 23.10. Passersystemet på köksdörren loggar varje öppning. Jag är den ende med det kortet under kvällspasset.', truthful: true },
          { keywords: ['per-arne', 'sår', 'repa', 'hand'], answer: 'Han skar sig på en konservkant runt 17-tiden, jag gav honom plåster. Senare, runt 22, kom han in i köket i en ren mörk tröja och verkade svettig trots kylan. Jag tänkte inte mer på det.', truthful: true },
        ],
        evidenceReactions: {
          h2_kok: 'Min dörrlogg. Hela kvällen i köket. Punkterat.',
          h2_nyckel: 'Endast Per-Arne har huvudnyckel. Det vet alla i personalen.',
        },
        genericLines: ['Jag kan bara prata för köket.', 'Fråga systemet – det ljuger inte.'],
      },
    },
    {
      personId: 'petra', kind: 'witness', name: 'Petra Nordin', age: 31,
      roleTitle: 'Receptionist (vittne)', initials: 'PN', color: '#b07bd8',
      publicProfile: {
        bakgrund: 'Petra arbetade nattpasset i receptionen och hanterade larmcentralen.',
        yrke: 'Receptionist', bor: 'Åre', relationer: 'Anställd på hotellet.',
        snabbfakta: [['Yrke', 'Receptionist'], ['Roll', 'Vittne']],
      },
      secret: {
        isCulprit: false,
        knows: ['Att inga ytterdörrar öppnats efter 20.00 på grund av stormlåset.', 'Att Per-Arne kom ner till receptionen 22.50 och bad om en påse is "åt en gäst", trots att ingen gäst ringt.'],
        believes: ['Att ispåsen var till hans egen hand.'],
        hides: ['Att hon tittade på en serie under passet och inte såg vem som passerade trapphuset.'],
        alibi: null,
        suggestedQuestions: ['Vad visar larmet?', 'Vad hände 22.50?', 'Kan någon utomstående ha tagit sig in?'],
        questions: [
          { keywords: ['larm', 'dörr', 'utomstående', 'storm', 'in'], answer: 'Stormlåset aktiverades 20.00. Inga ytterdörrar har öppnats efter det, det syns i larmcentralen. Gärningspersonen fanns redan inne.', truthful: true },
          { keywords: ['22.50', 'is', 'per-arne', 'ner'], answer: '22.50 kommer Per-Arne ner och ber om en påse is. Han sa att en gäst behövde den, men inget samtal kom in. Han höll vänster hand i fickan hela tiden.', truthful: true },
          { keywords: ['trappa', 'såg', 'kamera'], answer: 'Kameran i övre korridoren ligger bakom en snödriva och har varit mörk sedan 19.00. Den i trapphuset också. Jag kan tyvärr inte säga vem som passerade.', truthful: true },
        ],
        evidenceReactions: { h2_ovader: 'Ja, vi var helt avskurna. Det är därför det här inte kan vara någon utifrån.' },
        genericLines: ['Det är allt jag har noterat.', 'Jag såg inget jag inte redan berättat.'],
      },
    },
  ],
  events: [
    { id: 'h2e1', time: '17:00', label: 'Per-Arne skär sig i köket', detail: 'David Orlov ger honom plåster. Såret på vänster hand uppstår här, enligt vittne.', kind: 'claimed', isPublic: true, secretNote: 'Senare använder Per-Arne såret som förklaring på rivmärken från brottningskampen.' },
    { id: 'h2e2', time: '18:30', label: 'Gräl i foajén', detail: 'Lina och Margareta hörs argumentera högljutt. Flera gäster vittnar.', kind: 'confirmed', isPublic: true, secretNote: 'Pengarna till Linas projekt – sidospår.' },
    { id: 'h2e3', time: '20:00', label: 'Stormlåset aktiveras', detail: 'Ingen kan lämna eller beträda hotellet efter denna tidpunkt.', kind: 'confirmed', isPublic: true, secretNote: 'Avgränsar misstankekretsen till de innevarande.' },
    { id: 'h2e4', time: '22:00', label: 'Lina sätter sig i baren', detail: 'Hon stannar till stängning 23.30, styrkt av tre gäster och bartendern.', kind: 'confirmed', isPublic: true, secretNote: 'Linas alibi.' },
    { id: 'h2e5', time: '22:38', label: 'Huvudnyckeln används i Margaretas korridor', detail: 'Endast Per-Arnes huvudnyckelkort har denna behörighet.', kind: 'confirmed', isPublic: true, secretNote: 'Per-Arne går till offret.' },
    { id: 'h2e6', time: '22:45', label: 'Fall i trapphuset', detail: 'En gäst hör en duns men tänker på väskor som flyttas. Döden inträffar här.', kind: 'uncertain', isPublic: true, secretNote: 'Per-Arne knuffar Margareta nerför trappan under konfrontationen.' },
    { id: 'h2e7', time: '22:50', label: 'Per-Arne hämtar is i receptionen', detail: 'Petra noterar att han håller vänster hand dold.', kind: 'claimed', isPublic: true, secretNote: 'Is mot såret från kampen.' },
    { id: 'h2e8', time: '07:10', label: 'Kroppen upptäcks', detail: 'Morgonpersonalen finner Margareta vid foten av trappan och larmar.', kind: 'confirmed', isPublic: true, secretNote: '' },
  ],
  evidence: [
    { id: 'h2_nyckel', category: 'technical', title: 'Huvudnyckelns användningslogg', description: 'Passersystemet visar att ett huvudnyckelkort – en behörighet bara Per-Arne Holm innehar – användes i offrets korridor 22.38.', sourceStatus: 'fact', location: 'Receptionen', image: '', discoverHint: 'Dra ut loggar från passersystemet.', secretMeaning: 'Placerar Per-Arne vid offret precis före dödsfallet. Avgörande.' },
    { id: 'h2_larm', category: 'technical', title: 'Larmcentralens dörrlogg', description: 'Samtliga ytterdörrar förblir låsta från 20.00. Ingen utomstående har tagit sig in eller ut.', sourceStatus: 'fact', location: 'Larmcentralen', image: '', discoverHint: 'Verifiera att ingen kunde ta sig in i stormen.', secretMeaning: 'Gärningspersonen finns bland de innestängda.' },
    { id: 'h2_bokforing', category: 'document', title: 'Bokföringsunderlag med privatkonto', description: 'Utdrag visar att 1,4 miljoner kronor förts från hotellkontot till ett privat konto registrerat på Per-Arne Holm under två år.', sourceStatus: 'fact', location: 'Chefskontoret', image: '', discoverHint: 'Granska handlingarna på chefskontoret.', secretMeaning: 'Motivet: förskingring som offret skulle avslöja.' },
    { id: 'h2_mail', category: 'digital', title: 'Offrets mejl till revisorn', description: 'Mejl skickat 21.55: "Kan vi tidigarelägga mötet? Jag har hittat oegentligheter i hotellkontots transaktioner. Vi ses i övermorgon."', sourceStatus: 'fact', location: 'Offrets dator', image: '', discoverHint: 'Säkringställ offrets dator.', secretMeaning: 'Tidsbundet motiv – avslöjandet var timmar bort.' },
    { id: 'h2_matta', category: 'physical', title: 'Revor i trappmattan och hudfragment', description: 'Trappmattan är riven längs räcket på övre avsatsen. Rättsmedicin hittar hudfragment under offrets naglar som jämförs med såret på Per-Arnes vänstra underarm.', sourceStatus: 'fact', location: 'Trapphuset', image: '', discoverHint: 'Spärra av brottsplatsen och invänta kriminalteknik.', secretMeaning: 'Bevisar fysisk konfrontation och kopplar Per-Arnes skada till platsen.' },
    { id: 'h2_bar', category: 'testimony', title: 'Tre gäster och bartendern styrker Lina', description: 'Fyra oberoende vittnen placerar Lina Silfver i baren oavbrutet 22.00–23.30.', sourceStatus: 'fact', location: 'Baren', image: '', discoverHint: 'Förhör alla gäster i baren.', secretMeaning: 'Lina saknar möjlighet att vara i trapphuset.' },
    { id: 'h2_kok', category: 'technical', title: 'Köksdörrens passersystem', description: 'Köksdörren, som bara David Orlovs kort öppnar under kvällspasset, loggas inte som öppnad mellan 21.55 och 23.10.', sourceStatus: 'fact', location: 'Storköket', image: '', discoverHint: 'Kontrollera varje personals rörelse via kortloggar.', secretMeaning: 'David fysiskt instängd i köket under dödsfallet.' },
    { id: 'h2_ovader', category: 'document', title: 'Meteorologisk stormrapport', description: 'SMHI bekräftar att väg 804 och samtliga leder till hotellet var ofarbara 19.40–06.30. Ingen snöskoter har lämnat spår.', sourceStatus: 'fact', location: 'Extern rapport', image: '', discoverHint: 'Begär väder- och trafikunderlag.', secretMeaning: 'Utesluter utomstående gärningspersoner.' },
  ],
  witnessStatements: [
    { id: 'h2ws1', personId: 'petra', reliability: 'high', content: 'Petra styrker att inga dörrar öppnats efter 20.00 och att Per-Arne hämtade is 22.50 med dold vänsterhand.' },
  ],
  hints: [
    'När ingen kan lämka platsen handlar utredningen om att matcha motiv mot möjlighet. Börja med att verifiera alla tre misstänktas alibin mot tekniska loggar.',
    'Titta på vem som faktiskt kan ha varit i trapphuset 22.45. Nyckelkort och dörrloggar är bekräftade fakta – muntliga försäkringar är det inte.',
    'Per-Arnes huvudnyckel användes 22.38, offret skulle avslöja förskingringen dagen därpå, och hudfragmenten matchar hans sår. Kedjan är nu komplett.',
  ],
  boardLinks: [
    { a: 'person:perarne', b: 'evidence:h2_nyckel', type: 'supported', label: 'Vid offret 22.38' },
    { a: 'person:perarne', b: 'evidence:h2_bokforing', type: 'supported', label: 'Förskingring = motiv' },
    { a: 'person:perarne', b: 'evidence:h2_mail', type: 'supported', label: 'Avslöjande timmar bort' },
    { a: 'person:perarne', b: 'evidence:h2_matta', type: 'supported', label: 'Fysisk konfrontation' },
    { a: 'person:perarne', b: 'event:h2e6', type: 'supported', label: 'Närvarande vid dödsfallet' },
    { a: 'person:lina', b: 'evidence:h2_bar', type: 'supported', label: 'Styrkt alibi' },
    { a: 'person:david', b: 'evidence:h2_kok', type: 'supported', label: 'Instängd i köket' },
    { a: 'evidence:h2_larm', b: 'evidence:h2_ovader', type: 'supported', label: 'Ingen utomstående' },
    { a: 'evidence:h2_mail', b: 'evidence:h2_bokforing', type: 'supported', label: 'Hotet som utlöste mordet' },
  ],
  assistantInsights: {
    h2_larm: 'Efter 20.00 är hotellet ett slutet rum. Listan över misstänkta kan inte bli längre – bara kortare.',
    h2_nyckel: 'Huvudnyckeln har bara en innehavare. Den här loggen är ett bekräftat faktum som väger tyngre än Per-Arnes muntliga förnekande.',
    h2_bokforing: 'Nu finns motivet i siffror: 1,4 miljoner och en revisor på väg.',
    h2_mail: 'Tajmingen är allt – offret skulle avslöja allt morgonen därpå.',
    h2_matta: 'Hudfragment under naglarna är inte en fallolycka. Någon har varit i fysisk kontakt med offret.',
    h2_bar: 'Fyra vittnen är svårt att argumentera emot. Lina försvinner från listan över möjliga gärningspersoner.',
    h2_kok: 'Köksdörren är ett tekniskt alibi som David inte kan ha manipulerat.',
    h2_ovader: 'Ytterligare en spärr mot teorin om en utomstående.',
  },
  solution: {
    culpritId: 'perarne',
    motive:
      'Per-Arne Holm hade i två år förskingrat 1,4 miljoner kronor från hotellkontot. Margareta Silfver hade upptäckt oegentligheterna och kallat revisorn till dagen därpå – ett avslöjande som skulle betyda både ruin och fängelse.',
    narrative:
      'Under kvällen försökte Per-Arne först övertala och sedan hota Margareta att avblåsa revisorsmötet. Med hjälp av sin huvudnyckel tog han sig upp till hennes korridor 22.38. I trapphuset 22.45 eskalerade konfrontationen: i tumultet knuffade han Margareta så att hon föll baklänges nerför trappan och avled. Han rev upp armen på mattnaglarna under kampen, hämtade is i receptionen 22.50 och förklarade senare skadan som en köksolycka – en förklaring som bara stämde till hälften, eftersom såret från konservkanten fanns sedan 17.00 medan rivmärkena var nya. Han förlitade sig på att de snöstormsblinda kamerorna skulle dölja honom, men passersystemets loggar, bokföringen och de rättsmedicinska spåren bildade en obruten kedja.',
    realTimeline: [
      { time: '17:00', text: 'Per-Arne skar sig i köket – den äkta förklaringen till en del av hans skada.' },
      { time: '20:00', text: 'Stormlåset stänger hotellet. Gärningspersonen är innanför dörrarna.' },
      { time: '21:55', text: 'Margareta mejlar revisorn om oegentligheterna.' },
      { time: '22:38', text: 'Per-Arnes huvudnyckel används i hennes korridor.' },
      { time: '22:45', text: 'Konfrontation i trapphuset och det dödliga fallet.' },
      { time: '22:50', text: 'Per-Arne hämtar is och döljer sin skadade hand.' },
      { time: '07:10', text: 'Kroppen upptäcks av morgonpersonalen.' },
    ],
    decisiveEvidence: ['h2_nyckel', 'h2_bokforing', 'h2_mail', 'h2_matta'],
    alternativeExplanations: [
      { personId: 'lina', whySeemedGuilty: 'Huvudarvtagare som hörts i ett högljutt gräl med offret samma dag.', contradictedBy: ['h2_bar'], explanation: 'Fyra vittnen placerar henne i baren under hela dödsfönstret. Arvet var dessutom sedan länge känt och säkrat.' },
      { personId: 'david', whySeemedGuilty: 'Tidigare anklagad för stöld av offret och befann sig ensam i byggnaden.', contradictedBy: ['h2_kok'], explanation: 'Passersystemet visar att köksdörren inte öppnades under dödsfallet. Han var fysiskt instängd.' },
    ],
  },
};

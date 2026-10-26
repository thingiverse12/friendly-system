// ============================================================================
// OFFICIELLT FALL: Döden i skärgården
// Komplett, versionslåst fallmodell. Allt under `secret` är HEMLIGT och läses
// aldrig ut till klienten – det används endast serversidan av AI-motorn,
// poängberäkningen och lösningsvisningen.
// ============================================================================

export const skerggarden = {
  slug: 'doden-i-skargarden',
  title: 'Döden i skärgården',
  caseType: 'suspicious_death',
  environment: 'archipelago',
  difficulty: 'normal',
  playtimeMin: 120,
  image: '/img/cases/skargarden.jpg',
  intro:
    'En framgångsrik entreprenör hittas död på en ö i skärgården. Vad hände egentligen den där natten?',
  briefing: [
    'Tisdagen den 14 oktober hittas byggentreprenören Niklas Berg, 45, livlös vid bryggan på den privatägda ön Storskär utanför Stockholm. Han har drivit ett byggföretag i två decennier och befunnit sig på ön tillsammans med flera gäster.',
    'Den rättsmedicinska undersökningen visar att döden inte är en enkel drunkningsolycka. Du och ditt team kallas in för att utreda händelseförloppet, granska allas alibin och avgöra vem som bär ansvaret.',
    'Ingen har lämnat ön efter midnatt. Alla ni behöver för att lösa fallet finns här – men ingen kommer att servera sanningen. Sanningen ligger i detaljerna.',
  ],
  locations: [
    { id: 'place_brygga', name: 'Bryggan', kind: 'place' },
    { id: 'place_huvudbyggnad', name: 'Huvudbyggnaden', kind: 'place' },
    { id: 'place_stockholm', name: 'Stockholm (fastlandet)', kind: 'place' },
    { id: 'place_vardshus', name: 'Öns värdshus', kind: 'place' },
  ],
  persons: [
    {
      personId: 'niklas', kind: 'victim', name: 'Niklas Berg', age: 45,
      roleTitle: 'Byggentreprenör (offret)', initials: 'NB', color: '#5b6b7d',
      publicProfile: {
        bakgrund: 'Niklas grundade Berg & Thun AB tillsammans med Mikael Thun. Han var känd som en hårdför men rättfram affärsman som nyligen börjat ifrågasätta flera pågående affärer.',
        yrke: 'Entreprenör', bor: 'Stockholm',
        relationer: 'Gift med Sara Berg. Affärspartner med Mikael Thun. Grannekonkurrent till Erik Lindberg.',
        snabbfakta: [['Typ', 'Misstänkt dödsfall'], ['Miljö', 'Skärgård'], ['Svårighetsgrad', 'Normal'], ['Misstänkta', '4'], ['Speltid (ca)', '2–4 timmar']],
      },
      secret: { isCulprit: false },
    },
    {
      personId: 'erik', kind: 'suspect', name: 'Erik Lindberg', age: 42,
      roleTitle: 'Vd, Lindberg Bygg AB', initials: 'EL', color: '#c8102e',
      publicProfile: {
        bakgrund:
          'Erik driver ett konkurrerande byggföretag som är beroende av en stor markaffär i skärgården. Han har haft en infekterad konflikt med offret om ett pågående markköp.',
        yrke: 'Företagsledare', bor: 'Stockholm',
        relationer: 'Ex-partner och affärsrival till Niklas Berg. Bekant med Sara Berg sedan tidigare.',
        snabbfakta: [
          ['Yrke', 'Företagsledare'], ['Bor', 'Stockholm'],
          ['Relationer', 'Ex-partner, affärsrival'],
        ],
      },
      secret: {
        isCulprit: true,
        knows: [
          'Att Niklas hade bestämt sig för att stoppa markköpet och polisanmäla en oegentlighet i avtalet.',
          'Att han själv befann sig på ön mellan 19.45 och 22.25.',
          'Att han konfronterade Niklas vid bryggan och att bråket slutade med att Niklas föll i vattnet och drunknade.',
        ],
        believes: [
          'Att inga tekniska spår kan bevisa att han var på ön, eftersom han lämnade bilen på fastlandet.',
          'Att hans Stockholmskvitto ser ut som ett vattentätt alibi.',
        ],
        hides: [
          'Han döljer att hans företag är veckor från konkurs om markaffären stoppas.',
          'Han ljuger om att ha varit i Stockholm hela kvällen.',
        ],
        alibi: {
          claim: 'Jag var i Stockholm hela kvällen. Det finns kvitton som bevisar det.',
          truth: 'Han tog båten till ön 19.35 och lämnade 22.25. Kvitto han hänvisar till är från 17.42 – före resan.',
          reliability: 'false',
          evidenceIds: ['ev_mobil', 'ev_kvitto', 'ev_knapp'],
        },
        suggestedQuestions: [
          'Var befann du dig på kvällen den 14 oktober?',
          'Har du en relation med offret?',
          'Vad vet du om markköpet?',
          'Varför ljög du om din vistelse på ön?',
        ],
        questions: [
          {
            keywords: ['var', 'befann', 'kväll', 'kvällen', 'alibi', 'stockholm'],
            answer:
              'Jag var inte på ön. Jag var faktiskt i Stockholm hela kvällen. Det finns kvitton som bevisar det. Jag åt på en restaurang runt åtta och jobbade sedan hemma.',
            truthful: false,
          },
          {
            keywords: ['relation', 'offret', 'niklas', 'kände', 'känner'],
            answer:
              'Vi kände varandra från branschen i många år. Jag ska vara ärlig: vi var konkurrenter och det har hettat till mellan oss affärsmässigt. Men fiender? Nej, vi var bara oense om en markaffär.',
            truthful: true,
          },
          {
            keywords: ['mark', 'markköp', 'affär', 'köp', 'konkurs', 'pengar'],
            answer:
              'Det där är en komplicerad affär. Niklas och jag hade olika åsikter om hur marken skulle användas. Visst betyder avtalet mycket för mitt företag, men jag skulle aldrig lösa en affärsdisekt med våld.',
            truthful: false,
          },
          {
            keywords: ['argument', 'bråk', 'gräl', 'röst', 'huvudbyggnad'],
            answer:
              'Jag vet inte vad du pratar om. Jag hade inget bråk med någon. Om någon har hört höga röster så är det knappast bevis på att det var jag.',
            truthful: false,
          },
          {
            keywords: ['båt', 'färja', 'resa', 'ö'],
            answer: 'Jag har inte satt min fot på den där ön på flera veckor. Ni får gärna kolla färjelägets loggar.',
            truthful: false,
          },
          {
            keywords: ['sara', 'fru'],
            answer: 'Sara och jag har träffats på branschevent, inget mer. Jag vet att äktenskapet var knaggligt, men det är knappast mitt bekymmer.',
            truthful: true,
          },
        ],
        evidenceReactions: {
          ev_mobil:
            'Det där… mastdata kan väl inte vara exakt? Mobiler kan ju koppla mot fel mast. (Han undviker ögonkontakt.) Jag har ingen förklaring. Jag säger bara att jag var i Stockholm.',
          ev_kvitto:
            'Mitt kvitto? Titta på klockslaget själv. 17.42. Det bevisar bara att jag var i Stockholm strax efter arbetsdagen – inte var jag var senare på kvällen. (Han tystnar.)',
          ev_knapp:
              'En knapp? Slitna jackor tappar knappar hela tiden. Den kan vara därifrån sedan tidigare. Det bevisar ingenting.',
          ev_sms:
              'Jag har ingen aning om vad Niklas skrev i sin telefon. Men om han tänkte stoppa affären… det är fortfarande inget motiv till mord.',
          ev_annas:
              'Hon kan ha sett vem som helst. En mörk jacka på hösten? Varsågod, halva Stockholms kaféer är fulla av dem.',
        },
        genericLines: [
          'Jag har inget att tillägga om det.',
          'Ni försöker vinkla det här. Jag har samarbetat hela tiden.',
          'Fråga någon annan – jag var inte ens där.',
        ],
      },
    },
    {
      personId: 'sara', kind: 'suspect', name: 'Sara Berg', age: 34,
      roleTitle: 'Niklas Bergs hustru', initials: 'SB', color: '#6aa9ff',
      publicProfile: {
        bakgrund:
          'Sara driver ett inredningsföretag och var på ön tillsammans med Niklas under kvällen. Paret hade enligt uppgift ett stormigt äktenskap den senaste tiden.',
        yrke: 'Inredare', bor: 'Stockholm',
        relationer: 'Gift med offret. Känner Erik Lindberg via branschevent.',
        snabbfakta: [
          ['Yrke', 'Inredare'], ['Bor', 'Stockholm'], ['Relationer', 'Hustru till offret'],
        ],
      },
      secret: {
        isCulprit: false,
        knows: [
          'Att Niklas var nervös inför ett möte på kvällen och nämnde Erik Lindbergs namn.',
          'Att middagen i huvudbyggnaden pågick 21.10–21.40 och att hon själv inte lämnade byggnaden efter det.',
        ],
        believes: ['Att Erik på något sätt låg bakom Niklas död, men hon vågar inte anklaga honom utan bevis.'],
        hides: ['Äktenskapet var i praktiken över; hon hade kontaktat en skilsmässoadvokat – något hon skäms över.'],
        alibi: {
          claim: 'Jag var på middag i huvudbyggnaden och gick sedan direkt till mitt rum. Nyckelkortet och kvittonen visar det.',
          truth: 'Stämmer. Nyckelkortsloggen visar att hennes rum öppnades 21.48 och dörren inte öppnades igen förrän 07.00.',
          reliability: 'confirmed',
          evidenceIds: ['ev_sara'],
        },
        suggestedQuestions: [
          'Hur var er relation den sista tiden?',
          'Var befann du dig mellan 21 och 23?',
          'Vad vet du om Erik Lindberg?',
          'Nämnde Niklas något särskilt under kvällen?',
        ],
        questions: [
          {
            keywords: ['relation', 'äktenskap', 'gift', 'kände', 'känner'],
            answer:
              'Jag och Niklas hade det jobbigt den sista månaden. Jag hade till och med pratat med en skilsmässoadvokat. Men jag älskade honom fortfarande. Att vi bråkade betyder inte att jag skadade honom.',
            truthful: true,
          },
          {
            keywords: ['var', 'befann', 'kväll', 'kvällen', 'alibi', '21', '22', '23'],
            answer:
              'Middagen började 21.10 i huvudbyggnaden. Jag gick till mitt rum 21.45, och där stannade jag. Personalen såg mig gå, och mitt nyckelkort loggar varje dörröppning.',
            truthful: true,
          },
          {
            keywords: ['erik', 'lindberg'],
            answer:
              'Erik har ringt Niklas flera gånger de senaste veckorna. Niklas sa att Erik var desperad över en markaffär. I lördags skrek Erik i telefon – jag hörde det genom dörren. Niklas bara sa: "Jag tänker stoppa hela köpet."',
            truthful: true,
          },
          {
            keywords: ['niklas', 'kväll', 'nämna', 'säg', 'stämning'],
            answer:
              'Han var spänd. Efter middagen fick han ett meddelande och sa att han behövde gå ner mot bryggan ett ärende. Han sa inte med vem. Det var sista gången jag såg honom vid liv.',
            truthful: true,
          },
        ],
        evidenceReactions: {
          ev_sms:
            'Det där meddelandet känner jag igen. Han visade mig det innan han gick. Han menade allvar med att stoppa affären – Erik visste att allt skulle rasa.',
          ev_sara: 'Ja, mina egna kvitton. Jag har inget att dölja. Titta på loggarna själva.',
          ev_markkop: 'Niklas läste igenom det där avtalet söndagen innan. Han sa att Eriks signatur på en bilaga inte stämde.',
        },
        genericLines: [
          'Jag vill hjälpa er. Niklas förtjänar svar.',
          'Det är det jag vet. Jag kan inte trolla fram mer.',
        ],
      },
    },
    {
      personId: 'mikael', kind: 'suspect', name: 'Mikael Thun', age: 55,
      roleTitle: 'Delägare, Berg & Thun AB', initials: 'MT', color: '#f5a623',
      publicProfile: {
        bakgrund:
          'Mikael är Niklas kompanjon sedan 20 år. Företaget har haft ekonomiska problem och relationen mellan de två delägarna var ansträngd.',
        yrke: 'Delägare', bor: 'Nacka',
        relationer: 'Affärspartner till offret. Har inga kända kopplingar till Erik Lindberg.',
        snabbfakta: [
          ['Yrke', 'Delägare'], ['Bor', 'Nacka'], ['Relationer', 'Affärspartner till offret'],
        ],
      },
      secret: {
        isCulprit: false,
        knows: [
          'Att han ringde Niklas 19.10 för att diskutera företagets skulder – ett hetsigt men kort samtal.',
          'Att Niklas nämnt att han misstänkte oegentligheter i Erik Lindbergs markavtal.',
        ],
        believes: ['Att företagets kris kan lösas utan att markaffären alls är inblandad.'],
        hides: [
          'Han har i hemlighet lånat pengar ur företagskassan för att täcka privata skulder. Han ljög först om samtalets tonläge av rädsla för att granskas.',
        ],
        alibi: {
          claim: 'Jag var på fastlandet hela kvällen. Jag pratade i telefon med Niklas 19.10 och var sedan hemma i Nacka.',
          truth: 'Stämmer. Operatörens mastdata placerar hans telefon på fastlandet 19.00–23.30.',
          reliability: 'confirmed',
          evidenceIds: ['ev_mikael'],
        },
        suggestedQuestions: [
          'Hur var stämningen mellan dig och Niklas?',
          'Vad handlade ert sista samtal om?',
          'Var befann du dig under kvällen?',
          'Vad vet du om företagets ekonomi?',
        ],
        questions: [
          {
            keywords: ['stämning', 'relation', 'kompis', 'ovänner', 'bråkade'],
            answer:
              'Vi var oense om pengar – ja. Två delägare i ett pressat läge blir så. Men vi hade löst det tillsammans i 20 år. Niklas var min bäste vän.',
            truthful: true,
          },
          {
            keywords: ['samtal', 'telefon', 'ringde', '19.10', 'sista'],
            answer:
              'Jag ringde honom 19.10. Jag var pressad över en skuld och ville att vi skulle ta ett nytt banklån. Han sa att han hade viktigare saker på gång och la på. (Han tvekar.) Okej, det var hetsigt. Jag har inget att vinna på att försköna det.',
            truthful: true,
          },
          {
            keywords: ['var', 'befann', 'alibi', 'kväll', 'kvällen'],
            answer: 'Hemma i Nacka. Min telefon skvallrar väl om det – man kommer inte ifrån masterna nuförtiden.',
            truthful: true,
          },
          {
            keywords: ['pengar', 'ekonomi', 'skuld', 'kassa', 'lån'],
            answer:
              'Företaget har det tufft. (Lång paus.) Jag har lånat pengar ur bolagskassan privat. Det är fel och jag ångrar det. Men Niklas död löser inga av mina problem – hans liv var viktigare än så.',
            truthful: true,
          },
          {
            keywords: ['erik', 'lindberg', 'mark'],
            answer:
              'Niklas misstänkte att Eriks markavtal innehöll en förfalskad signatur. Han tjatade om det i veckor. Han tänkte gå till polisen och till markägaren.',
            truthful: true,
          },
        ],
        evidenceReactions: {
          ev_mikael: 'Där ser ni. Hela kvällen på fastlandet. Jag kunde omöjligen vara på bryggan.',
          ev_markkop: 'Jag har bara sett utkast. Niklas höll den slutliga granskningen själv.',
        },
        genericLines: [
          'Fråga på. Jag har gjort dumma saker, men inte det där.',
          'Jag vet inte mer. Jag var inte ens där.',
        ],
      },
    },
    {
      personId: 'jonas', kind: 'suspect', name: 'Jonas Viklund', age: 26,
      roleTitle: 'Allt-i-allo på ön', initials: 'JV', color: '#3fbf6f',
      publicProfile: {
        bakgrund:
          'Jonas sköter underhåll, generatorn och båtarna på Storskär. Han fick en muntlig varning av Niklas två veckor tidigare efter en missköld reparation.',
        yrke: 'Allt-i-allo', bor: 'På ön',
        relationer: 'Anställd i praktiken av Niklas Berg.',
        snabbfakta: [
          ['Yrke', 'Allt-i-allo'], ['Bor', 'Storskär'], ['Relationer', 'Underställd offret'],
        ],
      },
      secret: {
        isCulprit: false,
        knows: [
          'Att generatorn krånglade och att han arbetade med den tillsammans med två kollegor 21.00–23.00.',
          'Att han hörde ett plask från brygghållet runt 22.00 och att någon gick i båt 22.25.',
        ],
        believes: ['Att ljudet var en tumlare eller en boj – tills kroppen hittades.'],
        hides: ['Han rökte hasch på rasten 21.30 och vågade först inte träda fram av rädsla för att bli misstänkt.'],
        alibi: {
          claim: 'Jag mekade generator i maskinhuset med två kollegor från 21 till 23. Vi gick därifrån tillsammans.',
          truth: 'Stämmer. Båda kollegorna och arbetsloggen bekräftar tiden.',
          reliability: 'confirmed',
          evidenceIds: ['ev_jonas'],
        },
        suggestedQuestions: [
          'Vad hände under din kväll?',
          'Hörde du något ovanligt?',
          'Vad var konflikten med Niklas om?',
          'Vem kan ha tagit båten?',
        ],
        questions: [
          {
            keywords: ['var', 'befann', 'kväll', 'kvällen', 'alibi', 'generator'],
            answer:
              'Maskinhuset, från 21 till 23. Generatordelen hade pajat. Peter och Amir var där hela tiden, vi har till och med skrivit i arbetsloggen.',
            truthful: true,
          },
          {
            keywords: ['hörde', 'ljud', 'plask', 'brygga', '22'],
            answer:
              'Runt 22.00 hörde jag ett rejält plask från brygghållet. Jag tänkte att det var en tumlare, det händer här. Och 22.25 var det någon som startade båten – jag såg inte vem, bara ljuset därifrån.',
            truthful: true,
          },
          {
            keywords: ['konflikt', 'varning', 'arg', 'hatade'],
            answer:
              'Han gav mig en varning för att jag struntat i att laga bryggtrappan. Visst blev jag förbannad, man blir det. Men att döda någon för en varning? Kom igen.',
            truthful: true,
          },
          {
            keywords: ['båt', 'vem', 'tog'],
            answer:
              'Båtnyckeln hänger i skåpet vid köket. Vem som helst av gästerna kunde ta den. Loggboken visar 21.35 ut och 22.25 in – jag skrev aldrig i den själv under kvällen.',
            truthful: true,
          },
        ],
        evidenceReactions: {
          ev_jonas: 'Ja, mina kollegors uttalanden. Hela mitt alibi står och faller med dem, och de säger samma sak som jag.',
          ev_bat: 'Loggboken stämmer med det jag hörde. Båt 21.35 och tillbaka 22.25. Någon var ute med den.',
        },
        genericLines: ['Jag vet bara det jag hört.', 'Jag har inget mer att säga om det.'],
      },
    },
    {
      personId: 'anna', kind: 'witness', name: 'Anna Sjöberg', age: 38,
      roleTitle: 'Servitris på värdshuset (vittne)', initials: 'AS', color: '#b07bd8',
      publicProfile: {
        bakgrund:
          'Anna arbetar på öns värdshus och känner de flesta återkommande gästerna. Hon var i tjänst den aktuella kvällen.',
        yrke: 'Servitris', bor: 'Värmdö',
        relationer: 'Känner igen Erik Lindberg som tidigare gäst.',
        snabbfakta: [['Yrke', 'Servitris'], ['Roll', 'Vittne']],
      },
      secret: {
        isCulprit: false,
        knows: [
          'Att Erik Lindberg kom till värdshuset 19.45 och att hon serverade honom en whisky som han lämnade nästan orörd.',
          'Att hon såg en mörkklädd gestalt nära bryggan 21.40, men inte kunde urskilja ansiktet.',
        ],
        believes: ['Att gestalten var en man, men hon vågar inte peka ut någon.'],
        hides: [
          'Hon lämnade sin post obehörigt 21.35–21.45 för att träffa sin partner i personalrummet. Hon är rädd att det gör hennes vittnesmål opålitligt.',
        ],
        alibi: null,
        suggestedQuestions: [
          'Vad såg du under kvällen?',
          'Så du Erik Lindberg?',
          'Vad hände vid bryggan?',
          'Varför nämnde du inte din rast från början?',
        ],
        questions: [
          {
            keywords: ['såg', 'kväll', 'kvällen', 'vittne', 'händelse'],
            answer:
              'Jag jobbade serveringen. 19.45 kommer Erik Lindberg in och beställer en whisky. Han verkade nervös, lämnade glaset nästan orört och gick efter tio minuter. Runt 21.40 såg jag en mörk gestalt vid bryggan, men jag kan inte säga vem det var.',
            truthful: true,
          },
          {
            keywords: ['erik', 'lindberg'],
            answer:
              'Ja, jag känner igen honom från sommarens besök. Han kom 19.45, otvetydigt. Jag noterade tiden eftersom han avbröt mig i dukningen.',
            truthful: true,
          },
          {
            keywords: ['brygga', 'gestalt', 'mörk', '21.40'],
            answer:
              'Jag såg någon i mörk jacka stå vid räcket 21.40. Kanske en man, kortklippt. Sedan försvann personen mot båtshuset. Jag tänkte inte mer på det då.',
            truthful: true,
          },
          {
            keywords: ['rast', 'paus', 'personalrum', 'varför', 'ljuga'],
            answer:
              '(Hon rodnar.) Jag var borta från serveringen 21.35–21.45. Privat ärende. Jag vågade inte säga det först för då tror ni att jag hittar på allt annat. Men gestalten vid bryggan såg jag när jag kom tillbaka.',
            truthful: true,
          },
        ],
        evidenceReactions: {
          ev_annas: 'Det är min egen berättelse. Jag har bara lagt till sanningen om rasten sedan första utskriften.',
        },
        genericLines: ['Jag har berättat allt jag vet.', 'Jag kan bara uttala mig om det jag faktiskt såg.'],
      },
    },
  ],
  events: [
    { id: 'e1', time: '18:20', label: 'Erik lämnar kontoret', detail: 'Enligt Erik själv 18.10. Kontorets passersystem loggar utpassering 18.20.', kind: 'claimed', isPublic: true, secretNote: 'Erik rundar av tiden för att skapa bild av att han var kvar sent i Stockholm.' },
    { id: 'e2', time: '19:10', label: 'Sista kända samtalet', detail: 'Mikael Thun ringer Niklas Berg. Samtalet varar 2 minuter och 14 sekunder.', kind: 'confirmed', isPublic: true, secretNote: 'Hetsigt samtal om företagets skulder, ej brottsligt.' },
    { id: 'e3', time: '19:45', label: 'Ankomst till ön', detail: 'Vittnet Anna Sjöberg ser Erik Lindberg på värdshuset.', kind: 'claimed', isPublic: true, secretNote: 'Bekräftar Eriks närvaro på ön trots hans förnekande.' },
    { id: 'e4', time: '20:05', label: 'Höjda röster vid huvudbyggnaden', detail: 'Jonas Viklund hör två män argumentera. Han kan inte urskilja rösterna.', kind: 'uncertain', isPublic: true, secretNote: 'Erik konfronterar Niklas om markaffären.' },
    { id: 'e5', time: '21:10', label: 'Middag i huvudbyggnaden', detail: 'Flera gäster och personal närvarar. Sara Berg finns på plats.', kind: 'confirmed', isPublic: true, secretNote: 'Stödjer Saras alibi.' },
    { id: 'e6', time: '21:40', label: 'Mörk gestalt vid bryggan', detail: 'Anna Sjöberg ser en okänd mörkklädd person nära bryggräcket.', kind: 'uncertain', isPublic: true, secretNote: 'Erik i väntan på Niklas.' },
    { id: 'e7', time: '21:50', label: 'Mobil mot öns mast', detail: 'Erik Lindbergs telefon kopplar mot masten som täcker Storskär 21.50–22.20.', kind: 'confirmed', isPublic: true, secretNote: 'Tekniskt avgörande: Erik är på ön under dödsfönstret.' },
    { id: 'e8', time: '22:00', label: 'Ljud från bryggan', detail: 'Ett kraftigt plask rapporteras av Jonas Viklund. Personen okänd.', kind: 'uncertain', isPublic: true, secretNote: 'Niklas faller i vattnet efter konfrontationen.' },
    { id: 'e9', time: '22:25', label: 'Båt tillbaka', detail: 'Båtloggboken visar en tur 21.35–22.25. Föraren anges inte.', kind: 'confirmed', isPublic: true, secretNote: 'Eriks flykt från ön.' },
    { id: 'e10', time: '00:15', label: 'Dödsfallet upptäcks', detail: 'Nattpersonalen hittar Niklas Berg livlös vid bryggan och larmar 112.', kind: 'confirmed', isPublic: true, secretNote: '' },
  ],
  evidence: [
    {
      id: 'ev_mobil', category: 'technical', title: 'Mastdata – Erik Lindbergs mobil',
      description:
        'Operatörens logg visar att Erik Lindbergs telefon var ansluten till den mast som täcker Storskär mellan 21.50 och 22.20 den 14 oktober. Närmast annan mast ligger 14 kilometer bort och kan inte förklara anslutningen.',
      sourceStatus: 'fact', location: 'Tekniska spår', image: '', discoverHint: 'Beställ operatörsloggar för samtliga misstänkta.',
      secretMeaning: 'Motbevisar Eriks påstående om att ha varit i Stockholm hela kvällen. Avgörande bevis.',
    },
    {
      id: 'ev_markkop', category: 'document', title: 'Markköpsavtal med Niklas noteringar',
      description:
        'Avtal om försäljning av strandnära mark till Lindberg Bygg AB. Bland handlingarna finns Niklas Bergs handskrivna noteringar: "Bilaga 3 – signaturen går inte igenom. Stoppar hela affären och kontaktar polisen."',
      sourceStatus: 'fact', location: 'Offrets arbetsrum', image: '', discoverHint: 'Gå igenom offrets affärshandlingar.',
      secretMeaning: 'Motiv: Erik skulle förlora affären och riskera konkurs, och dessutom avslöjas med en förfalskad signatur.',
    },
    {
      id: 'ev_sms', category: 'digital', title: 'Oskickat meddelande i offrets telefon',
      description:
        'I Niklas Bergs telefon finns ett sparat men ej skickat meddelande, tidsstämplat 21.37: "Erik – jag stoppar affären. Jag vet vad du gjort med bilaga 3. Vi ses vid bryggan."',
      sourceStatus: 'fact', location: 'Offrets telefon', image: '', discoverHint: 'Säkringställ offrets mobiltelefon.',
      secretMeaning: 'Kopplar Erik direkt till mötet vid bryggan och visar att han var varnad.',
    },
    {
      id: 'ev_annas', category: 'testimony', title: 'Anna Sjöbergs vittnesmål',
      description:
        'Anna såg Erik Lindberg anlända 19.45 och en mörk gestalt vid bryggan 21.40. Hon kompletterar senare uppgiften att hon var obehörigt frånvarande 21.35–21.45, men vidhåller observationen vid 21.40.',
      sourceStatus: 'testimony', location: 'Värdshuset', image: '', discoverHint: 'Förhör alla som arbetade på ön.',
      secretMeaning: 'Placerar Erik på ön och vid bryggan före dödsfallet.',
    },
    {
      id: 'ev_dodstid', category: 'technical', title: 'Rättsmedicinsk rapport',
      description:
        'Rättsmedicin bedömer dödstiden till 21.30–22.30. Ett slag mot bakhuvudet orsakade medvetslöshet innan personen föll i vattnet; skadan kan inte uppstått vid ett vanligt fall från bryggan.',
      sourceStatus: 'fact', location: 'Rättsmedicin', image: '', discoverHint: 'Invänta den rättsmedicinska rapporten.',
      secretMeaning: 'Avgränsar gärningsfönstret och styrker att döden inte var en olycka.',
    },
    {
      id: 'ev_sara', category: 'document', title: 'Hotellkvitton och nyckelkortslogg – Sara Berg',
      description:
        'Kvitton från värdshuset 20.30–21.40 och nyckelkortslogg som visar att Saras rumsdörr öppnas 21.48 och därefter inte förrän 07.00.',
      sourceStatus: 'fact', location: 'Huvudbyggnaden', image: '', discoverHint: 'Verifiera varje misstänkts alibi.',
      secretMeaning: 'Bekräftar Saras alibi – hon utesluts.',
    },
    {
      id: 'ev_mikael', category: 'technical', title: 'Mastdata – Mikael Thuns mobil',
      description:
        'Operatörsloggen placerar Mikael Thuns telefon på fastlandet, med anslutning mot master i Nacka, under hela perioden 19.00–23.30.',
      sourceStatus: 'fact', location: 'Tekniska spår', image: '', discoverHint: 'Jämför samtliga mobilars rörelsemönster.',
      secretMeaning: 'Mikael fysiskt utesluten som gärningsperson.',
    },
    {
      id: 'ev_bat', category: 'document', title: 'Båtloggbok',
      description:
        'Loggboken vid bryggan visar en noterad avgång 21.35 och retur 22.25. Ingen förare har skrivit sitt namn. Båtens bränslenivå har sjunkit motsvarande en tur till fastlandet och tillbaka.',
      sourceStatus: 'circumstantial', location: 'Bryggan', image: '', discoverHint: 'Kontrollera båtarnas rörelser.',
      secretMeaning: 'Erik lämnade ön 22.25, efter dödsfallet.',
    },
    {
      id: 'ev_knapp', category: 'physical', title: 'Avsliten jackknapp vid bryggräcket',
      description:
        'En mörk marinblå metallknapp hittas fastkilad vid bryggräcket. Vid husrannsakan hos Erik Lindberg finns en matchande marinblå jacka som saknar motsvarande knapp på vänster ärm.',
      sourceStatus: 'fact', location: 'Bryggan', image: '', discoverHint: 'Spärra av och genomsök bryggan.',
      secretMeaning: 'Fysiskt spår som placerar Erik vid bryggräcket.',
    },
    {
      id: 'ev_kvitto', category: 'document', title: 'Erik Lindbergs Stockholmskvitto',
      description:
        'Erik hänvisar till ett restaurangkvitto som bevis för sin vistelse i Stockholm. Klockslaget på kvittot är 17.42 – mer än tre timmar före dödsfallet.',
      sourceStatus: 'circumstantial', location: 'Ingivet av Erik Lindberg', image: '', discoverHint: 'Granska de misstänktas egna bevis källkritiskt.',
      secretMeaning: 'Eriks "alibi" täcker inte dödstidsfönstret – en vilseledande ledtråd.',
    },
    {
      id: 'ev_jonas', category: 'testimony', title: 'Jonas Viklund och två kollegor',
      description:
        'Arbetslogg och två oberoende vittnen placerar Jonas i maskinhuset 21.00–23.00. Samtliga tre lämnar byggnaden tillsammans efter 23.00.',
      sourceStatus: 'fact', location: 'Maskinhuset', image: '', discoverHint: 'Kontrollera vem som kan styrka varje alibi.',
      secretMeaning: 'Jonas har ett styrkt alibi och utesluts.',
    },
  ],
  witnessStatements: [
    { id: 'ws_anna', personId: 'anna', reliability: 'high', content: 'Anna Sjöberg placerar Erik Lindberg på ön 19.45 och ser en mörk gestalt vid bryggan 21.40.' },
    { id: 'ws_jonas', personId: 'jonas', reliability: 'high', content: 'Jonas hör ett plask från bryggan 22.00 och en båt starta 22.25.' },
  ],
  hints: [
    'Börja med att fastställa dödstidsfönstret och gå sedan systematiskt igenom varje persons alibi. Vem kan rent fysiskt ha varit vid bryggan mellan 21.30 och 22.30?',
    'Flera personer påstår sig vara någon annanstans. Tekniska spår – särskilt operatörernas mastdata – kan kontrollera de påståendena. Jämför vad folk säger med vad deras telefoner avslöjar.',
    'Eriks "Stockholmskvitto" är från 17.42, alltså före brottet. Hans mobil finns på ön 21.50–22.20, en jackknapp matchar vid bryggan, och markköpsavtalet visar att han hade allt att förlora. Nu kan du bygga en sammanhängande kedja.',
  ],
  boardLinks: [
    { a: 'person:erik', b: 'evidence:ev_mobil', type: 'supported', label: 'Erik är på ön under dödsfönstret' },
    { a: 'person:erik', b: 'evidence:ev_kvitto', type: 'contradiction', label: 'Kvittot täcker inte kvällen' },
    { a: 'person:erik', b: 'evidence:ev_markkop', type: 'supported', label: 'Ekonomiskt motiv' },
    { a: 'person:erik', b: 'evidence:ev_sms', type: 'supported', label: 'Kallad till bryggan 21.37' },
    { a: 'person:erik', b: 'evidence:ev_knapp', type: 'supported', label: 'Fysiskt spår vid bryggan' },
    { a: 'person:erik', b: 'evidence:ev_annas', type: 'supported', label: 'Sedd på ön och vid bryggan' },
    { a: 'person:erik', b: 'event:e8', type: 'supported', label: 'Närvarande vid plaskljudet 22.00' },
    { a: 'person:erik', b: 'evidence:ev_bat', type: 'supported', label: 'Lämnar ön 22.25' },
    { a: 'evidence:ev_sms', b: 'evidence:ev_markkop', type: 'supported', label: 'Affären skulle stoppas' },
    { a: 'evidence:ev_dodstid', b: 'event:e8', type: 'supported', label: 'Plasket ligger i dödsfönstret' },
    { a: 'person:sara', b: 'evidence:ev_sara', type: 'supported', label: 'Styrkt alibi' },
    { a: 'person:mikael', b: 'evidence:ev_mikael', type: 'supported', label: 'Styrkt alibi (fastlandet)' },
    { a: 'person:jonas', b: 'evidence:ev_jonas', type: 'supported', label: 'Styrkt alibi (maskinhuset)' },
    { a: 'person:anna', b: 'event:e6', type: 'supported', label: 'Vittnet bakom observationen' },
  ],
  assistantInsights: {
    ev_dodstid: 'Dödstidsfönstret 21.30–22.30 är nu din ram. Alla som inte kan placeras någon annanstans under den timmen förtjänar granskning.',
    ev_mobil: 'Eriks mobil är på ön samtidigt som Erik själv säger att han är i Stockholm. Minst en av uppgifterna är fel – och mastdata är ett bekräftat faktum, inte ett påstående.',
    ev_kvitto: 'Lägg märke till klockslaget: 17.42. Ett kvitto kan vara äkta men ändå bevisa något helt annat än vad personen påstår.',
    ev_sara: 'Nyckelkortsloggen är ett tekniskt faktum som styrker Saras alibi. Hennes personliga problem är sannolikt ett sidospår.',
    ev_mikael: 'Mikael har ett motiv på pappret, men mastdata placerar honom på fastlandet. Ett motiv utan möjlighet fäller ingen.',
    ev_jonas: 'Tre personer och en arbetslogg styrker Jonas alibi. Hans lögner handlar om något annat än mordet.',
    ev_markkop: 'Nu börjar motivet klarna: en stoppad affär, en ifrågasatt signatur och en företagare nära konkurs.',
    ev_sms: 'Det oskickade meddelandet förklarar varför mötet vid bryggan ägde rum – och vem offret väntade på.',
    ev_knapp: 'Den fysiska knappen kopplar Erik till den exakta platsen, inte bara till ön.',
    ev_annas: 'Vittnesmålet är inte perfekt – men bristen gäller 21.35–21.45, inte observationen 21.40. Håll isär de två sakerna.',
    ev_bat: 'Båtturen 21.35–22.25 passar en flykt efter händelsen vid bryggan. Vem hade tillgång till nyckelskåpet?',
  },
  solution: {
    culpritId: 'erik',
    motive:
      'Ekonomiskt motiv och undanröjande av ett hot. Erik Lindbergs företag stod veckor från konkurs om markaffären stoppades, och Niklas Berg hade upptäckt att Bilaga 3 i avtalet innehöll en förfalskad signatur – ett brott som skulle sätta Erik i fängelse.',
    narrative:
      'Erik reste till Storskär den 14 oktober för att övertala eller hota Niklas att inte stoppa markaffären. Anna Sjöberg såg honom anlända 19.45. Vid 20.05 hörde Jonas Viklund de två männen argumentera vid huvudbyggnaden. Efter middagen kallade Niklas Erik till bryggan via ett meddelande 21.37. Vid bryggräcket eskalerade konfrontationen 21.50–22.00: Erik slog till Niklas i bakhuvudet, varefter han föll i vattnet och drunknade. Erik flydde med båten 22.25 och försökte dölja hela besöket bakom ett Stockholmskvitto från 17.42. Han förlitade sig på att inga tekniska spår kunde placera honom på ön – men operatörens mastdata, den avslitna knappen och vittnesmålet avslöjade honom.',
    realTimeline: [
      { time: '17:42', text: 'Erik äter i Stockholm och sparar kvittot som avsiktligt "alibi".' },
      { time: '19:35', text: 'Erik tar båten ut till Storskär.' },
      { time: '19:45', text: 'Anna Sjöberg ser Erik på värdshuset.' },
      { time: '20:05', text: 'Erik och Niklas argumenterar vid huvudbyggnaden.' },
      { time: '21:37', text: 'Niklas sparar meddelandet som kallar Erik till bryggan.' },
      { time: '21:40', text: 'Anna ser en mörk gestalt vid bryggan – Erik som väntar.' },
      { time: '22:00', text: 'Konfrontationen vid bryggräcket: slaget, fallet i vattnet, plasket Jonas hör.' },
      { time: '22:25', text: 'Erik flyr med båt till fastlandet.' },
      { time: '00:15', text: 'Kroppen upptäcks av nattpersonalen.' },
    ],
    decisiveEvidence: ['ev_mobil', 'ev_markkop', 'ev_sms', 'ev_knapp', 'ev_annas', 'ev_dodstid'],
    alternativeExplanations: [
      {
        personId: 'sara',
        whySeemedGuilty: 'Sara var gift med offret, äktenskapet var i kris och skilsmässohandlingar fanns. Ett försäkringsmord är en klassisk hypotes.',
        contradictedBy: ['ev_sara'],
        explanation: 'Nyckelkortsloggen placerar henne i sitt låsta rum under hela dödsfönstret. Hon varken kunde eller behövde lämna rummet.',
      },
      {
        personId: 'mikael',
        whySeemedGuilty: 'Affärspartner i ekonomisk kris, hetsigt sista telefonsamtal och ett eget lån ur företagskassan.',
        contradictedBy: ['ev_mikael', 'e2'],
        explanation: 'Mastdata placerar honom på fastlandet 19.00–23.30. Han hade motiv på pappret men saknade helt möjlighet att vara på ön.',
      },
      {
        personId: 'jonas',
        whySeemedGuilty: 'Färsk varning från offret, ensamt arbete på ön och han hörde själv ljudet från bryggan.',
        contradictedBy: ['ev_jonas'],
        explanation: 'Två kollegor och arbetsloggen placerar honom i maskinhuset 21.00–23.00. Hans tystnad förklarades av ett ringa regelbrott, inte mord.',
      },
    ],
  },
};

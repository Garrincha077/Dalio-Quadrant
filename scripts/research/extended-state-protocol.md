# Prijedlog backtesta za Dalio Quadrant

Datum prijedloga: 26. listopada 2026. Status: specifikacija; test nije izvršen.
Repozitorij: https://github.com/Garrincha077/Dalio-Quadrant

Dopuna istog datuma: na zahtjev korisnika proširen je predloženi povijesni obuhvat. Duga studija cilja 1973.–rujan 2026., uz zasebne slojeve kvalitete dokaza opisane u nastavku. To su ciljani datumi, ne potvrda da su svi potrebni izvori već pribavljeni.

## Što provjeravamo

Primarno pitanje: dodaje li ekonomsko stanje i njegov tromjesečni smjer vrijednost pri izboru između SPY, IEF, GLD, TIP i DBC, u usporedbi s istim postupkom koji koristi samo dotadašnje bezuvjetne prinose?

Postojeći `momentum-1` eksperiment i njegove rezultate sačuvati. Nova provjera odnosi se na logiku kartice Preferred asset classes, a ne na njezin graf ili na postojeći momentum model. Povijesna povezanost kvadranta i prinosa zaseban je rezultat od uspješnosti portfelja.

`state-tilt-1` trenutno koristi zamrznute revidirane ekonomske podatke i prinose uz fiksni dvomjesečni odmak. To nije povijesni model koji je postojao u svakom prošlom trenutku. Predložena prilagodba koristi tada dostupne objave i stvarne datume odluka te zato dobiva zasebnu verziju `state-tilt-pit-1`. Njezini rezultati ne smiju se pripisati postojećoj kartici bez promjene verzije i objašnjenja razlike.

## Pravila koja se zamrzavaju prije izračuna

- Aktivnost: CFNAI-MA3, s nulom kao referentnom točkom.
- Inflacija: headline PCE YoY, iz točno uparenih mjesečnih PCEPI razina; referentna točka 2%.
- Smjer: promjena aktivnosti i PCE YoY kroz tri mjeseca, uz četiri uzastopna mjesečna para.
- Pojasevi: ±0,10 za aktivnost i ±0,20 postotnih bodova za inflaciju. Zadržati postojeće meko miješanje susjednih kvadranata, granice i toleranciju.
- Zadržati dvostupanjsko sažimanje prema širem uzorku s 24 pseudoopažanja po stupnju. Ne tražiti profitabilnije parametre.
- Rangirati po sažetom povijesnom srednjem prinosu. Izjednačenja rješavati abecedno po simbolu, kao u postojećem modulu.
- Primarni horizont: 12 mjeseci. Horizonti 3 i 36 mjeseci služe kao sekundarne dijagnostike i ne biraju se naknadno prema pobjedniku.
- Početak učenja zahtijeva najmanje 60 zajedničkih, dovršenih 12-mjesečnih ishoda. Male lokalne skupine sažimati prema postojećem pravilu i prikazati broj opažanja/epizoda; oznaka tankog uzorka sama po sebi ne mijenja trgovanje.
- Ako je procijenjeni prinos prvoplasirane imovine nepozitivan, nova tranša ostaje u gotovini. Ako podaci ne zadovoljavaju provjere kvalitete, također koristiti gotovinu i zabilježiti razlog.

## Podaci i vremenska dostupnost

Za svaki mjesečni datum odluke preuzeti i privatno sačuvati ALFRED vintage za CFNAIMA3 i PCEPI. Koristiti samo verziju dostupnu zaključno s prethodnim kalendarskim danom. Signal izračunati prije otvaranja tržišta posljednjeg američkog trgovinskog dana u mjesecu; izvršenje modelirati na zatvaranju tog dana. Time dnevna razlučivost ALFRED-a ne pretpostavlja vrijeme objave unutar istog dana.

Povijesni signal mora sadržavati točno one četiri mjesečne vrijednosti trenda i godišnje baze PCE-a koje su bile dostupne tada. Pri sljedećoj odluci povijesni zapis signala ostaje zamrznut: naknadna revizija ne prepisuje stare ulazne vrijednosti. Nova odluka smije koristiti revizije koje su do nje već objavljene.

Za aktualni signal obje osi moraju pripadati istom završenom mjesecu i zadovoljiti postojeće pravilo svježine, do 90 dana od kraja referentnog mjeseca. Ne popunjavati rupe niti zamijeniti nedostajući vintage današnjom serijom. Ako povijesni vintage nije dostupan, mjesec nema valjan signal. Objaviti pokrivenost po godinama i broj takvih mjeseci.

Fiksni odmak od dva mjeseca iz opisne studije ne dodaje se na stvarni datum dostupnosti objave: ovaj novi test koristi odluku i izvršenje. Revidiranu studiju s postojećim odmakom prikazati samo kao zasebnu dijagnostiku osjetljivosti.

ETF podatke uzeti od početka zajedničke povijesti, približno od ožujka 2006., uz provjeru stvarne pokrivenosti. Potrebne su dnevne cijene i dividende/splitovi ili provjeren ekvivalent ukupnog prinosa. Ne dodavati dividende drugi put ako ih prilagodba cijena već uključuje. Za prinos od zatvaranja do zatvaranja provjeriti reinvestiranje i usklađenost s datumima izvršenja. Ne ekstrapolirati ETF-ove prije njihova postojanja.

Gotovinu obračunavati iz prethodno poznate kratkoročne T-bill stope i stvarnog broja dana, kao izričito označen prinosni proxy. Bez poluge, short pozicija, poreza ili pretpostavljenog individualnog poreznog tretmana. Valuta izvještaja je USD; valutno nezaštićeni rezultat u EUR nije isti rezultat.

## Učenje bez budućih informacija

Za odluku u trenutku t koristiti arhivirane povijesne signale i njihove 12-mjesečne ishode samo ako su cijeli period držanja i završna cijena poznati prije reza podataka za t. Isto ograničenje primjenjuje se na bezuvjetnu raspodjelu, pripadnost kvadrantima, brojeve opažanja i sve referentne prinose. Maturitet određivati datumom izlaza, ne samo brojem redaka.

To znači da signal iz prethodne godine čiji se period držanja upravo završava na današnjem zatvaranju još ne ulazi u jutarnje učenje. Normalizacije i dodatne procjene rizika, ako postoje samo kao dijagnostike, također koriste isključivo prethodne podatke.

Za svaku odluku ponovno izračunati sažimanje i rangiranje iz dotad dovršenog uzorka. Nema slučajnog dijeljenja uzorka, budućih prinosa u učenju ili izbora parametara prema ukupnoj krivulji kapitala.

## Test rangiranja i trgovinski portfelj

Prvo mjeriti izravan odgovor na karticu: ostvareni 12-mjesečni prinos prvoplasirane imovine, razliku prema jednako ponderiranoj košarici istih pet imovina, razliku prema bezuvjetnom izboru i korelaciju predviđenog s ostvarenim poretkom. Objaviti i udio odluka u gotovini. Za odluke bez imovinskog signala prikazati gotovinski rezultat u ukupnoj politici; rezultate samo valjanih rangiranja označiti zasebno.

Trgovinski test koristi 12 jednakih tranši portfelja. Svakog mjeseca dospjela tranša ulaže se u prvoplasiranu imovinu i drži 12 mjeseci, bez reakcije na međuvremene promjene rangiranja. Neaktivne tranše drže gotovinu. Tako horizont od 12 mjeseci u kartici odgovara stvarnom razdoblju držanja.

Portfelj počinje s 12 jednakih gotovinskih tranši. U prvih 12 odluka aktivira se po jedna; potom se dospjela tranša obnavlja s vlastitim tadašnjim iznosom. Tranše ne izjednačavati svakog mjeseca jer bi to stvorilo dodatno trgovanje. Primarni rezultat uključuje početno uvođenje kapitala; zasebno prikazati rezultat nakon njega, na jednakim datumima za sve strategije s tranšama. Sve otvorene pozicije na završetku uzorka vrednovati po tržišnoj vrijednosti. Njihove nezavršene 12-mjesečne ishode ne uključivati u tablicu dovršenih rangiranja.

Trošak: 10 baznih bodova po kupnji ili prodaji ETF-a na stvarno trgovani iznos; stres 25 bp. Primjer: prodaja 100 EUR jednog ETF-a i kupnja 100 EUR drugoga koštaju ukupno 0,20 EUR pri 10 bp po strani. Računati stvarne promjene ukupnih pozicija nakon objedinjavanja naloga tranši; prijenos identične imovine između tranši ne izmišljati kao prodaju i ponovnu kupnju. Prikazati promet i trošak. Polazne cijene zatvaranja uz ovaj trošak predstavljaju model izvršenja, ne dokaz stvarne ostvarivosti po toj cijeni.

## Usporedbe i izolacija koristi makro signala

Primarna usporedba: identičan sustav tranši koji svakog mjeseca bira imovinu s najboljim dotadašnjim bezuvjetnim srednjim 12-mjesečnim prinosom. Ima istih pet imovina, isti dovršeni uzorak, kalendar, početno uvođenje kapitala, gotovinski uvjet i troškove. Na datumima kada makro podaci nedostaju primarna kontrola također ne otvara novu rizičnu tranšu. Time razlikujemo informaciju kvadranta od opće sklonosti imovini koja je prije najbolje rasla.

Sekundarno usporediti:

1. Jednako ponderiranu košaricu svih pet ETF-ova, s mjesečnim rebalansom i troškovima.
2. SPY buy-and-hold, uz početni trošak; završno vrednovanje bez zamišljene likvidacije, kao i kod strategije.
3. Portfelj 60/40 SPY/IEF, s mjesečnim rebalansom i troškovima.
4. Gotovinu s jednakim obračunom kamate.
5. Samo stanje, bez informacije trenda: ista meka pripadnost i roditeljsko sažimanje, bez dodatnog state+trend stupnja. Isti sustav tranši.

Za prve tri kontrole prikazati i usporedivo postupno uvođenje kapitala ako se iz njihove razlike prema strategiji izvodi zaključak. Ne uspoređivati različite datume ili prešutno različit početno uložen kapital. Dodatno prikazati bezuvjetnu kontrolu bez makro filtra dostupnosti da se vidi cijena odustajanja zbog podataka. Usporedbe imaju različite rizike; veći CAGR sam po sebi nije alfa.

## Razdoblja i što se smije nazvati provjerom izvan uzorka

Izvorni ETF test ciljati od siječnja 2013. do posljednjeg potpunog i provjerenog cjenovnog mjeseca. Proširenu povijesnu studiju dodati prema specifikaciji niže. Stvarni početak svakog trgovinskog testa određuju dostupni vintages i minimum 60 dovršenih ishoda; ako uvjet nije ispunjen, početak pomaknuti i navesti razlog. Postojeći zamrznuti izvori završavaju u rujnu 2026.; nepotpuni listopad ne uključivati.

Rezultate prikazati za cijelo razdoblje te unaprijed zadane podperiode 2013.–2019., 2020.–2022. i 2023.–rujan 2026., koliko pokrivenost dopušta. Prikazati 2020. i 2022. zasebno radi stresnog ponašanja. Ne izbacivati krize niti naknadno mijenjati granice prema rezultatu.

Razdoblje 2021.–2025. već je pregledano u postojećem istraživanju, a logika state-tilt razvijena je nakon dostupnosti povijesnih rezultata. Stoga ni povijesni walk-forward s urednim vremenom podataka ne predstavlja novi, netaknuti test svih odluka istraživača. Nazvati ga retrospektivnom walk-forward provjerom, uz priznanje tog ograničenja.

Pravi forward test počinje prvom mjesečnom odlukom nakon zamrzavanja protokola i koda. Ako se pravila zamrznu do 29. listopada 2026., prva odluka može biti 30. listopada za naredni period držanja; inače je pomaknuti. Odmah arhivirati hash koda, izvorne ulaze, signal, rangiranje i ciljnu tranšu. Prvi puni 12-mjesečni ishod bit će dostupan tek približno godinu dana kasnije. Tri godine praćenja korisna su kontrolna točka, ali ne jamče dovoljnu statističku snagu.

## Proširena povijest: tri odvojena sloja

| Sloj | Ciljani podaci | Što rezultat može pokazati |
|---|---|---|
| Povijest ekonomskog stanja | Svibanj 1967.–posljednji zajednički dovršeni referentni mjesec | Učestalost kvadranata, trajanje i prijelaze kroz različite cikluse; revidirana, opisna povijest. |
| Duga studija imovine | 1973.–rujan 2026.; 1973.–1979. početno učenje, od 1980. retrospektivna simulacija | Povezanost stanja s prinosima i ponašanje pravila kroz inflaciju 1970-ih, dezinflaciju i kasnije krize. Koristi revidirana makro stanja i povijesne indekse; nije dokaz tada ostvarivog rezultata. |
| Test tada dostupnih objava | Arhivirati odluke od ožujka 2001.; trgovinska evaluacija okvirno od 2007., ako ima dovoljno izvora i dovršenih ishoda | Ponašanje odvojenog modela uz stvarnu povijesnu dostupnost makro informacija i indeksne zamjene za imovinu prije ETF-ova. ETF test od približno 2013. ostaje zasebna provjera. |

CFNAI je prvi put javno objavljen 5. ožujka 2001., iako njegova izračunata povijest seže znatno dalje. Povijesna vrijednost s oznakom 1973. zato nije dokaz objave 1973. U testu tada dostupnih informacija ne stvarati odluke prije početka stvarnih objava. Provjeriti arhivu Chicago Feda uz ALFRED; datum prvog raspoloživog vintagea u pojedinom sustavu može biti kasniji od prve javne objave.

Za strogi test učenje počinje arhiviranim odlukama od 2001. i njihovim naknadno dovršenim ishodima. Uz minimum 60 dovršenih 12M ishoda prvi mogući trgovinski rezultat okvirno je 2007., a nedostajući podaci mogu ga odgoditi. Ne koristiti retroaktivno rekonstruirane signale prije 2001. kao da su bili stvarne odluke. Ako se želi zasebna varijanta koja uči iz povijesnih rekonstrukcija objavljenih do tadašnjeg datuma, voditi je kao novi eksperiment s vlastitim manifestom i oznakom ograničenja.

### Imovina prije nastanka ETF-ova

Za dugu studiju fiksirati četiri rizične klase kroz cijelo razdoblje: američke dionice, američke državne obveznice srednjeg dospijeća, zlato i široku robnu košaricu. Gotovina ostaje odredište pri odustajanju i usporedba. Ovaj četveroimovinski eksperiment nije ista strategija kao postojeći izbor između pet ETF-ova; dobiva oznaku `state-tilt-long-4-1`.

| Klasa | Kandidat povijesnog izvora | Potrebna kontrola |
|---|---|---|
| Dionice | S&P 500 total return ili dokumentirani široki američki indeks | Uključene dividende; bez sastavljanja prošlosti iz današnjih članica. |
| Državne obveznice | Total-return indeks američkih državnih obveznica s približno 7–10 godina dospijeća | Uključeni kuponi i promjene cijena; prinos do dospijeća sam po sebi nije ukupni prinos. Širi intermediate indeks je zaseban proxy ako odgovarajući niz nedostaje. |
| Zlato | Dokumentirana tržišna USD spot serija, uz zaseban scenarij troška čuvanja | Ne predstavljati spot kao GLD prije njegova nastanka; povijesna dostupnost ulaganja ovisi o tržištu i tadašnjim pravilima. |
| Roba | Široki futures total-return indeks, primjerice S&P GSCI TR ako je pribavljen | Uključiti promjenu ugovora i prinos kolaterala; spot indeks ili nafta nisu zamjena za ukupni prinos košarice. |

Izbor dobavljača, točnog indeksa i početka serije zamrznuti nakon provjere metapodataka, prije pregledavanja rezultata strategije. Dostupnost licenci i povijesnih datoteka još nije potvrđena. Ako zajednička povijest ne počinje 1973., početak pomaknuti prema provjerenim podacima i zabilježiti zašto; ne ispunjavati rupe zamišljenim prinosima.

S&P GSCI pokrenut je 1991.; njegova povijest od 1970. uključuje naknadni izračun. Taj dio označiti kao backcast. Indeks robe ima drukčiji sastav i metodologiju od DBC-a, pa nije produžena povijest istog fonda. Isto vrijedi za obvezničke indekse u odnosu na IEF.

TIPS ne uključivati u fiksni dugi četveroimovinski uzorak: prve američke inflacijski indeksirane državne obveznice aukcionirane su u siječnju 1997. Za pet klasa može postojati zaseban indeksni test od prve potvrđene zajedničke pokrivenosti nakon tog datuma, uz vlastito razdoblje učenja. Ne izmišljati TIPS prinose za 1970-e niti tijekom dugog testa prešutno dodati novu klasu.

Indeksne nizove voditi kao zaseban istraživački panel sve do završetka studije; ETF panel ostaje zaseban. Na zajedničkom razdoblju usporediti iste četiri klase, makro ulaze i pravila, da bi se izmjerila osjetljivost na izbor proxyja. Ako se kasnije objavi spojena serija, navesti točan datum prijelaza i metodologiju; nijednu ETF naknadu ne odbijati dvaput.

### Učenje, troškovi i rezolucija dugog testa

U dugoj revidiranoj simulaciji koristiti isti minimum 60 dovršenih 12M ishoda. Ciljati početno učenje 1973.–1979. i evaluaciju od siječnja 1980.; datum potvrditi iz stvarnih ulaza i datuma maturiteta. Za 1973.–1979. prikazati opisne ishode po kvadrantima, bez tvrdnje o zarađenom prinosu naučene strategije. Time cijeli naftni šok nije unaprijed proglašen razdobljem uspješnog trgovanja.

Vremensko odvajanje dovršenih prinosa vrijedi i ovdje, ali ne uklanja pristranost današnjih revidiranih makro podataka, naknadno konstruiranog CFNAI-a ili backcast indeksa. Fiksni odmak ulaza od dva mjeseca dopušten je samo kao označena dijagnostika; ne pretvara revidirane podatke u tadašnje objave. Referentni PCE cilj od 2% prije formalnog usvajanja 2012. ostaje današnje analitičko sidro.

Ako dugi izvori imaju samo mjesečnu frekvenciju, izvršenje i vrednovanje modelirati mjesečno. Objaviti mjesečno izmjeren maksimalni pad i jasno navesti da ne obuhvaća padove unutar mjeseca. Usporedbe sa suvremenim ETF-ovima računati i na istoj mjesečnoj frekvenciji; dnevni pad prikazati dodatno samo ondje gdje postoje stvarni dnevni podaci.

Za indekse prikazati bruto rezultat te scenarije 10/25/50 bp po trgovanoj strani; to su pretpostavke troška, ne potvrda da su povijesni indeksni prinosi bili dostupni kroz stvarni proizvod po toj cijeni. Za zlato dodatno prikazati osjetljivost na 0,25% i 0,50% godišnjeg troška čuvanja. Pri usporedbi s ETF-ovima pojasniti koje su naknade već sadržane u cijenama.

Unaprijed zadani podperiodi dugog panela: 1973.–1979. opisno; 1980.–1989., 1990.–1999., 2000.–2009., 2010.–2019. i 2020.–rujan 2026. za simulaciju gdje je izvediva. Posebno prikazati 2000.–2002., 2007.–2009., 2020. i 2022. Samo podrazdoblja koja pripadaju stvarnoj evaluaciji smiju doprinositi trgovinskim rezultatima. Uz broj mjeseci navesti i broj epizoda/kriza: više preklapajućih ishoda nije isto što i više neovisnih ciklusa.

Duga studija ostaje sekundarna provjera robusnosti u odnosu na primarni test opisan gore. Ne birati između četiri i pet klasa, datuma početka ili proxyja prema najvećem povijesnom profitu. U aplikaciji ponuditi odvojene prikaze: Duga povijest, Tada dostupne objave i ETF-ovi, svaki s vlastitim datumima, univerzumom i ograničenjima.

Izvori provjere ograničenja:

- [Chicago Fed: prva objava CFNAI-a 5. ožujka 2001.](https://www.chicagofed.org/publications/economic-perspectives/2002/3qepart2)
- [Chicago Fed: arhiva tada dostupnih CFNAI podataka](https://www.chicagofed.org/research/data/cfnai/historical-data)
- [TreasuryDirect: prve TIPS aukcije u siječnju 1997.](https://www.treasurydirect.gov/research-center/timeline/tips/)
- [S&P: povijest GSCI-a i upozorenje o naknadnom izračunu prije 1991.](https://www.spglobal.com/spdji/en/documents/education/education-why-sp-gsci.pdf)

## Metrike, nesigurnost i zaključak

Primarni ekonomski učinak je 12 puta prosječna razlika uparenih mjesečnih prinosa strategije i primarne bezuvjetne kontrole, nakon troškova. To je godišnje izražena aritmetička razlika, ne razlika CAGR-a. Portfelje vrednovati dnevno; mjesečne prinose izvesti iz tih vrijednosti. Objaviti i CAGR, godišnju volatilnost, Sharpe iznad istog gotovinskog proxyja, dnevni maksimalni pad i trajanje oporavka, promet, troškove, prosječnu izloženost svakoj imovini i udio gotovine.

Za izravno rangiranje prikazati srednju i medijalnu razliku 12-mjesečnih prinosa, raspodjelu gubitaka, broj startova i epizoda. Ako se prikazuje P10 ili učestalost gubitaka, jasno ih nazvati povijesnim frekvencijama, bez tvrdnje da su buduće vjerojatnosti.

Na uparenim mjesečnim prinosima strategije i primarne kontrole koristiti moving-block bootstrap s 12-mjesečnim blokovima, najmanje 5.000 ponavljanja i fiksnim sjemenom; osjetljivost provjeriti s 24-mjesečnim blokovima. Preklapajuće ishode 12M uzorkovati u uparenim blokovima od najmanje 12 mjeseci; za sekundarni 36M najmanje 36. Prikazati 95% interval razlike prinosa. Bootstrap ne uklanja istraživački odabir, revizije izvan obuhvata izvora ili manjak neovisnih ciklusa.

Unaprijed postoji jedna primarna usporedba i jedan primarni horizont. Ostale tablice označiti kao sekundarne; ne proglasiti pobjedu na temelju najboljeg među mnogim testovima.

Povijesna podrška koristi makro signala postoji samo ako je primarni neto učinak pozitivan i njegov interval ne obuhvaća nulu, pozitivan učinak opstaje pri 25 bp, a rezultat nije očito koncentriran u jednoj epizodi. Ni tada povijesna analiza ne zamjenjuje forward provjeru. Ako interval uključuje nulu, zaključak je: „Prednost nije potvrđena.” Ako strategija samo smanji pad uz slabiji prinos, opisati taj kompromis, bez tvrdnje o nadmoći.

## Implementacijski plan za repozitorij

Predložene nove datoteke, još nisu dodane u repozitorij:

- `scripts/research/state-tilt-pit-protocol.md`: ovaj zamrznuti protokol.
- `scripts/research/build-state-vintages.mjs`: preuzimanje ALFRED vintages, manifest pokrivenosti i hash izvornih datoteka.
- `scripts/research/state_tilt_pit.py`: povijesni signali, provjera maturiteta, sažimanje, tranše, cijene, troškovi i statistika.
- `scripts/research/verify-state-tilt-pit.mjs`: neovisna provjera odabranih odluka, težina, izvršenja i novčanog toka.
- `data/state-tilt-pit.json`: dopušteni izvedeni rezultati i metapodaci za aplikaciju.
- `scripts/research/STATE_TILT_PIT.md`: nalazi i upute za ponavljanje.

Sirove izvore i vjerodajnice držati izvan javnih rezultata, u ignoriranom `work/research/`; objaviti samo ono što uvjeti izvora dopuštaju. Manifest mora navesti verziju, SHA koda, vintage datume, vremensku zonu, ulaz/izlaz, posljednji dovršeni cjenovni mjesec, troškovni model i sve iznimke.

Bitne automatizirane provjere:

1. Promjena budućeg vintagea ili budućeg prinosa ne smije promijeniti prošli signal ili rangiranje.
2. Nedovršen 12M ishod ne ulazi u učenje; posebno provjeriti izlaz na današnjem zatvaranju.
3. Miješani referentni mjeseci, nepotpun trend, stale podaci i nedostajući vintages daju označeno odustajanje.
4. Vrijednost +0,01 aktivnosti daje 55%/45% udjela uz postojeći pojas, bez mijenjanja ekonomskih sidara.
5. Dividende/splitovi, promjena mjeseca, praznici, trošak dviju strana i objedinjavanje naloga imaju ručno provjerene primjere.
6. Tranše, gotovina, prinosi i troškovi moraju se uskladiti s ukupnom dnevnom vrijednošću portfelja.
7. Sve primarne usporedbe imaju iste datume i ulazni kapital; razlikovati dovršene ishode rangiranja od otvorenih portfeljskih pozicija.

U tabu Backtest & prediction dodati odvojenu sekciju State + trend validation. Na vrhu prikazati status dokaza, verziju, razdoblje, izvor vintages, troškove i pokrivenost. Zatim prikazati krivulju kapitala, padove, usporedbe i zapis odabrane odluke: što je bilo poznato, kako je rangirano i što se poslije ostvarilo. Povijesne tablice s revidiranim podacima ostaviti jasno označene kao opisne.

## Pregledani izvori

- [README aplikacije](https://github.com/Garrincha077/Dalio-Quadrant/blob/main/README.md)
- [Postojeći momentum protokol](https://github.com/Garrincha077/Dalio-Quadrant/blob/main/scripts/research/protocol.md)
- [Postojeći rezultati](https://github.com/Garrincha077/Dalio-Quadrant/blob/main/scripts/research/README.md)
- [Opisna studija stanja i budućih prinosa](https://github.com/Garrincha077/Dalio-Quadrant/blob/main/scripts/research/STATE_FORWARD.md)
- [Pravila state-tilt-1](https://github.com/Garrincha077/Dalio-Quadrant/blob/main/scripts/research/state-tilt-method.md)
- [Implementacija kartice](https://github.com/Garrincha077/Dalio-Quadrant/blob/main/lib/state-tilt.mjs)

Prijedlog je izveden iz dokumentacije i pregledanog modula; postojeći istraživački rezultati nisu ovdje neovisno ponovno izračunati.

## Izvedbena dopuna: javno dostupna duga istraživačka serija

Dopuna prije pregleda rezultata dugog portfelja, 26. listopada 2026.: preuzeti su javni AQR podaci o jednako ponderiranoj robi (mjesečni futures excess returns, završavaju svibnjem 2025.), Shillerova izvorna tablica, Fama–French mjesečni tržišni i T-bill prinosi te World Bank mjesečno zlato preko označene kopije datasets/gold-prices. GSCI i potpuna povijest IEF-u usporedivog obvezničkog indeksa još nisu pribavljeni.

Zato odvojeni panel `long-public-proxy-1` koristi američko tržište dionica iz Fama–French Mkt-RF + RF, Shillerov objavljeni model obvezničkih prinosa, World Bank prosječnu mjesečnu cijenu zlata i AQR jednako ponderiranu robnu futures košaricu uz RF kolateral. To je eksplorativna provjera četiriju klasa, a ne spojena povijest četiriju ETF-ova ili potvrda povijesno ostvarivog trgovanja po zadanim cijenama. Shillerov obveznički indeks je rekonstrukcija; mjesečne prosječne cijene zlata nisu cijene zatvaranja.

Koristiti samo zajedničke mjesece od siječnja 1973. do posljednjeg potpunog zajedničkog mjeseca, bez nastavka AQR serije drugim indeksom. Ciljana simulacija počinje siječnjem 1980. Za makro ulaze vrijedi revidirana povijest i dvomjesečni odmak, jasno bez tvrdnje o tada dostupnim objavama. Parametri i univerzum ne biraju se prema rezultatima ove provjere. Prikazati troškove 0/10/25/50 bp i dodatno 0,25%/0,50% godišnje za čuvanje zlata. Preostali cilj do rujna 2026. i test stvarnih vintages ostaju zasebno označeni kao nedovršeni dok izvori ne budu pribavljeni i provjereni.

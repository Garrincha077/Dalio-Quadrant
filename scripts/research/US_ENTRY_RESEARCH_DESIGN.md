# Plan provjere prilika za ulazak · SAD · 26. listopada 2026.

Status: specifikacija sljedeće faze; novi izračuni, nabava i buduće praćenje još
nisu pokrenuti ovim dokumentom. Postojeći rezultati i njihovi protokoli ostaju
zasebni. Ovo nije tvrdnja da je otkriven pouzdan signal za kupnju.

## Pitanje i redoslijed rada

Tražimo uvjete nakon kojih je neto prinos pojedine klase imovine veći od njezina
uobičajenog prinosa za isto trajanje ulaganja. Ne rangiramo klase samo prema
apsolutnom prinosu. Pozitivan relativni rezultat može i dalje značiti gubitak.

Prvo završiti provjeru američkih državnih obveznica (IEF, 7–10 godina). Potom
primijeniti isti okvir na postojeći američki investicijski skup SPY, GLD, TIP i
DBC. To su postojeće američke tržišne izloženosti, uključujući zlato i robu;
ne uvodimo makro modele drugih zemalja. Različite ročnosti obveznica zasebni su
budući eksperimenti, bez prešutnog spajanja s IEF-om.

Glavni horizont je 12 mjeseci. Rezultati za 3 i 36 mjeseci obvezni su dodatni
prikazi, ali ne zamjenjuju glavni horizont ako izgledaju bolje. Cilj nije nužno
dobiti veći povijesni rezultat, nego utvrditi koliko je postojeći obrazac pouzdan.

## 1. Izvori i vrata za prihvat podataka

Za svaki izvor voditi inventar: identifikator, razdoblje, valuta, ukupni ili samo
cjenovni prinos, troškovi fonda, ročnost, konvencija duracije, datum ekonomskog
opažanja, vrijeme prve dostupnosti, dohvat, revizija, praznine, licenca i hash.
Odbijeni izvori i pogrešni datumi ostaju u evidenciji.

| Prednost | Potrebno | Provjera prije izračuna prinosa pravila |
| --- | --- | --- |
| 1 | Duga opažena povijest ukupnih prinosa američkih državnih obveznica, uz datirani YTM i duraciju | Ista ročnost/univerzum; kuponi i reinvestiranje; povijest lansiranja i naknadne rekonstrukcije označene |
| 2 | Popunjavanje stvarnih praznina u arhivi IEF-a iz izvornog arhiva | Točan fond i traženi datum; nikakva interpolacija ili zamjena današnjim portfeljem |
| 3 | Izvorne CFNAI/PCE objave prije sadašnje vintage granice | Vrijednost, referentni mjesec i dokaz vremena objave; današnja revizija ne zamjenjuje izvornu objavu |
| 4 | Dnevni tržišni ukupni prinosi i podatak o izvršenju | Raspodjele, korporativne akcije, stvarni trgovački kalendar, početak i kraj držanja |

Za dugu obvezničku povijest prvo provjeriti dostupnost i uvjete dokumentiranih
CRSP i indeksnih izvora prema [ugovoru ulaznih podataka](US_TREASURY_INPUT_CONTRACT.md).
Dokumentacija proizvoda nije pribavljena baza. Ovaj plan ne odobrava kupnju ili
pretplatu. Ako izvor nije dostupan, taj dio označiti blokiranim i nastaviti rad
na raspoloživim podacima.

Na preklapanju neovisnih izvora objaviti broj mjeseci te medijan, maksimum i
datume razlika mjesečnih prinosa. Razlike uskladiti s konvencijama prije analize,
bez biranja izvora koji daje bolje prinose. Za rizik provjeriti jedinice, vrstu
duracije i obuhvat portfelja. Nema univerzalnog proizvoljnog praga jednakosti
za tržišnu cijenu i NAV.

Tri odvojena skupa rezultata:

- Opaženi tržišni ukupni prinosi i dokazivo tada dostupni ulazi.
- Opaženi prinosi uz sada revidirane makro podatke ili naknadno dohvaćene as-of
  podatke bez dokaza izvorne objave: povijesni odnos uz jasno ograničenje.
- Rekonstruirani prinosi: provjera mehanizma, odvojena od opaženih instrumenata.

Dulja povijest bez tadašnjih objava pomaže razumjeti odnos, ali sama ne dokazuje
da je pravilo tada bilo provedivo. Sadašnji IEF rizik pripada drugom skupu u
pogledu vremena objave, čak i kada makro ulazi imaju izvorne vintage zapise.

## 2. Mali skup pravila za prvu fazu

Ne tražimo najbolje pragove po povijesnom prinosu. Koristimo postojeće dvije
hipoteze i jednu novu, unaprijed određenu provjeru z-scorea:

| Oznaka | Uvjet | Što provjerava |
| --- | --- | --- |
| B0 | Svaki prihvatljiv početni datum | Uobičajeni prinos istog instrumenta |
| B1 | YTM / duracija iznad vlastitog prethodnog 60-mjesečnog medijana | Je li početni odnos prinosa i kamatnog rizika koristan? |
| B2 | B1 i tromjesečna promjena PCE YoY manja od −0,20 postotnih bodova | Donosi li usporavanje inflacije dodatnu korist? |
| B3 | B2 i prethodno poznati 36-mjesečni z-score manji od nule | Pomaže li dodatno niži položaj indeksa ukupnog prinosa u vlastitoj povijesti? |

Za povijesnu usporedbu zadržati postojeću kronologiju: ulaz u mjesecu t, rizik i
makro referencija t−2; medijan rizika od t−62 do t−3. Primarni medijan zahtijeva
60 uzastopnih valjanih opažanja. Postojeći observed48 način ostaje samo zasebna
osjetljivost. Ne prebacujemo ga u glavni rezultat zbog većeg prinosa ili uzorka.

Z-score slijedi [postojeću definiciju](zscore-entry-protocol.md): logaritmi 36
uzastopnih pozitivnih vrijednosti prilagođenog indeksa ukupnog prinosa od t−36
do t−1, uključujući zadnju poznatu vrijednost u prosjek i uzoračku standardnu
devijaciju. SD ispod 1e−12 ili praznina znači nedostupan signal. Prag je z < 0,
uz numeričku toleranciju 1e−9. Nema traženja boljeg praga ili duljine prozora.
Z-score nije fundamentalna procjena vrijednosti i ne pretpostavlja normalnu
distribuciju; dug trend može ga dugo održavati pozitivnim.

Sva četiri retka usporediti na identičnim početnim datumima koji imaju sve
potrebne ulaze. Dodatno objaviti pokrivenost B1 na njegovu širem dostupnom skupu,
ali taj širi rezultat ne koristiti za dokaz doprinosa B2/B3. Prihvatljivost
ulaza prvo utvrditi bez gledanja budućeg prinosa; za pojedini horizont zatim
izdvojiti zajedničke datume s potpuno sazrelim ishodom.

Prethodno pravilo slabe aktivnosti ostaje objavljeno u staroj studiji. Ne brišemo
njegov slab rezultat i ne pretvaramo novi izbor B1–B3 u povijesno neovisan test.

## 3. Uloga kvadranata i ostalih klasa

Razdvojiti razinu stanja od smjera promjene. Za opis stanja zadržati postojeće
sidro CFNAI-MA3 = 0 i PCE YoY = 2%, uključujući postojeću obradu sidara. Ne
prilagođavati ta sidra da poboljšaju prinose. Disinflacija u B2 je smjer, a ne
isto što i inflacija ispod 2%.

Za svaku postojeću klasu prikazati sve kvadrante i raspoložive ishode 3/12/36M:
uobičajeni prinos, uvjetni prinos, razliku, gubitke, broj ulazaka, broj epizoda i
raspon neizvjesnosti. Učinak z-scorea pokazati i odvojeno te unutar kvadranta na
zajedničkim datumima, da se učinak cijene ne pripiše makru. To su istraživačke
tablice; najviši povijesni redak nije automatski buduće pravilo.

Ne prenositi YTM/duraciju na zlato ili robu i ne dodavati automatski nove
pokazatelje svakoj klasi. Prije njihove sljedeće formalne evaluacije zasebno
zapisati jednu ekonomsku hipotezu, definiciju ulaza i mali broj usporedbi. U
prvoj fazi ne provoditi masovnu pretragu kombinacija kvadrant × z-score ×
trend × prinos × prag. Dodavanje testova zahtijeva novu verziju protokola.

## 4. Mjerila i kriteriji zaključka

Primarna veličina ostaje razlika aritmetičkog prosjeka kumulativnih 12M neto
prinosa odabranih ulazaka i svih zajedničkih prihvatljivih ulazaka u isti
instrument. Ne nazivati je godišnjim CAGR-om ili tržišno neutralnom alfom.
Početni i završni trošak 10 bp po strani; zasebno stres 25 bp. Ugrađene naknade
fonda ne oduzimaju se ponovno. Jednaki troškovi vrijede i za B0.

Tri unaprijed zadane glavne usporedbe su B1−B0, B2−B1 i B3−B2. Za dodatne
filtre računati razliku njihovih uvjetnih prosjeka na zajedničkom skupu datuma;
u svakoj bootstrap replici ponovno izračunati oba prosjeka. Ne tretirati ugniježđene
ili preklapajuće ulaske kao nezavisne parove.

Objaviti prosjek, medijan, P10, udio gubitaka, broj odabranih i svih ulazaka,
pokrivenost, kalendarske epizode, najdulju epizodu i nepreklapajuća držanja.
Praznine u podacima mogu razdvojiti epizode; one nisu dodatni gospodarski ciklusi.
Za usporedbu B2−B1 i B3−B2 minimum potpore mora ispuniti svako uključeno pravilo.

Za povijesne 12M usporedbe: 5.000 zajedničkih kružnih kalendarskih blokova od
12 mjeseci, seed 20261026+12, najmanje 80% valjanih replika. Za dodatne horizonte
blok max(12,h). Ako potpora ne doseže 24 odabrana početka i šest epizoda,
inferenciju označiti nedovoljnom, čak i kada je prosjek visok. To je minimalni
prag za prikaz, a ne jamstvo statističke snage. Objaviti i raspoložive
nepreklapajuće ishode bez tvrdnje da su zbog toga nužno neovisni.

Holm korekcija za povijesni nastavak obuhvaća sve podržane usporedbe B1−B0,
B2−B1 i B3−B2, sve prikazane horizonte, oba režima povijesti i oba povratna
izvora unutar odvojenih vintage/revised skupova. Prije računanja popisati puni
registar usporedbi i poslije objaviti koji su testovi ostali bez potpore. Nova
obitelj ne briše rizik odabira iz dosadašnjeg istraživanja. Kvadrantne tablice
ostalih klasa ostaju zasebna, eksplicitno eksploratorna obitelj sa svojim punim
popisom; ne koristiti njihov najbolji rezultat kao potvrdu B1–B3.

Provjeriti sve unaprijed definirane ere (do 2015., 2016.–2019., od 2020.) i
osjetljivost uklanjanja jedne kalendarske epizode. Izračunati vlastitu uobičajenu
osnovicu za svaki preostali skup. Pri premalom uzorku ispisati nedostupno.
To su provjere koncentracije, bez biranja ili uklanjanja nepovoljnog razdoblja
iz glavnog rezultata. Novodobavljeni stari podaci ostaju povijesna provjera.

Predložene oznake u aplikaciji:

- **Nedovoljno podataka:** ne prolaze ulazni ili minimalni pragovi potpore.
- **Istraživački obrazac:** opisiv povijesni rezultat, bez neovisne potvrde.
- **Potpora u unaprijed određenoj provjeri:** pozitivan glavni rezultat s Holm
  p ≤ 0,05, pozitivnim predznakom pri 25 bp i bez promjene predznaka pri
  izostavljanju pojedine epizode, uz dostatnu potporu i neovisnu buduću provjeru.

Treća oznaka nije obećanje budućih prinosa. Dokaz da B1 pomaže ne dokazuje da
B2 ili B3 pomažu; svaki dodatak mora proći vlastitu usporedbu. Ako ne prođe,
jednostavnije pravilo zadržava se kao istraživački kandidat.

## 5. Buduće praćenje bez naknadnog popravljanja signala

Prije prvog signala spremiti verziju i hash protokola, pravila i popisa testova.
Planirani prvi mjesec je studeni 2026., samo ako se sve snimi na vrijeme.
Zaključavanje ulaza: zatvaranje posljednjeg američkog trgovačkog dana listopada;
izvršenje: zatvaranje prvog trgovačkog dana studenoga. Ako snimanje zakasni,
prvi mjesec pomaknuti unaprijed i evidentirati razlog, bez naknadnog signala.

Koristiti samo objave dokazivo dostupne do zaključavanja. Sačuvati referentne
lagove i formule B1–B3; ne prelaziti na svježiji makro mjesec ovisno o ishodu.
Za prospective z-score zadnje završeno mjesečno zatvaranje poznato je prije
sljedećeg izvršenja. Izlaz je prvo trgovačko zatvaranje mjeseca udaljenog h
mjeseci od ulaznog mjeseca. Ova kronologija razlikuje se od dosadašnjeg
povijesnog izvršenja na kraju mjeseca, pa njezine prinose voditi odvojeno.

Za svaku mjesečnu odluku, i kada nema ulaska, zapisati: decision_id, instrument,
protokol/hash, cutoff i retrieval timestamp, izvorni payload/hash, datume
objave i referentna razdoblja, YTM, duraciju, referentni medijan, PCE promjenu,
z-score, stanje kvadranta, dostupnost, B1/B2/B3, planirane i stvarne ulazne i
izlazne datume/cijene, izvor ukupnog prinosa, trošak i status sazrijevanja.
Naknadne ispravke appendati s razlogom; ne prepisivati originalnu odluku.
Ne unositi budući ishod pri izradi odluke. Nedostupan ulaz nije negativan signal.

Mjesečno objavljivati opisni dnevnik i sazrele ishode bez ponavljanih formalnih
testova značajnosti. Prvu formalnu 12M provjeru predvidjeti tek kada sazriju
ishodi prvih 60 mjesečnih odluka: za planirani početak u studenome 2026. to je
listopad 2032. Obitelj su tri navedene 12M usporedbe, primarni tržišni ishod,
complete60, izvorno snimljeni ulazi; Holm 5%. Pri nedovoljnoj potpori rezultat
ostaje neodlučen. Prije gledanja kasnijih ishoda odrediti novi termin, bez
ponavljanja testa svaki mjesec. Rani 3M i naknadni 36M ishodi su opisni.

To ne znači čekati šest godina za koristan rad: dulja povijest, izvorne objave,
neovisno usklađivanje izvora i provjere koncentracije rade se odmah. Znači da
kratko buduće praćenje ne predstavljamo kao konačan dokaz kroz više ciklusa.

## 6. Isporuke i redoslijed provedbe

1. Inventar izvora i izvještaj o dostupnosti/licenci; bez kupnje. Ishod može biti
   prihvaćen izvor ili precizno dokumentirana prepreka.
2. Validator novog izvora i izvještaj o preklapanju; tek zatim izračun B0–B3.
3. Sve usporedbe na zajedničkom kalendaru, vremenske provjere i analiza
   koncentracije; JSON/CSV s ulazima, odlukama, ishodima i razlozima isključenja.
4. Neovisna provjera datuma, maski, neto prinosa, osnovice i glavnih razlika iz
   stvarnih ulaza drugim izračunom; ciljane provjere praznina i vremenskog curenja.
5. Dnevnik budućih odluka i prikaz statusa dokaza u aplikaciji; zatim faza za
   ostale postojeće klase s unaprijed zapisanim hipotezama.

Nema automatske promjene live preferencija, objave signala ili rotacije portfelja
zbog većeg povijesnog prosjeka. Simulacija ukupnog portfelja zaseban je zadatak:
zahtijeva unaprijed određena pravila za novac između ulazaka, veličinu pozicija,
preklapanje držanja i stvarni promet. Prosjek odabranih ulazaka to ne određuje.

[Polazišni nalazi](OBSERVED_US_BONDS_FINDINGS.md) ·
[Prioriteti podataka](DATA_UPGRADE_PLAN.md) ·
[Ugovor izvora](US_TREASURY_INPUT_CONTRACT.md).

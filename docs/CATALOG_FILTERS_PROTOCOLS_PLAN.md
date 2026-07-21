# DozaKS — Katalogu, filtrat dhe protokollet personale

## Parimet bazë

1. Lista zyrtare e produkteve medicinale është baza kryesore e identitetit të barnave.
2. Një bar gjenerik dhe një produkt tregtar janë entitete të ndryshme.
3. Të dhënat klinike nuk merren nga lista e çmimeve; ato shtohen vetëm nga burime klinike të verifikuara.
4. Çdo fakt klinik ka burim, version, status editorial dhe datë rishikimi.
5. Protokollet personale nuk ruajnë identifikues pacientësh.
6. Gemini krijon vetëm draft dhe mund të përdorë vetëm product_id nga allowlist-i i kërkesës.
7. Asnjë rezultat AI nuk publikohet ose aktivizohet automatikisht.

## Modeli i katalogut

### Bar gjenerik
- emri kanonik i substancës
- variantet, kripërat, sinonimet dhe gabimet e zakonshme
- kodi ATC
- produktet e lidhura
- format dhe fortësitë e disponueshme
- statusi editorial

### Produkt medicinal
- emri tregtar
- substanca aktive nga burimi
- ATC
- fortësia
- forma farmaceutike
- paketimi
- prodhuesi
- bartësi i autorizimit
- certifikata MA
- statusi gjenerik/origjinator
- çmimi
- intervali i vlefshmërisë

## Filtrat e kërkimit

### Niveli 1 — të shpejtë
- Bar gjenerik
- Emër tregtar
- ATC
- Formë farmaceutike
- Rrugë administrimi
- Fortësi
- Gjenerik / Origjinator
- Vetëm produkte aktive

### Niveli 2 — profesional
- Prodhues
- Bartës autorizimi
- Certifikatë MA
- Kombinim substancash
- Produkte me të njëjtën substancë
- Produkte me të njëjtin ATC
- Produkte të së njëjtës formë
- Interval çmimi
- Listë esenciale
- Nivel institucional

### Sjellja e rezultateve
1. Përputhje ekzakte e substancës.
2. Përputhje ekzakte e emrit tregtar.
3. Përputhje e ATC-së.
4. Sinonime dhe variante të verifikuara.
5. Fuzzy search për gabime shkrimi.
6. Rezultatet e pa verifikuara etiketohen qartë.

## Kartela e barit

Tab-et e rekomanduara:

1. Përmbledhje
2. Produktet në Kosovë
3. Indikacionet
4. Dozat
5. Siguria
6. Rregullimi renal/hepatik
7. Shtatzënia dhe gjidhënia
8. Interaksionet
9. Protokollet personale
10. Burimet dhe historiku i versioneve

Dozat, indikacionet dhe siguria shfaqen vetëm kur editorial_status është `published`.

## Protokollet personale

Çdo protokoll ka:
- pronarin
- titullin
- diagnozën dhe ICD-në
- kontekstin klinik
- listën e produkteve të lejuara
- renditjen e hapave
- dozën, rrugën, frekuencën dhe kohëzgjatjen
- udhëzimet dhe shënimet e sigurisë
- versionin aktual
- historikun e ndryshimeve
- status draft / aktiv / arkivuar

Veprimet:
- krijo
- edito
- radhit me drag-and-drop
- dupliko
- arkivo
- rikthe version të vjetër
- printo / eksporto

## Gemini — rregullat e detyrueshme

Input-i server-side përmban:
- diagnozën / ICD
- kontekstin klinik
- vetëm produktet e përzgjedhura me product_id
- të dhënat klinike të publikuara
- formatin JSON të detyrueshëm

Validimi pas përgjigjes:
- çdo product_id duhet të jetë në allowlist
- çdo product_id duhet të jetë aktiv në databazë
- nuk lejohen emra barnash pa ID
- dozat pa burim shënohen të papranueshme
- përgjigjja ruhet si draft
- çdo referencë jashtë allowlist-it regjistrohet dhe refuzohet

## Fazat

### Faza 1 — katalogu dhe kërkimi
- API native në Vercel
- kërkim sipas barit dhe produktit
- filtra dhe facete
- grupim i produkteve të së njëjtës substancë
- normalizim i 136 formave farmaceutike
- aliaset dhe gabimet e shkrimit

### Faza 2 — kartela klinike
- burimet
- indikacionet
- dozat
- siguria
- rregullimet
- workflow draft → review → verified → published

### Faza 3 — protokollet personale
- autentikimi
- krijimi dhe editimi
- versionimi
- zgjedhja e produkteve nga katalogu
- pa të dhëna identifikuese të pacientëve

### Faza 4 — Gemini
- draftim vetëm me allowlist
- JSON schema
- validim server-side
- audit log
- miratim manual

### Faza 5 — performanca dhe përdorimi klinik
- latency monitoring
- cache i kontrolluar
- kërkim me tastierë
- offline shell pa cache të të dhënave klinike të vjetruara
- audit accessibility
- testim me skenarë realë para pacientit

# DozaKS — Plani i implementimit klinik

## Parimi kryesor

DozaKS do të përdoret para pacientit. Çdo ekran duhet të japë përgjigjen kryesore brenda 2–3 sekondave dhe çdo informacion klinik duhet të ketë burim, version, status editorial dhe datë verifikimi.

Burimet nuk përzihen:

- **ICD** kodifikon diagnozën.
- **Lista zyrtare e çmimeve të produkteve medicinale** jep katalogun e produkteve, emrin tregtar, substancën, ATC-në, fortësinë, formën, paketimin, certifikatën MA, çmimin dhe afatin e listës.
- **Lista e Barnave Esenciale** jep statusin esencial dhe nivelin institucional.
- **Burimet klinike të përditësuara** japin indikacionin, dozën, intervalin, maksimumin, kohëzgjatjen, rregullimin renal/hepatik dhe sigurinë.
- **Regjistri 2017** mbetet vetëm referencë historike e brendshme.

## Faza 1 — Katalogu i produkteve dhe kërkimi i shpejtë

Status: në implementim në `main`.

- Versionim dhe hash i burimit.
- Import me batch-e dhe auditim të rreshtave.
- Ruajtje e rreshtit origjinal dhe e fushave të normalizuara.
- Kërkim sipas emrit tregtar, substancës aktive, ATC-së, PDID-së, protokollit dhe certifikatës MA.
- View read-only për API-n publike.
- Pilot klinik para importit të plotë.
- UI “Produktet në Kosovë” me kërkim të menjëhershëm.

Kushti për përfundim:

- 4,006 rreshta të importuar.
- Zero dublime sipas rreshtit dhe hash-it të burimit.
- Raport për rreshtat me PDID/ProtocolNo të pazakontë, fusha të zbrazëta dhe vlera jo standarde.
- Kërkim p95 nën 300 ms në API pas ngrohjes.

## Faza 2 — Normalizimi farmaceutik

- Normalizim i substancave aktive dhe sinonimeve.
- Ndarje e produkteve me kombinime në përbërës individualë.
- Normalizim i formave farmaceutike, rrugëve dhe njësive.
- Lidhje produkt → substancë → ATC.
- Lidhje me Listën e Barnave Esenciale.
- Etiketa të qarta: esencial, origjinator/gjenerik, formë, rrugë dhe vlefshmëri.

Kushti për përfundim:

- Çdo produkt ka mapping të verifikuar me substancën/komponentët.
- Njësitë dhe format kanë fjalor të kontrolluar.
- Rastet e paqarta mbeten `needs_review` dhe nuk përdoren automatikisht në protokoll.

## Faza 3 — ICD dhe diagnozat

- ICD-10 për dokumentimin praktik aktual.
- Strukturë e gatshme për ICD-11.
- Kërkim sipas kodit, titullit dhe sinonimeve shqip.
- Mapping diagnosis → ICD me status `draft`, `reviewed` ose `verified`.
- Asnjë mapping automatik i paqartë nuk publikohet si përfundimtar.

## Faza 4 — Protokollet private të mjekut

- Zgjedh diagnozën dhe kodin ICD.
- Zgjedh produktet vetëm nga katalogu aktual.
- Shfaq substancën, formën, fortësinë dhe certifikatën MA.
- Krijon hapa, monitorim, kritere për eskalim dhe burime.
- Ruajtje private me autentikim, ownership, audit log dhe versionim.
- Pa të dhëna identifikuese të pacientit në protokoll.

## Faza 5 — Përmbajtja klinike e verifikuar

- Indikacionet.
- Dozat për të rritur dhe pediatri.
- Doza sipas peshës/BSA.
- Maksimumi ditor.
- Intervali dhe kohëzgjatja.
- Rregullimi renal/hepatik.
- Shtatzënia dhe gjidhënia.
- Kundërindikacionet dhe interaksionet.
- Burimi, versioni, reviewer-i dhe data e verifikimit për çdo rregull.

Rrjedha editoriale:

`draft → in_review → verified → published → archived`

## Faza 6 — UX klinike dhe performanca

- Kërkimi kryesor është gjithmonë i fokusueshëm me `Ctrl/Cmd + K`.
- Rezultati kryesor shfaqet pa reload.
- Cache vetëm për shell-in; të dhënat klinike kontrollohen me version.
- Prefetch i kartelës që përdoret më shpesh.
- Skeleton states, timeout dhe fallback i qartë.
- Objektiva klikimi ≥44 px dhe përdorim me tastierë.
- Modalet nuk humbin fokusin dhe mbyllen me `Esc`.
- Mobile: kërkim, urgjencë, protokolle dhe kalkulatorë me një dorë.

Objektivat teknike:

- LCP nën 1.5 s në lidhje të mirë.
- Kërkim lokal nën 50 ms.
- API p95 nën 300 ms pas ngrohjes.
- Zero kërkesa të panevojshme gjatë shkrimit; debounce dhe anulim i kërkesës së mëparshme.

## Faza 7 — Siguria, auditimi dhe publikimi

- RLS dhe role read-only për API-n publike.
- Autentikim për protokollet private dhe panelin editorial.
- Audit log për çdo ndryshim klinik.
- Backup para migrimeve.
- Teste negative: draftet, të dhënat historike dhe rreshtat e refuzuar nuk dalin në publik.
- Kontroll i regresionit para çdo deploy-i production.

## Rregullat e publikimit

1. Prania e produktit në katalog nuk konfirmon indikacionin ose dozën.
2. Prania në LBE nuk do të thotë se bari është zgjedhja e duhur për çdo pacient.
3. Teksti historik nuk publikohet si dozë aktive.
4. Doza numerike kërkon burim aktual dhe verifikim klinik.
5. DozaKS mbështet vendimin; nuk zëvendëson gjykimin klinik, SPC-në ose protokollin institucional.

# DozaKS

DozaKS është MVP funksional i një platforme klinike të shpejtë për profesionistët shëndetësorë në Kosovë.

## Versioni i parë

- Dashboard responsive sipas dizajnit referencë
- Kërkim universal sipas simptomës, diagnozës, emrit gjenerik dhe emrit tregtar
- Sugjerime të menjëhershme gjatë shkrimit
- Filtra klinikë dhe kërkim i zgjeruar
- Seksione për urgjencë, pediatri, antibiotikë, shtatzëni dhe rregullim renal
- Panel demonstrues i barit me format dhe tabelën sipas indikacionit
- Menu responsive për desktop, tablet dhe mobile
- Gjendje hover, focus dhe navigim me tastierë

## Ekzekutimi lokal

```bash
npm install
npm run dev
```

## Build për production

```bash
npm run build
npm run preview
```

Netlify është konfiguruar për të ekzekutuar `npm run build` dhe për të publikuar folderin `dist`.

## Siguria klinike

Ky version është prototip i ndërfaqes. Dozat dhe protokollet klinike nuk publikohen pa:

- burim të identifikueshëm;
- datë përditësimi;
- rishikim nga mjeku ose farmacisti përgjegjës;
- rregulla sipas moshës, peshës, indikacionit dhe funksionit renal/hepatik;
- validim të kalkulatorëve klinikë.

Për këtë arsye tabelat e dozimit në versionin fillestar shënohen **Në verifikim**.

## Struktura

- `index.html` – hyrja e aplikacionit
- `src/main.jsx` – komponentët dhe ndërveprimet React
- `src/styles.css` – dizajni responsive
- `vite.config.js` – konfigurimi i build-it
- `netlify.toml` – konfigurimi i deploy-it

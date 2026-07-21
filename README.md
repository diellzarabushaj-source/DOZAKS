# DozaKS

DozaKS është një prototip funksional i një platforme klinike të shpejtë për profesionistët shëndetësorë në Kosovë.

## Versioni i parë

- Dashboard responsive sipas dizajnit referencë
- Kërkim universal sipas simptomës, diagnozës, emrit gjenerik dhe emrit tregtar
- Tolerim bazë i varianteve të shkrimit për disa barna demo
- Filtra të kërkimit
- Kërkime të fundit dhe historik lokal
- Panel dinamik i barit
- Ruajtje lokale e barit të preferuar
- Kalkulator aritmetik mg/kg, infuzioni dhe BSA
- Menu responsive për mobile dhe tablet
- Modal për kërkim të zgjeruar
- Gjendje hover, focus dhe njoftime interaktive

## Ekzekutimi

Faqja është statike. Hape `index.html` direkt, ose përdor një server lokal:

```bash
python -m http.server 8000
```

Pastaj hape `http://localhost:8000`.

## GitHub Pages

Në repository:

1. Hape **Settings**.
2. Hape **Pages**.
3. Te **Build and deployment**, zgjidh **Deploy from a branch**.
4. Zgjidh branch-in `main` dhe folder-in `/root`.
5. Ruaj ndryshimin.

## Siguria klinike

Ky version është prototip i ndërfaqes. Dozat dhe protokollet klinike nuk publikohen pa:

- burim të identifikueshëm;
- datë përditësimi;
- rishikim nga mjeku ose farmacisti përgjegjës;
- rregulla sipas moshës, peshës, indikacionit dhe funksionit renal/hepatik;
- validim të kalkulatorëve klinikë.

Për këtë arsye tabelat e dozimit në versionin fillestar shënohen **Në verifikim**.

## Struktura

- `index.html` – struktura dhe përmbajtja
- `styles.css` – dizajni responsive
- `app.js` – kërkimi dhe ndërveprimet

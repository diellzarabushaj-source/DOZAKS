'use strict';

(() => {
  const API_URL = '/api/atc-catalog';
  const PAGE_SIZE = 80;
  const SEARCH_DELAY = 170;

  const ATC_SYSTEMS = [
    {
      code: 'A', title: 'Aparati tretës dhe metabolizmi', short: 'Tretja & metabolizmi', memory: 'A = abdomen / tretja',
      description: 'Barna për gojën, stomakun, zorrët, mëlçinë, diabetin, vitaminat, mineralet dhe metabolizmin.',
      subgroups: [
        ['A01', 'Barna për gojën dhe stomatologji', 19, 'Tantum Verde, Tanflex, Stomatidin, Myconol'],
        ['A02', 'Barna kundër aciditetit dhe ulçerës', 119, 'Omeprazol, Pantoprazol, Esomeprazol, Famotidinë'],
        ['A03', 'Barna për çrregullimet funksionale gastrointestinale', 42, 'Reglan, Domperidone, Buscopan, Atropinë'],
        ['A04', 'Barna kundër të përzierave dhe vjelljes', 17, 'Ondansetron, Palonosetron, Granisetron, Aprepitant'],
        ['A05', 'Barna për mëlçinë dhe rrugët biliare', 7, 'Ursobil, Ursoflor, Silymarin, Hepa-Merz'],
        ['A06', 'Laksativë – kundër kapsllëkut', 18, 'Dulcolax, Lactulose, Verolax, Prolax'],
        ['A07', 'Kundër diarresë, infeksioneve dhe inflamacionit intestinal', 35, 'Nifuroxazide, Loperamide, Rifaximin, Mesalazine'],
        ['A08', 'Barna kundër obezitetit', 1, 'Xenical – orlistat'],
        ['A09', 'Enzima dhe barna ndihmëse për tretje', 3, 'Creon 10 000, Creon 25 000'],
        ['A10', 'Barna për diabetin', 115, 'Metformin, Glibenclamide, Dapagliflozin, insulina'],
        ['A11', 'Vitamina', 58, 'Vitamina C, D3, B-kompleks, B1, B6, B12'],
        ['A12', 'Minerale dhe elektrolite', 9, 'Kalium klorid, kalcium glukonat, magnez sulfat'],
        ['A16', 'Barna të tjera metabolike', 9, 'Levocarnitine, acid tioktik, nitisinone, imiglucerase'],
      ],
    },
    {
      code: 'B', title: 'Gjaku dhe organet gjakformuese', short: 'Gjaku', memory: 'B = blood / gjaku',
      description: 'Barna antitrombotike, kundër gjakderdhjes, kundër anemisë dhe tretësira për infuzion.',
      subgroups: [
        ['B01', 'Barna antitrombotike – kundër formimit të trombeve', 123, 'Rivaroxaban, Apixaban, Heparinë, Enoxaparinë, Aspirinë'],
        ['B02', 'Barna kundër gjakderdhjes', 31, 'Acid traneksamik, vitaminë K, faktor VIII, faktor IX'],
        ['B03', 'Barna kundër anemisë', 24, 'Hekur, acid folik, vitaminë B12, Recormon, Mircera'],
        ['B05', 'Zëvendësues të gjakut dhe tretësira për infuzion', 83, 'NaCl 0.9%, glukozë, Ringer, albuminë, manitol'],
      ],
    },
    {
      code: 'C', title: 'Sistemi kardiovaskular', short: 'Zemra & enët', memory: 'C = circulation / zemra',
      description: 'Barna për zemrën, tensionin, diurezën, enët e gjakut, venat dhe lipidet.',
      subgroups: [
        ['C01', 'Barna për sëmundjet e zemrës', 45, 'Digoksinë, amiodaron, nitroglicerinë, noradrenalinë'],
        ['C02', 'Barna antihipertensive', 5, 'Moxonidinë, doxazosinë, metildopa, Physiotens'],
        ['C03', 'Diuretikë', 44, 'Furosemid, hidroklorotiazid, torasemid, spironolakton'],
        ['C04', 'Vazodilatatorë periferikë', 3, 'Trentilin, pentoksifilinë, Tre Tal'],
        ['C05', 'Barna vazoprotektive dhe për hemorroide/vena', 29, 'Diosminë, Hepathrombin, Phlebodia, Faktu'],
        ['C07', 'Beta-bllokues', 74, 'Bisoprolol, metoprolol, nebivolol, carvedilol'],
        ['C08', 'Bllokues të kanaleve të kalciumit', 57, 'Amlodipinë, verapamil, diltiazem, nifedipinë'],
        ['C09', 'Barna që veprojnë në sistemin reninë–angiotensinë', 253, 'Lisinopril, enalapril, perindopril, losartan'],
        ['C10', 'Barna për uljen e lipideve dhe kolesterolit', 127, 'Atorvastatin, rosuvastatin, simvastatin, ezetimib'],
      ],
    },
    {
      code: 'D', title: 'Dermatologjia', short: 'Lëkura', memory: 'D = dermatologji',
      description: 'Barna lokale për kërpudha, plagë, alergji, psoriazë, infeksione, inflamacion dhe akne.',
      subgroups: [
        ['D01', 'Barna antifungale për përdorim dermatologjik', 45, 'Clotrimazole, Ketoconazole, Terbinafine, Miconazole'],
        ['D03', 'Barna për trajtimin e plagëve dhe ulçerave të lëkurës', 8, 'Dexpanthenol, sodium hyaluronate, Pantenol'],
        ['D04', 'Barna kundër kruajtjes dhe reaksioneve alergjike të lëkurës', 10, 'Promethazine, dimetindene, diphenhydramine'],
        ['D05', 'Barna kundër psoriazës', 3, 'Acitretin, calcipotriol, Daivobet, Neotigason'],
        ['D06', 'Antibiotikë dhe antimikrobikë dermatologjikë', 41, 'Aciclovir, mupirocin, gentamicin, fusidic acid'],
        ['D07', 'Kortikosteroide për përdorim dermatologjik', 59, 'Hydrocortisone, betamethasone, clobetasol, mometasone'],
        ['D08', 'Antiseptikë dhe dezinfektues', 11, 'Povidone-iodine, chlorhexidine, Betadine'],
        ['D10', 'Barna kundër akneve', 19, 'Adapalene, isotretinoin, clindamycin, azelaic acid'],
        ['D11', 'Barna të tjera dermatologjike', 4, 'Minoxidil, pimecrolimus, Elidel'],
      ],
    },
    {
      code: 'G', title: 'Sistemi urinar dhe organet seksuale', short: 'Urogjenital', memory: 'G = gjenital-urinar',
      description: 'Barna gjinekologjike, hormone seksuale, kontracepsion dhe barna urologjike.',
      subgroups: [
        ['G01', 'Barna antiinfektive dhe antiseptike gjinekologjike', 34, 'Ornidazol, metronidazol, klotrimazol, nistatinë'],
        ['G02', 'Barna të tjera gjinekologjike', 6, 'Dinoproston, atosiban, metilergometrinë, kabergolinë'],
        ['G03', 'Hormone seksuale dhe modulues të sistemit gjenital', 50, 'Levonorgestrel, progesteron, estradiol, testosteron'],
        ['G04', 'Barna urologjike', 69, 'Tamsulosin, dutasteride, sildenafil, tadalafil, solifenacin'],
      ],
    },
    {
      code: 'H', title: 'Hormonet sistemike', short: 'Hormonet', memory: 'H = hormone',
      description: 'Hormone të hipofizës/hipotalamusit, kortikosteroide sistemike, tiroide dhe kalcium.',
      subgroups: [
        ['H01', 'Hormonet e hipofizës dhe hipotalamusit dhe analogët', 15, 'Somatropinë, desmopresinë, oksitocinë, oktreotid'],
        ['H02', 'Kortikosteroide për përdorim sistemik', 67, 'Dexamethasone, methylprednisolone, prednisolone, hydrocortisone'],
        ['H03', 'Barna për trajtimin e gjëndrës tiroide', 18, 'Levothyroxine, thiamazole, propylthiouracil'],
        ['H05', 'Barna që rregullojnë homeostazën e kalciumit', 8, 'Cinacalcet, paricalcitol, Pimaro, Rextol'],
      ],
    },
    {
      code: 'J', title: 'Barna kundër infeksioneve për përdorim sistemik', short: 'Antiinfektivët', memory: 'J = infeksionet sistemike',
      description: 'Antibiotikë, antifungale sistemike, antivirale, imunoglobulina dhe vaksina.',
      subgroups: [
        ['J01', 'Antibiotikë për përdorim sistemik', 473, 'Ceftriaxone, amoxicillin, azithromycin, cefixime'],
        ['J02', 'Barna antifungale për përdorim sistemik', 20, 'Fluconazole, itraconazole, voriconazole'],
        ['J05', 'Barna antivirale për përdorim sistemik', 14, 'Aciclovir, tenofovir, sofosbuvir/velpatasvir'],
        ['J06', 'Serume imune dhe imunoglobulina', 21, 'Imunoglobulinë humane, anti-D, anti-tetanus, anti-hepatit B'],
        ['J07', 'Vaksina', 13, 'Gardasil 9, Varivax, Influvac, Prevenar, Pentaxim'],
      ],
    },
    {
      code: 'L', title: 'Kanceri dhe sistemi imunitar', short: 'Onkologji & imunitet', memory: 'L = kancer / imunitet',
      description: 'Barna antineoplastike, terapi endokrine, imunostimulues dhe imunosupresivë.',
      subgroups: [
        ['L01', 'Barna antineoplastike – kundër kancerit', 138, 'Rituximab, bevacizumab, trastuzumab, paclitaxel'],
        ['L02', 'Terapi endokrine për trajtimin e tumoreve hormonale', 15, 'Goserelin, letrozole, tamoxifen, fulvestrant'],
        ['L03', 'Imunostimulues', 11, 'Filgrastim, pegfilgrastim, interferon beta'],
        ['L04', 'Imunosupresivë', 35, 'Adalimumab, infliximab, ciclosporin, tacrolimus'],
      ],
    },
    {
      code: 'M', title: 'Sistemi muskuloskeletal', short: 'Muskuj, nyja & kocka', memory: 'M = muskuj-kocka',
      description: 'Barna antiinflamatore, lokale, relaksues muskulorë, përdhes dhe sëmundje të kockave.',
      subgroups: [
        ['M01', 'Barna antiinflamatore dhe antireumatike', 215, 'Ibuprofen, diclofenac, dexketoprofen, naproxen'],
        ['M02', 'Barna lokale për dhimbjet e muskujve dhe nyjave', 40, 'Fastum Gel, diclofenac gel, ibuprofen gel'],
        ['M03', 'Relaksues të muskujve', 31, 'Thiocolchicoside, baclofen, rocuronium, atracurium'],
        ['M04', 'Barna kundër përdhes – hiperuricemisë', 5, 'Allopurinol, febuxostat, colchicine'],
        ['M05', 'Barna për trajtimin e sëmundjeve të kockave', 14, 'Alendronate, zoledronic acid, denosumab'],
        ['M09', 'Barna të tjera për sistemin muskuloskeletal', 4, 'Risdiplam, Hyalgan, Zeel comp. N'],
      ],
    },
    {
      code: 'N', title: 'Sistemi nervor', short: 'Sistemi nervor', memory: 'N = nerva',
      description: 'Anestetikë, analgjezikë, antiepileptikë, Parkinson, barna psikiatrike dhe neurologjike.',
      subgroups: [
        ['N01', 'Anestetikë', 60, 'Propofol, sevofluran, lidokainë, bupivakainë, fentanyl'],
        ['N02', 'Analgjezikë – barna kundër dhimbjes', 175, 'Paracetamol, metamizol, tramadol, morfinë'],
        ['N03', 'Antiepileptikë', 72, 'Pregabalin, levetiracetam, clonazepam, carbamazepine'],
        ['N04', 'Barna kundër Parkinsonit', 18, 'Levodopa/carbidopa, biperiden, pramipexole'],
        ['N05', 'Psikoleptikë – antipsikotikë, anksiolitikë dhe sedativë', 142, 'Diazepam, alprazolam, midazolam, risperidone'],
        ['N06', 'Psikoanaleptikë – antidepresivë dhe barna për demencë/ADHD', 95, 'Escitalopram, duloxetine, atomoxetine, donepezil'],
        ['N07', 'Barna të tjera për sistemin nervor', 36, 'Betahistine, buprenorphine, methadone, pyridostigmine'],
      ],
    },
    {
      code: 'P', title: 'Barna antiparazitare', short: 'Parazitët', memory: 'P = parazitë',
      description: 'Barna kundër protozoarëve, malaries, krimbave dhe parazitëve të jashtëm.',
      subgroups: [
        ['P01', 'Barna kundër protozoarëve dhe malaries', 10, 'Metronidazol, Ornidazol, Hydroxychloroquine'],
        ['P02', 'Barna kundër krimbave – antihelmintikë', 9, 'Albendazol, Mebendazol, Vermoff, Vermex'],
        ['P03', 'Barna kundër parazitëve të jashtëm, zgjebes dhe morrave', 2, 'Permethrin, Benzyl benzoate'],
      ],
    },
    {
      code: 'R', title: 'Sistemi respirator', short: 'Respiratori', memory: 'R = respirator',
      description: 'Barna për hundë, fyt, astmë/COPD, kollë, sekrecione dhe alergji.',
      subgroups: [
        ['R01', 'Barna për hundën – dekongjestivë dhe preparate nazale', 58, 'Xylometazolinë, oxymetazolinë, mometasone'],
        ['R02', 'Barna për fytin', 23, 'Benzydamine, chlorhexidine, benzocaine, Septolete'],
        ['R03', 'Barna për sëmundjet obstruktive të rrugëve të frymëmarrjes', 117, 'Salbutamol, montelukast, budesonide, formoterol'],
        ['R05', 'Barna kundër kollës dhe ftohjes', 75, 'Acetylcysteine, ambroxol, bromhexine, butamirate'],
        ['R06', 'Antihistaminikë për përdorim sistemik', 79, 'Desloratadine, cetirizine, loratadine'],
        ['R07', 'Barna të tjera për sistemin respirator', 4, 'Broncho-Vaxom'],
      ],
    },
    {
      code: 'S', title: 'Organet shqisore', short: 'Sy & vesh', memory: 'S = sy-vesh',
      description: 'Barna oftalmologjike, otologjike dhe preparate të kombinuara për sy/vesh.',
      subgroups: [
        ['S01', 'Barna oftalmologjike – preparate për sytë', 93, 'Tears Naturale II, Moxifloxan, Tobrin, latanoprost'],
        ['S02', 'Barna otologjike – preparate për veshët', 5, 'Paroticin, Cetraxal, Ottoduo, Otis-T'],
        ['S03', 'Preparate për sy dhe vesh', 7, 'Citeral, Ciprofloxacin ABR, Gentazon, Dexacyn G'],
      ],
    },
    {
      code: 'V', title: 'Produkte të ndryshme', short: 'Të ndryshme', memory: 'V = varia / të ndryshme',
      description: 'Antidote, produkte ushqyese, tretës për barna dhe mjete kontrasti.',
      subgroups: [
        ['V03', 'Produkte të tjera terapeutike, antidote dhe preparate të veçanta', 34, 'Naloxone, protamine sulfate, MESNA, oksigjen medicinal'],
        ['V06', 'Preparate ushqyese të përgjithshme', 2, 'Cerebrolysin, Ketosteril'],
        ['V07', 'Produkte joterapeutike dhe tretës për barna', 2, 'Water for Injection, ujë steril për injeksion'],
        ['V08', 'Mjete kontrasti për ekzaminime radiologjike dhe MRI', 22, 'Ultravist, Gadovist, Omnipaque, Visipaque'],
      ],
    },
  ];

  const bySystem = new Map(ATC_SYSTEMS.map((system) => [system.code, system]));
  const subgroupLookup = new Map(ATC_SYSTEMS.flatMap((system) => system.subgroups.map((row) => [row[0], { system, row }])));
  const liveCounts = { systems: new Map(), subgroups: new Map() };
  const cache = new Map();

  let state = { query: '', system: '', subgroup: '', letter: '', offset: 0, total: 0, results: [], genericGroups: [] };
  let controller = null;
  let searchTimer = null;

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const formatPrice = (value) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat('sq-AL', { style: 'currency', currency: 'EUR' }).format(number)
      : '—';
  };

  function toast(message) {
    window.showToast?.(message);
  }

  function injectStyles() {
    if (document.querySelector('#atcCatalogStyles')) return;
    const style = document.createElement('style');
    style.id = 'atcCatalogStyles';
    style.textContent = `
      .atc-browser{display:grid;gap:14px}.atc-toolbar{display:grid;grid-template-columns:minmax(260px,1.35fr) minmax(220px,.65fr);gap:10px}.atc-toolbar input,.atc-toolbar select{width:100%;min-height:48px;padding:10px 13px;border:1px solid #cbd8e8;border-radius:11px;background:#fff;color:#17263b;font-size:13px}
      .atc-system-strip{display:flex;gap:7px;overflow-x:auto;padding:2px 0 7px;scrollbar-width:thin}.atc-system-button{display:grid;min-width:62px;min-height:53px;place-items:center;padding:6px 9px;border:1px solid #d2ddeb;border-radius:10px;background:#fff;color:#52657d}.atc-system-button strong{font-size:12px}.atc-system-button small{font-size:8px}.atc-system-button.active{border-color:#1765c1;background:#1765c1;color:#fff;box-shadow:0 7px 18px rgba(23,101,193,.18)}
      .atc-overview{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:13px;padding:14px;border:1px solid #cfe0f5;border-radius:13px;background:linear-gradient(135deg,#f3f8ff,#fff)}.atc-overview-code{display:grid;width:52px;height:52px;place-items:center;border-radius:12px;background:#1559ae;color:#fff;font-size:18px;font-weight:950}.atc-overview h3{margin:1px 0 5px;font-size:16px}.atc-overview p{margin:0;color:#607188;font-size:10px;line-height:1.55}.atc-memory{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:#e9f2ff;color:#1559ae;font-size:9px;font-weight:850}.atc-overview-count{text-align:right;color:#63758c;font-size:9px}.atc-overview-count strong{display:block;color:#123b70;font-size:17px}
      .atc-subgroup-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.atc-subgroup{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:9px;padding:10px;border:1px solid #d8e1ec;border-radius:10px;background:#fff;text-align:left}.atc-subgroup:hover{border-color:#99bce8;background:#fbfdff}.atc-subgroup.active{border-color:#1765c1;background:#eef5ff}.atc-subgroup-code{display:inline-grid;min-width:42px;place-items:center;padding:6px;border-radius:8px;background:#eaf2ff;color:#1559ae;font-size:9px;font-weight:950}.atc-subgroup strong{display:block;font-size:10px;line-height:1.35}.atc-subgroup small{display:block;margin-top:4px;color:#738298;font-size:8px;line-height:1.4}.atc-subgroup-count{color:#1559ae;font-size:8px;font-weight:900;white-space:nowrap}
      .atc-result-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.atc-alphabet{display:flex;gap:5px;overflow-x:auto;padding-bottom:4px}.atc-alphabet button{min-width:33px;height:33px;border:1px solid #d3deeb;border-radius:8px;background:#fff;color:#53677f;font-size:9px;font-weight:850}.atc-alphabet button.active{border-color:#1765c1;background:#1765c1;color:#fff}.atc-result-summary{color:#63748a;font-size:9px;font-weight:800}.atc-result-summary strong{color:#123b70}
      .atc-results{display:grid;gap:10px}.atc-drug-group{overflow:hidden;border:1px solid #d9e2ed;border-radius:12px;background:#fff}.atc-drug-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;background:#f7faff;border-bottom:1px solid #e1e8f1}.atc-drug-head strong{display:block;font-size:13px}.atc-drug-head small{display:block;margin-top:3px;color:#6a7b90;font-size:9px}.atc-code-pill{padding:5px 7px;border-radius:7px;background:#e7f1ff;color:#1559ae;font-size:8px;font-weight:950}.atc-product-list{display:grid}.atc-product{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 13px;border:0;border-bottom:1px solid #edf1f6;background:#fff;text-align:left}.atc-product:last-child{border-bottom:0}.atc-product:hover{background:#fbfdff}.atc-product strong{display:block;font-size:11px}.atc-product small{display:block;margin-top:3px;color:#6c7c90;font-size:8px;line-height:1.4}.atc-product-meta{text-align:right}.atc-product-meta b{display:block;color:#173c68;font-size:9px}.atc-product-meta span{display:block;margin-top:3px;color:#738198;font-size:8px}.atc-empty{padding:30px 15px;border:1px dashed #cbd7e6;border-radius:12px;background:#fafcff;text-align:center;color:#64758a;font-size:10px;line-height:1.6}.atc-load-more{justify-self:center;min-height:42px;padding:9px 15px;border:1px solid #1765c1;border-radius:9px;background:#1765c1;color:#fff;font-size:10px;font-weight:900}.atc-source-note{padding:10px 12px;border-left:3px solid #1765c1;border-radius:8px;background:#f2f7ff;color:#4b617c;font-size:9px;line-height:1.55}
      @media(max-width:900px){.atc-subgroup-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.atc-toolbar{grid-template-columns:1fr}.atc-overview{grid-template-columns:auto minmax(0,1fr)}.atc-overview-count{grid-column:1/-1;text-align:left}.atc-product{grid-template-columns:1fr}.atc-product-meta{text-align:left}}
      @media(max-width:580px){.atc-subgroup-grid{grid-template-columns:1fr}.atc-system-button{min-width:54px}.atc-overview{grid-template-columns:1fr}.atc-overview-code{width:44px;height:44px}.atc-product{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function countFor(code, fallback = 0) {
    if (code.length === 1) return liveCounts.systems.get(code) ?? fallback;
    return liveCounts.subgroups.get(code) ?? fallback;
  }

  function selectedAtc() {
    return state.subgroup || state.system;
  }

  function currentSystem() {
    return bySystem.get(state.system) || null;
  }

  function openBrowser(initialAtc = '') {
    if (typeof window.openModal !== 'function') {
      toast('Moduli ATC nuk është ende gati. Rifresko faqen.');
      return;
    }

    const prefix = String(initialAtc || '').toUpperCase();
    state = {
      query: '',
      system: prefix ? prefix.charAt(0) : '',
      subgroup: prefix.length === 3 ? prefix : '',
      letter: '',
      offset: 0,
      total: 0,
      results: [],
      genericGroups: [],
    };

    window.openModal({
      title: 'Barnat sipas sistemit ATC',
      subtitle: 'Kërko dhe filtro katalogun zyrtar sipas organit/sistemit, nën-grupit ATC, substancës aktive ose emrit tregtar.',
      kicker: 'KATALOGU ATC',
      body: `
        <div class="atc-browser" id="atcBrowser">
          <div class="atc-toolbar">
            <input id="atcSearch" type="search" placeholder="Kërko barin, substancën, emrin tregtar, ATC-në, prodhuesin…" autocomplete="off" autofocus>
            <select id="atcSystemSelect" aria-label="Zgjidh sistemin ATC"><option value="">Të gjitha sistemet ATC</option>${ATC_SYSTEMS.map((system) => `<option value="${system.code}">${system.code} · ${escapeHTML(system.title)}</option>`).join('')}</select>
          </div>
          <div class="atc-system-strip" id="atcSystemStrip"></div>
          <div id="atcSystemOverview"></div>
          <div class="atc-subgroup-grid" id="atcSubgroups"></div>
          <div class="atc-result-tools"><div class="atc-alphabet" id="atcAlphabet"></div><div class="atc-result-summary" id="atcResultSummary">Duke ngarkuar…</div></div>
          <div class="atc-results" id="atcResults"><div class="atc-empty">Duke u lidhur me katalogun e produkteve medicinale…</div></div>
          <button class="atc-load-more" id="atcLoadMore" type="button" hidden>Shfaq më shumë</button>
          <div class="atc-source-note">Klasifikimi ATC organizon produktet sipas sistemit ku veprojnë. Prania në një grup nuk konfirmon automatikisht indikacionin, dozën ose përshtatshmërinë për pacientin.</div>
        </div>`,
    });

    bindUI();
    renderStructure();
    loadMeta();
    loadResults(true);
  }

  function bindUI() {
    const search = document.querySelector('#atcSearch');
    const select = document.querySelector('#atcSystemSelect');
    const loadMore = document.querySelector('#atcLoadMore');

    if (select) select.value = state.system;
    search?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      state.query = search.value.trim();
      searchTimer = setTimeout(() => loadResults(true), SEARCH_DELAY);
    });
    select?.addEventListener('change', () => {
      state.system = select.value;
      state.subgroup = '';
      renderStructure();
      loadResults(true);
    });
    loadMore?.addEventListener('click', () => loadResults(false));
  }

  function renderStructure() {
    renderSystems();
    renderOverview();
    renderSubgroups();
    renderAlphabet();
  }

  function renderSystems() {
    const strip = document.querySelector('#atcSystemStrip');
    if (!strip) return;
    strip.innerHTML = `<button class="atc-system-button ${state.system ? '' : 'active'}" type="button" data-atc-system=""><strong>Të gjitha</strong><small>4,006</small></button>` + ATC_SYSTEMS.map((system) => `
      <button class="atc-system-button ${state.system === system.code ? 'active' : ''}" type="button" data-atc-system="${system.code}"><strong>${system.code}</strong><small>${countFor(system.code, '') || system.short}</small></button>`).join('');
    strip.querySelectorAll('[data-atc-system]').forEach((button) => {
      button.addEventListener('click', () => {
        state.system = button.dataset.atcSystem;
        state.subgroup = '';
        const select = document.querySelector('#atcSystemSelect');
        if (select) select.value = state.system;
        renderStructure();
        loadResults(true);
      });
    });
  }

  function renderOverview() {
    const container = document.querySelector('#atcSystemOverview');
    if (!container) return;
    const system = currentSystem();
    if (!system) {
      container.innerHTML = `<div class="atc-overview"><span class="atc-overview-code">ATC</span><div><h3>Të gjitha sistemet anatomike</h3><p>Zgjidh një shkronjë ATC për të parë nën-grupet dhe përshkrimin klinik të sistemit.</p><span class="atc-memory">A · B · C · D · G · H · J · L · M · N · P · R · S · V</span></div><div class="atc-overview-count"><strong>4,006</strong>produkte në katalog</div></div>`;
      return;
    }
    container.innerHTML = `<div class="atc-overview"><span class="atc-overview-code">${system.code}</span><div><h3>${escapeHTML(system.title)}</h3><p>${escapeHTML(system.description)}</p><span class="atc-memory">${escapeHTML(system.memory)}</span></div><div class="atc-overview-count"><strong>${Number(countFor(system.code, 0)).toLocaleString('sq-AL')}</strong>produkte aktive</div></div>`;
  }

  function renderSubgroups() {
    const container = document.querySelector('#atcSubgroups');
    if (!container) return;
    const system = currentSystem();
    if (!system) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = system.subgroups.map(([code, name, referenceCount, examples]) => `
      <button class="atc-subgroup ${state.subgroup === code ? 'active' : ''}" type="button" data-atc-subgroup="${code}">
        <span class="atc-subgroup-code">${code}</span>
        <span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(examples)}</small></span>
        <span class="atc-subgroup-count">${Number(countFor(code, referenceCount)).toLocaleString('sq-AL')}</span>
      </button>`).join('');
    container.querySelectorAll('[data-atc-subgroup]').forEach((button) => {
      button.addEventListener('click', () => {
        state.subgroup = state.subgroup === button.dataset.atcSubgroup ? '' : button.dataset.atcSubgroup;
        renderStructure();
        loadResults(true);
      });
    });
  }

  function renderAlphabet() {
    const container = document.querySelector('#atcAlphabet');
    if (!container) return;
    container.innerHTML = `<button class="${state.letter ? '' : 'active'}" type="button" data-atc-letter="">Të gjitha</button>` + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `<button class="${state.letter === letter ? 'active' : ''}" type="button" data-atc-letter="${letter}">${letter}</button>`).join('');
    container.querySelectorAll('[data-atc-letter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.letter = button.dataset.atcLetter;
        renderAlphabet();
        loadResults(true);
      });
    });
  }

  async function loadMeta() {
    try {
      const response = await fetch(`${API_URL}?mode=meta`, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      (data.systems || []).forEach((row) => liveCounts.systems.set(row.code, Number(row.count || 0)));
      (data.subgroups || []).forEach((row) => liveCounts.subgroups.set(row.code, Number(row.count || 0)));
      renderStructure();
    } catch {
      // Reference counts remain available when live metadata cannot load.
    }
  }

  function requestKey() {
    return JSON.stringify({ q: normalize(state.query), atc: selectedAtc(), letter: state.letter, offset: state.offset });
  }

  async function loadResults(reset) {
    if (!document.querySelector('#atcBrowser')) return;
    if (reset) {
      state.offset = 0;
      state.results = [];
      state.genericGroups = [];
      document.querySelector('#atcResults').innerHTML = '<div class="atc-empty">Duke filtruar katalogun…</div>';
    }

    const key = requestKey();
    let data = cache.get(key);
    if (!data) {
      controller?.abort();
      controller = new AbortController();
      const params = new URLSearchParams({ mode: 'browse', limit: String(PAGE_SIZE), offset: String(state.offset) });
      if (state.query) params.set('q', state.query);
      if (selectedAtc()) params.set('atc', selectedAtc());
      if (state.letter) params.set('letter', state.letter);
      try {
        const response = await fetch(`${API_URL}?${params}`, {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`API ${response.status}`);
        data = await response.json();
        cache.set(key, data);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        document.querySelector('#atcResults').innerHTML = '<div class="atc-empty"><strong>Katalogu ATC nuk u arrit.</strong><br>Kontrollo lidhjen Vercel → Neon dhe provo përsëri.</div>';
        document.querySelector('#atcResultSummary').textContent = 'Lidhja me databazën dështoi';
        return;
      }
    }

    state.total = Number(data.total || 0);
    state.genericGroups = data.genericGroups || [];
    state.results = reset ? (data.results || []) : [...state.results, ...(data.results || [])];
    state.offset = state.results.length;
    renderResults();
  }

  function renderResults() {
    const container = document.querySelector('#atcResults');
    const summary = document.querySelector('#atcResultSummary');
    const loadMore = document.querySelector('#atcLoadMore');
    if (!container || !summary || !loadMore) return;

    const atcLabel = state.subgroup
      ? `${state.subgroup} · ${subgroupLookup.get(state.subgroup)?.row?.[1] || ''}`
      : currentSystem()
        ? `${state.system} · ${currentSystem().title}`
        : 'Të gjitha sistemet';
    summary.innerHTML = `<strong>${state.total.toLocaleString('sq-AL')}</strong> produkte · ${escapeHTML(atcLabel)}${state.letter ? ` · shkronja ${state.letter}` : ''}`;

    if (!state.results.length) {
      container.innerHTML = '<div class="atc-empty"><strong>Nuk u gjet asnjë bar.</strong><br>Ndrysho kërkimin, shkronjën ose nën-grupin ATC.</div>';
      loadMore.hidden = true;
      return;
    }

    const totalsByDrug = new Map((state.genericGroups || []).map((row) => [String(row.drug_id || row.generic_name), row]));
    const grouped = new Map();
    state.results.forEach((product) => {
      const key = String(product.drug_id || `${product.generic_name}|${product.atc_code}`);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(product);
    });

    container.innerHTML = [...grouped.entries()].map(([key, products]) => {
      const first = products[0];
      const genericMeta = totalsByDrug.get(key);
      const productCount = Number(genericMeta?.product_count || products.length);
      return `<section class="atc-drug-group">
        <header class="atc-drug-head"><div><strong>${escapeHTML(first.generic_name || first.active_substance || 'Bar')}</strong><small>${productCount} produkte · ${escapeHTML((genericMeta?.forms || []).slice(0, 4).join(' · ') || first.pharmaceutical_form || '')}</small></div><span class="atc-code-pill">${escapeHTML(first.atc_code || 'ATC')}</span></header>
        <div class="atc-product-list">${products.map((product) => `
          <button class="atc-product" type="button" data-atc-product="${escapeHTML(product.id)}">
            <span><strong>${escapeHTML(product.trade_name)}</strong><small>${escapeHTML(product.active_substance || product.generic_name || '')}</small></span>
            <span><strong>${escapeHTML([product.strength_text, product.pharmaceutical_form].filter(Boolean).join(' · ') || '—')}</strong><small>${escapeHTML([product.package_size, product.manufacturer].filter(Boolean).join(' · ') || '')}</small></span>
            <span class="atc-product-meta"><b>${escapeHTML(formatPrice(product.retail_price))}</b><span>${escapeHTML(product.product_status || 'Produkt i listuar')}</span></span>
          </button>`).join('')}</div>
      </section>`;
    }).join('');

    container.querySelectorAll('[data-atc-product]').forEach((button) => {
      button.addEventListener('click', () => openProduct(button.dataset.atcProduct));
    });
    loadMore.hidden = state.results.length >= state.total;
  }

  function openProduct(id) {
    window.closeModal?.();
    if (window.DozaKSProductCatalog?.openProduct) {
      window.DozaKSProductCatalog.openProduct(id);
      return;
    }
    const input = document.querySelector('#searchInput');
    if (input) {
      input.value = id;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function interceptNavigation(event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const name = action.dataset.action;
    if (name !== 'drugs' && name !== 'antibiotics') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openBrowser(name === 'antibiotics' ? 'J01' : '');
  }

  function start() {
    injectStyles();
    document.addEventListener('click', interceptNavigation, true);
    window.DozaKSATCCatalog = { open: openBrowser, systems: ATC_SYSTEMS };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

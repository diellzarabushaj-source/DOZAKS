const drugCatalog = [
  {
    name: "Amoxicillin",
    type: "generic",
    group: "Antibiotik – Penicilina",
    indications: "Infeksione të rrugëve të frymëmarrjes, ORL, urinare, lëkurës dhe indeve të buta.",
    forms: ["Tableta", "Kapsula", "Suspension", "IV"],
    aliases: ["amoksicilin", "amoxicilin", "amoksicillina", "amoxil"]
  },
  {
    name: "Paracetamol",
    type: "generic",
    group: "Analgjezik / Antipiretik",
    indications: "Dhimbje dhe temperaturë. Përdorimi duhet të përshtatet sipas moshës, peshës dhe faktorëve klinikë.",
    forms: ["Tableta", "Shurup", "Supozitor", "IV"],
    aliases: ["acetaminophen", "paracetamoll", "temperaturë"]
  },
  {
    name: "Ibuprofen",
    type: "generic",
    group: "Analgjezik / NSAID",
    indications: "Dhimbje, temperaturë dhe procese inflamatore, pas vlerësimit të kundërindikacioneve.",
    forms: ["Tableta", "Kapsula", "Suspension"],
    aliases: ["brufen", "nurofen"]
  },
  {
    name: "Metronidazole",
    type: "generic",
    group: "Antiprotozoal / Antibiotik",
    indications: "Infeksione të caktuara anaerobe dhe protozoare, vetëm sipas indikacionit klinik.",
    forms: ["Tableta", "Suspension", "IV"],
    aliases: ["metronidazol", "flagyl"]
  },
  {
    name: "Omeprazole",
    type: "generic",
    group: "Frenues i pompës protonike",
    indications: "Gjendje të lidhura me aciditetin gastrik, sipas diagnozës dhe kohëzgjatjes së përcaktuar.",
    forms: ["Kapsula", "Tableta", "IV"],
    aliases: ["omeprazol", "losec"]
  },
  {
    name: "Salbutamol",
    type: "generic",
    group: "Bronkodilatator",
    indications: "Bronkospazëm dhe gjendje obstruktive të rrugëve të frymëmarrjes.",
    forms: ["Inhalator", "Nebulizim", "Tableta"],
    aliases: ["ventolin", "salbutamoll"]
  },
  {
    name: "Ceftriaxone",
    type: "generic",
    group: "Antibiotik – Cefalosporinë",
    indications: "Infeksione bakteriale të përzgjedhura sipas vlerësimit klinik dhe mikrobiologjik.",
    forms: ["IM", "IV"],
    aliases: ["ceftriakson", "rocephin"]
  },
  {
    name: "Ondansetron",
    type: "generic",
    group: "Antiemetik",
    indications: "Nauze dhe të vjella në indikacione të caktuara, me vlerësim të rrezikut të QT.",
    forms: ["Tableta", "ODT", "IV"],
    aliases: ["ondansetron", "zofran"]
  },
  {
    name: "Augmentin",
    type: "brand",
    group: "Emër tregtar – amoxicillin/clavulanate",
    indications: "Kërko substancën aktive dhe indikacionin për të parë të dhënat e verifikuara.",
    forms: ["Tableta", "Suspension", "IV"],
    aliases: ["amoxicillin clavulanate", "amoksicilin klavulanat"]
  }
];

const clinicalIndex = [
  { name: "Dhimbje fyti", type: "symptom", detail: "Simptomë – hap vlerësimin diferencial", icon: "bi-thermometer-half" },
  { name: "Temperaturë te fëmijët", type: "symptom", detail: "Simptomë – vlerësim sipas moshës", icon: "bi-thermometer-high" },
  { name: "Dhimbje barku", type: "symptom", detail: "Simptomë – kontrollo shenjat alarmuese", icon: "bi-activity" },
  { name: "Pneumoni e komunitetit", type: "diagnosis", detail: "Diagnozë – algoritëm klinik", icon: "bi-lungs" },
  { name: "Infeksion urinar", type: "diagnosis", detail: "Diagnozë – klasifikim dhe vlerësim", icon: "bi-droplet" },
  { name: "Hipertension", type: "diagnosis", detail: "Diagnozë – menaxhim dhe monitorim", icon: "bi-heart-pulse" },
  { name: "Antibiotikët", type: "group", detail: "Grup terapeutik", icon: "bi-capsule" },
  { name: "Antiemetikët", type: "group", detail: "Grup terapeutik", icon: "bi-capsule-pill" }
];

const allSearchItems = [
  ...drugCatalog.map((drug) => ({
    ...drug,
    detail: drug.group,
    icon: drug.type === "brand" ? "bi-box-seam" : "bi-capsule"
  })),
  ...clinicalIndex
];

const drugRows = {
  Amoxicillin: ["Faringit / Tonsilit", "Sinuzit akut", "Otit media akut", "Infeksion urinar"],
  Paracetamol: ["Temperaturë", "Dhimbje e lehtë–mesatare", "Kujdes pediatrik", "Përdorim IV"],
  Ibuprofen: ["Dhimbje inflamatore", "Temperaturë", "Dismenorre", "Gjendje muskuloskeletore"],
  Metronidazole: ["Infeksione anaerobe", "Protozoa", "Infeksione intraabdominale", "Indikacione të tjera"],
  Omeprazole: ["Refluks gastroezofageal", "Ulçerë peptike", "Gastroprotekcion", "Përdorim IV"],
  Salbutamol: ["Bronkospazëm", "Astma akute", "Nebulizim", "Inhalim"],
  Ceftriaxone: ["Infeksione respiratore", "Infeksione të rënda", "Infeksione urinare", "Indikacione të tjera"],
  Ondansetron: ["Nauze / të vjella", "Pas operacionit", "Përdorim oral", "Përdorim IV"],
  Augmentin: ["Infeksione respiratore", "Infeksione ORL", "Infeksione të lëkurës", "Infeksione të tjera"]
};

const searchInput = document.querySelector("#searchInput");
const searchForm = document.querySelector("#searchForm");
const suggestions = document.querySelector("#searchSuggestions");
const filterButtons = [...document.querySelectorAll(".filter-chip")];
const toast = document.querySelector("#toast");
const advancedModal = document.querySelector("#advancedModal");
const calculatorModal = document.querySelector("#calculatorModal");
const sidebar = document.querySelector("#sidebar");
const sidebarBackdrop = document.querySelector("#sidebarBackdrop");
let activeFilter = "all";
let highlightedSuggestion = -1;
let toastTimer;

function normalize(value) {
  return value
    .toLocaleLowerCase("sq")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function showToast(message, icon = "bi-check-circle-fill") {
  window.clearTimeout(toastTimer);
  toast.querySelector("i").className = `bi ${icon}`;
  toast.querySelector("span").textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function matchesFilter(item) {
  return activeFilter === "all" || item.type === activeFilter;
}

function scoreItem(item, rawQuery) {
  const query = normalize(rawQuery);
  const name = normalize(item.name);
  const aliases = (item.aliases || []).map(normalize);
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (aliases.some((alias) => alias === query)) return 75;
  if (name.includes(query)) return 60;
  if (aliases.some((alias) => alias.includes(query) || query.includes(alias))) return 50;
  if (normalize(item.detail || "").includes(query)) return 30;
  return 0;
}

function getSearchResults(rawQuery) {
  if (!rawQuery.trim()) return [];
  return allSearchItems
    .filter(matchesFilter)
    .map((item) => ({ ...item, score: scoreItem(item, rawQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);
}

function renderSuggestions() {
  const results = getSearchResults(searchInput.value);
  highlightedSuggestion = -1;
  if (!results.length) {
    suggestions.classList.remove("open");
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = results
    .map(
      (item, index) => `
        <button type="button" role="option" data-result-index="${index}" data-name="${item.name}">
          <i class="bi ${item.icon}"></i>
          <span><strong>${item.name}</strong><small>${item.detail || "Rezultat klinik"}</small></span>
          <em>${labelForType(item.type)}</em>
        </button>`
    )
    .join("");
  suggestions.classList.add("open");
}

function labelForType(type) {
  const labels = {
    generic: "Gjenerik",
    brand: "Tregtar",
    symptom: "Simptomë",
    diagnosis: "Diagnozë",
    group: "Grup"
  };
  return labels[type] || "Rezultat";
}

function addRecentSearch(value) {
  if (!value) return;
  const container = document.querySelector("#recentSearches");
  const existing = [...container.querySelectorAll("button")].find(
    (button) => normalize(button.dataset.query) === normalize(value)
  );
  if (existing) existing.remove();
  const button = document.createElement("button");
  button.dataset.query = value;
  button.innerHTML = `<i class="bi bi-search"></i><span>${value}</span><time>Tani</time>`;
  button.addEventListener("click", () => runSearch(value));
  container.prepend(button);
  while (container.children.length > 5) container.lastElementChild.remove();

  const history = JSON.parse(localStorage.getItem("dozaks-history") || "[]");
  const next = [value, ...history.filter((item) => normalize(item) !== normalize(value))].slice(0, 20);
  localStorage.setItem("dozaks-history", JSON.stringify(next));
}

function updateDrugPanel(drug) {
  document.querySelector("#drugName").textContent = drug.name;
  document.querySelector("#drugGroup").textContent = drug.group;
  document.querySelector("#drugIndications").textContent = drug.indications;

  const forms = document.querySelector("#drugForms");
  forms.innerHTML = drug.forms
    .map((form, index) => `<button class="${index === 0 ? "active" : ""}"><i class="bi bi-capsule"></i>${form}</button>`)
    .join("");
  bindFormButtons();

  const rows = drugRows[drug.name] || ["Indikacioni klinik", "Alternativa", "Rregullimi renal", "Monitorimi"];
  document.querySelector("#doseTableBody").innerHTML = rows
    .map(
      (row) => `<tr><td>${row}</td><td colspan="2">Doza do të publikohet pas verifikimit editorial</td><td><span class="status-review">Në verifikim</span></td></tr>`
    )
    .join("");

  document.querySelector("#drugPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

function runSearch(value = searchInput.value) {
  const query = value.trim();
  if (!query) {
    showToast("Shkruaj një simptomë, diagnozë ose bar për të kërkuar.", "bi-info-circle-fill");
    searchInput.focus();
    return;
  }
  searchInput.value = query;
  suggestions.classList.remove("open");
  addRecentSearch(query);

  const result = getSearchResults(query)[0];
  if (!result) {
    showToast(`Nuk u gjet rezultat i saktë për “${query}”. Provo një emër tjetër.`, "bi-search");
    return;
  }

  if (result.type === "generic" || result.type === "brand") {
    const drug = drugCatalog.find((item) => item.name === result.name);
    updateDrugPanel(drug);
    showToast(`${drug.name} u hap. Të dhënat e dozimit janë në verifikim editorial.`);
  } else {
    showToast(`${result.name}: moduli klinik do të lidhet në fazën e ardhshme.`, "bi-info-circle-fill");
  }
}

searchInput.addEventListener("input", renderSuggestions);
searchInput.addEventListener("focus", renderSuggestions);
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

searchInput.addEventListener("keydown", (event) => {
  const items = [...suggestions.querySelectorAll("button")];
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightedSuggestion = (highlightedSuggestion + 1) % items.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightedSuggestion = (highlightedSuggestion - 1 + items.length) % items.length;
  } else if (event.key === "Enter" && highlightedSuggestion >= 0) {
    event.preventDefault();
    runSearch(items[highlightedSuggestion].dataset.name);
    return;
  } else if (event.key === "Escape") {
    suggestions.classList.remove("open");
    return;
  } else {
    return;
  }
  items.forEach((item, index) => item.classList.toggle("active", index === highlightedSuggestion));
});

suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-name]");
  if (button) runSearch(button.dataset.name);
});

document.addEventListener("click", (event) => {
  if (!searchForm.contains(event.target)) suggestions.classList.remove("open");
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderSuggestions();
  });
});

function bindFormButtons() {
  document.querySelectorAll("#drugForms button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#drugForms button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      showToast(`Forma “${button.textContent.trim()}” u zgjodh.`);
    });
  });
}
bindFormButtons();

document.querySelectorAll("[data-drug]").forEach((button) => {
  button.addEventListener("click", () => runSearch(button.dataset.drug));
});

document.querySelectorAll("#recentSearches [data-query]").forEach((button) => {
  button.addEventListener("click", () => runSearch(button.dataset.query));
});

document.querySelectorAll("[data-protocol]").forEach((button) => {
  button.addEventListener("click", () => {
    showToast(`${button.dataset.protocol}: protokolli është planifikuar për fazën e dytë.`, "bi-bell-fill");
  });
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.querySelector("strong").textContent;
    if (button.dataset.category === "quick-dose") searchInput.focus();
    showToast(`${name}: seksioni u përzgjodh.`, "bi-grid-fill");
  });
});

document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".sidebar .nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    showToast(`${button.textContent.trim()}: moduli do të zgjerohet në fazën e ardhshme.`, "bi-layout-text-sidebar-reverse");
    closeSidebar();
  });
});

const favoriteButton = document.querySelector("#favoriteDrug");
favoriteButton.addEventListener("click", () => {
  favoriteButton.classList.toggle("saved");
  const drugName = document.querySelector("#drugName").textContent;
  const saved = favoriteButton.classList.contains("saved");
  localStorage.setItem("dozaks-favorite", saved ? drugName : "");
  showToast(saved ? `${drugName} u ruajt.` : `${drugName} u hoq nga të ruajturat.`);
});

document.querySelector("#savedButton").addEventListener("click", () => {
  const saved = localStorage.getItem("dozaks-favorite");
  showToast(saved ? `Bari i ruajtur: ${saved}` : "Nuk ke ruajtur ende asnjë bar.", "bi-bookmark-fill");
});

document.querySelector("#historyButton").addEventListener("click", () => {
  const history = JSON.parse(localStorage.getItem("dozaks-history") || "[]");
  showToast(history.length ? `Historiku përmban ${history.length} kërkime.` : "Historiku është ende bosh.", "bi-clock-history");
});

document.querySelector("#notificationButton").addEventListener("click", () => {
  showToast("3 njoftime editoriale janë në pritje të verifikimit.", "bi-bell-fill");
});

document.querySelectorAll("[data-show-all]").forEach((button) => {
  button.addEventListener("click", () => showToast("Pamja e plotë do të shtohet në fazën e ardhshme.", "bi-list-ul"));
});

document.querySelectorAll("[data-drug-tab]").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.textContent}: përmbajtja është në verifikim editorial.`, "bi-shield-check"));
});

document.querySelector("#drugDetailsButton").addEventListener("click", () => {
  showToast("Faqja e detajuar e barit do të ndërtohet në fazën e ardhshme.", "bi-file-earmark-medical-fill");
});

function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("open");
  document.body.style.overflow = "";
}

document.querySelector("#menuButton").addEventListener("click", openSidebar);
sidebarBackdrop.addEventListener("click", closeSidebar);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

document.querySelector("#advancedButton").addEventListener("click", () => advancedModal.showModal());
document.querySelector("#applyAdvanced").addEventListener("click", (event) => {
  event.preventDefault();
  const data = new FormData(document.querySelector("#advancedForm"));
  const age = data.get("age");
  const weight = data.get("weight");
  advancedModal.close();
  showToast(`Filtrat u aplikuan${age ? ` · mosha ${age}` : ""}${weight ? ` · ${weight} kg` : ""}.`);
});

const calculatorDefinitions = {
  mgkg: {
    title: "Kalkulator mg/kg",
    subtitle: "Llogarit vetëm konvertimin aritmetik nga një dozë e përshkruar në mg/kg.",
    fields: [
      ["weight", "Pesha (kg)", "number", "p.sh. 18"],
      ["dose", "Doza e përcaktuar (mg/kg)", "number", "p.sh. 10"]
    ],
    calculate(values) {
      const weight = Number(values.weight);
      const dose = Number(values.dose);
      if (!(weight > 0) || !(dose > 0)) return null;
      return `<strong>${(weight * dose).toFixed(1)} mg për dozë</strong><br>Kjo është vetëm llogaritje aritmetike, jo rekomandim i dozës.`;
    }
  },
  infusion: {
    title: "Kalkulator infuzioni",
    subtitle: "Llogarit shpejtësinë nga vëllimi dhe koha e vendosur nga profesionisti.",
    fields: [
      ["volume", "Vëllimi (mL)", "number", "p.sh. 500"],
      ["hours", "Koha (orë)", "number", "p.sh. 4"]
    ],
    calculate(values) {
      const volume = Number(values.volume);
      const hours = Number(values.hours);
      if (!(volume > 0) || !(hours > 0)) return null;
      return `<strong>${(volume / hours).toFixed(1)} mL/orë</strong><br>Verifiko pajisjen, protokollin dhe kufizimet e pacientit.`;
    }
  },
  bsa: {
    title: "Kalkulator BSA",
    subtitle: "Vlerësim aritmetik i sipërfaqes trupore me formulën Mosteller.",
    fields: [
      ["weight", "Pesha (kg)", "number", "p.sh. 70"],
      ["height", "Gjatësia (cm)", "number", "p.sh. 170"]
    ],
    calculate(values) {
      const weight = Number(values.weight);
      const height = Number(values.height);
      if (!(weight > 0) || !(height > 0)) return null;
      return `<strong>${Math.sqrt((weight * height) / 3600).toFixed(2)} m²</strong><br>Rezultat orientues aritmetik; verifiko para përdorimit klinik.`;
    }
  },
  renal: {
    title: "Kalkulator CrCl / eGFR",
    subtitle: "Ky modul kërkon validim klinik dhe nuk është aktivizuar ende.",
    fields: [
      ["age", "Mosha", "number", "p.sh. 65"],
      ["creatinine", "Kreatinina", "number", "Vendos vlerën"]
    ],
    calculate() {
      return `<strong>Në verifikim klinik.</strong><br>Nuk jepet rezultat derisa njësitë, formula dhe kufizimet të validohen nga ekipi editorial.`;
    }
  },
  scores: {
    title: "Skorë & Indekse",
    subtitle: "Modulet e skorimit do të shtohen pas validimit klinik.",
    fields: [],
    calculate() {
      return `<strong>Në zhvillim.</strong><br>Skorët klinike do të publikohen me burim, version dhe datë përditësimi.`;
    }
  }
};

let activeCalculator = "mgkg";
function openCalculator(type) {
  activeCalculator = calculatorDefinitions[type] ? type : "mgkg";
  const config = calculatorDefinitions[activeCalculator];
  document.querySelector("#calculatorTitle").textContent = config.title;
  document.querySelector("#calculatorSubtitle").textContent = config.subtitle;
  const fields = document.querySelector("#calculatorFields");
  fields.className = "calculator-fields";
  fields.innerHTML = config.fields
    .map(
      ([name, label, inputType, placeholder]) => `<label>${label}<input name="${name}" type="${inputType}" min="0" step="any" placeholder="${placeholder}" /></label>`
    )
    .join("");
  document.querySelector("#calculatorResult").textContent = "Rezultati do të shfaqet këtu.";
  calculatorModal.showModal();
}

document.querySelectorAll("[data-calculator]").forEach((button) => {
  button.addEventListener("click", () => openCalculator(button.dataset.calculator));
});

document.querySelector("#calculateButton").addEventListener("click", () => {
  const config = calculatorDefinitions[activeCalculator];
  const formData = new FormData(document.querySelector("#calculatorForm"));
  const values = Object.fromEntries(formData.entries());
  const result = config.calculate(values);
  document.querySelector("#calculatorResult").innerHTML = result || "Kontrollo fushat dhe vendos vlera më të mëdha se zero.";
});

const savedDrug = localStorage.getItem("dozaks-favorite");
if (savedDrug === document.querySelector("#drugName").textContent) favoriteButton.classList.add("saved");

document.querySelector("#updatedDate").textContent = new Intl.DateTimeFormat("sq-AL", {
  day: "2-digit",
  month: "long",
  year: "numeric"
}).format(new Date());

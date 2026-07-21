'use strict';

const catalog = [
  {id:'amoxicillin',name:'Amoxicillin',type:'generic',typeLabel:'Bar gjenerik',group:'Antibiotik — Penicilina',category:'antibiotic',forms:['Tableta','Kapsula','Suspension','IV'],aliases:['amoksicilin','amoxicilin','amoxil'],indications:['Infeksione ORL','Infeksione respiratore','Infeksione urinare'],notice:'Dozat publikohen vetëm pas verifikimit sipas indikacionit, moshës, peshës dhe funksionit renal.'},
  {id:'augmentin',name:'Augmentin',type:'brand',typeLabel:'Emër tregtar',group:'Amoxicillin + clavulanate',category:'antibiotic',forms:['Tableta','Suspension','IV'],aliases:['amoksiklav','co-amoxiclav','amoxicillin clavulanate'],indications:['Infeksione ORL','Infeksione respiratore','Infeksione të lëkurës'],notice:'Emri tregtar lidhet me substancën aktive; preparati dhe përqendrimi duhet të verifikohen.'},
  {id:'paracetamol',name:'Paracetamol',type:'generic',typeLabel:'Bar gjenerik',group:'Analgjezik / Antipiretik',category:'analgesic',forms:['Tableta','Shurup','Supozitor','IV'],aliases:['acetaminophen','temperaturë','paracetamoll'],indications:['Temperaturë','Dhimbje e lehtë–mesatare','Përdorim pediatrik'],notice:'Kujdes me dozën totale ditore dhe preparatet e kombinuara; vlerat numerike janë në verifikim editorial.'},
  {id:'ibuprofen',name:'Ibuprofen',type:'generic',typeLabel:'Bar gjenerik',group:'NSAID / Analgjezik',category:'analgesic',forms:['Tableta','Kapsula','Suspension'],aliases:['brufen','nurofen'],indications:['Dhimbje inflamatore','Temperaturë','Dismenorre'],notice:'Kontrollo kundërindikacionet gastrointestinale, renale dhe kardiovaskulare para përdorimit.'},
  {id:'metronidazole',name:'Metronidazole',type:'generic',typeLabel:'Bar gjenerik',group:'Antimikrobik',category:'antibiotic',forms:['Tableta','Suspension','IV'],aliases:['metronidazol','flagyl'],indications:['Infeksione anaerobe','Infeksione intraabdominale','Protozoa'],notice:'Indikacioni, rruga dhe kohëzgjatja kërkojnë verifikim klinik dhe mikrobiologjik.'},
  {id:'omeprazole',name:'Omeprazole',type:'generic',typeLabel:'Bar gjenerik',group:'Frenues i pompës protonike',category:'gastro',forms:['Kapsula','Tableta','IV'],aliases:['omeprazol','losec'],indications:['Refluks gastroezofageal','Ulçerë peptike','Gastroprotekcion'],notice:'Indikacioni dhe kohëzgjatja duhet të rivlerësohen; dozat janë në verifikim editorial.'},
  {id:'ondansetron',name:'Ondansetron',type:'generic',typeLabel:'Bar gjenerik',group:'Antiemetik',category:'antiemetic',forms:['Tableta','ODT','IV'],aliases:['zofran','ondansetron iv','ondosetron'],indications:['Nauze dhe të vjella','Pas operacionit','Përdorim IV'],notice:'Kërkohet vlerësim i QT, elektroliteve dhe interaksioneve para përdorimit.'},
  {id:'ceftriaxone',name:'Ceftriaxone',type:'generic',typeLabel:'Bar gjenerik',group:'Antibiotik — Cefalosporinë',category:'antibiotic',forms:['IM','IV'],aliases:['ceftriakson','rocephin'],indications:['Infeksione respiratore','Infeksione të rënda','Infeksione urinare'],notice:'Përdorimi duhet të bazohet në diagnozë, alergji, epidemiologji dhe kulturë kur është e mundur.'},
  {id:'salbutamol',name:'Salbutamol',type:'generic',typeLabel:'Bar gjenerik',group:'Bronkodilatator',category:'respiratory',forms:['Inhalator','Nebulizim'],aliases:['ventolin','salbutamoll'],indications:['Bronkospazëm','Astma akute','Sëmundje obstruktive'],notice:'Rruga, pajisja dhe reagimi klinik duhet të vlerësohen; dozat janë në verifikim editorial.'},
  {id:'furosemide',name:'Furosemide',type:'generic',typeLabel:'Bar gjenerik',group:'Diuretik i ansës',category:'cardio',forms:['Tableta','IV'],aliases:['furosemid','lasix'],indications:['Edemë','Kongjestion','Përdorim akut'],notice:'Monitoro statusin vëllimor, elektrolitet, presionin dhe funksionin renal.'},
  {id:'dexamethasone',name:'Dexamethasone',type:'generic',typeLabel:'Bar gjenerik',group:'Kortikosteroid',category:'steroid',forms:['Tableta','IM','IV'],aliases:['deksametazon','dexamethason'],indications:['Inflamacion','Alergji të caktuara','Indikacione urgjente'],notice:'Indikacioni, rruga dhe kohëzgjatja ndryshojnë ndjeshëm; verifiko protokollin përkatës.'},
  {id:'diazepam',name:'Diazepam',type:'generic',typeLabel:'Bar gjenerik',group:'Benzodiazepinë',category:'neurology',forms:['Tableta','Rektal','IV'],aliases:['diazeoam','valium'],indications:['Konvulsione','Agjitacion i përzgjedhur','Spazëm'],notice:'Bar me rrezik të lartë për sedacion dhe depresion respirator; përdor vetëm sipas protokollit.'}
];

const clinicalItems = [
  {id:'sore-throat-child',name:'Dhimbje fyti te fëmijët',type:'symptom',typeLabel:'Simptomë',group:'Algoritëm klinik',aliases:['dhimbje fyti','tonsilit','faringit'],summary:'Vlerësim i shenjave alarmuese, moshës dhe probabilitetit etiologjik.'},
  {id:'fever-child',name:'Temperaturë te fëmijët',type:'symptom',typeLabel:'Simptomë',group:'Vlerësim sipas moshës',aliases:['ethe','temperaturë fëmijë'],summary:'Modul i strukturuar sipas moshës, gjendjes së përgjithshme dhe shenjave alarmuese.'},
  {id:'abdominal-pain',name:'Dhimbje barku',type:'symptom',typeLabel:'Simptomë',group:'Diagnozë diferenciale',aliases:['dhimbje abdominale','abdomen'],summary:'Lokalizim, fillim, shenja peritoneale dhe diagnoza diferenciale.'},
  {id:'community-pneumonia',name:'Pneumoni e komunitetit',type:'diagnosis',typeLabel:'Diagnozë',group:'Udhëzues praktik',aliases:['pneumoni','cap'],summary:'Vlerësim i rëndesës, ekzaminimeve dhe trajtimit sipas protokollit.'},
  {id:'uti',name:'Infeksion urinar',type:'diagnosis',typeLabel:'Diagnozë',group:'Algoritëm klinik',aliases:['uti','cistit','pielonefrit'],summary:'Dallon cistitin, pielonefritin dhe faktorët komplikues.'},
  {id:'hypertension',name:'Hipertension',type:'diagnosis',typeLabel:'Diagnozë',group:'Menaxhim dhe monitorim',aliases:['tension i lartë','hta'],summary:'Konfirmim i matjes, dëmtim akut i organeve dhe plan monitorimi.'},
  {id:'antibiotics',name:'Antibiotikët',type:'group',typeLabel:'Grup terapeutik',group:'Përdorim racional',aliases:['antibiotik','antimikrobik'],summary:'Katalog sipas grupit, indikacionit dhe statusit të verifikimit.'},
  {id:'antiemetics',name:'Antiemetikët',type:'group',typeLabel:'Grup terapeutik',group:'Nauze dhe të vjella',aliases:['antiemetik','nauze'],summary:'Krahasim sipas indikacionit dhe faktorëve të sigurisë.'}
];

const emergencyItems = [
  {id:'anaphylaxis',name:'Anafilaksia',summary:'Strukturë ABCDE, aktivizim ekipi dhe dokumentim.'},
  {id:'status-epilepticus',name:'Status epileptik',summary:'Kohëmatje, mbështetje vitale dhe algoritëm institucional.'},
  {id:'hyperkalemia',name:'Hiperkalemia',summary:'Konfirmim, EKG, monitorim dhe trajtim sipas protokollit.'},
  {id:'hypoglycemia',name:'Hipoglikemia',summary:'Konfirmim i glukozës, trajtim dhe rivlerësim.'},
  {id:'sepsis',name:'Sepsa',summary:'Njohje e hershme, mostra, monitorim dhe eskalim.'},
  {id:'pulmonary-edema',name:'Edema pulmonare akute',summary:'Oksigjenim, monitorim dhe vlerësim i shkakut.'},
  {id:'tachycardia',name:'Takikardia',summary:'Stabiliteti hemodinamik, EKG dhe algoritmi përkatës.'},
  {id:'intoxications',name:'Intoksikimet',summary:'ABC, identifikim i toksidromit dhe kontakt me toksikologjinë.'}
];

const popularIds = ['paracetamol','amoxicillin','ibuprofen','metronidazole','omeprazole','salbutamol','ceftriaxone','ondansetron'];
const allItems = [...catalog, ...clinicalItems];
const state = {filter:'all',selectedId:'amoxicillin',highlightIndex:-1};

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value='') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const normalize = (value='') => String(value).toLocaleLowerCase('sq').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const store = {
  get(key, fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}},
  set(key, value){localStorage.setItem(key, JSON.stringify(value))}
};

const dom = {
  input:$('#searchInput'), suggestions:$('#suggestions'), toast:$('#toast'), modal:$('#modal'), modalBackdrop:$('#modalBackdrop'), modalBody:$('#modalBody'), modalTitle:$('#modalTitle'), modalSubtitle:$('#modalSubtitle'), modalKicker:$('#modalKicker'), modalFooter:$('#modalFooter'), sidebar:$('#sidebar'), sidebarBackdrop:$('#sidebarBackdrop')
};

function showToast(message){
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => dom.toast.classList.remove('show'), 3200);
}

function getFavorites(){return store.get('dozaks-favorites',[])}
function getHistory(){return store.get('dozaks-history',[])}
function getProfile(){return store.get('dozaks-profile',{name:'Profili i mjekut',role:'Profesionist shëndetësor',institution:'',initials:'MD'})}

function updateCounters(){
  $('#savedCount').textContent = getFavorites().length;
  const profile = getProfile();
  $('#profileName').textContent = profile.name || 'Profili i mjekut';
  $('#profileRole').textContent = profile.role || 'Profesionist shëndetësor';
  $('#profileAvatar').textContent = profile.initials || initialsFrom(profile.name);
}

function initialsFrom(name=''){const parts=name.trim().split(/\s+/).filter(Boolean);return (parts.slice(0,2).map(x=>x[0]).join('')||'MD').toUpperCase()}

function scoreItem(item, rawQuery){
  const query = normalize(rawQuery); if(!query) return 0;
  const name = normalize(item.name); const aliases = (item.aliases||[]).map(normalize); const haystack = normalize(`${item.group||''} ${item.summary||''}`);
  if(name === query) return 100;
  if(name.startsWith(query)) return 85;
  if(aliases.some(alias => alias === query)) return 80;
  if(name.includes(query)) return 65;
  if(aliases.some(alias => alias.includes(query) || query.includes(alias))) return 55;
  if(haystack.includes(query)) return 35;
  const queryTokens=query.split(/\s+/); const text=`${name} ${aliases.join(' ')} ${haystack}`;
  return queryTokens.every(token=>text.includes(token)) ? 25 : 0;
}

function getResults(query){
  return allItems
    .filter(item => state.filter === 'all' || item.type === state.filter)
    .map(item => ({...item,score:scoreItem(item,query)}))
    .filter(item => item.score > 0)
    .sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name,'sq'))
    .slice(0,8);
}

function renderSuggestions(){
  const results = getResults(dom.input.value);
  state.highlightIndex = -1;
  $('#clearSearch').classList.toggle('visible', Boolean(dom.input.value));
  if(!results.length){dom.suggestions.innerHTML='';dom.suggestions.classList.remove('open');return}
  dom.suggestions.innerHTML = results.map((item,index)=>`<button type="button" role="option" data-result-id="${escapeHTML(item.id)}" data-index="${index}"><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)}</small></span><span class="type">${escapeHTML(item.typeLabel)}</span></button>`).join('');
  dom.suggestions.classList.add('open');
}

function addHistory(item){
  const current = getHistory();
  const entry = {id:item.id,name:item.name,type:item.typeLabel,time:new Date().toISOString()};
  store.set('dozaks-history',[entry,...current.filter(x=>x.id!==item.id)].slice(0,30));
  renderRecent();
}

function findItem(idOrName){
  const normalized=normalize(idOrName);
  return allItems.find(item=>item.id===idOrName || normalize(item.name)===normalized || (item.aliases||[]).some(a=>normalize(a)===normalized));
}

function openItem(idOrName){
  const item = findItem(idOrName) || getResults(idOrName)[0];
  dom.suggestions.classList.remove('open');
  if(!item){showToast(`Nuk u gjet rezultat i saktë për “${idOrName}”.`);return}
  dom.input.value = item.name;
  $('#clearSearch').classList.add('visible');
  addHistory(item);
  if(['symptom','diagnosis','group'].includes(item.type)){openClinicalItem(item);return}
  state.selectedId=item.id;
  renderSelectedDrug();
  $('#drugPanel').scrollIntoView({behavior:'smooth',block:'center'});
  showToast(`${item.name} u hap.`);
}

function renderSelectedDrug(){
  const item = catalog.find(x=>x.id===state.selectedId) || catalog[0];
  $('#itemType').textContent = item.typeLabel.toUpperCase();
  $('#drugName').textContent = item.name;
  $('#drugGroup').textContent = item.group;
  $('#itemNotice').textContent = item.notice;
  $('#formChips').innerHTML = item.forms.map((form,index)=>`<button type="button" class="${index===0?'active':''}" data-form="${escapeHTML(form)}">${escapeHTML(form)}</button>`).join('');
  $('#doseRows').innerHTML = item.indications.map(indication=>`<tr><td>${escapeHTML(indication)}</td><td>—</td><td>—</td><td><span class="status">Në verifikim</span></td></tr>`).join('');
  const isSaved=getFavorites().includes(item.id);
  $('#favoriteButton').classList.toggle('saved',isSaved);
  $('#favoriteButton').textContent=isSaved?'★':'☆';
}

function renderRecent(){
  const history=getHistory().slice(0,5);
  $('#recentList').innerHTML = history.length ? history.map(entry=>`<button type="button" data-open-item="${escapeHTML(entry.id)}"><span>⌕ ${escapeHTML(entry.name)}</span><time>${formatRelative(entry.time)}</time></button>`).join('') : '<div class="empty-state">Kërkimet e tua do të shfaqen këtu.</div>';
}

function formatRelative(iso){
  const diff=Math.max(0,Date.now()-new Date(iso).getTime());
  const min=Math.floor(diff/60000); if(min<1)return'Tani'; if(min<60)return`Para ${min} min`;
  const h=Math.floor(min/60); if(h<24)return`Para ${h} orë`;
  return new Intl.DateTimeFormat('sq-AL',{day:'2-digit',month:'short'}).format(new Date(iso));
}

function renderPopular(){
  $('#popularList').innerHTML = popularIds.map((id,index)=>{const item=catalog.find(x=>x.id===id);return `<button type="button" data-open-item="${id}"><b>${index+1}</b><span>${escapeHTML(item.name)}</span><em class="pill-tag">${escapeHTML(item.group.split('—')[0].split('/')[0].trim())}</em></button>`}).join('');
}

function renderEmergencies(){
  $('#emergencyList').innerHTML = emergencyItems.slice(0,5).map(item=>`<button type="button" data-emergency="${item.id}"><span>! ${escapeHTML(item.name)}</span>→</button>`).join('');
}

function openModal({title,subtitle='',kicker='DOZAKS',body,footer=true}){
  dom.modalTitle.textContent=title; dom.modalSubtitle.textContent=subtitle; dom.modalKicker.textContent=kicker; dom.modalBody.innerHTML=body;
  dom.modalFooter.hidden=!footer; dom.modal.hidden=false; dom.modalBackdrop.hidden=false; document.body.classList.add('modal-open');
  requestAnimationFrame(()=>$('#modalClose').focus());
}
function closeModal(){dom.modal.hidden=true;dom.modalBackdrop.hidden=true;document.body.classList.remove('modal-open')}

function openDrugs(filterCategory=null){
  const drugs=filterCategory ? catalog.filter(x=>x.category===filterCategory) : catalog;
  openModal({title:filterCategory==='antibiotic'?'Antibiotikët':'Barnat A–Z',subtitle:'Kërko sipas emrit gjenerik, emrit tregtar ose grupit.',kicker:'KATALOGU',body:`
    <div class="module-toolbar"><input id="drugModuleSearch" type="search" placeholder="Kërko barin…" aria-label="Kërko barin"><select id="drugGroupFilter"><option value="all">Të gjitha grupet</option>${[...new Set(drugs.map(x=>x.category))].map(group=>`<option value="${group}">${groupLabel(group)}</option>`).join('')}</select></div>
    <div class="alphabet" id="alphabet"><button class="active" type="button" data-letter="all">Të gjitha</button>${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=>`<button type="button" data-letter="${l}">${l}</button>`).join('')}</div>
    <div class="module-list" id="drugModuleList"></div>`});
  const render=()=>{
    const q=normalize($('#drugModuleSearch').value); const group=$('#drugGroupFilter').value; const active=$('#alphabet .active')?.dataset.letter||'all';
    const list=drugs.filter(x=>(!q||normalize(`${x.name} ${x.group} ${(x.aliases||[]).join(' ')}`).includes(q))&&(group==='all'||x.category===group)&&(active==='all'||x.name.toUpperCase().startsWith(active)));
    $('#drugModuleList').innerHTML=list.length?list.map(item=>`<button type="button" data-open-item="${item.id}"><span>Rx</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)}</small></span><em>${escapeHTML(item.typeLabel)}</em></button>`).join(''):'<div class="empty-state">Nuk u gjet asnjë bar.</div>';
  };
  $('#drugModuleSearch').addEventListener('input',render); $('#drugGroupFilter').addEventListener('change',render); $('#alphabet').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('#alphabet button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()}); render();
}

function groupLabel(group){return({antibiotic:'Antibiotikë',analgesic:'Analgjezikë',gastro:'Gastroenterologji',antiemetic:'Antiemetikë',respiratory:'Respirator',cardio:'Kardiologji',steroid:'Kortikosteroide',neurology:'Neurologji'}[group]||group)}

function openDiagnoses(){
  openModal({title:'Diagnozat & simptomat',subtitle:'Zgjidh një modul klinik për të hapur strukturën e vlerësimit.',kicker:'REFERENCA',body:`<div class="module-toolbar"><input id="clinicalSearch" type="search" placeholder="Kërko diagnozë ose simptomë…"></div><div class="module-list" id="clinicalList"></div>`});
  const render=()=>{const q=normalize($('#clinicalSearch').value);const list=clinicalItems.filter(x=>!q||normalize(`${x.name} ${x.group} ${x.summary}`).includes(q));$('#clinicalList').innerHTML=list.map(item=>`<button type="button" data-clinical="${item.id}"><span>${item.type==='symptom'?'S':'D'}</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.summary)}</small></span><em>${escapeHTML(item.typeLabel)}</em></button>`).join('')};
  $('#clinicalSearch').addEventListener('input',render);render();
}

function openClinicalItem(item){
  addHistory(item);
  openModal({title:item.name,subtitle:item.group,kicker:item.typeLabel.toUpperCase(),body:`
    <div class="info-note">Ky modul organizon procesin e vlerësimit. Përmbajtja terapeutike dhe kriteret numerike publikohen vetëm pas verifikimit editorial.</div>
    <div class="checklist">
      <label><input type="checkbox"> <span>Konfirmo anamnezën e orientuar dhe kohëzgjatjen.</span></label>
      <label><input type="checkbox"> <span>Kontrollo shenjat alarmuese dhe stabilitetin klinik.</span></label>
      <label><input type="checkbox"> <span>Rishiko barnat, alergjitë, shtatzëninë dhe funksionin renal/hepatik.</span></label>
      <label><input type="checkbox"> <span>Dokumento diagnozën diferenciale dhe planin e rivlerësimit.</span></label>
    </div>
    <div class="clinical-warning">Nuk jepet terapi automatike pa konfirmim të diagnozës dhe pa burim të verifikuar.</div>`});
}

function openQuickDose(){
  openModal({title:'Doza të shpejta',subtitle:'Qasje e shpejtë te kartelat; vlerat numerike mbeten të bllokuara deri në verifikim.',kicker:'QUICK DOSE',body:`<div class="module-toolbar"><input id="quickDoseSearch" type="search" placeholder="Kërko barin…"></div><div class="module-list" id="quickDoseList"></div>`});
  const render=()=>{const q=normalize($('#quickDoseSearch').value);const list=catalog.filter(x=>!q||normalize(`${x.name} ${x.group}`).includes(q));$('#quickDoseList').innerHTML=list.map(item=>`<button type="button" data-open-item="${item.id}"><span>ϟ</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.forms.join(' · '))}</small></span><em>Në verifikim</em></button>`).join('')};
  $('#quickDoseSearch').addEventListener('input',render);render();
}

function openEmergency(selectedId=null){
  if(selectedId){const item=emergencyItems.find(x=>x.id===selectedId);openEmergencyDetail(item);return}
  openModal({title:'Protokollet e urgjencës',subtitle:'Hap protokollin dhe përdor checklistën e strukturuar.',kicker:'URGJENCA',body:`<div class="emergency-grid">${emergencyItems.map(item=>`<button class="emergency-card" type="button" data-emergency="${item.id}"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.summary)}</small></button>`).join('')}</div><div class="clinical-warning">Për situata reale ndiq protokollin institucional dhe aktivizo ekipin emergjent. DozaKS nuk zëvendëson algoritmet e aprovuara.</div>`});
}
function openEmergencyDetail(item){
  if(!item)return;
  openModal({title:item.name,subtitle:item.summary,kicker:'PROTOKOLL URGJENT',body:`<div class="checklist"><label><input type="checkbox"><span>Vlerësimi fillestar dhe stabiliteti klinik janë dokumentuar.</span></label><label><input type="checkbox"><span>Monitorimi dhe qasja venoze janë vendosur sipas nevojës.</span></label><label><input type="checkbox"><span>Ekipi senior / emergjent është njoftuar.</span></label><label><input type="checkbox"><span>Protokolli institucional është hapur dhe ndjekur.</span></label><label><input type="checkbox"><span>Rivlerësimi dhe koha e ndërhyrjeve janë dokumentuar.</span></label></div><div class="clinical-warning">Hapat dhe dozat specifike do të publikohen vetëm pas aprovimit nga redaksia mjekësore.</div>`});
}

function openInteractions(){
  const options=catalog.map(x=>`<option value="${x.id}">${escapeHTML(x.name)}</option>`).join('');
  openModal({title:'Kontrolluesi i interaksioneve',subtitle:'Prototip funksional; databaza klinike e interaksioneve nuk është publikuar ende.',kicker:'SIGURIA',body:`<div class="form-grid"><label>Bari i parë<select id="interactionA"><option value="">Zgjidh</option>${options}</select></label><label>Bari i dytë<select id="interactionB"><option value="">Zgjidh</option>${options}</select></label></div><button class="calculate-button" id="checkInteraction" type="button">Kontrollo kombinimin</button><div id="interactionResult"></div>`});
  $('#checkInteraction').onclick=()=>{const a=$('#interactionA').value,b=$('#interactionB').value,result=$('#interactionResult');if(!a||!b){result.innerHTML='<div class="clinical-warning">Zgjidh dy barna.</div>';return}if(a===b){result.innerHTML='<div class="clinical-warning">Ke zgjedhur të njëjtin bar dy herë. Kontrollo dublikimin terapeutik dhe preparatet e kombinuara.</div>';return}const first=catalog.find(x=>x.id===a),second=catalog.find(x=>x.id===b);result.innerHTML=`<div class="result-card"><h3>${escapeHTML(first.name)} + ${escapeHTML(second.name)}</h3><p>Nuk mund të konfirmohet mungesa ose prania e interaksionit nga ky MVP. Verifiko në SPC, bazën institucionale ose me farmacistin klinik.</p></div>`};
}

function openPregnancy(){
  openModal({title:'Shtatzënia & Gjidhënia',subtitle:'Kërkim i strukturuar me status editorial për secilin bar.',kicker:'SIGURIA',body:`<div class="module-toolbar"><input id="pregnancySearch" type="search" placeholder="Kërko barin…"><select id="pregnancyContext"><option value="pregnancy">Shtatzëni</option><option value="breastfeeding">Gjidhënie</option></select></div><div class="module-list" id="pregnancyList"></div><div class="clinical-warning">Mos interpreto “në verifikim” si siguri ose kundërindikacion. Vendimi kërkon burim të verifikuar dhe vlerësim individual.</div>`});
  const render=()=>{const q=normalize($('#pregnancySearch').value);$('#pregnancyList').innerHTML=catalog.filter(x=>!q||normalize(x.name).includes(q)).map(item=>`<button type="button" data-open-item="${item.id}"><span>♡</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)}</small></span><em>Në verifikim</em></button>`).join('')};$('#pregnancySearch').addEventListener('input',render);render();
}

function openRenalAdjustment(){
  const options=catalog.map(x=>`<option value="${x.id}">${escapeHTML(x.name)}</option>`).join('');
  openModal({title:'Rregullimi renal',subtitle:'Filtro barin sipas vlerës së funksionit renal; rregullat e dozimit nuk janë publikuar ende.',kicker:'RENAL',body:`<div class="form-grid"><label>Bari<select id="renalDrug"><option value="">Zgjidh</option>${options}</select></label><label>eGFR ose CrCl (mL/min)<input id="renalValue" type="number" min="1" max="250" step="0.1" placeholder="p.sh. 45"></label></div><button class="calculate-button" id="renalCheck" type="button">Kontrollo statusin</button><div id="renalAdjustmentResult"></div>`});
  $('#renalCheck').onclick=()=>{const id=$('#renalDrug').value,value=Number($('#renalValue').value),out=$('#renalAdjustmentResult');if(!id||!Number.isFinite(value)||value<=0){out.innerHTML='<div class="clinical-warning">Zgjidh barin dhe vendos një vlerë valide.</div>';return}const item=catalog.find(x=>x.id===id);out.innerHTML=`<div class="result-card"><h3>${escapeHTML(item.name)}</h3><p>Vlera e futur: <strong>${value.toFixed(1)} mL/min</strong></p><p>Rregulli specifik i rregullimit renal është në verifikim editorial. Kontrollo burimin e barit dhe metodën me të cilën është përcaktuar kufiri i dozimit.</p></div>`};
}

function openAlternatives(){
  const current=catalog.find(x=>x.id===state.selectedId)||catalog[0];const alternatives=catalog.filter(x=>x.category===current.category&&x.id!==current.id);
  openModal({title:`Alternativat për ${current.name}`,subtitle:'Alternativat janë të grupuara farmakologjikisht, jo rekomandim automatik për zëvendësim.',kicker:'ALTERNATIVAT',body:alternatives.length?`<div class="module-list">${alternatives.map(item=>`<button type="button" data-open-item="${item.id}"><span>↔</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)}</small></span><em>Hap kartelën</em></button>`).join('')}</div><div class="clinical-warning">Zëvendësimi kërkon krahasim të indikacionit, spektrit, alergjisë, interaksioneve dhe karakteristikave të pacientit.</div>`:'<div class="empty-state">Nuk ka alternativë të indeksuar ende në të njëjtin grup.</div>'});
}

function openMgKgCalculator(){
  openModal({title:'Kalkulator mg/kg',subtitle:'Llogaritje matematikore e dozës sipas peshës; vlera mg/kg duhet të vijë nga një burim i verifikuar.',kicker:'KALKULATOR',body:`<form id="mgkgForm"><div class="form-grid"><label>Pesha (kg)<input id="mgkgWeight" type="number" min="0.1" max="400" step="0.1" required></label><label>Doza e verifikuar (mg/kg për dozë)<input id="mgkgDose" type="number" min="0.001" max="10000" step="0.001" required></label><label>Doza maksimale për dozë (mg, opsionale)<input id="mgkgMax" type="number" min="0" step="0.1"></label><label>Koncentrimi (mg/mL, opsionale)<input id="mgkgConcentration" type="number" min="0" step="0.001"></label></div><button class="calculate-button" type="submit">Llogarit</button></form><div id="mgkgResult"></div><div class="clinical-warning">Kalkulatori nuk zgjedh dozën klinike. Verifiko mg/kg, intervalin, dozën maksimale, moshën dhe funksionin renal/hepatik.</div>`});
  $('#mgkgForm').onsubmit=e=>{e.preventDefault();const weight=Number($('#mgkgWeight').value),dose=Number($('#mgkgDose').value),max=Number($('#mgkgMax').value),conc=Number($('#mgkgConcentration').value);if(!validPositive(weight)||!validPositive(dose)){showInlineError('#mgkgResult','Vendos peshën dhe mg/kg valide.');return}const raw=weight*dose;const final=max>0?Math.min(raw,max):raw;const capped=max>0&&raw>max;const volume=conc>0?final/conc:null;$('#mgkgResult').innerHTML=`<div class="result-card"><h3>Rezultati matematikor</h3><div class="result-number">${formatNumber(final)} mg / dozë</div>${volume!==null?`<p><strong>${formatNumber(volume)} mL / dozë</strong> me koncentrimin e futur.</p>`:''}${capped?`<p>Rezultati i papërkufizuar ishte ${formatNumber(raw)} mg; u kufizua nga maksimumi i futur.</p>`:''}</div>`};
}

function openInfusionCalculator(){
  openModal({title:'Kalkulator infuzioni',subtitle:'Llogarit shpejtësinë nga vëllimi dhe koha.',kicker:'KALKULATOR',body:`<form id="infusionForm"><div class="form-grid"><label>Vëllimi total (mL)<input id="infusionVolume" type="number" min="0.1" step="0.1" required></label><label>Koha<input id="infusionTime" type="number" min="0.01" step="0.01" required></label><label>Njësia e kohës<select id="infusionUnit"><option value="hours">Orë</option><option value="minutes">Minuta</option></select></label><label>Faktori i pikave (gtt/mL, opsionale)<select id="dropFactor"><option value="">Pa llogaritje pikash</option><option value="10">10 gtt/mL</option><option value="15">15 gtt/mL</option><option value="20">20 gtt/mL</option><option value="60">60 gtt/mL</option></select></label></div><button class="calculate-button" type="submit">Llogarit</button></form><div id="infusionResult"></div><div class="clinical-warning">Konfirmo kufizimet e pompës, përqendrimin, kompatibilitetin dhe protokollin e barit para administrimit.</div>`});
  $('#infusionForm').onsubmit=e=>{e.preventDefault();const volume=Number($('#infusionVolume').value),time=Number($('#infusionTime').value),unit=$('#infusionUnit').value,drop=Number($('#dropFactor').value);if(!validPositive(volume)||!validPositive(time)){showInlineError('#infusionResult','Vendos vëllim dhe kohë valide.');return}const hours=unit==='minutes'?time/60:time;const minutes=unit==='minutes'?time:time*60;const rate=volume/hours;const drops=drop>0?(volume*drop)/minutes:null;$('#infusionResult').innerHTML=`<div class="result-card"><h3>Shpejtësia e llogaritur</h3><div class="result-number">${formatNumber(rate)} mL/orë</div>${drops!==null?`<p><strong>${Math.round(drops)} pika/min</strong> me faktor ${drop} gtt/mL.</p>`:''}</div>`};
}

function openRenalCalculator(){
  openModal({title:'Kalkulator CrCl / eGFR',subtitle:'CKD-EPI 2021 për të rritur dhe Cockcroft–Gault.',kicker:'KALKULATOR RENAL',body:`<form id="renalForm"><div class="form-grid"><label>Mosha (vjet)<input id="renalAge" type="number" min="18" max="120" step="1" required></label><label>Seksi biologjik<select id="renalSex"><option value="female">Femër</option><option value="male">Mashkull</option></select></label><label>Pesha (kg)<input id="renalWeight" type="number" min="20" max="400" step="0.1" required></label><label>Kreatinina serike<input id="renalCreatinine" type="number" min="0.1" step="0.01" required></label><label>Njësia<select id="renalUnit"><option value="mgdl">mg/dL</option><option value="umol">µmol/L</option></select></label><label>Gjatësia (cm, opsionale për deindeksim)<input id="renalHeight" type="number" min="80" max="250" step="0.1"></label></div><button class="calculate-button" type="submit">Llogarit</button></form><div id="renalResult"></div><div class="source-list"><a href="https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults" target="_blank" rel="noreferrer">Burimi i formulës CKD-EPI 2021 — NIDDK</a><a href="https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/ckd-drug-dosing-providers" target="_blank" rel="noreferrer">Konsiderata për dozimin renal — NIDDK</a></div><div class="clinical-warning">Vetëm për moshën ≥18 vjeç dhe kreatininë relativisht stabile. Vlerat janë vlerësime; zgjedhja e formulës për dozimin varet nga etiketa e barit dhe konteksti klinik.</div>`});
  $('#renalForm').onsubmit=e=>{e.preventDefault();const age=Number($('#renalAge').value),sex=$('#renalSex').value,weight=Number($('#renalWeight').value),inputCr=Number($('#renalCreatinine').value),unit=$('#renalUnit').value,height=Number($('#renalHeight').value);if(age<18||!validPositive(weight)||!validPositive(inputCr)){showInlineError('#renalResult','Vendos moshë ≥18 vjeç, peshë dhe kreatininë valide.');return}const scr=unit==='umol'?inputCr/88.4:inputCr;const k=sex==='female'?0.7:0.9;const alpha=sex==='female'?-0.241:-0.302;const egfr=142*Math.pow(Math.min(scr/k,1),alpha)*Math.pow(Math.max(scr/k,1),-1.2)*Math.pow(0.9938,age)*(sex==='female'?1.012:1);const crcl=((140-age)*weight)/(72*scr)*(sex==='female'?0.85:1);let absolute=null,bsa=null;if(validPositive(height)){bsa=Math.sqrt((height*weight)/3600);absolute=egfr*bsa/1.73}$('#renalResult').innerHTML=`<div class="result-card"><h3>Rezultatet</h3><div class="result-grid"><div class="result-box"><small>eGFR CKD-EPI 2021</small><strong>${formatNumber(egfr)} mL/min/1.73m²</strong></div><div class="result-box"><small>CrCl Cockcroft–Gault</small><strong>${formatNumber(crcl)} mL/min</strong></div>${absolute!==null?`<div class="result-box"><small>eGFR e deindeksuar</small><strong>${formatNumber(absolute)} mL/min</strong></div><div class="result-box"><small>BSA Mosteller</small><strong>${formatNumber(bsa)} m²</strong></div>`:''}</div></div>`};
}

function openBsaCalculator(){
  openModal({title:'Kalkulator BSA',subtitle:'Formula e Mosteller-it.',kicker:'KALKULATOR',body:`<form id="bsaForm"><div class="form-grid"><label>Pesha (kg)<input id="bsaWeight" type="number" min="0.1" max="400" step="0.1" required></label><label>Gjatësia (cm)<input id="bsaHeight" type="number" min="20" max="250" step="0.1" required></label></div><button class="calculate-button" type="submit">Llogarit</button></form><div id="bsaResult"></div><div class="source-list"><a href="https://pubmed.ncbi.nlm.nih.gov/3657876/" target="_blank" rel="noreferrer">Mosteller RD. Simplified calculation of body-surface area.</a></div><div class="clinical-warning">BSA është vlerësim matematikor. Përdorimi për dozimin kërkon protokoll të posaçëm dhe verifikim të njësive.</div>`});
  $('#bsaForm').onsubmit=e=>{e.preventDefault();const w=Number($('#bsaWeight').value),h=Number($('#bsaHeight').value);if(!validPositive(w)||!validPositive(h)){showInlineError('#bsaResult','Vendos peshë dhe gjatësi valide.');return}const bsa=Math.sqrt((w*h)/3600);$('#bsaResult').innerHTML=`<div class="result-card"><h3>Sipërfaqja trupore</h3><div class="result-number">${formatNumber(bsa)} m²</div></div>`};
}

function validPositive(value){return Number.isFinite(value)&&value>0}
function formatNumber(value){return Number(value).toLocaleString('sq-AL',{maximumFractionDigits:2})}
function showInlineError(selector,message){$(selector).innerHTML=`<div class="clinical-warning">${escapeHTML(message)}</div>`}

function openSaved(){
  const ids=getFavorites();const items=ids.map(id=>catalog.find(x=>x.id===id)||clinicalItems.find(x=>x.id===id)).filter(Boolean);
  openModal({title:'Të ruajturat',subtitle:'Kartelat që ke shënuar për qasje të shpejtë.',kicker:'PERSONALE',body:items.length?items.map(item=>`<div class="saved-row"><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)}</small></span><button type="button" data-open-item="${item.id}">Hap</button><button type="button" data-remove-favorite="${item.id}" aria-label="Largo">×</button></div>`).join(''):'<div class="empty-state">Ende nuk ke ruajtur asnjë kartelë.</div>'});
}

function openHistory(){
  const history=getHistory();openModal({title:'Historiku i kërkimeve',subtitle:'Ruhet vetëm në këtë pajisje dhe mund të pastrohet.',kicker:'PERSONALE',body:`<div id="historyModalList">${history.length?history.map(entry=>`<div class="saved-row"><span><strong>${escapeHTML(entry.name)}</strong><small>${escapeHTML(entry.type)} · ${formatRelative(entry.time)}</small></span><button type="button" data-open-item="${escapeHTML(entry.id)}">Hap</button></div>`).join(''):'<div class="empty-state">Historiku është bosh.</div>'}</div>${history.length?'<button class="calculate-button" id="clearHistory" type="button">Pastro historikun</button>':''}`});
  if($('#clearHistory'))$('#clearHistory').onclick=()=>{store.set('dozaks-history',[]);renderRecent();openHistory();showToast('Historiku u pastrua.')};
}

function openNotifications(){
  openModal({title:'Njoftimet',subtitle:'Përditësimet e platformës dhe statusi editorial.',kicker:'NJOFTIME',body:`<div class="module-card"><span class="bubble blue">✓</span><span><strong>Kërkimi universal është aktiv</strong><small>Kërkon emra gjenerikë, tregtarë, simptoma dhe diagnoza.</small></span></div><div class="module-card"><span class="bubble green">∑</span><span><strong>Kalkulatorët janë aktivë</strong><small>mg/kg, infuzion, CKD-EPI 2021, Cockcroft–Gault dhe BSA.</small></span></div><div class="module-card"><span class="bubble amber">!</span><span><strong>Dozat mbeten në verifikim</strong><small>Nuk publikohen vlera klinike pa burim dhe aprovimin editorial.</small></span></div>`});
}

function openProfile(){
  const p=getProfile();openModal({title:'Profili i mjekut',subtitle:'Të dhënat ruhen vetëm lokalisht në shfletues.',kicker:'PROFILI',body:`<div class="profile-preview"><span class="avatar" id="profileModalAvatar">${escapeHTML(p.initials||initialsFrom(p.name))}</span><span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.role)}${p.institution?` · ${escapeHTML(p.institution)}`:''}</small></span></div><form id="profileForm"><div class="form-grid"><label>Emri<input id="profileInputName" value="${escapeHTML(p.name)}" required></label><label>Roli<input id="profileInputRole" value="${escapeHTML(p.role)}" required></label><label class="full">Institucioni<input id="profileInputInstitution" value="${escapeHTML(p.institution||'')}"></label></div><button class="calculate-button" type="submit">Ruaj profilin</button></form>`});
  $('#profileForm').onsubmit=e=>{e.preventDefault();const name=$('#profileInputName').value.trim(),role=$('#profileInputRole').value.trim(),institution=$('#profileInputInstitution').value.trim();if(!name||!role){showToast('Plotëso emrin dhe rolin.');return}store.set('dozaks-profile',{name,role,institution,initials:initialsFrom(name)});updateCounters();closeModal();showToast('Profili u ruajt në këtë pajisje.')};
}

function openDetails(){
  const item=catalog.find(x=>x.id===state.selectedId)||catalog[0];openModal({title:item.name,subtitle:item.group,kicker:item.typeLabel.toUpperCase(),body:`<div class="module-card"><span class="bubble blue">Rx</span><span><strong>Format</strong><small>${escapeHTML(item.forms.join(' · '))}</small></span></div><div class="module-card"><span class="bubble green">✓</span><span><strong>Indikacionet e indeksuara</strong><small>${escapeHTML(item.indications.join(' · '))}</small></span></div><div class="info-note">${escapeHTML(item.notice)}</div><div class="clinical-warning">Doza, intervali, kohëzgjatja, kundërindikacionet dhe rregullimet specifike janë në verifikim editorial.</div>`});
}

function toggleFavorite(){
  const id=state.selectedId;let favorites=getFavorites();const exists=favorites.includes(id);favorites=exists?favorites.filter(x=>x!==id):[id,...favorites];store.set('dozaks-favorites',favorites);updateCounters();renderSelectedDrug();showToast(exists?'U largua nga të ruajturat.':'U ruajt për qasje të shpejtë.')
}

function applyContext(){
  const patient=$('#patientType').selectedOptions[0].textContent,context=$('#careContext').selectedOptions[0].textContent,special=$('#specialState').selectedOptions[0].textContent;const data={patient,context,special};store.set('dozaks-context',data);const badge=$('#contextBadge');badge.textContent=`Konteksti aktiv: ${patient} · ${context} · ${special}`;badge.hidden=false;showToast('Konteksti klinik u aplikua në kërkim.')
}

function handleAction(action){
  const map={
    home:()=>{closeSidebar();window.scrollTo({top:0,behavior:'smooth'});setActiveNav('home')},
    search:()=>{closeSidebar();$('#searchSection').scrollIntoView({behavior:'smooth'});setTimeout(()=>dom.input.focus(),350);setActiveNav('search')},
    drugs:()=>{closeSidebar();openDrugs();setActiveNav('drugs')},
    diagnoses:()=>{closeSidebar();openDiagnoses();setActiveNav('diagnoses')},
    'quick-dose':()=>{closeSidebar();openQuickDose();setActiveNav('quick-dose')},
    interactions:()=>{closeSidebar();openInteractions();setActiveNav('interactions')},
    'renal-adjustment':()=>{closeSidebar();openRenalAdjustment();setActiveNav('renal-adjustment')},
    pregnancy:()=>{closeSidebar();openPregnancy();setActiveNav('pregnancy')},
    'calc-mgkg':()=>{closeSidebar();openMgKgCalculator();setActiveNav('calc-mgkg')},
    'calc-infusion':()=>{closeSidebar();openInfusionCalculator();setActiveNav('calc-infusion')},
    'calc-renal':()=>{closeSidebar();openRenalCalculator();setActiveNav('calc-renal')},
    'calc-bsa':()=>{closeSidebar();openBsaCalculator();setActiveNav('calc-bsa')},
    emergency:()=>{closeSidebar();openEmergency();setActiveNav('emergency')},
    antibiotics:()=>openDrugs('antibiotic'),
    pediatrics:()=>openMgKgCalculator(),
    alternatives:()=>openAlternatives(),
    saved:()=>openSaved(),history:()=>openHistory(),notifications:()=>openNotifications(),profile:()=>openProfile()
  };(map[action]||(()=>showToast('Ky modul është duke u përgatitur.')))();
}

function setActiveNav(action){$$('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.action===action))}
function closeSidebar(){dom.sidebar.classList.remove('open');dom.sidebarBackdrop.classList.remove('show')}

function bindEvents(){
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]');if(action){handleAction(action.dataset.action);return}
    const open=event.target.closest('[data-open-item]');if(open){closeModal();openItem(open.dataset.openItem);return}
    const clinical=event.target.closest('[data-clinical]');if(clinical){const item=clinicalItems.find(x=>x.id===clinical.dataset.clinical);openClinicalItem(item);return}
    const emergency=event.target.closest('[data-emergency]');if(emergency){openEmergency(emergency.dataset.emergency);return}
    const remove=event.target.closest('[data-remove-favorite]');if(remove){store.set('dozaks-favorites',getFavorites().filter(x=>x!==remove.dataset.removeFavorite));updateCounters();openSaved();return}
    if(!event.target.closest('.search-box'))dom.suggestions.classList.remove('open');
  });
  $('#searchForm').addEventListener('submit',e=>{e.preventDefault();const item=getResults(dom.input.value)[0];openItem(item?.id||dom.input.value)});
  dom.input.addEventListener('input',renderSuggestions);
  dom.input.addEventListener('focus',renderSuggestions);
  dom.input.addEventListener('keydown',e=>{
    const buttons=$$('#suggestions button');
    if(e.key==='ArrowDown'&&buttons.length){e.preventDefault();state.highlightIndex=(state.highlightIndex+1)%buttons.length;highlightSuggestion(buttons)}
    else if(e.key==='ArrowUp'&&buttons.length){e.preventDefault();state.highlightIndex=(state.highlightIndex-1+buttons.length)%buttons.length;highlightSuggestion(buttons)}
    else if(e.key==='Enter'&&state.highlightIndex>=0&&buttons[state.highlightIndex]){e.preventDefault();openItem(buttons[state.highlightIndex].dataset.resultId)}
    else if(e.key==='Escape'){dom.suggestions.classList.remove('open')}
  });
  dom.suggestions.addEventListener('click',e=>{const b=e.target.closest('[data-result-id]');if(b)openItem(b.dataset.resultId)});
  $('#clearSearch').onclick=()=>{dom.input.value='';renderSuggestions();dom.input.focus()};
  $$('#filters button').forEach(button=>button.onclick=()=>{$$('#filters button').forEach(x=>x.classList.remove('active'));button.classList.add('active');state.filter=button.dataset.filter;renderSuggestions();showToast(`Filtri “${button.textContent}” u aktivizua.`)});
  $('#advancedButton').onclick=()=>{$('#advancedPanel').classList.toggle('open');$('#advancedButton').classList.toggle('active')};
  $('#applyContext').onclick=applyContext;
  $('#menuButton').onclick=()=>{dom.sidebar.classList.add('open');dom.sidebarBackdrop.classList.add('show')};dom.sidebarBackdrop.onclick=closeSidebar;
  $('#favoriteButton').onclick=toggleFavorite;$('#openDetails').onclick=openDetails;
  $('#formChips').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('#formChips button').forEach(x=>x.classList.remove('active'));b.classList.add('active');showToast(`Forma “${b.dataset.form}” u zgjodh.`)});
  $('#modalClose').onclick=closeModal;$('#modalSecondary').onclick=closeModal;dom.modalBackdrop.onclick=closeModal;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!dom.modal.hidden)closeModal();else closeSidebar()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();closeModal();$('#searchSection').scrollIntoView({behavior:'smooth'});setTimeout(()=>dom.input.focus(),250)}});
}

function highlightSuggestion(buttons){buttons.forEach((b,i)=>b.classList.toggle('highlight',i===state.highlightIndex));buttons[state.highlightIndex]?.scrollIntoView({block:'nearest'})}

function init(){
  const context=store.get('dozaks-context',null);if(context){const badge=$('#contextBadge');badge.textContent=`Konteksti aktiv: ${context.patient} · ${context.context} · ${context.special}`;badge.hidden=false}
  renderSelectedDrug();renderRecent();renderPopular();renderEmergencies();updateCounters();bindEvents();
}

document.addEventListener('DOMContentLoaded',init);
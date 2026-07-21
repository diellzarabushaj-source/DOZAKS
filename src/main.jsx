import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Pulse,
  ArrowRight,
  Bell,
  BookmarkSimple,
  Calculator,
  CaretDown,
  ClockCounterClockwise,
  Drop,
  FirstAid,
  Flask,
  Heartbeat,
  House,
  Info,
  Lightning,
  List,
  MagnifyingGlass,
  Pill,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Stethoscope,
  Syringe,
  UserCircle,
  Warning,
  X,
} from '@phosphor-icons/react'
import './styles.css'

const searchItems = [
  { label: 'Amoxicillin', type: 'Bar gjenerik', meta: 'Antibiotik – penicilina' },
  { label: 'Augmentin', type: 'Emër tregtar', meta: 'Amoxicillin + clavulanate' },
  { label: 'Dhimbje fyti te fëmijët', type: 'Simptomë', meta: 'Algoritëm klinik' },
  { label: 'Pneumoni e komunitetit', type: 'Diagnozë', meta: 'Udhëzues praktik' },
  { label: 'Ondansetron', type: 'Bar gjenerik', meta: 'Antiemetik' },
  { label: 'Temperaturë te fëmijët', type: 'Simptomë', meta: 'Vlerësim sipas moshës' },
]

const categories = [
  { title: 'Doza të shpejta', subtitle: 'Dozat më të përdorura', icon: Lightning, tone: 'blue' },
  { title: 'Urgjenca', subtitle: 'Protokollet kryesore', icon: FirstAid, tone: 'red' },
  { title: 'Antibiotikët', subtitle: 'Terapia empirike', icon: Pill, tone: 'green' },
  { title: 'Pediatria', subtitle: 'Doza sipas peshës', icon: UserCircle, tone: 'purple' },
  { title: 'Shtatzënia', subtitle: 'Barnat e sigurta', icon: Heartbeat, tone: 'amber' },
  { title: 'Rregullimi renal', subtitle: 'Dozat sipas eGFR', icon: Drop, tone: 'cyan' },
]

const emergencyItems = [
  'Anafilaksia',
  'Status epileptik',
  'Hiperkalemia',
  'Hipoglikemia',
  'Sepsa',
  'Edema pulmonare akute',
  'Takikardia',
  'Intoksikimet',
]

const recent = [
  ['Amoxicillin', 'Para 5 min'],
  ['Dhimbje fyti te fëmijët', 'Para 18 min'],
  ['Metronidazole dozimi', 'Para 1 orë'],
  ['Pneumoni e komunitetit', 'Para 2 orë'],
  ['Paracetamol fëmijë', 'Para 3 orë'],
]

const popular = [
  ['Paracetamol', 'Analgjezik / Antipiretik', 'green'],
  ['Amoxicillin', 'Antibiotik', 'blue'],
  ['Ibuprofen', 'Analgjezik / NSAID', 'green'],
  ['Metronidazole', 'Antiprotozoal / Antibiotik', 'blue'],
  ['Omeprazole', 'Gastroprotektiv', 'purple'],
  ['Salbutamol', 'Bronkodilatator', 'amber'],
  ['Ceftriaxone', 'Antibiotik', 'blue'],
  ['Ondansetron', 'Antiemetik', 'red'],
]

const demoRows = [
  ['Faringit / Tonsilit', 'Në verifikim', 'Në verifikim', 'Në verifikim'],
  ['Sinuzit akut', 'Në verifikim', 'Në verifikim', 'Në verifikim'],
  ['Otit media akut', 'Në verifikim', 'Në verifikim', 'Në verifikim'],
  ['Infeksion urinar', 'Në verifikim', 'Në verifikim', 'Në verifikim'],
]

const navGroups = [
  {
    title: '',
    items: [{ label: 'Faqja kryesore', icon: House, active: true }],
  },
  {
    title: 'KËRKIM & REFERENCA',
    items: [
      { label: 'Kërkim inteligjent', icon: MagnifyingGlass },
      { label: 'Barnat A–Z', icon: Pill },
      { label: 'Diagnozat', icon: Stethoscope },
      { label: 'Doza të shpejta', icon: Pulse },
      { label: 'Interaksionet', icon: Flask },
      { label: 'Rregullimi renal', icon: Drop },
      { label: 'Shtatzënia & Gjidhënia', icon: Heartbeat },
    ],
  },
  {
    title: 'MJETET KLINIKE',
    items: [
      { label: 'Kalkulator mg/kg', icon: Calculator },
      { label: 'Kalkulator infuzioni', icon: Syringe },
      { label: 'Kalkulator CrCl / eGFR', icon: Drop },
      { label: 'Skorë & Indekse', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'URGJENCA',
    items: [{ label: 'Protokollet e urgjencës', icon: FirstAid, emergency: true }],
  },
  {
    title: 'TË TJERA',
    items: [
      { label: 'Lajme & Udhëzime', icon: Bell },
      { label: 'Lista esenciale e barnave', icon: List },
      { label: 'Rreth nesh', icon: Info },
    ],
  },
]

function Sidebar({ open, onClose }) {
  return (
    <>
      <button className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} aria-label="Mbyll menunë" />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Pulse size={35} weight="duotone" /></div>
          <div>
            <div className="brand-name">Doza<span>KS</span></div>
            <div className="brand-tagline">Vendimi i duhur. Pacienti i sigurt.</div>
          </div>
        </div>
        <nav className="nav-scroll" aria-label="Navigimi kryesor">
          {navGroups.map((group, groupIndex) => (
            <div className="nav-group" key={groupIndex}>
              {group.title && <div className="nav-heading">{group.title}</div>}
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    className={`nav-item ${item.active ? 'active' : ''} ${item.emergency ? 'emergency' : ''}`}
                    onClick={onClose}
                  >
                    <Icon size={19} weight={item.active || item.emergency ? 'fill' : 'regular'} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-source">
          <ShieldCheck size={24} weight="duotone" />
          <p>Bazuar në udhëzime klinike dhe burime që do të verifikohen para publikimit.</p>
        </div>
      </aside>
    </>
  )
}

function Header({ onMenu }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Hap menunë"><List size={25} /></button>
      <div className="heading-block">
        <h1>Platforma Klinike e Dozave dhe Barnave</h1>
        <p>Vetëm për profesionistë shëndetësorë në Kosovë</p>
      </div>
      <div className="top-actions">
        <button><BookmarkSimple size={21} /> <span>Të ruajturat</span></button>
        <button><ClockCounterClockwise size={22} /> <span>Historiku</span></button>
        <button className="notification"><Bell size={21} /><span>Njoftimet</span><b>3</b></button>
        <div className="profile">
          <UserCircle size={38} weight="duotone" />
          <div><strong>Dr. Arben</strong><small>Mjek</small></div>
          <CaretDown size={16} />
        </div>
      </div>
    </header>
  )
}

function Hero({ query, setQuery, activeFilter, setActiveFilter, onSelect }) {
  const [advanced, setAdvanced] = useState(false)
  const suggestions = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return []
    return searchItems.filter((item) => `${item.label} ${item.type} ${item.meta}`.toLowerCase().includes(value)).slice(0, 5)
  }, [query])

  const filters = ['Simptoma', 'Diagnoza', 'Bar/Emër gjenerik', 'Emër tregtar', 'Grup terapeutik']

  return (
    <section className="hero">
      <ShieldCheck className="hero-symbol" size={132} weight="duotone" aria-hidden="true" />
      <div className="hero-copy">
        <h2>Çfarë po kërkon?</h2>
        <p>Kërko simptomën, diagnozën, barin ose emrin tregtar…</p>
      </div>
      <div className="search-row">
        <div className="search-wrap">
          <MagnifyingGlass size={23} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="P.sh. dhimbje fyti, amoxicillin, Augmentin, pneumoni, temperaturë fëmijë…"
            aria-label="Kërko në DozaKS"
          />
          {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Pastro kërkimin"><X size={17} /></button>}
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((item) => (
                <button key={item.label} onClick={() => { setQuery(item.label); onSelect(item) }}>
                  <MagnifyingGlass size={18} />
                  <span><strong>{item.label}</strong><small>{item.type} · {item.meta}</small></span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={`advanced-button ${advanced ? 'selected' : ''}`} onClick={() => setAdvanced((value) => !value)}>
          <SlidersHorizontal size={20} /> Kërkim i zgjeruar
        </button>
      </div>
      <div className="hero-filters">
        {filters.map((filter) => (
          <button key={filter} className={activeFilter === filter ? 'selected' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>
        ))}
      </div>
      {advanced && (
        <div className="advanced-panel">
          <label>Mosha<select defaultValue=""><option value="">Zgjidh</option><option>I rritur</option><option>Fëmijë</option><option>I moshuar</option></select></label>
          <label>Konteksti<select defaultValue=""><option value="">Zgjidh</option><option>Ambulancë</option><option>Urgjencë</option><option>Spital</option></select></label>
          <label>Gjendje e veçantë<select defaultValue=""><option value="">Asnjë</option><option>Shtatzëni</option><option>Gjidhënie</option><option>Insuficiencë renale</option></select></label>
        </div>
      )}
    </section>
  )
}

function CategoryStrip() {
  return (
    <section className="category-grid" aria-label="Kategoritë kryesore">
      {categories.map(({ title, subtitle, icon: Icon, tone }) => (
        <button className="category-card" key={title}>
          <span className={`icon-bubble ${tone}`}><Icon size={27} weight="duotone" /></span>
          <span><strong>{title}</strong><small>{subtitle}</small></span>
          <ArrowRight size={16} />
        </button>
      ))}
    </section>
  )
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header"><h3>{title}</h3>{action && <button>{action}</button>}</div>
      {children}
    </section>
  )
}

function RecentPanel() {
  return (
    <div className="left-stack">
      <Panel title="Kërkimet e fundit" action="Shiko të gjitha">
        <div className="compact-list">
          {recent.map(([name, time]) => (
            <button key={name}><MagnifyingGlass size={16} /><span>{name}</span><small>{time}</small></button>
          ))}
        </div>
      </Panel>
      <Panel title="Kalkulator i shpejtë">
        <div className="calculator-grid">
          <button><span className="calc-icon blue"><Calculator size={25} /></span><small>mg/kg</small></button>
          <button><span className="calc-icon green"><Syringe size={25} /></span><small>Infuzion</small></button>
          <button><span className="calc-icon purple"><Drop size={25} /></span><small>CrCl / eGFR</small></button>
          <button><span className="calc-icon amber"><UserCircle size={25} /></span><small>BSA</small></button>
        </div>
      </Panel>
    </div>
  )
}

function PopularPanel() {
  return (
    <Panel title="Barnat më të kërkuara" action="Shiko të gjitha" className="popular-panel">
      <div className="rank-list">
        {popular.map(([name, group, tone], index) => (
          <button key={name}><b>{index + 1}</b><span>{name}</span><em className={tone}>{group}</em></button>
        ))}
      </div>
    </Panel>
  )
}

function EmergencyPanel() {
  return (
    <Panel title="Protokollet e urgjencës" className="emergency-panel">
      <div className="emergency-list">
        {emergencyItems.map((item) => (
          <button key={item}><FirstAid size={18} weight="duotone" /><span>{item}</span><ArrowRight size={15} /></button>
        ))}
      </div>
    </Panel>
  )
}

function DrugPanel({ selected }) {
  const label = selected?.label || 'Amoxicillin'
  return (
    <Panel title={label} className="drug-panel">
      <button className="favorite" aria-label="Ruaj barin"><Star size={24} /></button>
      <p className="drug-subtitle">Antibiotik – Penicilina</p>
      <h4>Format:</h4>
      <div className="form-chips"><button>Tableta</button><button>Kapsula</button><button>Suspension</button><button>IV</button></div>
      <h4>Indikacionet kryesore:</h4>
      <p className="drug-description">Përmbajtja klinike e këtij prototipi është vetëm demonstrative dhe do të publikohet pasi të verifikohet nga redaksia mjekësore.</p>
      <h4>Doza sipas indikacionit</h4>
      <div className="dose-table-wrap">
        <table>
          <thead><tr><th>Indikacioni</th><th>Të rriturit</th><th>Fëmijët</th><th>Kohëzgjatja</th></tr></thead>
          <tbody>{demoRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <button className="full-details">Shiko detajet e plota</button>
      <div className="drug-actions"><button>Rregullimi renal</button><button>Interaksionet</button><button>Shtatzënia</button><button>Alternativat</button></div>
    </Panel>
  )
}

function SafetyBar() {
  return (
    <div className="safety-bar">
      <Warning size={20} weight="fill" />
      <p>Ky informacion është prototip për profesionistë shëndetësorë. Dozat dhe rekomandimet duhet të verifikohen para publikimit dhe përdorimit klinik.</p>
      <span>Versioni MVP · 2026</span>
    </div>
  )
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('Simptoma')
  const [selected, setSelected] = useState(null)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-area">
        <Header onMenu={() => setSidebarOpen(true)} />
        <div className="content">
          <Hero query={query} setQuery={setQuery} activeFilter={activeFilter} setActiveFilter={setActiveFilter} onSelect={setSelected} />
          <CategoryStrip />
          <section className="dashboard-grid">
            <RecentPanel />
            <PopularPanel />
            <EmergencyPanel />
            <DrugPanel selected={selected} />
          </section>
          <SafetyBar />
        </div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)

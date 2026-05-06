import { useState, useEffect, useRef } from "react";

// ── constants ──────────────────────────────────────────────────────────────
const DEADLINE = new Date("2026-06-13T23:59:59");

const PARAMETERS = [
  { temp: 140, time: 20 },
  { temp: 140, time: 30 },
  { temp: 140, time: 45 },
  { temp: 160, time: 20 },
  { temp: 160, time: 30 },
  { temp: 160, time: 45 },
  { temp: 180, time: 20 },
  { temp: 180, time: 30 },
  { temp: 180, time: 45 },
];

const TEMP_GROUPS = [140, 160, 180];

const STEPS = [
  { id: "liquefaction", label: "Liquefaction (RBF + oil bath + reflux condenser)" },
  { id: "quench",       label: "Quench in room-temp water bath" },
  { id: "ethanol_dist", label: "Add 100 ml EtOH, distribute into 4 centrifuge tubes" },
  { id: "centrifuge",   label: "Centrifuge 10,000 rpm × 15 min × 3 rounds, collect supernatant" },
  { id: "oven",         label: "Residue → oven 105 °C × 24 h" },
  { id: "rotavap",      label: "Rotary evaporation (40–50 °C, reduced pressure)" },
  { id: "weigh_store",  label: "Weigh bio-polyol, store at 4 °C" },
  { id: "testing",      label: "Analytical testing complete" },
];

const CHEMICALS = [
  { id: "peg600",       label: "PEG 600",                               amount: "30 g" },
  { id: "agarwood",     label: "Agarwood leaves (Aquilaria malaccensis)", amount: "3 g" },
  { id: "h2so4",        label: "H₂SO₄ (catalyst)",                     amount: "0.6 g" },
  { id: "ethanol_liq",  label: "Ethanol 95% (liquefaction)",            amount: "100 ml" },
  { id: "ethanol_wash", label: "Ethanol 95% (washing)",                 amount: "90 ml" },
  { id: "tubes",        label: "Centrifuge tubes",                      amount: "× 4" },
  { id: "rbf",          label: "Round-bottom flask (1000 ml)",          amount: "× 1" },
  { id: "reflux",       label: "Reflux condenser",                      amount: "× 1" },
  { id: "oil_bath",     label: "Silicone oil bath",                     amount: "× 1" },
];

// 9 parameter combos × 3 replicates = 27 samples
const ALL_SAMPLES = PARAMETERS.flatMap(({ temp, time }) =>
  [1, 2, 3].map((rep) => ({
    id:         `${temp}C_${time}min_R${rep}`,
    temp, time, rep,
    label:      `${temp} °C / ${time} min — R${rep}`,
    groupLabel: `${temp} °C / ${time} min`,
  }))
);

const EMPTY_SAMPLE = () => ({
  steps: {}, chemicals: {},
  w_biomass: "", w_residue: "",
  w_biopolyol_pre: "", w_biopolyol_post: "",
  moisture: "", ftir: false,
  hydroxyl: "", acid: "", viscosity: "",
  notes: "", photos: [],
});

// ── storage ────────────────────────────────────────────────────────────────
async function storeGet(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function storeSet(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ── utils ──────────────────────────────────────────────────────────────────
const num        = (v) => parseFloat(v) || 0;
const pct        = (a, b) => b ? ((a / b) * 100).toFixed(2) : "—";
const daysLeft   = () => Math.max(0, Math.ceil((DEADLINE - new Date()) / 86400000));
const isComplete = (sd) => STEPS.every((s) => sd.steps[s.id]);

// ── palette: amber (140°C) → orange (160°C) → red (180°C), emerald accents ──
const C = {
  bg: "#0d1117", surface: "#161b22", card: "#1c2330",
  border: "#2d3748", green: "#10b981", greenDim: "#059669",
  red: "#ef4444", muted: "#6b7280", text: "#e2e8f0",
};
const TEMP_COLOR = { 140: "#f59e0b", 160: "#f97316", 180: "#ef4444" };

// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [allData,      setAllData]      = useState({});
  const [view,         setView]         = useState("dashboard");
  const [activeSample, setActiveSample] = useState(null);
  const [loaded,       setLoaded]       = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storeGet("fyp_agar_v3");
      if (saved) setAllData(saved);
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) storeSet("fyp_agar_v3", allData); }, [allData, loaded]);

  const getSample    = (id) => allData[id] || EMPTY_SAMPLE();
  const updateSample = (id, patch) =>
    setAllData((prev) => ({ ...prev, [id]: { ...getSample(id), ...patch } }));

  const completedCount = ALL_SAMPLES.filter((s) => isComplete(getSample(s.id))).length;

  if (!loaded) return <div style={{ color: C.text, padding: 40, fontFamily: "monospace" }}>Loading…</div>;

  return (
    <div style={s.app}>
      <style>{globalCSS}</style>
      <Header view={view} setView={setView} completedCount={completedCount} activeSample={activeSample} />
      {view === "dashboard" && (
        <Dashboard getSample={getSample} completedCount={completedCount}
          setView={setView} setActiveSample={setActiveSample} />
      )}
      {view === "sample" && activeSample && (
        <SampleView sample={activeSample} sampleData={getSample(activeSample.id)}
          updateSample={updateSample} setView={setView} />
      )}
      {view === "summary" && <Summary  getSample={getSample} />}
      {view === "export"  && <Export   getSample={getSample} />}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ view, setView, completedCount, activeSample }) {
  const days    = daysLeft();
  const urgency = days < 14 ? C.red : days < 30 ? TEMP_COLOR[140] : C.green;
  return (
    <header style={s.header}>
      <div style={s.hLeft}>
        <span style={s.logo}><span style={{ color: TEMP_COLOR[140] }}>◈</span> AgarTrack</span>
        {view === "sample" && activeSample && (
          <span style={{ color: C.muted, fontSize: 13 }}>/ {activeSample.label}</span>
        )}
      </div>
      <div style={s.hRight}>
        <div style={{ ...s.pill, background: urgency + "22", color: urgency, border: `1px solid ${urgency}55` }}>
          ⏱ {days}d left
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[["dashboard","Dashboard"],["summary","Results"],["export","Export"]].map(([v,l]) => (
            <button key={v} style={{ ...s.navBtn, ...(view===v ? { background: TEMP_COLOR[140]+"22", color: TEMP_COLOR[140] } : {}) }}
              onClick={() => setView(v)}>{l}</button>
          ))}
        </nav>
      </div>
    </header>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard({ getSample, completedCount, setView, setActiveSample }) {
  const pctAll = Math.round((completedCount / 27) * 100);
  return (
    <main style={s.main}>
      {/* overall bar */}
      <section style={s.card}>
        <div style={s.cardTitle}>Overall Progress</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginTop:12 }}>
          <div style={{ flex:1 }}>
            <div style={s.track}>
              <div style={{ ...s.fill, width:`${pctAll}%`, background:`linear-gradient(90deg,${TEMP_COLOR[140]},${TEMP_COLOR[180]})` }} />
            </div>
          </div>
          <div style={{ color:TEMP_COLOR[140], fontWeight:700, fontSize:22, whiteSpace:"nowrap" }}>
            {completedCount} / 27
          </div>
        </div>
        <div style={{ color:C.muted, fontSize:12, marginTop:6 }}>{pctAll}% complete · Thesis due 13 June 2026</div>
      </section>

      {/* one card per temperature */}
      {TEMP_GROUPS.map((temp) => {
        const tc          = TEMP_COLOR[temp];
        const timings     = [20, 30, 45];
        const groupSamples= ALL_SAMPLES.filter((s) => s.temp === temp);
        const groupDone   = groupSamples.filter((s) => isComplete(getSample(s.id))).length;

        return (
          <section key={temp} style={{ ...s.card, borderColor: tc + "44" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ ...s.cardTitle, color:tc }}>{temp} °C</div>
              <span style={{ ...s.pill, background:tc+"22", color:tc }}>{groupDone}/9 done</span>
            </div>
            <div style={s.track}>
              <div style={{ ...s.fill, width:`${(groupDone/9)*100}%`, background:`linear-gradient(90deg,${tc}88,${tc})` }} />
            </div>

            {/* 3 time-columns */}
            <div style={s.timeGrid}>
              {timings.map((time) => {
                const reps     = ALL_SAMPLES.filter((s) => s.temp===temp && s.time===time);
                const repsDone = reps.filter((s) => isComplete(getSample(s.id))).length;
                return (
                  <div key={time}>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:8, fontWeight:700,
                      textTransform:"uppercase", letterSpacing:"0.07em" }}>
                      {time} min <span style={{ color: repsDone===3 ? C.green : tc }}>{repsDone}/3</span>
                    </div>
                    {reps.map((sample) => {
                      const sd       = getSample(sample.id);
                      const stepsOk  = STEPS.filter((st) => sd.steps[st.id]).length;
                      const done     = isComplete(sd);
                      return (
                        <button key={sample.id}
                          style={{ ...s.repCard, borderColor: done ? C.green+"66" : tc+"33" }}
                          onClick={() => { setActiveSample(sample); setView("sample"); }}>
                          <div style={{ display:"flex", justifyContent:"space-between" }}>
                            <span style={{ fontWeight:700, color: done ? C.green : C.text }}>R{sample.rep}</span>
                            <span style={{ fontSize:10, color: done ? C.green : C.muted }}>{stepsOk}/{STEPS.length}</span>
                          </div>
                          <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:6 }}>
                            {STEPS.map((st) => (
                              <div key={st.id} style={{ width:5, height:5, borderRadius:"50%",
                                background: sd.steps[st.id] ? C.green : C.border }} />
                            ))}
                          </div>
                          {done && <div style={{ color:C.green, fontSize:10, marginTop:4 }}>✓ Complete</div>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}

// ── Sample View ────────────────────────────────────────────────────────────
function SampleView({ sample, sampleData: sd, updateSample, setView }) {
  const fileRef = useRef();
  const [tab, setTab] = useState("checklist");

  const toggleStep = (sid) => updateSample(sample.id, { steps:     { ...sd.steps,     [sid]: !sd.steps[sid] } });
  const toggleChem = (cid) => updateSample(sample.id, { chemicals: { ...sd.chemicals, [cid]: !sd.chemicals[cid] } });
  const set        = (f)   => (e) => updateSample(sample.id, { [f]: e.target.value });
  const setBool    = (f)   => (e) => updateSample(sample.id, { [f]: e.target.checked });

  const liqRate  = sd.w_biomass && sd.w_residue
    ? pct(num(sd.w_biomass) - num(sd.w_residue), num(sd.w_biomass)) : "—";
  const yieldPct = sd.w_biomass && sd.w_biopolyol_post
    ? pct(num(sd.w_biopolyol_post), num(sd.w_biomass)) : "—";

  const addPhoto = (e) => {
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        updateSample(sample.id, { photos: [...(sd.photos || []), ev.target.result] });
      reader.readAsDataURL(file);
    });
  };
  const removePhoto = (i) => {
    const photos = [...(sd.photos || [])]; photos.splice(i, 1);
    updateSample(sample.id, { photos });
  };

  const tc       = TEMP_COLOR[sample.temp];
  const stepsOk  = STEPS.filter((st) => sd.steps[st.id]).length;
  const done     = isComplete(sd);
  const TABS = [
    { id:"checklist", label:"Checklist" },
    { id:"data",      label:"Data" },
    { id:"photos",    label:`Photos (${(sd.photos||[]).length})` },
    { id:"notes",     label:"Notes" },
  ];

  return (
    <main style={s.main}>
      <button style={s.backBtn} onClick={() => setView("dashboard")}>← Back</button>

      <div style={{ ...s.card, borderColor: done ? C.green+"66" : tc+"44" }}>
        <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ ...s.cardTitle, color:tc }}>{sample.label}</div>
            <div style={{ color:C.muted, fontSize:12, marginTop:2 }}>ID: {sample.id}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color: done ? C.green : tc, fontWeight:700, fontSize:20 }}>{stepsOk}/{STEPS.length}</div>
            <div style={{ color:C.muted, fontSize:11 }}>steps</div>
          </div>
        </div>
        <div style={s.track}>
          <div style={{ ...s.fill,
            width:`${(stepsOk/STEPS.length)*100}%`,
            background: done
              ? `linear-gradient(90deg,${C.greenDim},${C.green})`
              : `linear-gradient(90deg,${tc}99,${tc})` }} />
        </div>
      </div>

      <div style={s.tabBar}>
        {TABS.map((t) => (
          <button key={t.id}
            style={{ ...s.tabBtn, ...(tab===t.id ? { background:tc+"22", color:tc, borderColor:tc+"55" } : {}) }}
            onClick={() => setTab(t.id)}>{t.label}
          </button>
        ))}
      </div>

      {tab === "checklist" && (
        <section style={s.card}>
          <div style={s.secTitle}>Chemical & Equipment Pre-check</div>
          {CHEMICALS.map((c) => (
            <label key={c.id} style={s.checkRow}>
              <input type="checkbox" checked={!!sd.chemicals[c.id]} onChange={() => toggleChem(c.id)} style={{ accentColor:tc, width:16, height:16, marginTop:2, flexShrink:0 }} />
              <div>
                <span style={{ color: sd.chemicals[c.id] ? C.green : C.text }}>{c.label}</span>
                <span style={{ color:C.muted, fontSize:11, marginLeft:8 }}>{c.amount}</span>
              </div>
            </label>
          ))}
          <div style={{ ...s.secTitle, marginTop:24 }}>Experiment Steps</div>
          {STEPS.map((st, i) => (
            <label key={st.id} style={s.checkRow}>
              <input type="checkbox" checked={!!sd.steps[st.id]} onChange={() => toggleStep(st.id)} style={{ accentColor:tc, width:16, height:16, marginTop:2, flexShrink:0 }} />
              <span style={{ color: sd.steps[st.id] ? C.green : C.text }}>
                <span style={{ color:C.muted, marginRight:8 }}>{i+1}.</span>{st.label}
              </span>
            </label>
          ))}
        </section>
      )}

      {tab === "data" && (
        <section style={s.card}>
          <div style={s.secTitle}>Weights</div>
          <div style={s.fGrid}>
            {[["w_biomass","W_biomass (g)"],["w_residue","W_residue (g)"],
              ["w_biopolyol_pre","W_bio-polyol before rotavap (g)"],
              ["w_biopolyol_post","W_bio-polyol after rotavap (g)"]].map(([f,l]) => (
              <label key={f} style={s.fLabel}>
                <span style={s.fName}>{l}</span>
                <input type="number" value={sd[f]} onChange={set(f)} style={s.input} placeholder="0.000" step="0.001" />
              </label>
            ))}
          </div>
          <div style={{ ...s.calcRow, borderColor: tc+"33", background: tc+"0c" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>Liquefaction Rate</div>
              <div style={{ fontSize:22, fontWeight:700, color:tc }}>{liqRate !== "—" ? `${liqRate}%` : "—"}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>Bio-polyol Yield</div>
              <div style={{ fontSize:22, fontWeight:700, color:C.green }}>{yieldPct !== "—" ? `${yieldPct}%` : "—"}</div>
            </div>
          </div>
          <div style={{ ...s.secTitle, marginTop:20 }}>Analytical Testing</div>
          <div style={s.fGrid}>
            {[["moisture","Moisture Content (%)"],["hydroxyl","Hydroxyl Value (mg KOH/g)"],
              ["acid","Acid Value (mg KOH/g)"],["viscosity","Viscosity (mPa·s)"]].map(([f,l]) => (
              <label key={f} style={s.fLabel}>
                <span style={s.fName}>{l}</span>
                <input type="number" value={sd[f]} onChange={set(f)} style={s.input} placeholder="—" step="0.01" />
              </label>
            ))}
          </div>
          <label style={{ ...s.checkRow, marginTop:12 }}>
            <input type="checkbox" checked={!!sd.ftir} onChange={setBool("ftir")} style={{ accentColor:tc, width:16, height:16, marginTop:2, flexShrink:0 }} />
            <span style={{ color: sd.ftir ? C.green : C.text }}>FTIR analysis done</span>
          </label>
        </section>
      )}

      {tab === "photos" && (
        <section style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={s.secTitle}>Sample Photos</div>
            <button style={{ ...s.accentBtn, background:`linear-gradient(135deg,${tc}cc,${tc})` }}
              onClick={() => fileRef.current.click()}>+ Add Photo</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
            style={{ display:"none" }} onChange={addPhoto} />
          {!(sd.photos||[]).length && (
            <div style={{ color:C.muted, textAlign:"center", padding:32 }}>
              No photos yet. Tap "Add Photo" to capture or upload.
            </div>
          )}
          <div style={s.photoGrid}>
            {(sd.photos||[]).map((src, i) => (
              <div key={i} style={s.photoWrap}>
                <img src={src} alt={`p${i}`} style={s.photo} />
                <button style={s.photoX} onClick={() => removePhoto(i)}>✕</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "notes" && (
        <section style={s.card}>
          <div style={s.secTitle}>Observations & Notes</div>
          <textarea value={sd.notes} onChange={set("notes")} style={s.textarea} rows={10}
            placeholder="Colour of product, smell, unusual observations, issues during experiment…" />
        </section>
      )}
    </main>
  );
}

// ── Summary ────────────────────────────────────────────────────────────────
function Summary({ getSample }) {
  return (
    <main style={s.main}>
      <section style={s.card}>
        <div style={s.cardTitle}>All 27 Samples</div>
        <div style={{ overflowX:"auto", marginTop:16 }}>
          <table style={s.table}>
            <thead><tr>
              {["Sample","T(°C)","t(min)","Rep","Liq.Rate%","Yield%","Moisture","OH Val","Acid Val","Viscosity","FTIR","Steps"]
                .map(h=><th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ALL_SAMPLES.map((sam) => {
                const sd  = getSample(sam.id);
                const liq = sd.w_biomass&&sd.w_residue ? pct(num(sd.w_biomass)-num(sd.w_residue),num(sd.w_biomass)) : "—";
                const yld = sd.w_biomass&&sd.w_biopolyol_post ? pct(num(sd.w_biopolyol_post),num(sd.w_biomass)) : "—";
                const tc  = TEMP_COLOR[sam.temp];
                return (
                  <tr key={sam.id} style={{ background: isComplete(sd) ? C.green+"0a" : "transparent" }}>
                    <td style={{ ...s.td, color:tc }}>{sam.id}</td>
                    <td style={{ ...s.td, color:tc }}>{sam.temp}</td>
                    <td style={s.td}>{sam.time}</td>
                    <td style={s.td}>{sam.rep}</td>
                    <td style={s.tdN}>{liq!=="—"?`${liq}%`:"—"}</td>
                    <td style={{ ...s.tdN, color:C.green }}>{yld!=="—"?`${yld}%`:"—"}</td>
                    <td style={s.tdN}>{sd.moisture||"—"}</td>
                    <td style={s.tdN}>{sd.hydroxyl||"—"}</td>
                    <td style={s.tdN}>{sd.acid||"—"}</td>
                    <td style={s.tdN}>{sd.viscosity||"—"}</td>
                    <td style={{ ...s.td, color:sd.ftir?C.green:C.muted }}>{sd.ftir?"✓":"✗"}</td>
                    <td style={s.tdN}>{STEPS.filter(st=>sd.steps[st.id]).length}/{STEPS.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={s.card}>
        <div style={s.cardTitle}>Group Averages (9 groups)</div>
        <div style={{ overflowX:"auto", marginTop:16 }}>
          <table style={s.table}>
            <thead><tr>
              {["Group","Avg Liq.Rate%","Avg Yield%","Avg OH Val","Avg Acid Val","Avg Viscosity","Done"]
                .map(h=><th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {PARAMETERS.map((param) => {
                const group = ALL_SAMPLES.filter(s=>s.temp===param.temp&&s.time===param.time);
                const sds   = group.map(s=>getSample(s.id));
                const avg   = (vals) => {
                  const nums = vals.filter(v=>v!==null&&v!=="");
                  return nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2) : "—";
                };
                const done  = sds.filter(sd=>isComplete(sd)).length;
                const tc    = TEMP_COLOR[param.temp];
                return (
                  <tr key={`${param.temp}_${param.time}`}>
                    <td style={{ ...s.td, color:tc, fontWeight:700 }}>{param.temp} °C / {param.time} min</td>
                    <td style={s.tdN}>{avg(sds.map(sd=>sd.w_biomass&&sd.w_residue?((num(sd.w_biomass)-num(sd.w_residue))/num(sd.w_biomass))*100:null))}</td>
                    <td style={{ ...s.tdN, color:C.green }}>{avg(sds.map(sd=>sd.w_biomass&&sd.w_biopolyol_post?(num(sd.w_biopolyol_post)/num(sd.w_biomass))*100:null))}</td>
                    <td style={s.tdN}>{avg(sds.map(sd=>sd.hydroxyl?num(sd.hydroxyl):null))}</td>
                    <td style={s.tdN}>{avg(sds.map(sd=>sd.acid?num(sd.acid):null))}</td>
                    <td style={s.tdN}>{avg(sds.map(sd=>sd.viscosity?num(sd.viscosity):null))}</td>
                    <td style={{ ...s.tdN, color:done===3?C.green:C.muted }}>{done}/3</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────
function Export({ getSample }) {
  const exportCSV = () => {
    const headers = ["Sample_ID","Temperature_C","Time_min","Replicate",
      "W_biomass_g","W_residue_g","W_biopolyol_pre_g","W_biopolyol_post_g",
      "Liquefaction_Rate_%","Biopolyol_Yield_%",
      "Moisture_Content","FTIR_Done","Hydroxyl_Value","Acid_Value","Viscosity_mPas",
      "Steps_Complete","Notes"];
    const rows = ALL_SAMPLES.map((sam) => {
      const sd  = getSample(sam.id);
      const liq = sd.w_biomass&&sd.w_residue ? pct(num(sd.w_biomass)-num(sd.w_residue),num(sd.w_biomass)) : "";
      const yld = sd.w_biomass&&sd.w_biopolyol_post ? pct(num(sd.w_biopolyol_post),num(sd.w_biomass)) : "";
      return [sam.id,sam.temp,sam.time,sam.rep,
        sd.w_biomass,sd.w_residue,sd.w_biopolyol_pre,sd.w_biopolyol_post,
        liq,yld,sd.moisture,sd.ftir?"Yes":"No",sd.hydroxyl,sd.acid,sd.viscosity,
        STEPS.filter(st=>sd.steps[st.id]).length,
        `"${(sd.notes||"").replace(/"/g,"'")}"`,
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type:"text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "FYP_Agarwood_Biopolyol_Data.csv";
    a.click();
  };

  return (
    <main style={s.main}>
      <section style={s.card}>
        <div style={s.cardTitle}>Export All Data</div>
        <p style={{ color:C.muted, marginTop:8, lineHeight:1.6 }}>
          Downloads all 27 sample records as a .csv file, ready for Excel, SPSS, or R.
        </p>
        <button style={{ ...s.accentBtn, background:`linear-gradient(135deg,${TEMP_COLOR[160]},${TEMP_COLOR[140]})`,
          marginTop:20, padding:"14px 28px", fontSize:15 }} onClick={exportCSV}>
          ⬇ Download CSV
        </button>
      </section>
    </main>
  );
}

// ── style tokens ───────────────────────────────────────────────────────────
const s = {
  app:      { background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'DM Mono','Fira Mono',monospace" },
  header:   { background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"12px 20px",
               display:"flex", justifyContent:"space-between", alignItems:"center",
               flexWrap:"wrap", gap:12, position:"sticky", top:0, zIndex:100 },
  hLeft:    { display:"flex", alignItems:"center", gap:12 },
  hRight:   { display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" },
  logo:     { fontWeight:700, fontSize:18, letterSpacing:"-0.5px" },
  pill:     { padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:700 },
  navBtn:   { background:"transparent", border:"none", color:C.muted, cursor:"pointer",
               padding:"6px 12px", borderRadius:8, fontSize:13, fontFamily:"inherit" },
  main:     { padding:"20px 16px", maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:16 },
  card:     { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px" },
  cardTitle:{ fontWeight:700, fontSize:15, letterSpacing:"-0.3px" },
  secTitle: { fontSize:11, fontWeight:700, color:TEMP_COLOR[140], textTransform:"uppercase",
               letterSpacing:"0.09em", marginBottom:12 },
  track:    { height:6, background:C.border, borderRadius:3, marginTop:10, overflow:"hidden" },
  fill:     { height:"100%", borderRadius:3, transition:"width 0.4s ease" },
  timeGrid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:14 },
  repCard:  { background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
               padding:"12px 10px", cursor:"pointer", textAlign:"left",
               fontFamily:"inherit", width:"100%", marginBottom:8 },
  tabBar:   { display:"flex", gap:4, overflowX:"auto", paddingBottom:2 },
  tabBtn:   { background:C.surface, border:`1px solid ${C.border}`, color:C.muted,
               cursor:"pointer", padding:"8px 14px", borderRadius:8, fontSize:13,
               fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 },
  checkRow: { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0",
               borderBottom:`1px solid ${C.border}`, cursor:"pointer", fontSize:14, lineHeight:1.4 },
  fGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  fLabel:   { display:"flex", flexDirection:"column", gap:4 },
  fName:    { fontSize:11, color:C.muted },
  input:    { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
               color:C.text, fontFamily:"inherit", fontSize:14, padding:"8px 10px",
               outline:"none", width:"100%", boxSizing:"border-box" },
  calcRow:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:16,
               padding:16, borderRadius:10, border:"1px solid" },
  photoGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10 },
  photoWrap:{ position:"relative", aspectRatio:"1", borderRadius:8, overflow:"hidden" },
  photo:    { width:"100%", height:"100%", objectFit:"cover" },
  photoX:   { position:"absolute", top:4, right:4, background:"#00000088", color:"#fff",
               border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer",
               fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" },
  textarea: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
               color:C.text, fontFamily:"inherit", fontSize:14, padding:"12px",
               width:"100%", boxSizing:"border-box", resize:"vertical", lineHeight:1.6, outline:"none" },
  table:    { width:"100%", borderCollapse:"collapse", fontSize:12 },
  th:       { color:C.muted, textAlign:"left", padding:"8px 10px", borderBottom:`1px solid ${C.border}`,
               whiteSpace:"nowrap", fontWeight:600 },
  td:       { color:C.text, padding:"8px 10px", borderBottom:`1px solid ${C.border}22`, fontSize:12 },
  tdN:      { color:TEMP_COLOR[140], padding:"8px 10px", borderBottom:`1px solid ${C.border}22`,
               fontSize:12, fontVariantNumeric:"tabular-nums" },
  accentBtn:{ color:"#0d1117", border:"none", borderRadius:8, padding:"9px 16px",
               cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 },
  backBtn:  { background:"transparent", border:`1px solid ${C.border}`, color:C.muted,
               borderRadius:8, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:13 },
};

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; }
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input:focus, textarea:focus { border-color: #f59e0b !important; box-shadow: 0 0 0 2px #f59e0b22; }
button:active { opacity: 0.75; }
::-webkit-scrollbar { width:6px; height:6px; }
::-webkit-scrollbar-track { background: #161b22; }
::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 3px; }
`;
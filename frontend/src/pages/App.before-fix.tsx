import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MapView } from '../components/MapView';
import { Icon } from '../components/Icon';
import { api, type CycleStatus, type Forecast, type Hazard, type Mode, type PointForecast, type ReplayFrame, type SkillModel, type Source, type Variable, type Verification, type Workspace } from '../lib/api';

const LEADS = [24, 48, 72, 96, 120];
const VARIABLES: { id: Variable; label: string; unit: string; title: string }[] = [
  { id: 'rainfall', label: 'Rainfall', unit: 'mm / 24h', title: '24-hour precipitation' },
  { id: 'temperature', label: 'Temperature', unit: '°C', title: '2 m air temperature' },
  { id: 'wind', label: 'Wind', unit: 'km/h', title: '10 m wind speed' },
];
const MODELS = ['ECMWF', 'AIFS', 'NCUM', 'GFS', 'GraphCast'];
const MODES: { id: Mode; label: string; description: string }[] = [
  { id: 'blend', label: 'MEGH blend', description: 'Contextual fused forecast' },
  { id: 'model', label: 'Source field', description: 'Individual model forecast' },
  { id: 'confidence', label: 'Confidence', description: 'Fusion confidence' },
  { id: 'disagreement', label: 'Disagreement', description: 'Inter-model spread' },
  { id: 'hazard', label: 'Hazard probability', description: 'Threshold-based signal' },
];
const LOCATIONS = [
  ['Pune', 18.52, 73.86], ['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21],
  ['Kolkata', 22.57, 88.36], ['Chennai', 13.08, 80.27], ['Guwahati', 26.14, 91.74],
] as const;

function formatValue(value: number, variable: Variable) {
  if (variable === 'rainfall') return `${value.toFixed(1)} mm`;
  if (variable === 'temperature') return `${value.toFixed(1)} °C`;
  return `${value.toFixed(1)} km/h`;
}
function percent(value: number) { return `${Math.round(value * 100)}%`; }
function variableMeta(variable: Variable) { return VARIABLES.find((item) => item.id === variable) ?? VARIABLES[0]; }
function pretty(value: string) { return value.replaceAll('_', ' '); }

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('forecast');
  const [variable, setVariable] = useState<Variable>('rainfall');
  const [lead, setLead] = useState(48);
  const [mode, setMode] = useState<Mode>('blend');
  const [model, setModel] = useState('ECMWF');
  const [lat, setLat] = useState(18.52);
  const [lon, setLon] = useState(73.86);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [selected, setSelected] = useState<PointForecast | null>(null);
  const [health, setHealth] = useState<'checking' | 'ok' | 'down'>('checking');
  const [dataMode, setDataMode] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cycle, setCycle] = useState<CycleStatus | null>(null);
  const [skill, setSkill] = useState<SkillModel[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [replay, setReplay] = useState<ReplayFrame[]>([]);
  const [autopsy, setAutopsy] = useState<Record<string, unknown> | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);

  const active = selected ?? forecast?.point ?? null;
  const meta = variableMeta(variable);

  const loadForecast = useCallback(async (nextLat = lat, nextLon = lon) => {
    setBusy(true);
    setError('');
    try {
      const result = await api.forecast({ variable, lead_hours: lead, latitude: nextLat, longitude: nextLon, model: mode === 'model' ? model : undefined });
      setForecast(result);
      setDataMode(result.data_mode);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Forecast request failed');
    } finally {
      setBusy(false);
    }
  }, [lat, lon, lead, variable, model, mode]);

  const refreshCycle = async () => {
    await Promise.allSettled([
      loadForecast(),
      api.cycle().then(setCycle),
      api.sources().then((result) => setSources(result.sources)),
    ]);
  };

  useEffect(() => {
    api.health()
      .then((result) => { setHealth('ok'); setDataMode(result.data_mode); })
      .catch(() => setHealth('down'));
    api.cycle().then(setCycle).catch(() => setCycle(null));
    api.sources().then((result) => setSources(result.sources)).catch(() => setSources([]));
  }, []);

  useEffect(() => {
    setSelected(null);
    loadForecast();
  }, [variable, lead, model, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    api.hazards(active.latitude, active.longitude, lead)
      .then((result) => setHazards(result.hazards))
      .catch(() => setHazards([]));
  }, [active?.latitude, active?.longitude, lead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (workspace === 'models') {
      Promise.all([api.skill(variable), api.sources()])
        .then(([skillResult, sourceResult]) => { setSkill(skillResult.models); setSources(sourceResult.sources); })
        .catch(() => setSkill([]));
    }
    if (workspace === 'verification') api.verification(variable).then(setVerification).catch(() => setVerification(null));
    if (workspace === 'replay') {
      api.replay(variable, 'west_monsoon_case').then((result) => setReplay(result.frames)).catch(() => setReplay([]));
      api.autopsy(variable, 'west_monsoon_case').then(setAutopsy).catch(() => setAutopsy(null));
    }
  }, [workspace, variable]);

  const chooseLocation = (name: string) => {
    const place = LOCATIONS.find((item) => item[0] === name);
    if (!place) return;
    setLat(place[1]);
    setLon(place[2]);
    setSelected(null);
    loadForecast(place[1], place[2]);
  };

  const selectPoint = async (point: PointForecast) => {
    setLat(point.latitude);
    setLon(point.longitude);
    setSelected(point);
    try {
      const decision = await api.weights(point.latitude, point.longitude, lead, variable);
      setSelected({
        ...point,
        confidence: decision.confidence,
        disagreement: decision.disagreement,
        regime: decision.regime,
        contributions: decision.contributors,
        top_model: decision.contributors[0]?.model,
        top_weight: decision.contributors[0]?.weight,
      });
    } catch {
      // The clicked grid cell is already a complete fallback.
    }
  };

  const topModel = active?.top_model ?? active?.contributions?.[0]?.model ?? '—';
  const topWeight = active?.top_weight ?? active?.contributions?.[0]?.weight ?? 0;
  const highHazard = (active?.hazard_probability ?? 0) >= 0.65;
  const methodology = useMemo(() => forecast?.methodology ?? [
    'Context-conditioned skill prior',
    'Atmospheric regime affinity',
    'Lead-time adjustment',
    'Outlier suppression',
    'Weighted ensemble spread',
  ], [forecast]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-name">MEGH</div>
            <div className="brand-subtitle">ADAPTIVE MULTI-MODEL WEATHER INTELLIGENCE</div>
          </div>
        </div>
        <div className="topbar-meta">
          <div className={`system-state ${health}`}><span />{health === 'ok' ? 'API ONLINE' : health === 'down' ? 'API OFFLINE' : 'CONNECTING'}</div>
          <div className="data-mode"><span>DATA MODE</span><b>{pretty(dataMode)}</b></div>
          <button className="refresh-button" onClick={refreshCycle} disabled={busy}><Icon name="refresh" size={14} />{busy ? 'Updating' : 'Refresh cycle'}</button>
        </div>
      </header>

      <nav className="workspace-nav" aria-label="MEGH workspaces">
        <div className="workspace-nav-inner">
          {([['forecast', 'Forecast', '01'], ['models', 'Model trust', '02'], ['verification', 'Verification', '03'], ['replay', 'Replay', '04']] as [Workspace, string, string][]).map(([id, label, number]) => (
            <button key={id} className={workspace === id ? 'active' : ''} onClick={() => setWorkspace(id)}>
              <span>{number}</span>{label}
            </button>
          ))}
          <div className="nav-context">NCMRWF · SIH 26081 · FORECAST FUSION LAYER</div>
        </div>
      </nav>

      {workspace === 'forecast' && (
        <>
          <section className="commandbar">
            <ControlGroup label="VARIABLE">
              <div className="segmented">{VARIABLES.map((item) => <button key={item.id} className={variable === item.id ? 'selected' : ''} onClick={() => setVariable(item.id)}>{item.label}</button>)}</div>
            </ControlGroup>
            <ControlGroup label="LEAD TIME">
              <div className="segmented">{LEADS.map((item) => <button key={item} className={lead === item ? 'selected' : ''} onClick={() => setLead(item)}>{item}h</button>)}</div>
            </ControlGroup>
            <ControlGroup label="SOURCE FIELD">
              <select value={model} onChange={(e) => { setModel(e.target.value); setMode('model'); }}>
                {MODELS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </ControlGroup>
            <ControlGroup label="FOCUS LOCATION">
              <select defaultValue="" onChange={(e) => chooseLocation(e.target.value)}>
                <option value="">Select location</option>
                {LOCATIONS.map((item) => <option key={item[0]} value={item[0]}>{item[0]}</option>)}
              </select>
            </ControlGroup>
            <ControlGroup label="MAP LAYER" wide>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </ControlGroup>
          </section>

          <main className="forecast-shell">
            <section className="map-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">FORECAST FIELD <span className="live-label">INTERACTIVE</span></div>
                  <h1>{meta.title}</h1>
                  <p>{lead}-hour · {MODES.find((item) => item.id === mode)?.description} · {meta.unit}</p>
                </div>
                <div className="run-summary">
                  <span>CYCLE</span><strong>{cycle?.cycle ?? 'DEMO-00Z'}</strong>
                  <small>{busy ? 'updating field' : `${cycle?.status ?? 'ready'} · ${pretty(dataMode)}`}</small>
                </div>
              </div>
              <MapView variable={variable} lead={lead} mode={mode} model={model} focus={{ lat, lon }} onSelect={selectPoint} />
              <div className="map-caption">
                <div className="scale-legend"><span>LOW</span><i /><span>HIGH</span></div>
                <span>Click a forecast cell to inspect its context, source weights and uncertainty.</span>
                <span className="caption-right">INDIA · 69–97°E · 8–36°N</span>
              </div>
            </section>

            <aside className="trace-panel">
              <div className="trace-header">
                <div><div className="eyebrow">DECISION TRACE</div><h2>{active ? `${active.latitude.toFixed(2)}°N · ${active.longitude.toFixed(2)}°E` : 'Select a map cell'}</h2></div>
                {busy && <span className="loading-chip">UPDATING</span>}
              </div>

              {active ? (
                <>
                  <section className="primary-reading">
                    <div className="eyebrow">{mode === 'model' ? `${model} FORECAST` : 'BLENDED FORECAST'}</div>
                    <strong>{formatValue(active.value, variable)}</strong>
                    <div className={`hazard-chip ${highHazard ? 'high' : ''}`}>{highHazard ? 'HIGH HAZARD SIGNAL' : 'NO HIGH HAZARD SIGNAL'}</div>
                    <div className="range-row"><span>{formatValue(active.lower, variable)}</span><i><em style={{ left: `${Math.max(4, Math.min(96, active.confidence * 100))}%` }} /></i><span>{formatValue(active.upper, variable)}</span></div>
                  </section>

                  <section className="trace-metrics">
                    <TraceMetric label="CONFIDENCE" value={percent(active.confidence)} note="fusion state" />
                    <TraceMetric label="DISAGREEMENT" value={percent(active.disagreement)} note="source spread" />
                    <TraceMetric label="TOP TRUST" value={`${topModel} · ${percent(topWeight)}`} note="current context" />
                  </section>

                  <section className="trace-section">
                    <div className="section-label"><span>MODEL CONTRIBUTION</span><em>CONTEXT WEIGHTED</em></div>
                    <div className="contribution-list">{(active.contributions ?? []).map((item) => <div className="contribution" key={item.model}><div><span>{item.model}</span><b>{percent(item.weight)}</b></div><i><em style={{ width: `${Math.round(item.weight * 100)}%` }} /></i><small>forecast {formatValue(item.forecast, variable)} · skill {Math.round(item.skill * 100)}%</small></div>)}</div>
                  </section>

                  <section className="trace-section context-section">
                    <div className="section-label"><span>CONTEXT</span><em>CURRENT STATE</em></div>
                    <div className="context-grid">
                      <div><span>REGIME</span><strong>{pretty(active.regime)}</strong></div>
                      <div><span>LEAD</span><strong>{lead}h</strong></div>
                      <div><span>VARIABLE</span><strong>{meta.label}</strong></div>
                      <div><span>LOCATION</span><strong>{active.latitude.toFixed(2)}, {active.longitude.toFixed(2)}</strong></div>
                    </div>
                  </section>

                  <section className="trace-section">
                    <div className="section-label"><span>HAZARD GUIDANCE</span><em>SPREAD-AWARE</em></div>
                    <div className="hazard-list">{hazards.map((item) => <div className="hazard-row" key={item.hazard}><div><strong>{pretty(item.hazard)}</strong><small>{item.basis}</small></div><b>{percent(item.probability)}</b></div>)}</div>
                  </section>

                  <section className="trace-section methodology">
                    <div className="section-label"><span>ROUTING LOGIC</span><em>MEGH</em></div>
                    {methodology.map((item, index) => <div className="method-row" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{pretty(item)}</p></div>)}
                  </section>
                </>
              ) : <EmptyState title="Select a forecast cell" copy="The trace panel becomes the inspection surface for the active point. Click any coloured field cell on the map." />}
            </aside>
          </main>
        </>
      )}

      {workspace === 'models' && <ModelWorkspace variable={variable} setVariable={setVariable} skill={skill} sources={sources} active={active} lead={lead} />}
      {workspace === 'verification' && <VerificationWorkspace variable={variable} setVariable={setVariable} verification={verification} />}
      {workspace === 'replay' && <ReplayWorkspace variable={variable} setVariable={setVariable} frames={replay} autopsy={autopsy} setAutopsy={setAutopsy} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame} />}

      {error && <div className="toast"><div><strong>REQUEST ERROR</strong><span>{error}</span></div><button onClick={() => loadForecast()}>Retry</button><button className="toast-close" onClick={() => setError('')}>×</button></div>}
      <footer className="footer"><span>MEGH · ADAPTIVE MULTI-MODEL WEATHER INTELLIGENCE</span><span>{pretty(dataMode)} · PROTOTYPE · NOT AN OPERATIONAL WARNING</span></footer>
    </div>
  );
}

function ControlGroup({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={`command-group ${wide ? 'wide' : ''}`}><span className="command-label">{label}</span><div className="control-frame">{children}</div></div>;
}
function TraceMetric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="trace-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function WorkspaceHead({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children?: ReactNode }) { return <div className="workspace-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{copy}</p></div>{children}</div>; }
function VariableSelect({ variable, setVariable }: { variable: Variable; setVariable: (value: Variable) => void }) { return <select className="workspace-select" value={variable} onChange={(event) => setVariable(event.target.value as Variable)}>{VARIABLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>; }
function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="empty-state"><div className="empty-index">—</div><h3>{title}</h3><p>{copy}</p></div>; }

function ModelWorkspace({ variable, setVariable, skill, sources, active, lead }: { variable: Variable; setVariable: (value: Variable) => void; skill: SkillModel[]; sources: Source[]; active: PointForecast | null; lead: number }) {
  const strongest = skill.length ? Math.max(...skill.map((item) => item.overall_skill)) : 0;
  return <main className="workspace-page">
    <WorkspaceHead eyebrow="02 / MODEL TRUST" title="Understand why MEGH trusts a source." copy="The trust workspace exposes the skill cube, source health and the exact context used by the router."><VariableSelect variable={variable} setVariable={setVariable} /></WorkspaceHead>
    <div className="kpi-grid">
      <Kpi label="Forecast sources" value={`${sources.filter((s) => s.family !== 'Verification').length}`} note="adapter catalog" />
      <Kpi label="Highest baseline" value={strongest ? `${Math.round(strongest * 100)}%` : '—'} note="demo calibration prior" />
      <Kpi label="Regime classes" value="06" note="context layer" />
      <Kpi label="Forecast horizon" value="24–120h" note="active UI range" />
    </div>
    <div className="split-grid">
      <section className="workspace-card">
        <CardTitle eyebrow="SOURCE CATALOG" title="Forecast inputs" meta="MODEL-AGNOSTIC" />
        <div className="source-table">{sources.map((source) => <div className="source-row" key={source.name}><div className="source-id"><span className="source-dot" /><div><strong>{source.name}</strong><small>{source.family} · {source.format}</small></div></div><span className={`status-tag ${source.status === 'adapter-ready' ? 'ready' : ''}`}>{source.status}</span><small>{source.refresh}</small></div>)}</div>
      </section>
      <section className="workspace-card">
        <CardTitle eyebrow="LIVE CONTEXT" title="Current routing state" meta={`${lead}H`} />
        {active ? <div className="live-context"><div><span>REGIME</span><strong>{pretty(active.regime)}</strong></div><div><span>LOCATION</span><strong>{active.latitude.toFixed(2)}°N · {active.longitude.toFixed(2)}°E</strong></div><div><span>TOP SOURCE</span><strong>{active.top_model ?? '—'} · {percent(active.top_weight ?? 0)}</strong></div><div><span>DISAGREEMENT</span><strong>{percent(active.disagreement)}</strong></div></div> : <EmptyState title="No active map point" copy="Return to Forecast and select a cell to populate this context summary." />}
      </section>
    </div>
    <section className="workspace-card">
      <CardTitle eyebrow="SKILL CUBE" title="Model × regime evidence" meta="DEMO CALIBRATION PRIOR" />
      <div className="skill-table">
        <div className="skill-head"><span>MODEL</span><span>BASELINE</span><span>HEALTH</span><span>REGIME RESPONSE</span></div>
        {skill.map((item) => <div className="skill-row" key={item.model}><strong>{item.model}</strong><b>{Math.round(item.overall_skill * 100)}%</b><span className="health-read"><i style={{ width: `${Math.round(item.health * 100)}%` }} />{Math.round(item.health * 100)}%</span><div className="regime-grid">{Object.entries(item.regimes).map(([regime, score]) => <span key={regime}><small>{pretty(regime)}</small><b>{Math.round(Number(score) * 100)}%</b></span>)}</div></div>)}
      </div>
    </section>
    <section className="workspace-card methodology-card"><CardTitle eyebrow="ROUTER CONTRACT" title="What changes the weight" meta="CONTEXT VECTOR" /><div className="factor-grid">{['Region', 'Lead time', 'Variable', 'Season', 'Weather regime', 'Recent model health', 'Inter-model spread', 'Source availability'].map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, '0')}</span><strong>{item}</strong><small>{factorDescription(item)}</small></div>)}</div></section>
  </main>;
}

function factorDescription(item: string) {
  const descriptions: Record<string, string> = {
    'Region': 'Spatially local skill', 'Lead time': 'Error grows with horizon', 'Variable': 'Rain, temperature and wind differ', 'Season': 'Seasonal error structure', 'Weather regime': 'Atmospheric-state affinity', 'Recent model health': 'Rolling performance and source quality', 'Inter-model spread': 'Agreement informs uncertainty', 'Source availability': 'Failed or stale sources are suppressed',
  };
  return descriptions[item];
}

function VerificationWorkspace({ variable, setVariable, verification }: { variable: Variable; setVariable: (value: Variable) => void; verification: Verification | null }) {
  return <main className="workspace-page"><WorkspaceHead eyebrow="03 / VERIFICATION" title="Prove the fusion before calling it better." copy="MEGH is only defensible when the same forecast cycles are compared against the same independent truth with leakage-safe validation."><VariableSelect variable={variable} setVariable={setVariable} /></WorkspaceHead>
    {!verification ? <EmptyState title="Loading verification" copy="Requesting the benchmark scaffold from the FastAPI service." /> : <>
      <div className="verification-banner"><div><strong>DEMO CALIBRATION SCAFFOLD</strong><span>These values are deterministic prototype evidence, not measured operational skill. Replace them with historical forecast/observation pairs before claiming improvement.</span></div><span className="status-tag">DATA MODE · {pretty(verification.data_mode)}</span></div>
      <section className="workspace-card"><CardTitle eyebrow="BENCHMARK" title="Reference methods" meta={`${verification.horizon_days}-DAY SCAFFOLD`} /><div className="benchmark-table"><div className="benchmark-head"><span>METHOD</span><span>ERROR</span><span>SKILL SCORE</span><span>ROLE</span></div>{verification.methods.map((method) => <div className="benchmark-row" key={method.method}><strong>{method.method}</strong><span>{method.mae_or_rmse.toFixed(2)}</span><span>{method.skill_score.toFixed(3)}</span><em>{method.method.toLowerCase().includes('megh') ? 'Contextual fusion candidate' : 'Reference baseline'}</em></div>)}</div></section>
      <div className="split-grid verification-grid"><section className="workspace-card"><CardTitle eyebrow="EVENT EVALUATION" title="Extreme-weather cases" meta="HELD-OUT REQUIRED" />{verification.event_cases.map((item) => <article className="event-case" key={item.event}><div><span className="case-index">CASE</span><h3>{item.event}</h3></div><div className="case-values"><div><b>{item.megh}</b><small>MEGH · {item.metric}</small></div><div><b>{item.simple_mme}</b><small>SIMPLE MME</small></div></div><p>{item.note}</p></article>)}</section><section className="workspace-card"><CardTitle eyebrow="VALIDATION PROTOCOL" title="What must be true" meta="RESEARCH CONTRACT" /><div className="protocol-list">{['Chronological train / validation / test split', 'Independent observation truth', 'Same domain, cycles and lead times', 'Climatology + individual + equal MME + static skill baselines', 'Extreme-event metrics separated from average error', 'Ablation tests for regime, health, lead and spatial context'].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p><b>REQUIRED</b></div>)}</div></section></div>
    </>}
  </main>;
}

function ReplayWorkspace({ variable, setVariable, frames, autopsy, setAutopsy, selectedFrame, setSelectedFrame }: { variable: Variable; setVariable: (value: Variable) => void; frames: ReplayFrame[]; autopsy: Record<string, unknown> | null; setAutopsy: (value: Record<string, unknown> | null) => void; selectedFrame: number | null; setSelectedFrame: (value: number | null) => void }) {
  const selected = selectedFrame === null ? frames[frames.length - 1] : frames[selectedFrame];
  const maxForecast = Math.max(...frames.map((frame) => frame.forecast), 1);
  return <main className="workspace-page"><WorkspaceHead eyebrow="04 / FORECAST REPLAY" title="Replay the trust decision, not just the final number." copy="Move through forecast lead time and inspect how confidence, disagreement, hazard signal and source weights evolve."><VariableSelect variable={variable} setVariable={setVariable} /></WorkspaceHead>
    <section className="workspace-card replay-card"><CardTitle eyebrow="WEST MONSOON CASE" title="Lead-time evolution" meta="DEMO EVENT" />{frames.length ? <>
      <div className="replay-chart"><div className="chart-axis"><span>{maxForecast.toFixed(0)}</span><span>0</span></div><svg viewBox="0 0 1000 260" preserveAspectRatio="none" aria-label="Replay forecast evolution"><line x1="30" y1="225" x2="980" y2="225" /><line x1="30" y1="20" x2="30" y2="225" /><polyline points={frames.map((frame, index) => `${60 + index * (880 / Math.max(1, frames.length - 1))},${225 - (frame.forecast / maxForecast) * 180}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" />{frames.map((frame, index) => <circle key={frame.lead_hours} cx={60 + index * (880 / Math.max(1, frames.length - 1))} cy={225 - (frame.forecast / maxForecast) * 180} r={selectedFrame === index ? 7 : 5} className="chart-point" onClick={() => setSelectedFrame(index)} />)}</svg></div>
      <div className="replay-track">{frames.map((frame, index) => <button key={frame.lead_hours} className={selectedFrame === index ? 'active' : ''} onClick={() => setSelectedFrame(index)}><span>T−{frame.lead_hours}H</span><b>{frame.forecast.toFixed(1)}</b><i><em style={{ width: `${Math.round(frame.confidence * 100)}%` }} /></i><small>{Math.round(frame.confidence * 100)}% confidence</small></button>)}</div>
      {selected && <div className="replay-detail"><div><span>FRAME</span><strong>T−{selected.lead_hours}h</strong></div><div><span>FORECAST</span><strong>{selected.forecast.toFixed(1)}</strong></div><div><span>CONFIDENCE</span><strong>{percent(selected.confidence)}</strong></div><div><span>DISAGREEMENT</span><strong>{percent(selected.disagreement)}</strong></div><div><span>HAZARD</span><strong>{percent(selected.hazard_probability)}</strong></div><div className="replay-weights"><span>SOURCE WEIGHTS</span><strong>{Object.entries(selected.weights).map(([name, weight]) => `${name} ${percent(weight)}`).join(' · ')}</strong></div></div>}
    </> : <EmptyState title="Replay unavailable" copy="The API did not return a replay frame set." />}</section>
    <div className="replay-actions"><button onClick={() => api.autopsy(variable, 'west_monsoon_case').then(setAutopsy)}>Run forecast autopsy <span>→</span></button><span>Reconstructs the routing state and verification readiness for the selected event.</span></div>
    {autopsy && <section className="workspace-card autopsy"><CardTitle eyebrow="FORECAST AUTOPSY" title="System explanation" meta="PROVENANCE VIEW" /><div className="autopsy-grid"><AutopsyItem label="Summary" value={String(autopsy.summary ?? '—')} wide />{Array.isArray(autopsy.checks) && autopsy.checks.map((check: any) => <AutopsyItem key={check.name} label={String(check.name)} value={`${String(check.status)}${check.value !== undefined ? ` · ${check.value}` : ''}`} />)}</div></section>}
  </main>;
}

function CardTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) { return <div className="card-title-row"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><span>{meta}</span></div>; }
function AutopsyItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'autopsy-item wide' : 'autopsy-item'}><span>{label}</span><strong>{value}</strong></div>; }
function Kpi({ label, value, note }: { label: string; value: string; note: string }) { return <div className="kpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }

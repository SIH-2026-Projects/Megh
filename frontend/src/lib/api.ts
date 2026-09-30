export const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 180)}` : ''}`);
  }

  return response.json() as Promise<T>;
}

export type Variable = 'rainfall' | 'temperature' | 'wind';
export type Mode = 'blend' | 'model' | 'confidence' | 'disagreement' | 'hazard';
export type Workspace = 'forecast' | 'models' | 'verification' | 'replay';

export type Source = { name: string; family: string; format: string; status: string; refresh: string };

export type Contribution = {
  model: string;
  weight: number;
  forecast: number;
  skill: number;
  regime_affinity: number;
  recent_bias: number;
  outlier_penalty: number;
};

export type PointForecast = {
  latitude: number;
  longitude: number;
  value: number;
  lower: number;
  upper: number;
  confidence: number;
  disagreement: number;
  hazard_probability: number;
  regime: string;
  contributions: Contribution[];
  top_model?: string;
  top_weight?: number;
};

export type Forecast = {
  product?: string;
  variable: Variable;
  lead_hours: number;
  valid_time: string;
  data_mode: string;
  point: PointForecast;
  methodology: string[];
};

export type GridFeature = {
  type: 'Feature';
  properties: PointForecast;
  geometry: { type: 'Point'; coordinates: [number, number] };
};

export type GridResponse = {
  type: 'FeatureCollection';
  data_mode: string;
  variable: Variable;
  lead_hours: number;
  features: GridFeature[];
};

export type SkillModel = {
  model: string;
  overall_skill: number;
  regimes: Record<string, number>;
  health: number;
};

export type Verification = {
  data_mode: string;
  variable: Variable;
  horizon_days: number;
  methods: { method: string; mae_or_rmse: number; skill_score: number }[];
  event_cases: { event: string; metric: string; megh: number; simple_mme: number; note: string }[];
};

export type ReplayFrame = {
  lead_hours: number;
  forecast: number;
  confidence: number;
  disagreement: number;
  hazard_probability: number;
  weights: Record<string, number>;
};

export type Hazard = {
  hazard: string;
  probability: number;
  basis: string;
  value: number;
};

export type CycleStatus = {
  cycle: string;
  status: string;
  generated_at: string;
  steps: { id: string; label: string; status: string }[];
};

export const api = {
  sources: async () => {
    const result = await request<Source[] | { sources: Source[] }>('/sources');
    return Array.isArray(result) ? { sources: result } : result;
  },
  health: () => request<{ status: string; service: string; version: string; data_mode: string }>('/health'),
  forecast: (p: { variable: Variable; lead_hours: number; latitude: number; longitude: number; model?: string }) =>
    request<Forecast>('/forecast', { method: 'POST', body: JSON.stringify(p) }),
  grid: (variable: Variable, lead: number, model?: string) =>
    request<GridResponse>(`/forecast/grid?variable=${variable}&lead_hours=${lead}&step=1.25${model ? `&model=${encodeURIComponent(model)}` : ''}`),
  weights: (lat: number, lon: number, lead: number, variable: Variable) =>
    request<{ regime: string; confidence: number; disagreement: number; contributors: Contribution[] }>(
      `/weights?latitude=${lat}&longitude=${lon}&lead_hours=${lead}&variable=${variable}`,
    ),
  hazards: (lat: number, lon: number, lead: number) =>
    request<{ hazards: Hazard[]; data_mode: string }>(`/hazards?latitude=${lat}&longitude=${lon}&lead_hours=${lead}`),
  skill: (variable: Variable) => request<{ models: SkillModel[] }>(`/models/skill?variable=${variable}`),
  verification: (variable: Variable) => request<Verification>(`/verification?variable=${variable}`),
  replay: (variable: Variable, eventId: string) =>
    request<{ frames: ReplayFrame[]; data_mode: string }>(`/replay?variable=${variable}&event_id=${eventId}`),
  autopsy: (variable: Variable, eventId: string) => request<Record<string, unknown>>(`/autopsy?variable=${variable}&event_id=${eventId}`),
  cycle: () => request<CycleStatus>('/operations/cycle'),
};

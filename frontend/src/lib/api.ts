// HealthVault API client
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://srv1424731.hstgr.cloud';

async function apiFetch<T>(
  path: string,
  options: {
    token?: string;
    body?: unknown;
    method?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { token, body, method = 'GET', headers: extraHeaders = {} } = options;
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Auth ────────────────────────────────────────────────
export interface UserProfile {
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  country: string | null;
  smoking_status: string | null;
  alcohol_use: string | null;
  physical_activity: string | null;
  additional_notes: string | null;
}

export interface UserCondition {
  code: string;
  name: string;
  category: string;
  is_diagnosed: boolean;
  notes?: string | null;
}

export interface MeResponse {
  id: string;
  email: string;
  sex: string | null;
  clerk_id: string;
  created_at: string;
  profile: UserProfile;
  conditions: UserCondition[];
}

export async function getMe(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/auth/me', { token });
}

export async function updateMe(token: string, body: {
  sex?: string;
  date_of_birth?: string;
  height_cm?: number;
  weight_kg?: number;
  country?: string;
  smoking_status?: string;
  alcohol_use?: string;
  physical_activity?: string;
  additional_notes?: string;
  condition_codes?: string[];
  is_diagnosed_map?: Record<string, boolean>;
}): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/auth/me', { token, body, method: 'PATCH' });
}

// ── Conditions ────────────────────────────────────────────
export interface Condition {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export async function getConditions(): Promise<Condition[]> {
  return apiFetch<Condition[]>('/api/conditions');
}

// ── Documents ────────────────────────────────────────────
export interface Document {
  id: string;
  document_type: string;
  file_type: string;
  created_at: string;
  summary?: string;
}

export interface DocumentDetail extends Document {
  file_path: string;
  fhir_resource: unknown;
  extracted_text: string;
  observations: Observation[];
}

export interface Observation {
  code: string;
  display_name: string;
  value: number | null;
  unit: string;
  interpretation?: string;
  effective_date?: string;
  reference_range_low?: number | null;
  reference_range_high?: number | null;
}

export interface UploadResponse {
  id: string;
  document_type: string;
  file_path: string;
  observations: Observation[];
  created_at: string;
}

export interface BiomarkerSummary {
  items: Observation[];
  total?: number;
}

export async function listDocuments(token: string, params: { limit?: number; page?: number; type?: string } = {}) {
  const sp = new URLSearchParams();
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.page) sp.set('page', String(params.page));
  if (params.type) sp.set('type', params.type);
  return apiFetch<{ items: Document[]; total: number; page: number }>(`/api/documents?${sp}`, { token });
}

export async function uploadDocument(token: string, file: File, documentType?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (documentType) formData.append('document_type', documentType);
  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Upload failed ${res.status}`);
  }
  return res.json() as Promise<UploadResponse>;
}

export async function listBiomarkers(token: string) {
  return apiFetch<BiomarkerSummary>('/api/analyze/biomarkers', { token });
}

export async function analyzeDocuments(token: string, documentIds?: string[]) {
  return apiFetch<{ biomarkers: Observation[]; deviations: Observation[]; risk_factors: string[]; recommendations: string[]; summary: string; confidence: number }>(
    '/api/analyze',
    { token, body: { document_ids: documentIds }, method: 'POST' }
  );
}

// ── Coach ────────────────────────────────────────────────
export interface ChatMessage {
  role: string;
  content: string;
  sources?: string[];
  created_at?: string;
}

export async function createCoachSession(token: string) {
  return apiFetch<{ session_id: string }>('/api/coach/session', { token, method: 'POST' });
}

export async function coachChat(token: string, sessionId: string, message: string) {
  return apiFetch<{ reply: string; sources?: string[] }>('/api/coach/chat', { token, body: { session_id: sessionId, message }, method: 'POST' });
}

export async function getCoachHistory(token: string, sessionId: string) {
  return apiFetch<{ messages: ChatMessage[] }>(`/api/coach/history?session_id=${sessionId}`, { token });
}

// ── Documents ────────────────────────────────────────────
export async function deleteDocument(token: string, docId: string) {
  return apiFetch<void>(`/api/documents/${docId}`, { token, method: 'DELETE' });
}

// Aliases (for backward compat with existing pages)
export {
  createCoachSession as createChatSession,
  coachChat as chat,
  getCoachHistory as getChatHistory,
};
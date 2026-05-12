// HealthVault API client
// All calls go through the backend API, authenticated via Clerk JWT

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

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error ${res.status}`);
  }

  return res.json();
}

// ── Auth ────────────────────────────────────────────────
export async function getMe(token: string) {
  return apiFetch<{ id: string; email: string; clerk_id: string; created_at: string }>(
    '/api/auth/me',
    { token }
  );
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
  reference_range_low: number | null;
  reference_range_high: number | null;
  interpretation: string;
  effective_date?: string;
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  limit: number;
}

export async function listDocuments(token: string, params: {
  type?: string;
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);

  return apiFetch<DocumentListResponse>(`/api/documents?${q}`, { token });
}

export async function getDocument(token: string, docId: string) {
  return apiFetch<DocumentDetail>(`/api/documents/${docId}`, { token });
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

  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function deleteDocument(token: string, docId: string) {
  return apiFetch<{ status: string }>(`/api/documents/${docId}`, {
    method: 'DELETE',
    token,
  });
}

// ── Analyze ──────────────────────────────────────────────
export interface AnalysisResult {
  biomarkers: Observation[];
  deviations: Observation[];
  risk_factors: string[];
  recommendations: string[];
  summary: string;
  confidence: number;
}

export async function analyzeDocuments(token: string, documentIds?: string[]) {
  return apiFetch<AnalysisResult>('/api/analyze', {
    method: 'POST',
    token,
    body: { document_ids: documentIds },
  });
}

export async function listBiomarkers(token: string, params: {
  code?: string;
  date_from?: string;
  date_to?: string;
} = {}) {
  const q = new URLSearchParams();
  if (params.code) q.set('code', params.code);
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);

  return apiFetch<{ items: Observation[] }>(`/api/analyze/biomarkers?${q}`, { token });
}

// ── Coach ────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources: string[];
  created_at: string;
}

export interface ChatSession {
  session_id: string;
  messages: ChatMessage[];
}

export async function createChatSession(token: string) {
  return apiFetch<{ session_id: string }>('/api/coach/session', {
    method: 'POST',
    token,
  });
}

export async function chat(token: string, sessionId: string, message: string) {
  return apiFetch<{ reply: string; sources: string[]; disclaimer: string }>(
    '/api/coach/chat',
    { method: 'POST', token, body: { session_id: sessionId, message } }
  );
}

export async function getChatHistory(token: string, sessionId: string) {
  return apiFetch<ChatSession>(`/api/coach/history?session_id=${sessionId}`, { token });
}
import type { Session } from "next-auth";

const API_BASE = process.env.INTERNAL_API_URL || "http://api:8000";
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "dev-internal-token";

export function apiUserHeaders(session: Session): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Internal-Token": INTERNAL_TOKEN,
    "X-User-Id": session.user.id,
    "X-User-Role": session.user.role,
  };
}

async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_TOKEN,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API error ${response.status}`);
  }

  return response.json();
}

export async function getIngestStatus() {
  return apiFetch("/admin/ingest/status");
}

export async function getIngestPages(limit = 50, offset = 0) {
  return apiFetch(`/admin/ingest/pages?limit=${limit}&offset=${offset}`);
}

export async function triggerIngestSync(type: "full" | "incremental") {
  return apiFetch("/admin/ingest/sync", {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export async function listConversations(session: Session) {
  return apiFetch("/chat/conversations", { headers: apiUserHeaders(session) });
}

export async function createConversation(session: Session, title = "Nueva conversación") {
  return apiFetch("/chat/conversations", {
    method: "POST",
    headers: apiUserHeaders(session),
    body: JSON.stringify({ title }),
  });
}

export async function getConversation(session: Session, conversationId: string) {
  return apiFetch(`/chat/conversations/${conversationId}`, {
    headers: apiUserHeaders(session),
  });
}

export async function deleteConversation(session: Session, conversationId: string) {
  return apiFetch(`/chat/conversations/${conversationId}`, {
    method: "DELETE",
    headers: apiUserHeaders(session),
  });
}

export async function getHealthSummary() {
  return apiFetch("/health/summary");
}

export async function getHealthFindings(params?: {
  detector?: string;
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.detector) qs.set("detector", params.detector);
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiFetch(`/health/findings${query ? `?${query}` : ""}`);
}

export async function triggerHealthScan(session: Session) {
  return apiFetch("/health/scan", {
    method: "POST",
    headers: apiUserHeaders(session),
  });
}

export async function updateFindingStatus(
  session: Session,
  findingId: string,
  status: string,
) {
  return apiFetch(`/health/findings/${findingId}`, {
    method: "PATCH",
    headers: apiUserHeaders(session),
    body: JSON.stringify({ status }),
  });
}

export async function listRunbooks(session: Session, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch(`/runbooks${qs}`, { headers: apiUserHeaders(session) });
}

export async function getRunbook(session: Session, runbookId: string) {
  return apiFetch(`/runbooks/${runbookId}`, { headers: apiUserHeaders(session) });
}

export async function createRunbookFromPage(session: Session, pageId: string) {
  return apiFetch("/runbooks/from-page", {
    method: "POST",
    headers: apiUserHeaders(session),
    body: JSON.stringify({ page_id: pageId }),
  });
}

export async function updateRunbook(session: Session, runbookId: string, payload: object) {
  return apiFetch(`/runbooks/${runbookId}`, {
    method: "PATCH",
    headers: apiUserHeaders(session),
    body: JSON.stringify(payload),
  });
}

export async function publishRunbook(session: Session, runbookId: string) {
  return apiFetch(`/runbooks/${runbookId}/publish`, {
    method: "POST",
    headers: apiUserHeaders(session),
  });
}

export async function startRunbookSession(
  session: Session,
  runbookId: string,
  context: Record<string, string>,
) {
  return apiFetch(`/runbooks/${runbookId}/sessions`, {
    method: "POST",
    headers: apiUserHeaders(session),
    body: JSON.stringify({ context }),
  });
}

export interface ChatInstructionsPayload {
  user: { content: string; updated_at: string | null };
  team: { content: string; updated_at: string | null; updated_by: string | null };
}

export async function getChatInstructions(session: Session): Promise<ChatInstructionsPayload> {
  return apiFetch("/chat/instructions", { headers: apiUserHeaders(session) });
}

export async function updateUserChatInstructions(session: Session, content: string) {
  return apiFetch("/chat/instructions/user", {
    method: "PUT",
    headers: apiUserHeaders(session),
    body: JSON.stringify({ content }),
  });
}

export async function updateTeamChatInstructions(session: Session, content: string) {
  return apiFetch("/chat/instructions/team", {
    method: "PUT",
    headers: apiUserHeaders(session),
    body: JSON.stringify({ content }),
  });
}

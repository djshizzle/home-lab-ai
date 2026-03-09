/**
 * AVops API client — thin fetch wrapper pointing to FastAPI backend.
 */

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Ticket {
  ticket_id: string;
  created_at: string;
  updated_at: string;
  status: "open" | "in_progress" | "resolved" | "error";
  priority: "critical" | "high" | "medium" | "low";
  intent: string;
  webex_room_id: string;
  webex_person_email: string;
  message: string;
  room_id: string;
  device_id: string;
  resolution?: string;
  agent_workflow: AgentEvent[];
}

export interface AgentEvent {
  agent: string;
  output_summary: string;
  timestamp: string;
}

export interface Device {
  device_id: string;
  room_id: string;
  model: string;
  vendor: string;
  hostname: string;
  ip_address: string;
  firmware_version: string;
  webex_supported: boolean;
  status: string;
  updated_at: string;
}

export interface HealthCheck {
  status: string;
  checks: Record<string, string>;
}

// ── API Calls ─────────────────────────────────────────────────────────────────

export const api = {
  health: {
    check: () => request<HealthCheck>("/ready"),
  },

  tickets: {
    list: (status = "open", limit = 50) =>
      request<{ tickets: Ticket[]; count: number }>(
        `/tickets?status=${status}&limit=${limit}`
      ),
    get: (ticketId: string) => request<Ticket>(`/tickets/${ticketId}`),
    updateStatus: (ticketId: string, createdAt: string, status: string) =>
      request<{ ticket_id: string; status: string }>(`/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, created_at: createdAt }),
      }),
  },

  devices: {
    list: () => request<{ devices: Device[]; count: number }>("/devices"),
    byRoom: (roomId: string) =>
      request<{ room_id: string; devices: Device[]; count: number }>(
        `/devices/room/${roomId}`
      ),
  },
};

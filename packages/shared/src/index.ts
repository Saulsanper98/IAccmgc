/**
 * Shared types — OpenAPI-generated client will live in ./generated/
 * Phase 0: placeholder exports for monorepo structure.
 */

export type HealthStatus = "ok" | "degraded" | "down";

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency_ms: number | null;
  message: string | null;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  components: ComponentHealth[];
}

export type UserRole = "admin" | "editor" | "lector";

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  requestId?: string;
  timestamp?: string;
}

export interface ReportingResponseMeta extends ApiResponseMeta {
  dataAsOf: string; // ISO 8601 timestamp of projection calculation
  projectionLagMs: number; // Staleness / lag duration in milliseconds
  isEventuallyConsistent: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiResponseMeta;
}

export interface ReportingResponse<T = unknown> extends ApiResponse<T> {
  meta?: ReportingResponseMeta;
}

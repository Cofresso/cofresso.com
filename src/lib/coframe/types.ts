export interface CoframeIdentifyItem {
  user_token: string;
  external_id: string;
  external_id_type: string;
}

export interface CoframeIdentifyPayload {
  data: CoframeIdentifyItem[];
}

export interface CoframeConversionItem {
  event_name: string;
  event_time: number; // Unix timestamp in seconds
  event_id?: string;
  action_source?: 'server' | 'website' | 'app' | 'shopify_webhook' | 'shopify_pixel' | string;
  value?: number;
  user_token?: string;
  external_id?: string;
  external_id_type?: string;
  url?: string;
  custom_data?: Record<string, unknown>;
  user_data?: {
    email_sha256?: string;
    phone_sha256?: string;
    [key: string]: unknown;
  };
}

export interface CoframeConversionPayload {
  data: CoframeConversionItem[];
}

export interface CoframeResponseMeta {
  'powered-by'?: string;
  'trace-id'?: string;
  timestamp?: number;
}

export interface CoframeApiResponse {
  meta?: CoframeResponseMeta;
  [key: string]: unknown;
}

export type CoframeSendResult =
  | { ok: true; traceId?: string; data?: CoframeApiResponse; skipped?: false }
  | { ok: false; skipped: true; error: string }
  | { ok: false; skipped?: false; error: string; status?: number };

export interface CoframeClientOptions {
  apiKey?: string;
  projectId?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

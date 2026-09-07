/**
 * The presenter's pre-flight report: which parts of the demo are actually wired
 * up, and with what. Every optional integration here degrades quietly by design
 * — an unset memory store, an absent ConversationRelay URL, a session still in
 * rehearsal — which is exactly why they need somewhere to be *visible*. Finding
 * out on stage that memory was never configured is the failure this prevents.
 */

/**
 * `ok` — configured and reachable. `off` — deliberately not configured; the demo
 * degrades to its fallback. `warn` — configured but not in the state you want on
 * stage (rehearsal gate down, dev bypass on). `error` — configured but broken,
 * the only state that is unambiguously a problem.
 */
export type FeatureState = 'ok' | 'off' | 'warn' | 'error';

export interface FeatureStatus {
  id: string;
  label: string;
  state: FeatureState;
  /** One line: what this state means for the presentation, not what it is. */
  detail: string;
  /** Configured values worth reading on stage — sids, numbers, model names. */
  values?: Array<{ label: string; value: string }>;
}

/** One pool number and the session holding it, if any. */
export interface PhonePoolEntry {
  phoneNumber: string;
  sessionId?: string;
  sessionTitle?: string;
  joinCode?: string;
  /** True for the number this session's own SMS and calls go out from. */
  isThisSession: boolean;
}

export interface FeatureReport {
  features: FeatureStatus[];
  phonePool: PhonePoolEntry[];
  generatedAt: number;
}

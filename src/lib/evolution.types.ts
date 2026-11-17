export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface QueueState {
  isRunning: boolean;
  isPaused: boolean;
  currentContactId: string | null;
  currentContactName: string | null;
  currentContactPhone: string | null;
  currentContactPreview: string | null;
  currentStatus: "idle" | "sending" | "sent" | "error" | "paused" | "waiting";
  currentError: string | null;
  lastSentAt: string | null;
  nextRunAt: string | null;
  dailySentCount: number;
  dailySentDate: string; // YYYY-MM-DD no fuso America/Sao_Paulo
  totalEligible: number;
  evolutionConfigured: boolean;
  evolutionApiUrl?: string;
  evolutionInstanceName?: string;
  evolutionApiKeyMasked?: string;
}

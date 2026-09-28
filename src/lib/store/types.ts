import type { AlertRule, RuleType } from "@/lib/alerts/engine";
import type { ActivityEvent } from "@/lib/types";
import type { PlanId } from "@/lib/plans";

export type ChannelType = "email" | "telegram" | "discord" | "webhook";

export type StoreUser = {
  id: string;
  email: string;
  plan: PlanId;
  createdAt: number;
};

/** What the payment provider knows about this account. All empty until a checkout completes. */
export type BillingRecord = {
  customerId: string | null;
  subscriptionId: string | null;
  /** Stripe subscription status, e.g. active, trialing, past_due, canceled. */
  status: string | null;
  /** End of the paid period, ms. The plan renews or ends here. */
  periodEnd: number | null;
  /** True when the subscription is set to end at periodEnd. */
  cancelAtPeriodEnd: boolean;
};

export const EMPTY_BILLING: BillingRecord = {
  customerId: null,
  subscriptionId: null,
  status: null,
  periodEnd: null,
  cancelAtPeriodEnd: false,
};

export type RuleInput = {
  eventType: RuleType;
  asset?: string | null;
  threshold?: number | null;
  direction?: "INCOMING" | "OUTGOING" | "ANY" | null;
  enabled?: boolean;
};

export type ChannelInput = {
  type: ChannelType;
  target: string;
};

export type WatchRecord = {
  id: string;
  userId: string;
  address: string;
  createdAt: number;
  cursor: number;
  /** 0 sends every match. Otherwise the watch stays quiet for this long after a send. */
  cooldownMs: number;
  /** Wall-clock time of the last match that was queued for delivery. */
  lastNotifiedAt: number;
  rules: AlertRule[];
  channels: Array<{ id: string; type: ChannelType; target: string }>;
};

export type StoredAlert = {
  id: string;
  watchId: string;
  userId: string;
  address: string;
  ruleType: RuleType;
  summary: string;
  detail: string;
  hash: string;
  amountUsd: number;
  timestamp: number;
  delivery: string;
};

export type NewAlertEvent = {
  alertId: string;
  hash: string;
  summary: string;
  detail: string;
  amountUsd: number;
  timestamp: number;
};

export type StoredNotification = {
  id: string;
  userId: string;
  alertEventId?: string;
  channel: ChannelType;
  target: string;
  status: string;
  payload: string;
  error?: string;
  attempts?: number;
  nextAttemptAt?: number;
};

export type NewNotification = {
  userId: string;
  alertEventId?: string;
  channel: ChannelType;
  target: string;
  payload: string;
  /** "pending" queues delivery. "logged" records history without sending. */
  status?: "pending" | "logged";
  error?: string;
};

export interface AppStore {
  upsertUser(email: string): Promise<StoreUser>;
  getUserById(id: string): Promise<StoreUser | null>;
  getUserByEmail(email: string): Promise<StoreUser | null>;
  /** Null when the account has never set a password. */
  getPasswordHash(userId: string): Promise<string | null>;
  setPasswordHash(userId: string, hash: string): Promise<void>;
  setPlan(userId: string, plan: PlanId): Promise<StoreUser>;
  getBilling(userId: string): Promise<BillingRecord>;
  setBilling(userId: string, billing: Partial<BillingRecord>): Promise<BillingRecord>;
  getUserByCustomerId(customerId: string): Promise<StoreUser | null>;
  listWatches(userId: string): Promise<WatchRecord[]>;
  listAllWatches(): Promise<WatchRecord[]>;
  createWatch(input: {
    userId: string;
    address: string;
    rules: RuleInput[];
    channels: ChannelInput[];
    cooldownMs?: number;
  }): Promise<WatchRecord>;
  deleteWatch(userId: string, watchId: string): Promise<void>;
  setCooldown(userId: string, watchId: string, cooldownMs: number): Promise<WatchRecord>;
  updateCursor(watchId: string, cursor: number): Promise<void>;
  markNotified(watchId: string, at: number): Promise<void>;
  listAlertEvents(userId: string, limit?: number): Promise<StoredAlert[]>;
  insertAlertEvents(events: NewAlertEvent[]): Promise<StoredAlert[]>;
  enqueueNotifications(items: NewNotification[]): Promise<void>;
  claimPendingNotifications(limit: number): Promise<StoredNotification[]>;
  markNotification(
    id: string,
    status: string,
    error?: string,
    retry?: { attempts: number; nextAttemptAt: number },
  ): Promise<void>;
  upsertActivity(events: ActivityEvent[]): Promise<void>;
  listActivity(): Promise<ActivityEvent[]>;
}

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

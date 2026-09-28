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
  setPlan(userId: string, plan: PlanId): Promise<StoreUser>;
  listWatches(userId: string): Promise<WatchRecord[]>;
  listAllWatches(): Promise<WatchRecord[]>;
  createWatch(input: {
    userId: string;
    address: string;
    rules: RuleInput[];
    channels: ChannelInput[];
  }): Promise<WatchRecord>;
  deleteWatch(userId: string, watchId: string): Promise<void>;
  updateCursor(watchId: string, cursor: number): Promise<void>;
  listAlertEvents(userId: string, limit?: number): Promise<StoredAlert[]>;
  insertAlertEvents(events: NewAlertEvent[]): Promise<StoredAlert[]>;
  enqueueNotifications(items: NewNotification[]): Promise<void>;
  claimPendingNotifications(limit: number): Promise<StoredNotification[]>;
  markNotification(id: string, status: string, error?: string): Promise<void>;
  upsertActivity(events: ActivityEvent[]): Promise<void>;
  listActivity(): Promise<ActivityEvent[]>;
}

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

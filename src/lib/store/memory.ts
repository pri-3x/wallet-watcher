import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AlertRule } from "@/lib/alerts/engine";
import { isPlanId, type PlanId } from "@/lib/plans";
import type { ActivityEvent } from "@/lib/types";
import {
  StoreError,
  type AppStore,
  type ChannelInput,
  type ChannelType,
  type NewAlertEvent,
  type RuleInput,
  type StoredAlert,
  type StoredNotification,
  type StoreUser,
  type WatchRecord,
} from "@/lib/store/types";

type WatchRow = {
  id: string;
  userId: string;
  address: string;
  createdAt: number;
  cursor: number;
};

type AlertRow = AlertRule & { watchId: string };
type ChannelRow = { id: string; watchId: string; type: ChannelType; target: string };
type AlertEventRow = NewAlertEvent & { id: string };
type MemoryNotification = StoredNotification & { createdAt: number };

type DatabaseFile = {
  users: StoreUser[];
  watches: WatchRow[];
  alerts: AlertRow[];
  channels: ChannelRow[];
  alertEvents: AlertEventRow[];
  notifications: MemoryNotification[];
  activity: ActivityEvent[];
};

const empty = (): DatabaseFile => ({
  users: [],
  watches: [],
  alerts: [],
  channels: [],
  alertEvents: [],
  notifications: [],
  activity: [],
});

const filePath = path.join(process.cwd(), "data", "store.json");
let queue: Promise<unknown> = Promise.resolve();
let memory: DatabaseFile | null = null;

function mutate<T>(fn: (db: DatabaseFile) => Promise<T> | T) {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function load() {
  if (memory) return memory;
  try {
    const raw = await readFile(filePath, "utf8");
    memory = { ...empty(), ...JSON.parse(raw) } as DatabaseFile;
  } catch {
    memory = empty();
  }
  return memory;
}

async function save(db: DatabaseFile) {
  memory = db;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(db));
}

function assemble(db: DatabaseFile, watch: WatchRow): WatchRecord {
  return {
    ...watch,
    rules: db.alerts.filter((alert) => alert.watchId === watch.id),
    channels: db.channels.filter((channel) => channel.watchId === watch.id),
  };
}

function toStoredAlert(db: DatabaseFile, event: AlertEventRow): StoredAlert | null {
  const alert = db.alerts.find((item) => item.id === event.alertId);
  const watch = alert ? db.watches.find((item) => item.id === alert.watchId) : undefined;
  if (!alert || !watch) return null;
  const delivery =
    db.notifications.find((note) => note.alertEventId === event.id)?.status ?? "pending";
  return {
    id: event.id,
    watchId: watch.id,
    userId: watch.userId,
    address: watch.address,
    ruleType: alert.eventType,
    summary: event.summary,
    detail: event.detail,
    hash: event.hash,
    amountUsd: event.amountUsd,
    timestamp: event.timestamp,
    delivery,
  };
}

export const memoryStore: AppStore = {
  upsertUser(email) {
    return mutate((db) => {
      const existing = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (existing) return existing;
      const user: StoreUser = {
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        plan: "observer",
        createdAt: Date.now(),
      };
      db.users.push(user);
      return user;
    });
  },

  getUserById(id) {
    return mutate((db) => db.users.find((user) => user.id === id) ?? null);
  },

  getUserByEmail(email) {
    return mutate((db) => db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null);
  },

  setPlan(userId, plan: PlanId) {
    return mutate((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user || !isPlanId(plan)) throw new StoreError("We couldn't find that account.");
      user.plan = plan;
      return user;
    });
  },

  listWatches(userId) {
    return mutate((db) =>
      db.watches.filter((watch) => watch.userId === userId).map((watch) => assemble(db, watch)),
    );
  },

  listAllWatches() {
    return mutate((db) => db.watches.map((watch) => assemble(db, watch)));
  },

  createWatch({ userId, address, rules, channels }) {
    return mutate((db) => {
      const duplicate = db.watches.find(
        (watch) => watch.userId === userId && watch.address.toLowerCase() === address.toLowerCase(),
      );
      if (duplicate) throw new StoreError("You are already watching this wallet.");
      const watch: WatchRow = {
        id: crypto.randomUUID(),
        userId,
        address,
        createdAt: Date.now(),
        cursor: 0,
      };
      db.watches.push(watch);
      db.alerts.push(...rules.map((rule) => ruleRow(watch.id, rule)));
      db.channels.push(...channels.map((channel) => channelRow(watch.id, channel)));
      return assemble(db, watch);
    });
  },

  deleteWatch(userId, watchId) {
    return mutate((db) => {
      const watch = db.watches.find((item) => item.id === watchId && item.userId === userId);
      if (!watch) return;
      const alertIds = new Set(db.alerts.filter((alert) => alert.watchId === watchId).map((alert) => alert.id));
      const eventIds = new Set(
        db.alertEvents.filter((event) => alertIds.has(event.alertId)).map((event) => event.id),
      );
      db.watches = db.watches.filter((item) => item.id !== watchId);
      db.alerts = db.alerts.filter((alert) => alert.watchId !== watchId);
      db.channels = db.channels.filter((channel) => channel.watchId !== watchId);
      db.alertEvents = db.alertEvents.filter((event) => !alertIds.has(event.alertId));
      db.notifications = db.notifications.filter((note) => !note.alertEventId || !eventIds.has(note.alertEventId));
    });
  },

  updateCursor(watchId, cursor) {
    return mutate((db) => {
      const watch = db.watches.find((item) => item.id === watchId);
      if (watch) watch.cursor = cursor;
    });
  },

  listAlertEvents(userId, limit = 40) {
    return mutate((db) => {
      const watchIds = new Set(db.watches.filter((watch) => watch.userId === userId).map((watch) => watch.id));
      const alertIds = new Set(db.alerts.filter((alert) => watchIds.has(alert.watchId)).map((alert) => alert.id));
      return db.alertEvents
        .filter((event) => alertIds.has(event.alertId))
        .map((event) => toStoredAlert(db, event))
        .filter((event): event is StoredAlert => Boolean(event))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    });
  },

  insertAlertEvents(events) {
    return mutate((db) => {
      const created: StoredAlert[] = [];
      for (const event of events) {
        const exists = db.alertEvents.some(
          (item) => item.alertId === event.alertId && item.hash === event.hash,
        );
        if (exists) continue;
        const row: AlertEventRow = { ...event, id: crypto.randomUUID() };
        db.alertEvents.push(row);
        const stored = toStoredAlert(db, row);
        if (stored) created.push(stored);
      }
      return created;
    });
  },

  enqueueNotifications(items) {
    return mutate((db) => {
      for (const item of items) {
        db.notifications.push({
          userId: item.userId,
          alertEventId: item.alertEventId,
          channel: item.channel,
          target: item.target,
          payload: item.payload,
          error: item.error,
          id: crypto.randomUUID(),
          status: item.status ?? "pending",
          createdAt: Date.now(),
        });
      }
    });
  },

  claimPendingNotifications(limit) {
    return mutate((db) => {
      const pending = db.notifications.filter((note) => note.status === "pending").slice(0, limit);
      for (const note of pending) note.status = "sending";
      return pending.map((note) => ({ ...note }));
    });
  },

  markNotification(id, status, error) {
    return mutate((db) => {
      const note = db.notifications.find((item) => item.id === id);
      if (!note) return;
      note.status = status;
      note.error = error;
    });
  },

  upsertActivity(events) {
    return mutate((db) => {
      const ids = new Set(db.activity.map((event) => event.id));
      for (const event of events) {
        if (!ids.has(event.id)) db.activity.push(event);
      }
      db.activity = db.activity.sort((a, b) => b.timestamp - a.timestamp).slice(0, 300);
    });
  },

  listActivity() {
    return mutate((db) => db.activity);
  },
};

function ruleRow(watchId: string, rule: RuleInput): AlertRow {
  return {
    id: crypto.randomUUID(),
    watchId,
    eventType: rule.eventType,
    asset: rule.asset ?? null,
    threshold: rule.threshold ?? null,
    direction: rule.direction ?? "ANY",
    enabled: rule.enabled ?? true,
  };
}

function channelRow(watchId: string, channel: ChannelInput): ChannelRow {
  return { id: crypto.randomUUID(), watchId, type: channel.type, target: channel.target };
}

import { activeNetwork } from "@/lib/chains/ethereum";
import { notificationText, dispatchPending } from "@/lib/notifications/dispatch";
import { evaluateAlerts } from "@/lib/alerts/engine";
import { planDeliveries } from "@/lib/alerts/quiet";
import { getStore } from "@/lib/store";
import type { NewNotification } from "@/lib/store/types";
import { loadWalletView } from "@/lib/wallet-service";

/**
 * Blockchain → indexer → normalize → store → evaluate alerts → notify.
 *
 * Each watch keeps a cursor: the last time it was indexed. Matches with a
 * block time before the cursor are history. They are recorded so the desk can
 * show them, but they are never sent. Matches after the cursor are live and
 * are queued for delivery. A watch with a quiet period sends the first live
 * match, then records later matches until the window ends. Block times lag
 * wall-clock time, so a short grace window keeps a transaction mined moments
 * before the cursor from being lost.
 */
const GRACE_MS = 2 * 60_000;

export type IndexReport = {
  watches: number;
  skipped: number;
  recorded: number;
  queued: number;
};

export async function indexWatches(
  options: { notify: boolean; userId?: string } = { notify: true },
): Promise<IndexReport> {
  const store = await getStore();
  const watches = await store.listAllWatches();
  const selected = options.userId ? watches.filter((watch) => watch.userId === options.userId) : watches;
  const now = Date.now();
  const explorer = activeNetwork().explorer;
  const report: IndexReport = { watches: selected.length, skipped: 0, recorded: 0, queued: 0 };

  for (const watch of selected) {
    const view = await loadWalletView(watch.address, now);
    if (view.error) {
      report.skipped += 1;
      console.warn(`[indexer] ${watch.address}: ${view.error.title} ${view.error.technical ?? ""}`.trim());
      continue;
    }

    const matches = evaluateAlerts(watch.rules, view.events);
    const created = await store.insertAlertEvents(
      matches.map((match) => ({
        alertId: match.rule.id,
        hash: match.event.hash,
        summary: match.summary,
        detail: match.detail,
        amountUsd: match.event.amountUsd,
        timestamp: match.event.timestamp,
      })),
    );
    report.recorded += created.length;

    // A backfill run, or a watch that has never been indexed, treats everything as history.
    const liveAfter =
      options.notify && watch.cursor > 0 ? watch.cursor - GRACE_MS : Number.POSITIVE_INFINITY;

    const planned = planDeliveries(created, {
      liveAfter,
      cooldownMs: watch.cooldownMs,
      lastNotifiedAt: watch.lastNotifiedAt,
      now,
    });
    const items: NewNotification[] = planned.events.flatMap((event) =>
      watch.channels.map((channel) => ({
        userId: watch.userId,
        alertEventId: event.id,
        channel: channel.type,
        target: channel.target,
        payload: notificationText(watch.address, event.detail, `${explorer}/tx/${event.hash}`),
        status: event.status,
        error: event.error,
      })),
    );
    if (items.length > 0) await store.enqueueNotifications(items);
    report.queued += items.filter((item) => item.status === "pending").length;
    if (planned.notified) await store.markNotified(watch.id, planned.lastNotifiedAt);

    await store.updateCursor(watch.id, now);
    if (view.events.length > 0) await store.upsertActivity(view.events);
  }

  if (options.notify) await dispatchPending();
  return report;
}

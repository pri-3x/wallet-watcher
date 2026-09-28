import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { getWalletView } from "@/lib/wallet-service";
import type { StoredAlert, StoreUser, WatchRecord } from "@/lib/store/types";
import type { WalletView } from "@/lib/types";

export type DeskWallet = { watch: WatchRecord; view: WalletView };

export async function loadDesk(): Promise<{
  user: StoreUser | null;
  now: number;
  wallets: DeskWallet[];
  alerts: StoredAlert[];
}> {
  const now = Date.now();
  const user = await getSessionUser();
  if (!user) return { user: null, now, wallets: [], alerts: [] };

  const store = await getStore();
  const watches = await store.listWatches(user.id);
  const wallets = await Promise.all(
    watches.map(async (watch) => ({
      watch,
      view: await getWalletView(watch.address, now),
    })),
  );
  const alerts = await store.listAlertEvents(user.id);
  const stamps = new Map<string, number>();
  for (const wallet of wallets) {
    for (const event of wallet.view.events) stamps.set(event.hash, event.timestamp);
  }

  return {
    user,
    now,
    wallets,
    alerts: alerts.map((alert) => ({
      ...alert,
      timestamp: stamps.get(alert.hash) ?? alert.timestamp,
    })),
  };
}

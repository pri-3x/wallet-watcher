import { DEMO_ADDRESS, DEMO_EMAIL, PARTIES } from "@/lib/parties";
import { indexWatches } from "@/lib/indexer";
import { getStore } from "@/lib/store";

export async function ensureDemoDesk(userId: string) {
  const store = await getStore();
  const existing = await store.listWatches(userId);
  if (existing.length > 0) return;
  await store.createWatch({
    userId,
    address: DEMO_ADDRESS,
    rules: [
      { eventType: "TRANSFER", threshold: 10000, direction: "ANY", enabled: true },
      { eventType: "DEX", enabled: true },
      { eventType: "STABLECOIN", enabled: true },
      { eventType: "ETH", enabled: true },
    ],
    channels: [{ type: "email", target: DEMO_EMAIL }],
  });
  await store.createWatch({
    userId,
    address: PARTIES.walletA.address,
    rules: [{ eventType: "TRANSFER", threshold: 1000, direction: "ANY", enabled: true }],
    channels: [{ type: "email", target: DEMO_EMAIL }],
  });
  await indexWatches({ notify: false, userId });
}

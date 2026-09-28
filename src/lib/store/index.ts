import type { AppStore } from "@/lib/store/types";

export { StoreError } from "@/lib/store/types";
export type { ChannelType, StoreUser, WatchRecord, StoredAlert } from "@/lib/store/types";

let selected: Promise<AppStore> | null = null;

export function getStore() {
  selected ??= choose();
  return selected;
}

async function choose(): Promise<AppStore> {
  if (process.env.USE_DATABASE === "true") {
    try {
      const { prisma, prismaStore } = await import("@/lib/store/prisma-store");
      await prisma.$queryRaw`SELECT 1`;
      return prismaStore;
    } catch (error) {
      console.error("Database unavailable. Using the local store.", error);
    }
  }
  const { memoryStore } = await import("@/lib/store/memory");
  return memoryStore;
}

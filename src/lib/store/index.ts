import type { AppStore } from "@/lib/store/types";

export { StoreError } from "@/lib/store/types";
export type { ChannelType, StoreUser, WatchRecord, StoredAlert } from "@/lib/store/types";

let selected: Promise<AppStore> | null = null;

export function getStore() {
  selected ??= choose();
  return selected;
}

async function choose(): Promise<AppStore> {
  const fileStore = process.env.USE_DATABASE === "false" || !process.env.DATABASE_URL;
  if (!fileStore) {
    try {
      const { prisma, prismaStore } = await import("@/lib/store/prisma-store");
      await prisma.$queryRaw`SELECT 1`;
      console.log("Store · Postgres");
      return prismaStore;
    } catch (error) {
      console.error("Database unavailable. Using the local file store.", error);
    }
  }
  console.log("Store · file");
  const { memoryStore } = await import("@/lib/store/memory");
  return memoryStore;
}

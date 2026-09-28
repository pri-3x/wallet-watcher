export const PLANS = {
  observer: { id: "observer", name: "Observer", price: 0, walletLimit: 3 },
  desk: { id: "desk", name: "Desk", price: 49, walletLimit: 25 },
  terminal: { id: "terminal", name: "Terminal", price: 149, walletLimit: Number.POSITIVE_INFINITY },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

import { getWalletView } from "@/lib/wallet-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  const view = await getWalletView(address, Date.now());
  return Response.json(view);
}

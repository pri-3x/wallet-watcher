import { getWalletView } from "@/lib/wallet-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  const chain = new URL(request.url).searchParams.get("chain") ?? undefined;
  const view = await getWalletView(address, Date.now(), chain);
  return Response.json(view);
}

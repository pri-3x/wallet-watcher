import { identifyToken } from "@/lib/tokens/load";
import { findChain } from "@/lib/chains/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chain = findChain(url.searchParams.get("chain"));
  const address = url.searchParams.get("address") ?? "";
  if (!chain || !address) return Response.json({ token: false });
  const token = await identifyToken(chain.id, address);
  return Response.json(token ? { token: true, symbol: token.symbol, name: token.name } : { token: false });
}

import type { Metadata } from "next";
import { SiteHeader } from "@/components/shell/site-header";
import { TokenScreen } from "@/components/token/token-screen";
import { ErrorState } from "@/components/ui/states";
import { findChain } from "@/lib/chains/catalog";
import { loadTokenOverview } from "@/lib/tokens/load";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  return { title: address.startsWith("0x") ? `${address.slice(0, 6)}…${address.slice(-4)} holders` : "Token" };
}

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { address } = await params;
  const query = await searchParams;
  const chainId = typeof query.chain === "string" ? query.chain : "ethereum";
  const chain = findChain(chainId);

  let overview = null;
  let failure: string | null = null;
  try {
    overview = await loadTokenOverview(chain?.id ?? chainId, decodeURIComponent(address));
  } catch (error) {
    failure = error instanceof Error ? error.message : "We couldn't read that token.";
  }

  return (
    <>
      <SiteHeader />
      {overview ? (
        <TokenScreen overview={overview} />
      ) : (
        <main className="mx-auto max-w-[1360px] px-6 md:px-10">
          <ErrorState title="We couldn't read that token." body={failure ?? "Try again in a moment."} />
        </main>
      )}
    </>
  );
}

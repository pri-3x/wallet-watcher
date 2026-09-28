import type { Metadata } from "next";
import { SiteHeader } from "@/components/shell/site-header";
import { WalletScreen } from "@/components/wallet/wallet-screen";
import { openWallet } from "@/lib/wallet-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  return { title: address.startsWith("0x") ? `${address.slice(0, 6)}…${address.slice(-4)}` : address };
}

export default async function WalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { address } = await params;
  const query = await searchParams;
  const { view, now } = await openWallet(address);
  const filter = typeof query.filter === "string" ? query.filter : undefined;
  const asset = typeof query.asset === "string" ? query.asset : undefined;
  const tx = typeof query.tx === "string" ? query.tx : undefined;

  return (
    <>
      <SiteHeader />
      <WalletScreen key={view.address} view={view} now={now} initialFilter={filter} initialAsset={asset} initialTx={tx} />
    </>
  );
}

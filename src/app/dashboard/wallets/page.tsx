import { SignInPanel } from "@/components/dashboard/sign-in";
import { WalletList } from "@/components/dashboard/wallet-list";
import { loadDesk } from "@/lib/dashboard";

export default async function WalletsPage() {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;

  return (
    <div>
      <h1 className="text-5xl tracking-tight">Watched wallets</h1>
      <div className="mt-10">
        <WalletList wallets={desk.wallets} now={desk.now} removable />
      </div>
    </div>
  );
}

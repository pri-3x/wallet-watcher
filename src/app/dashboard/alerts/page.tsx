import { AlertTimeline } from "@/components/dashboard/alert-timeline";
import { SignInPanel } from "@/components/dashboard/sign-in";
import { loadDesk } from "@/lib/dashboard";

export default async function AlertsPage() {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;

  return (
    <div>
      <h1 className="text-5xl tracking-tight">Alerts</h1>
      <div className="mt-10">
        <AlertTimeline alerts={desk.alerts} now={desk.now} />
      </div>
    </div>
  );
}

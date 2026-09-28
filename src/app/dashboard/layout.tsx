import { Sidebar } from "@/components/dashboard/sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-56">
        <div className="mx-auto max-w-5xl px-6 py-10 md:px-12 md:py-14">{children}</div>
      </div>
    </div>
  );
}

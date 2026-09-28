import { LoadingLine } from "@/components/ui/states";

export default function Loading() {
  return (
    <main className="mx-auto max-w-[1360px] px-6 md:px-10">
      <LoadingLine label="Reading the chain…" />
    </main>
  );
}

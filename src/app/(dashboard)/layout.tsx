import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-[240px] flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}

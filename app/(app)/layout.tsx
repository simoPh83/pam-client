import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/ui/toaster";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {children}
      </main>
    </ToastProvider>
  );
}

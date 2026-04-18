import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">{children}</div>
      </main>
    </>
  );
}

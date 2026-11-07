import { TopBar } from "@/components/TopBar";
import { SubNav, NAV_LEARN } from "@/components/SubNav";
import { AiChat } from "@/components/AiChat";
import { activeProvider } from "@/lib/ai";
export const metadata = { title: "AI-läraren" };
export default async function AiPage({ searchParams }: { searchParams: Promise<{ ctx?: string }> }) {
  const { ctx } = await searchParams;
  const p = activeProvider();
  return (
    <>
      <TopBar title="AI-läraren" back="/learn" />
      <SubNav items={NAV_LEARN} />
      <div className="page">
        <AiChat context={ctx ?? null} online={!!p} providerName={p?.label ?? null} />
      </div>
    </>
  );
}

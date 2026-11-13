import { Logo } from "@/components/logo";
// A5: toasts e confirmações só onde há formulários do produto (fora da landing)
import { Provedores } from "@/components/ui/provedores";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" style={{ minHeight: "100vh", display: "grid", placeItems: "start center", padding: "48px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ marginBottom: 28 }}>
          <Logo largura={128} />
        </div>
        <Provedores>{children}</Provedores>
      </div>
    </main>
  );
}

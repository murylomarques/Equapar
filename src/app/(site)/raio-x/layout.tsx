import { Provedores } from "@/components/ui/provedores";

/** A5: o Raio-X usa formulários com aviso (toast); a landing não carrega esse JavaScript. */
export default function RaioXLayout({ children }: { children: React.ReactNode }) {
  return <Provedores>{children}</Provedores>;
}

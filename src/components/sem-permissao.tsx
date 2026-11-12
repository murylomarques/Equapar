import Link from "next/link";

export function SemPermissao({ acao }: { acao: string }) {
  return (
    <div className="cartao" role="alert" style={{ maxWidth: 640 }}>
      <h1>Seu papel não permite {acao}</h1>
      <p className="secundario">Peça a um Dono da conta para mudar seu papel em Configurações &gt; Pessoas e papéis.</p>
      <Link href="/app/hoje" className="btn">
        Voltar para Hoje
      </Link>
    </div>
  );
}

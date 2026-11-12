import "server-only";
import { tokenConfirmacao } from "./confirmacao-email";
import { appUrl, enviar } from "./mensagens";

/** C7: envia (ou simula) o link de confirmação do e-mail. Cada envio tem chave própria (permite reenviar). */
export async function enviarConfirmacaoEmail(u: { id: string; email: string; nome: string }) {
  const link = appUrl(`/confirmar-email?t=${encodeURIComponent(tokenConfirmacao(u.id, u.email))}`);
  await enviar({
    contaId: null,
    chave: `confirmar-email:${u.id}:${Date.now()}`,
    tipo: "CONFIRMAR_EMAIL",
    canal: "EMAIL",
    destino: u.email,
    assunto: "Confirme seu e-mail na Equapar",
    corpo: `Olá, ${u.nome.split(" ")[0]}. Para receber os avisos de prazo, confirme seu e-mail: ${link}\n\nO link vale por 24 horas. Se você não criou uma conta na Equapar, ignore esta mensagem.`,
  });
}

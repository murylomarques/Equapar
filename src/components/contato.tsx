import { MessageCircle, Mail, CalendarDays } from "lucide-react";
import { contatoSite } from "@/lib/site";

/**
 * B4. Botão único de contato: WhatsApp quando SITE_WHATSAPP existe, senão e-mail (SITE_EMAIL_CONTATO).
 * Com SITE_AGENDA_URL, um segundo botão "Marcar uma conversa".
 */
export function Contato({ principal = false, agenda = true }: { principal?: boolean; agenda?: boolean }) {
  const c = contatoSite();
  const classe = principal ? "btn btn-primario" : "btn";
  return (
    <span className="fileira contato">
      {c.whatsappLink ? (
        <a className={classe} href={c.whatsappLink} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} strokeWidth={1.5} aria-hidden /> Falar no WhatsApp
        </a>
      ) : (
        <a className={classe} href={c.emailLink}>
          <Mail size={16} strokeWidth={1.5} aria-hidden /> Falar por e-mail
        </a>
      )}
      {agenda && c.agendaUrl && (
        <a className="btn" href={c.agendaUrl} target="_blank" rel="noopener noreferrer">
          <CalendarDays size={16} strokeWidth={1.5} aria-hidden /> Marcar uma conversa
        </a>
      )}
    </span>
  );
}

/**
 * Layout HTML dos e-mails do sistema (todos passam por `enviar`, em mensagens.ts; o e-mail de teste do painel também).
 * O texto é o mesmo da versão em texto puro; o HTML só organiza: logo, título, parágrafos, seções, listas, um botão
 * e o rodapé. Tabelas e estilos inline de propósito: é o que Gmail, Outlook e celulares exibem do mesmo jeito.
 *
 * Como o texto vira HTML (por linha):
 * - "PRECISA DE VOCÊ (2)" (linha toda em maiúsculas) → título de seção;
 * - "- Contrato 45/2025 · Órgão: URL" → item de lista, com o texto como link;
 * - "Ver o que falta: URL" fechando o texto ou um parágrafo → botão (o último desses é a ação principal);
 * - demais links → link no texto, mostrando o endereço curto (equapar.com.br/criar-conta).
 */

const COR = { tinta: "#16181d", texto: "#3a3d45", suave: "#6b6f7a", verde: "#1e7a55", fundo: "#f4f1ea", borda: "#e4e0d6", linha: "#efece4" };
const FONTE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Texto visível: escapado e sem quebrar "R$" do valor. */
function escTexto(s: string) {
  return esc(s).replace(/R\$ /g, () => "R$&nbsp;");
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TEM_URL = /https?:\/\//;
const limparUrl = (u: string) => u.replace(/[.,;)]+$/, "");

/** Texto do botão por tipo de e-mail: quando a mensagem não traz um rótulo curto, ou traz só "Abrir". */
export const ROTULO_POR_TIPO: Record<string, string> = {
  CONFIRMAR_EMAIL: "Confirmar e-mail",
  REDEFINIR_SENHA: "Criar senha nova",
  CONVITE: "Entrar na conta",
  D30: "Abrir o contrato",
  DEFERIDO: "Ver a receber",
  APOSTILAMENTO: "Ver a receber",
};

const ROTULOS_GENERICOS = new Set(["abrir", "link", "acesse"]);

type Linha = { tipo: "texto"; texto: string } | { tipo: "secao"; texto: string } | { tipo: "item"; texto: string; url: string | null } | { tipo: "vazia" };
type Botao = { rotulo: string; url: string };

function classificar(l: string): Linha {
  const t = l.trim();
  if (!t) return { tipo: "vazia" };
  const item = t.match(/^[-•]\s+(.*)$/);
  if (item) {
    const comLink = item[1].match(/^(.*?):\s*(https?:\/\/\S+)\s*$/);
    return comLink ? { tipo: "item", texto: comLink[1], url: limparUrl(comLink[2]) } : { tipo: "item", texto: item[1], url: null };
  }
  // título de seção: em maiúsculas até o ":" (se houver), como "PRECISA DE VOCÊ (2)" ou "A RECEBER: R$ 48 mil"
  const cabeca = t.split(":")[0];
  if (/[A-ZÀ-Ú]{3}/.test(cabeca) && cabeca === cabeca.toUpperCase() && !TEM_URL.test(t) && t.length <= 60) return { tipo: "secao", texto: t };
  return { tipo: "texto", texto: l };
}

/**
 * Acha a ação principal: o último "Rótulo: URL" que fecha uma linha de texto (rótulo de até 40 caracteres, começando
 * no início da linha ou depois de um ponto; "Fonte:" não conta). Tira o par do texto e devolve o botão.
 * Sem esse padrão: se o texto tem um link só, fechando uma frase depois de ": " ou ". ", ele vira o botão com o rótulo
 * do tipo do e-mail. Senão, sem botão (os links ficam no texto).
 * O botão fica no fim do parágrafo de onde saiu o link: `antes` é o texto até ali, `depois` o resto.
 */
export function separarBotao(texto: string, tipo?: string): { texto: string; botao: Botao | null; antes: string; depois: string } {
  const linhas = texto.split("\n");
  const padrao = ROTULO_POR_TIPO[tipo ?? ""] ?? "Abrir na Equapar";
  const resultado = (i: number, botao: Botao) => {
    let fimParagrafo = i + 1;
    while (fimParagrafo < linhas.length && linhas[fimParagrafo].trim()) fimParagrafo++;
    return { texto: arrumar(linhas), botao, antes: arrumar(linhas.slice(0, fimParagrafo)), depois: arrumar(linhas.slice(fimParagrafo)) };
  };
  for (let i = linhas.length - 1; i >= 0; i--) {
    const l = linhas[i];
    if (classificar(l).tipo !== "texto") continue;
    const m = l.match(/(^|[.!?]\s+)([^.!?:\n]{2,40}):\s*(https?:\/\/\S+?)[.\s]*$/);
    if (m && !/^\s*fonte\b/i.test(m[2])) {
      const r = m[2].trim();
      const rotulo = ROTULOS_GENERICOS.has(r.toLowerCase()) ? padrao : r.charAt(0).toUpperCase() + r.slice(1);
      linhas[i] = l.slice(0, m.index! + m[1].length).trimEnd();
      return resultado(i, { rotulo, url: limparUrl(m[3]) });
    }
  }
  const soTexto = linhas.filter((l) => classificar(l).tipo === "texto");
  const links = soTexto.flatMap((l) => [...l.matchAll(URL_RE)]);
  if (links.length === 1) {
    const i = linhas.findIndex((l) => classificar(l).tipo === "texto" && l.includes(links[0][0]));
    const l = linhas[i];
    const m = l.match(/(:|[.!?])\s*(https?:\/\/\S+?)([.\s]*)$/) ?? l.match(/(:|[.!?])\s*(https?:\/\/\S+?)([.\s]+)(?=\S)/);
    if (m) {
      const fim = m[1] === ":" ? "." : m[1];
      linhas[i] = (l.slice(0, m.index) + fim + l.slice(m.index! + m[0].length).replace(/^[\s.]*/, " ")).trimEnd();
      return resultado(i, { rotulo: padrao, url: limparUrl(m[2]) });
    }
  }
  return { texto, botao: null, antes: texto, depois: "" };
}

/** Endereço completo para copiar: o link rastreado (/r/<id>?para=/app/...) vira o destino real no site. */
export function urlLegivel(url: string) {
  try {
    const u = new URL(url);
    const para = u.pathname.startsWith("/r/") ? u.searchParams.get("para") : null;
    return para?.startsWith("/") ? `${u.origin}${para}` : url;
  } catch {
    return url;
  }
}

/** Junta as linhas de novo sem deixar linhas vazias sobrando no começo/fim nem em sequência. */
function arrumar(linhas: string[]) {
  return linhas.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Endereço curto para mostrar: os links rastreados (/r/<id>?para=/app/...) mostram o destino real. */
export function rotuloLink(url: string) {
  try {
    const u = new URL(url);
    const para = u.pathname.startsWith("/r/") ? u.searchParams.get("para") : null;
    const caminho = (para ?? u.pathname).split(/[?#]/)[0].replace(/\/$/, "");
    return `${u.host.replace(/^www\./, "")}${caminho}`;
  } catch {
    return url;
  }
}

function linksNoTexto(t: string) {
  let html = "";
  let i = 0;
  for (const m of t.matchAll(URL_RE)) {
    const url = limparUrl(m[0]);
    html += escTexto(t.slice(i, m.index)) + `<a href="${esc(url)}" style="color:${COR.verde};text-decoration:underline;word-break:break-word">${esc(rotuloLink(url))}</a>`;
    i = m.index! + url.length;
  }
  return html + escTexto(t.slice(i));
}

/** Sem o "Equapar:" do início (o logo já diz de quem é), com a primeira letra maiúscula. */
function semPrefixo(texto: string) {
  const t = texto.replace(/^Equapar:\s*/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function corpoHtml(texto: string) {
  const blocos: string[] = [];
  let paragrafo: string[] = [];
  let lista: string[] = [];
  const P = `margin:0 0 16px;font-size:16px;line-height:1.55;color:${COR.texto}`;
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push(`<p style="${P}">${paragrafo.map(linksNoTexto).join("<br>")}</p>`);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista.length)
      blocos.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid ${COR.linha}">${lista.join("")}</table>`);
    lista = [];
  };
  for (const l of texto.split("\n").map(classificar)) {
    if (l.tipo === "vazia") {
      fecharParagrafo();
      fecharLista();
    } else if (l.tipo === "secao") {
      fecharParagrafo();
      fecharLista();
      blocos.push(`<p style="margin:22px 0 8px;font-size:12px;letter-spacing:.06em;font-weight:700;color:${COR.suave}">${escTexto(l.texto)}</p>`);
    } else if (l.tipo === "item") {
      fecharParagrafo();
      const conteudo = l.url
        ? `<a href="${esc(l.url)}" style="color:${COR.tinta};text-decoration:none">${escTexto(l.texto)}&nbsp;<span style="color:${COR.verde};font-weight:600">›</span></a>`
        : linksNoTexto(l.texto);
      lista.push(`<tr><td style="padding:10px 2px;border-bottom:1px solid ${COR.linha};font-size:15px;line-height:1.45;color:${COR.tinta}">${conteudo}</td></tr>`);
    } else {
      fecharLista();
      paragrafo.push(l.texto.trim());
    }
  }
  fecharParagrafo();
  fecharLista();
  return blocos.join("\n");
}

export function emailHtml(o: { assunto: string; texto: string; appUrl: string; tipo?: string; rodapePreferencias: boolean }) {
  const { texto, botao, antes, depois } = separarBotao(semPrefixo(o.texto), o.tipo);
  const base = o.appUrl.replace(/\/$/, "");
  const botaoHtml = botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px"><tr><td style="border-radius:8px;background:${COR.verde}">` +
      `<a href="${esc(botao.url)}" style="display:inline-block;padding:13px 22px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(botao.rotulo)}</a>` +
      `</td></tr></table>` +
      `<p style="margin:12px 0 18px;font-size:13px;line-height:1.5;color:${COR.suave}">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${esc(urlLegivel(botao.url))}</span></p>`
    : "";
  const preferencias = o.rodapePreferencias
    ? `Para escolher quais avisos recebe e por qual canal, acesse <a href="${esc(base)}/app/configuracoes" style="color:${COR.suave}">Configurações › Avisos</a>.<br>`
    : "";
  const previa = texto.replace(URL_RE, "").replace(/\s+/g, " ").trim().slice(0, 140);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(o.assunto)}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo}">
<div style="display:none;max-height:0;overflow:hidden">${esc(previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COR.fundo}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONTE}">
<tr><td style="background:#ffffff;border:1px solid ${COR.borda};border-radius:12px;padding:28px 26px">
<a href="${esc(base)}"><img src="${esc(base)}/email/equapar-logo.png" width="140" height="32" alt="Equapar" style="display:block;border:0;width:140px;height:auto;margin:0 0 22px"></a>
<h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;font-weight:700;color:${COR.tinta}">${escTexto(semPrefixo(o.assunto))}</h1>
${corpoHtml(antes)}
${botaoHtml}
${corpoHtml(depois)}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.6;color:${COR.suave}">
Mensagem automática da Equapar, controle de repactuação de contratos públicos.<br>${preferencias}Dúvidas: responda este e-mail.
</td></tr>
</table></td></tr></table></body></html>`;
}

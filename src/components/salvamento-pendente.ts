"use client";
/**
 * L7. Ponte entre o editor com salvamento automático e o botão "Continuar" (em outro formulário,
 * renderizado no servidor). O editor registra o seu salvarAgora; o formulário com esperarSalvamento
 * chama salvarPendente() antes de enviar, para a última edição não se perder.
 */
let salvarAgora: (() => Promise<void>) | null = null;

export function registrarSalvarAgora(fn: () => Promise<void>) {
  salvarAgora = fn;
  return () => {
    if (salvarAgora === fn) salvarAgora = null;
  };
}

export async function salvarPendente() {
  await salvarAgora?.();
}

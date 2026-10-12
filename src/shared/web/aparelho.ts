/**
 * "Celular · Android · Chrome" a partir do user-agent. O texto inteiro não
 * serve pra nada na hora de ler e ainda carrega versão de sistema que não
 * precisamos guardar.
 */
export function aparelho(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  const tipo = /iphone|android.*mobile|mobile/.test(ua) ? 'Celular' : /ipad|tablet|android/.test(ua) ? 'Tablet' : 'Computador';
  const sistema = /iphone|ipad|ios/.test(ua) ? 'iOS' : /android/.test(ua) ? 'Android' : /windows/.test(ua) ? 'Windows' : /mac os/.test(ua) ? 'Mac' : null;
  const navegador = /instagram/.test(ua)
    ? 'Instagram'
    : /fban|fbav|fb_iab/.test(ua)
      ? 'Facebook'
      : /edg\//.test(ua)
        ? 'Edge'
        : /samsungbrowser/.test(ua)
          ? 'Samsung Internet'
          : /crios|chrome\//.test(ua)
            ? 'Chrome'
            : /fxios|firefox/.test(ua)
              ? 'Firefox'
              : /safari/.test(ua)
                ? 'Safari'
                : null;
  return [tipo, sistema, navegador].filter(Boolean).join(' · ');
}

/**
 * Navegador embutido de rede social: o link aberto pelo Instagram abre
 * dentro do Instagram, e lá login com Google não funciona.
 */
export function navegadorDeApp(userAgent: string | undefined): 'instagram' | 'facebook' | null {
  if (!userAgent) return null;
  if (/instagram/i.test(userAgent)) return 'instagram';
  if (/fban|fbav|fb_iab/i.test(userAgent)) return 'facebook';
  return null;
}

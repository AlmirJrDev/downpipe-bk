import { AppError } from '@/shared/utils/AppError';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS, MAX_IMAGE_SIZE_BYTES } from '@/shared/storage/storage.constants';

/**
 * A arte do rolê, puxada da página que serviu de fonte.
 *
 * Rolê sem foto some no meio do calendário, e a imagem boa já existe: é o
 * flyer que o organizador fez. O que se busca aqui é a `og:image` da página
 * — a mesma imagem que qualquer app mostra ao colar o link num chat, posta
 * pelo próprio autor justamente pra ser exibida fora dali.
 *
 * A cópia é obrigatória, não preguiça: as URLs de imagem do Instagram
 * carregam assinatura com validade de dias. Guardar o endereço daria um rolê
 * com foto quebrada na semana seguinte, que é pior do que rolê sem foto.
 *
 * Nada aqui é automático. Quem revisa é que pede — e é quem olha o flyer e
 * decide se aquilo representa o encontro.
 */

/** Cabeçalho de quem busca prévia de link, que é exatamente o que é. */
const AGENTE = 'Mozilla/5.0 (compatible; DownpipeBot/1.0; +https://downpipe.onrender.com)';

const TEMPO_LIMITE_MS = 12_000;

async function buscar(url: string, aceita: string): Promise<Response> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    return await fetch(url, {
      headers: { 'user-agent': AGENTE, accept: aceita },
      signal: controle.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * O endereço da imagem anunciada pela página.
 *
 * Aceita as duas formas que aparecem na prática — `property` antes de
 * `content` e o contrário — porque quem gera o HTML não combina a ordem.
 */
export function imagemAnunciada(html: string): string | null {
  const padroes = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const padrao of padroes) {
    const achou = html.match(padrao);
    if (achou?.[1]) {
      // O HTML vem com as entidades escapadas; a URL tem que voltar ao
      // original ou o CDN recusa a assinatura.
      return achou[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    }
  }
  return null;
}

export const flyerService = {
  /**
   * Busca a imagem da página e devolve a cópia já no nosso Storage.
   *
   * `donoId` é a pasta do arquivo — quem pediu. Serve pra faxina: se a conta
   * sair, as imagens que ela trouxe saem junto, como qualquer upload dela.
   */
  async copiarDaPagina(paginaUrl: string, donoId: string): Promise<string> {
    let html: string;
    try {
      const pagina = await buscar(paginaUrl, 'text/html');
      if (!pagina.ok) {
        throw AppError.validation(`A fonte respondeu ${pagina.status}. Tente baixar a foto à mão.`);
      }
      html = await pagina.text();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.validation('Não deu pra abrir a fonte. Tente baixar a foto à mão.');
    }

    const imagemUrl = imagemAnunciada(html);
    if (!imagemUrl) {
      // Acontece quando a página exige login pra mostrar qualquer coisa.
      throw AppError.validation('Essa página não publica uma imagem de prévia. Suba a foto à mão.');
    }

    const imagem = await buscar(imagemUrl, 'image/*');
    if (!imagem.ok) {
      throw AppError.validation('A imagem da fonte não respondeu. Tente de novo.');
    }

    const mimeType = (imagem.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
      throw AppError.validation('O endereço da prévia não devolveu uma imagem.');
    }

    const buffer = Buffer.from(await imagem.arrayBuffer());
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw AppError.validation('A imagem da fonte é grande demais.');
    }

    const { publicUrl } = await storageService.uploadImage({
      bucket: STORAGE_BUCKETS.POSTS,
      userId: donoId,
      buffer,
      // O storage só aceita jpeg/png/webp; o que vier diferente vira jpeg,
      // que é o que o Instagram entrega de qualquer jeito.
      mimeType: ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
        ? mimeType
        : 'image/jpeg',
    });

    return publicUrl;
  },
};

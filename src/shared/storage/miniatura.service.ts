import { storageService } from './storage.service';
import { STORAGE_BUCKETS } from './storage.constants';

/**
 * Miniatura quadrada de uma foto, pro pino do mapa.
 *
 * O pino tem 44 px; 128 cobre tela de densidade 3x sem desperdício. A arte
 * de um rolê chega com 300 KB a 1 MB, e a miniatura fica em poucos KB.
 *
 * Nunca lança, e é por isso que o sharp entra por import dinâmico: é um
 * módulo nativo, e se um dia o binário não carregar no servidor, o que tem
 * que acontecer é o rolê ficar sem miniatura (o app cai na foto cheia) — não
 * o servidor inteiro cair no boot por causa de um enfeite do mapa.
 */

export const LADO_DA_MINIATURA = 128;

/** Reduz uma imagem já em memória. Separado pra dar pra testar sem rede. */
export async function reduzir(buffer: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(buffer)
      // Gira conforme o EXIF antes de cortar: foto de celular deitada no
      // arquivo viraria miniatura deitada.
      .rotate()
      .resize(LADO_DA_MINIATURA, LADO_DA_MINIATURA, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Não deu pra gerar a miniatura:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function guardar(miniatura: Buffer, donoId: string): Promise<string | null> {
  try {
    const { publicUrl } = await storageService.uploadImage({
      bucket: STORAGE_BUCKETS.POSTS,
      userId: donoId,
      buffer: miniatura,
      mimeType: 'image/jpeg',
    });
    return publicUrl;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Não deu pra guardar a miniatura:', err instanceof Error ? err.message : err);
    return null;
  }
}

export const miniaturaService = {
  /** Quando a foto acabou de subir e o arquivo ainda está em memória. */
  async doBuffer(buffer: Buffer, donoId: string): Promise<string | null> {
    const pequena = await reduzir(buffer);
    return pequena ? guardar(pequena, donoId) : null;
  },

  /** Quando a foto já está no Storage — a arte puxada de um post, por exemplo. */
  async daUrl(url: string, donoId: string): Promise<string | null> {
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!resposta.ok) return null;
      return this.doBuffer(Buffer.from(await resposta.arrayBuffer()), donoId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Não deu pra baixar a foto da miniatura:', err instanceof Error ? err.message : err);
      return null;
    }
  },
};

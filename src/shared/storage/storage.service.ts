import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/config/supabase';
import { AppError } from '@/shared/utils/AppError';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  StorageBucket,
  extensionForMimeType,
} from './storage.constants';

interface UploadImageParams {
  bucket: StorageBucket;
  /** Id do usuário autenticado dono do arquivo — define a "pasta" no bucket. */
  userId: string;
  buffer: Buffer;
  mimeType: string;
}

interface UploadImageResult {
  path: string;
  publicUrl: string;
}

/**
 * Camada única de upload de imagens para o Supabase Storage. Valida tipo e
 * tamanho do arquivo (mesmo que o middleware de upload já tenha validado,
 * como defesa em profundidade), e sempre grava dentro de uma "pasta" cujo
 * primeiro segmento é o id do usuário autenticado — isso é o que as
 * policies de RLS de storage.objects exigem para permitir a escrita.
 */
export const storageService = {
  async uploadImage({ bucket, userId, buffer, mimeType }: UploadImageParams): Promise<UploadImageResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      throw AppError.validation(
        `Tipo de arquivo não permitido: ${mimeType}. Envie um JPEG, PNG ou WEBP.`
      );
    }

    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw AppError.validation(
        `Arquivo muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 5MB.`
      );
    }

    const extension = extensionForMimeType(mimeType);
    const path = `${userId}/${randomUUID()}.${extension}`;

    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
      // Um ano. O padrão do Supabase é uma hora, e é pouco: passada a hora, o
      // navegador baixa a mesma foto de novo, e o feed inteiro recarrega toda
      // vez que a pessoa volta ao app.
      //
      // Guardar por um ano só é seguro porque o nome tem um UUID e nunca se
      // repete: trocar a foto de um carro gera outro arquivo, com outro
      // endereço. Não existe o caso "mesma URL, conteúdo diferente".
      cacheControl: String(60 * 60 * 24 * 365),
    });

    if (error) {
      throw AppError.internal(`Falha ao enviar imagem: ${error.message}`);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    return { path, publicUrl: publicUrlData.publicUrl };
  },

  /**
   * Remove um arquivo do bucket. Usado, por exemplo, para limpar a imagem
   * antiga quando o usuário substitui a foto de um carro/avatar. Falhas de
   * remoção são apenas logadas (best-effort) para não quebrar o fluxo
   * principal por causa de um arquivo órfão.
   */
  async deleteImage(bucket: StorageBucket, path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`Falha ao remover imagem antiga (${bucket}/${path}):`, error.message);
    }
  },

  /**
   * Apaga tudo o que um usuário enviou para um bucket. Devolve quantos
   * arquivos saíram.
   *
   * Ao contrário de deleteImage, aqui erro interrompe. É usado ao excluir a
   * conta, e a política de privacidade promete que as fotos saem junto: se
   * a remoção falhar no meio, é melhor a exclusão parar e poder ser tentada
   * de novo do que apagar a conta e deixar fotos públicas sem dono, que
   * ninguém mais conseguiria remover pelo app.
   *
   * Funciona porque todo upload grava em `<userId>/<arquivo>` (ver
   * uploadImage), numa pasta só, sem subpastas.
   */
  async deleteUserFolder(bucket: StorageBucket, userId: string): Promise<number> {
    const removidos = new Set<string>();

    // Lista sempre do começo: o que já foi removido some da página seguinte.
    for (;;) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 100 });
      if (error) {
        throw AppError.internal(`Falha ao listar arquivos de ${bucket}: ${error.message}`);
      }

      // Entrada sem id é pasta, não arquivo — e não há subpastas pra descer.
      const caminhos = (data ?? []).filter((f) => f.id).map((f) => `${userId}/${f.name}`);
      if (caminhos.length === 0) return removidos.size;

      // Se algo que já mandamos remover volta na lista, a remoção não está
      // surtindo efeito. Sem esta trava o laço rodaria pra sempre.
      if (caminhos.some((c) => removidos.has(c))) {
        throw AppError.internal(`Arquivos de ${bucket} não saíram do Storage`);
      }

      const { error: erroRemocao } = await supabaseAdmin.storage.from(bucket).remove(caminhos);
      if (erroRemocao) {
        throw AppError.internal(`Falha ao remover arquivos de ${bucket}: ${erroRemocao.message}`);
      }
      caminhos.forEach((c) => removidos.add(c));
    }
  },

  /**
   * Extrai o path relativo ao bucket a partir de uma URL pública do Supabase
   * Storage, para permitir a remoção de imagens antigas ao substituir.
   */
  extractPathFromPublicUrl(bucket: StorageBucket, publicUrl: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    return publicUrl.slice(index + marker.length);
  },
};

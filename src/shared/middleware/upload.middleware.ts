import multer from 'multer';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/shared/storage/storage.constants';

/**
 * Upload em memória (não grava em disco): o buffer resultante é repassado
 * diretamente para storageService.uploadImage. Valida tipo e tamanho antes
 * mesmo de chegar ao controller.
 */
const storage = multer.memoryStorage();

export const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      callback(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).single('file');

/**
 * Upload de múltiplas imagens em um único campo "files" (ex.: mídias de um
 * post). Limite de 10 arquivos por requisição, mesma validação de tipo e
 * tamanho do upload individual.
 */
export const imagesUpload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      callback(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).array('files', 10);

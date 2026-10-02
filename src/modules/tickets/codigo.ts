import { randomBytes } from 'node:crypto';

/**
 * Sem 0/O e 1/I/L: o código também é ditado em voz alta na porta, quando a
 * câmera não lê o QR de uma tela trincada.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * 10 caracteres de 31 possíveis dá uns 49 bits. A portaria só aceita os
 * códigos da lista do próprio rolê, então acertar um no chute é coisa de
 * trilhões de tentativas — e cada uma precisa passar na frente da câmera.
 *
 * O `% 31` sobre um byte puxa um tiquinho a distribuição pros primeiros
 * caracteres. Irrelevante aqui: o código não é senha, é só impossível de
 * adivinhar dentro de uma lista de algumas centenas.
 *
 * Fica num arquivo próprio porque o repositório de eventos precisa dele ao
 * criar a presença, e importar o service de ingressos de lá fecharia um
 * ciclo de imports.
 */
export function novoCodigoDeIngresso(tamanho = 10): string {
  let code = '';
  for (const b of randomBytes(tamanho)) code += ALFABETO[b % ALFABETO.length];
  return code;
}

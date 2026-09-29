import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { reduzir, LADO_DA_MINIATURA } from '@/shared/storage/miniatura.service';

/** Uma "arte" de verdade em memória, do tamanho de um flyer de Instagram. */
async function flyer(largura: number, altura: number) {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 200, g: 40, b: 60 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe('miniatura do pino', () => {
  it('sai quadrada no lado certo, venha a arte em pé ou deitada', async () => {
    for (const [l, a] of [[1080, 1350], [1440, 1920], [1254, 1254], [1920, 1080]]) {
      const pequena = await reduzir(await flyer(l, a));
      const meta = await sharp(pequena!).metadata();
      expect([meta.width, meta.height]).toEqual([LADO_DA_MINIATURA, LADO_DA_MINIATURA]);
      expect(meta.format).toBe('jpeg');
    }
  });

  it('fica muito menor que a arte original', async () => {
    const original = await flyer(1440, 1920);
    const pequena = await reduzir(original);
    expect(pequena!.length).toBeLessThan(original.length / 5);
    expect(pequena!.length).toBeLessThan(20 * 1024);
  });

  /**
   * Arquivo quebrado não pode derrubar quem salvou a foto: a miniatura é
   * enfeite do mapa, e o rolê tem que ser salvo mesmo sem ela.
   */
  it('arquivo que não é imagem devolve null em vez de lançar', async () => {
    await expect(reduzir(Buffer.from('isto não é um jpeg'))).resolves.toBeNull();
  });
});

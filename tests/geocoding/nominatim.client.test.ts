import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { consultarNominatim, reiniciarNominatim } from '@/shared/geocoding/nominatim.client';

function respostaOk(corpo: unknown) {
  return { ok: true, json: async () => corpo } as Response;
}

describe('consultarNominatim', () => {
  const saidas: number[] = [];

  beforeEach(() => {
    reiniciarNominatim();
    saidas.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        saidas.push(Date.now());
        return respostaOk([{ url }]);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('não repete a mesma pergunta: a segunda vem do cache', async () => {
    const url = 'https://nominatim.openstreetmap.org/search?q=rua+a';

    const primeira = await consultarNominatim(url);
    const segunda = await consultarNominatim(url);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(segunda).toEqual(primeira);
  });

  it('espaça chamadas diferentes em mais de um segundo, mesmo disparadas juntas', async () => {
    await Promise.all([
      consultarNominatim('https://nominatim.openstreetmap.org/search?q=1'),
      consultarNominatim('https://nominatim.openstreetmap.org/search?q=2'),
    ]);

    expect(saidas).toHaveLength(2);
    expect(saidas[1] - saidas[0]).toBeGreaterThanOrEqual(1000);
  });

  it('recusa na hora quando a fila está cheia, em vez de acumular espera', async () => {
    const pedidos = Array.from({ length: 12 }, (_, i) =>
      consultarNominatim(`https://nominatim.openstreetmap.org/search?q=${i}`)
    );

    // Os dois últimos não cabem na fila de 10: voltam null sem esperar.
    const [penultimo, ultimo] = await Promise.all(pedidos.slice(10));
    expect(penultimo).toBeNull();
    expect(ultimo).toBeNull();
  }, 20_000);
});

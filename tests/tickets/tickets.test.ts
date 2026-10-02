import { describe, expect, it } from 'vitest';
import { novoCodigoDeIngresso } from '@/modules/tickets/codigo';
import { horaDaEntrada, rotuloDoCarro } from '@/modules/tickets/tickets.service';
import { syncCheckinsSchema, ticketCodeSchema } from '@/modules/tickets/tickets.schema';

describe('código do ingresso', () => {
  it('sai com 10 caracteres, sem os que se confundem ditados em voz alta', () => {
    for (let i = 0; i < 200; i++) {
      const code = novoCodigoDeIngresso();
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
    }
  });

  it('não repete numa amostra grande', () => {
    const codigos = new Set(Array.from({ length: 5000 }, () => novoCodigoDeIngresso()));
    expect(codigos.size).toBe(5000);
  });

  it('o código gerado passa na validação da portaria', () => {
    expect(ticketCodeSchema.safeParse(novoCodigoDeIngresso()).success).toBe(true);
  });

  it('o hexadecimal dos ingressos antigos (migration 0038) também passa', () => {
    expect(ticketCodeSchema.safeParse('0A1B2C3D4E').success).toBe(true);
  });

  it('recusa ponto e minúscula — o ponto separa as partes do QR', () => {
    expect(ticketCodeSchema.safeParse('ABC.DEF123').success).toBe(false);
    expect(ticketCodeSchema.safeParse('abcdef1234').success).toBe(false);
  });
});

describe('carro no ingresso', () => {
  it('do catálogo: marca, modelo e ano', () => {
    expect(
      rotuloDoCarro({
        version: null,
        vehicle_versions: {
          year: 1994,
          vehicle_models: { name: 'Gol', vehicle_brands: { name: 'VW' } },
        },
      })
    ).toBe('VW Gol 1994');
  });

  it('fora do catálogo: o que a pessoa escreveu', () => {
    expect(rotuloDoCarro({ version: ' Opala 4cc ', vehicle_versions: null })).toBe('Opala 4cc');
  });

  it('sem carro: null, e a portaria não mostra a linha', () => {
    expect(rotuloDoCarro(null)).toBeNull();
    expect(rotuloDoCarro({ version: '  ', vehicle_versions: null })).toBeNull();
  });
});

describe('hora da entrada', () => {
  const agora = new Date('2026-10-02T23:00:00.000Z');

  it('usa a hora do celular da portaria — offline, é a única que existe', () => {
    expect(horaDaEntrada('2026-10-02T22:14:00.000Z', agora)).toBe('2026-10-02T22:14:00.000Z');
  });

  it('relógio adiantado não registra entrada no futuro', () => {
    expect(horaDaEntrada('2026-10-02T23:30:00.000Z', agora)).toBe(agora.toISOString());
  });

  it('aceita o fuso do aparelho e grava em UTC', () => {
    expect(horaDaEntrada('2026-10-02T19:14:00.000-03:00', agora)).toBe('2026-10-02T22:14:00.000Z');
  });
});

describe('lote da portaria', () => {
  it('aceita o que o app manda', () => {
    const r = syncCheckinsSchema.safeParse({
      checkins: [{ code: 'K7Q2M9XAB3', at: '2026-10-02T22:14:03.120Z', deviceId: 'a8f3k2p1' }],
    });
    expect(r.success).toBe(true);
  });

  it('lote vazio é válido — é o que vai quando só se quer a lista atualizada', () => {
    expect(syncCheckinsSchema.safeParse({ checkins: [] }).success).toBe(true);
  });

  it('recusa hora que não é ISO', () => {
    const r = syncCheckinsSchema.safeParse({
      checkins: [{ code: 'K7Q2M9XAB3', at: '02/10/2026 22:14', deviceId: 'a' }],
    });
    expect(r.success).toBe(false);
  });
});

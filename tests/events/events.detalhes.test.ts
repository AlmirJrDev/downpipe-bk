import { describe, expect, it } from 'vitest';
import { carroAceitoNoRole } from '@/modules/events/events.service';
import { createEventSchema, updateEventSchema } from '@/modules/events/events.schema';

const base = {
  name: 'Encontro da Paulista',
  startsAt: '2026-10-10T22:00:00.000Z',
  location: 'Posto Shell',
  city: 'São Paulo',
};

describe('carro aceito no rolê', () => {
  it('sem lista, qualquer carro entra — que é a maioria dos encontros', () => {
    expect(carroAceitoNoRole([], 'Stance')).toBe(true);
    expect(carroAceitoNoRole(null, 'Stance')).toBe(true);
  });

  it('com lista, só as categorias que o rolê espera', () => {
    expect(carroAceitoNoRole(['Clássicos'], 'Clássicos')).toBe(true);
    expect(carroAceitoNoRole(['Clássicos'], 'Stance')).toBe(false);
  });

  it('carro sem categoria preenchida passa: recusar por campo vazio seria pior', () => {
    expect(carroAceitoNoRole(['Clássicos'], null)).toBe(true);
  });
});

describe('campos novos do rolê', () => {
  it('aceita atrações, proibições, tipo e carros esperados', () => {
    const r = createEventSchema.safeParse({
      ...base,
      endsAt: '2026-10-11T03:00:00.000Z',
      endsAtEstimated: true,
      entryNote: '1 kg de alimento não perecível',
      attractions: ['food_truck', 'espaco_kids'],
      rules: ['sem_som_alto', 'sem_borrachao'],
      kind: 'encontro',
      carCategories: ['Clássicos'],
    });
    expect(r.success).toBe(true);
  });

  it('recusa atração e proibição fora do vocabulário', () => {
    expect(createEventSchema.safeParse({ ...base, attractions: ['churrasco'] }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...base, rules: ['sem_nada'] }).success).toBe(false);
  });

  it('rolê que termina antes de começar é erro de digitação', () => {
    const r = createEventSchema.safeParse({
      ...base,
      endsAt: '2026-10-10T20:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });

  it('a mesma regra vale na edição', () => {
    const r = updateEventSchema.safeParse({
      startsAt: '2026-10-10T22:00:00.000Z',
      endsAt: '2026-10-10T21:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });

  it('tirar o fim do rolê é permitido (volta a ser em aberto)', () => {
    expect(updateEventSchema.safeParse({ endsAt: null }).success).toBe(true);
  });
});

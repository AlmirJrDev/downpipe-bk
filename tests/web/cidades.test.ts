import { describe, expect, it } from 'vitest';
import {
  cidadesComRole,
  paginaDaAgenda,
  paginaDaCidade,
  slugDaCidade,
  RoleDaAgenda,
} from '@/shared/web/cidades';

const ORIGEM = 'https://downpipe.onrender.com';

const role = (extra: Partial<RoleDaAgenda> = {}): RoleDaAgenda => ({
  id: 'e1',
  name: 'Drift Fest 3',
  // 03/10 16:00 em Brasília.
  starts_at: '2026-10-03T19:00:00+00:00',
  ends_at: '2026-10-04T01:00:00+00:00',
  ends_at_estimated: false,
  location: 'Shopping Central Park',
  city: 'Cotia',
  entry_note: 'Expositor R$ 20',
  photo_url: 'https://storage/flyer.jpg',
  photo_thumb_url: 'https://storage/mini.jpg',
  organizer_instagram: 'low_meeting',
  ...extra,
});

describe('endereço da cidade', () => {
  it('tira acento e espaço: é o que vira o endereço /encontros/<cidade>', () => {
    expect(slugDaCidade('São Bernardo do Campo')).toBe('sao-bernardo-do-campo');
    expect(slugDaCidade('Águas de Lindóia')).toBe('aguas-de-lindoia');
    expect(slugDaCidade('Hortolândia')).toBe('hortolandia');
  });
});

describe('página da cidade', () => {
  const roles = [
    role(),
    role({ id: 'e2', name: 'Rota 17', city: 'Campinas', starts_at: '2026-10-04T11:00:00+00:00' }),
    role({ id: 'e3', name: 'AFR288', city: 'Campinas' }),
  ];

  it('lista só os rolês daquela cidade', () => {
    const p = paginaDaCidade(ORIGEM, 'campinas', roles, ['Campinas', 'Cotia'])!;
    expect(p.html).toContain('Encontros de carro em Campinas');
    expect(p.html).toContain('Rota 17');
    expect(p.html).toContain('AFR288');
    expect(p.html).not.toContain('>Drift Fest 3<');
  });

  it('mostra o horário de Brasília, não o do servidor', () => {
    const p = paginaDaCidade(ORIGEM, 'cotia', roles, ['Cotia'])!;
    expect(p.html).toContain('SÁB 03 OUT · 16:00 às 22:00');
  });

  it('usa a miniatura, não a arte cheia', () => {
    const p = paginaDaCidade(ORIGEM, 'cotia', roles, ['Cotia'])!;
    expect(p.html).toContain('https://storage/mini.jpg');
    expect(p.html).not.toContain('https://storage/flyer.jpg');
  });

  /**
   * Página de cidade sem rolê agendado não pode virar 404: semana que vem
   * tem rolê de novo, e o Google esqueceria a página. Mas também não deve
   * ser indexada vazia.
   */
  it('cidade que já teve rolê, sem nenhum agora: existe, mas com noindex', () => {
    const p = paginaDaCidade(ORIGEM, 'jundiai', roles, ['Campinas', 'Cotia', 'Jundiaí'])!;
    expect(p.indexar).toBe(false);
    expect(p.html).toContain('noindex');
    expect(p.html).toContain('Nenhum rolê agendado em Jundiaí');
  });

  it('cidade que nunca teve rolê: null, e o servidor responde 404', () => {
    expect(paginaDaCidade(ORIGEM, 'manaus', roles, ['Campinas'])).toBeNull();
  });

  it('nome escrito por usuário não vira HTML', () => {
    const p = paginaDaCidade(ORIGEM, 'cotia', [role({ name: '<img src=x onerror=alert(1)>' })], ['Cotia'])!;
    expect(p.html).not.toContain('<img src=x');
    expect(p.html).toContain('&lt;img src=x');
  });

  it('marca a lista e a trilha pro Google', () => {
    const p = paginaDaCidade(ORIGEM, 'campinas', roles, ['Campinas'])!;
    expect(p.html).toContain('"@type":"ItemList"');
    expect(p.html).toContain(`"url":"${ORIGEM}/app/event/e2"`);
    expect(p.html).toContain('"@type":"BreadcrumbList"');
  });

  it('liga pras outras cidades, que é como o Google acha as outras páginas', () => {
    const p = paginaDaCidade(ORIGEM, 'campinas', roles, ['Campinas', 'Cotia'])!;
    expect(p.html).toContain('href="/encontros/cotia"');
    expect(p.html).not.toContain('href="/encontros/campinas"');
  });
});

describe('agenda geral', () => {
  it('conta as cidades da que tem mais pra que tem menos', () => {
    const roles = [role({ city: 'Cotia' }), role({ city: 'Campinas' }), role({ city: 'Campinas' })];
    expect(cidadesComRole(roles)).toEqual([
      { nome: 'Campinas', total: 2 },
      { nome: 'Cotia', total: 1 },
    ]);
  });

  it('é indexável e leva o endereço canônico', () => {
    const html = paginaDaAgenda(ORIGEM, [role()]);
    expect(html).toContain(`<link rel="canonical" href="${ORIGEM}/encontros">`);
    expect(html).not.toContain('noindex');
  });
});

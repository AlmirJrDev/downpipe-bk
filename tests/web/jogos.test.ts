import { describe, expect, it } from 'vitest';
import { numeroDaNaveDoDia, paginaDaNaveDoDia, paginaDosJogos } from '@/shared/web/jogos';

describe('páginas dos jogos', () => {
  it('o número do dia acompanha o app: #1 em 13/10/2026, troca à meia-noite de Brasília', () => {
    expect(numeroDaNaveDoDia(new Date('2026-10-13T15:00:00Z'))).toBe(1);
    expect(numeroDaNaveDoDia(new Date('2026-10-14T02:59:00Z'))).toBe(1); // 23h59 em Brasília
    expect(numeroDaNaveDoDia(new Date('2026-10-14T03:00:00Z'))).toBe(2);
  });

  it('a página da Nave do Dia tem o que o Google lê e o botão de jogar', () => {
    const html = paginaDaNaveDoDia('https://downpipe.com.br', new Date('2026-10-20T15:00:00Z'));
    expect(html).toContain('<title>Nave do Dia · Jogo de adivinhar o carro do dia | Downpipe</title>');
    expect(html).toContain('href="https://downpipe.com.br/app/nave-do-dia"');
    expect(html).toContain('#8');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('<link rel="canonical" href="https://downpipe.com.br/jogos/nave-do-dia">');
  });

  it('a vitrine leva pra página do jogo', () => {
    expect(paginaDosJogos('https://downpipe.com.br')).toContain('href="/jogos/nave-do-dia"');
  });
});

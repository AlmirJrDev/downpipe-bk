import { describe, expect, it } from 'vitest';
import {
  diaEmBrasilia,
  ehRobo,
  normalizarCaminho,
  origemDa,
  resumir,
  visitanteDoDia,
  type Visualizacao,
} from '@/modules/visitas/visitas';
import { aparelho, navegadorDeApp } from '@/shared/web/aparelho';

// User-agents tirados do log do anúncio de 12/10/2026.
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G90 Instagram 450.1.0.35.61 (iPhone12,1; iOS 26_6_2; pt_BR; pt; scale=2.00; 828x1792; IABMV/1; 1084815185) Safari/604.1';
const ANDROID_INSTAGRAM =
  'Mozilla/5.0 (Linux; Android 15; moto g15 Build/VVTA35.51-158; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.32 Mobile Safari/537.36 Instagram 450.0.0.50.77 Android (35/15; 400dpi; 1080x2400; motorola; moto g15; lamu; mt6768; pt_BR; 1084453874; IABMV/1)';
const PREVIA_INSTAGRAM =
  'Instagram 450.0.0.50.77 Android (36/16; 340dpi; 1080x2400; motorola; motorola edge 50 fusion; cusco; qcom; pt_BR; 1084453874)';

describe('quem conta como visita', () => {
  it('gente no navegador do Instagram conta', () => {
    expect(ehRobo(IPHONE_INSTAGRAM)).toBe(false);
    expect(ehRobo(ANDROID_INSTAGRAM)).toBe(false);
  });

  it('robôs, prévias de link e monitores ficam de fora', () => {
    expect(ehRobo(PREVIA_INSTAGRAM)).toBe(true);
    expect(ehRobo('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(ehRobo('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
    expect(ehRobo('WhatsApp/2.23.20.0 A')).toBe(true);
    expect(ehRobo('Render/1.0')).toBe(true);
    expect(ehRobo('curl/8.4.0')).toBe(true);
    expect(ehRobo(undefined)).toBe(true);
  });

  it('celular CUBOT não é robô', () => {
    expect(ehRobo('Mozilla/5.0 (Linux; Android 13; CUBOT X70) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36')).toBe(false);
  });
});

describe('de onde veio', () => {
  it('o utm do anúncio manda primeiro', () => {
    expect(origemDa({ utmSource: 'ig', utmMedium: 'paid', referrer: 'https://instagram.com/', userAgent: IPHONE_INSTAGRAM })).toBe(
      'Instagram (anúncio)'
    );
    expect(origemDa({ utmSource: 'ig', userAgent: IPHONE_INSTAGRAM })).toBe('Instagram');
  });

  it('sem utm, vale o site anterior', () => {
    expect(origemDa({ referrer: 'https://www.google.com/' })).toBe('Google');
    expect(origemDa({ referrer: 'https://l.facebook.com/' })).toBe('Facebook');
    expect(origemDa({ referrer: 'https://downpipe.com.br/' })).toBe('Interno');
    expect(origemDa({ referrer: 'https://blog.exemplo.com/post' })).toBe('blog.exemplo.com');
  });

  it('sem nada, o navegador do Instagram se entrega; senão é Direto', () => {
    expect(origemDa({ userAgent: ANDROID_INSTAGRAM })).toBe('Instagram');
    expect(origemDa({})).toBe('Direto');
  });
});

describe('aparelho e caminho', () => {
  it('resume o aparelho e marca o navegador do Instagram', () => {
    expect(aparelho(ANDROID_INSTAGRAM)).toBe('Celular · Android · Instagram');
    expect(navegadorDeApp(IPHONE_INSTAGRAM)).toBe('instagram');
    expect(navegadorDeApp('Mozilla/5.0 (Windows NT 10.0) Chrome/129.0')).toBeNull();
  });

  it('junta as páginas do mesmo tipo', () => {
    expect(normalizarCaminho('/app/event/0b8a1c2d-1111-4222-8333-944445555666?x=1')).toBe('/app/event/:id');
    expect(normalizarCaminho('/encontros/campinas/')).toBe('/encontros/campinas');
    expect(normalizarCaminho('/?fbclid=abc')).toBe('/');
  });

  it('o código do visitante muda de um dia pro outro', () => {
    const a = visitanteDoDia('1.2.3.4', 'ua', new Date('2026-10-12T15:00:00Z'), 'segredo-de-teste-123');
    const b = visitanteDoDia('1.2.3.4', 'ua', new Date('2026-10-12T20:00:00Z'), 'segredo-de-teste-123');
    const c = visitanteDoDia('1.2.3.4', 'ua', new Date('2026-10-13T15:00:00Z'), 'segredo-de-teste-123');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(16);
  });

  it('o dia é o de Brasília', () => {
    // 01h UTC do dia 13 ainda é 22h do dia 12 em Brasília.
    expect(diaEmBrasilia(new Date('2026-10-13T01:00:00Z'))).toBe('2026-10-12');
  });
});

describe('resumo do período', () => {
  const v = (at: string, visitor: string, path: string, source = 'Instagram (anúncio)', campaign: string | null = '1202'): Visualizacao => ({
    at,
    visitor,
    path,
    source,
    campaign,
    device: 'Celular · Android · Instagram',
    in_app: 'instagram',
  });

  it('monta o funil e a origem de cada pessoa', () => {
    const linhas = [
      v('2026-10-12T21:20:00Z', 'a', '/'),
      v('2026-10-12T21:26:00Z', 'b', '/'),
      v('2026-10-12T21:27:00Z', 'b', '/app', 'Interno', null),
      v('2026-10-12T21:28:00Z', 'b', '/app/register', 'Interno', null),
      v('2026-10-12T21:30:00Z', 'c', '/encontros/campinas', 'Google', null),
    ];
    const r = resumir(linhas, 1, 7, new Date('2026-10-12T23:00:00Z'));
    expect(r.funil).toEqual({ viramOSite: 3, abriramOApp: 1, foramProCadastro: 1, contasCriadas: 1 });
    // Andar da landing pro app não muda a origem de quem veio do anúncio.
    expect(r.origens).toEqual([
      { nome: 'Instagram (anúncio)', pessoas: 2 },
      { nome: 'Google', pessoas: 1 },
    ]);
    expect(r.noInstagram).toBe(3);
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia.at(-1)).toEqual({ dia: '2026-10-12', pessoas: 3, visualizacoes: 5 });
    expect(r.paginas[0]).toEqual({ nome: '/', pessoas: 2 });
  });
});

import { describe, expect, it } from 'vitest';
import {
  abrirViagem,
  concluirComGoogle,
  enderecoDeIdaProGoogle,
  enderecoDoGoogle,
  hashDoNonce,
  lerCookie,
  novaViagem,
  retornoDoGoogle,
  selarViagem,
  voltarSeguro,
} from '@/modules/auth/loginSocial';

describe('login com Google', () => {
  it('a ida passa pelo Supabase e volta pra tela /app/entrar', () => {
    const url = new URL(enderecoDeIdaProGoogle('https://downpipe.com.br', null));
    expect(url.pathname).toBe('/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toBe('https://downpipe.com.br/app/entrar');
  });

  it('o link que a pessoa tinha aberto vai junto, pra voltar pra ele', () => {
    const url = new URL(enderecoDeIdaProGoogle('https://downpipe.com.br', '/event/e1'));
    expect(url.searchParams.get('redirect_to')).toBe('https://downpipe.com.br/app/entrar?voltar=%2Fevent%2Fe1');
  });

  /** Endereço completo no "voltar" viraria redirecionamento aberto pra qualquer site. */
  it('voltar só aceita caminho dentro do app', () => {
    expect(voltarSeguro('/event/e1')).toBe('/event/e1');
    expect(voltarSeguro('https://golpe.com')).toBeNull();
    expect(voltarSeguro('//golpe.com')).toBeNull();
    expect(voltarSeguro('/\\golpe.com')).toBeNull();
    expect(voltarSeguro(undefined)).toBeNull();
    expect(voltarSeguro(['/a'])).toBeNull();
  });
});

describe('login direto com o Google', () => {
  const segredo = 'segredo-de-teste';

  it('a ida vai direto pro Google, com a volta em downpipe.com.br', () => {
    const viagem = novaViagem('/event/e1');
    const url = new URL(enderecoDoGoogle('cliente.apps.googleusercontent.com', retornoDoGoogle('https://downpipe.com.br'), viagem));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe('https://downpipe.com.br/auth/google/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(viagem.state);
    // O Google recebe só o hash; o nonce cru fica no cookie, pro Supabase.
    expect(url.searchParams.get('nonce')).toBe(hashDoNonce(viagem.nonce));
    expect(url.searchParams.get('nonce')).not.toBe(viagem.nonce);
  });

  it('o cookie da viagem abre só com a assinatura certa e dentro do prazo', () => {
    const agora = 1_000_000;
    const viagem = novaViagem('/event/e1', agora);
    const selada = selarViagem(viagem, segredo);
    expect(abrirViagem(selada, segredo, agora)).toEqual(viagem);
    expect(abrirViagem(selada, 'outro-segredo', agora)).toBeNull();
    expect(abrirViagem(selada, segredo, agora + 11 * 60_000)).toBeNull();
    expect(abrirViagem(undefined, segredo, agora)).toBeNull();
    expect(abrirViagem('lixo', segredo, agora)).toBeNull();
  });

  it('cookie adulterado (trocando o voltar) é recusado', () => {
    const agora = 1_000_000;
    const selada = selarViagem(novaViagem('/event/e1', agora), segredo);
    const [, assinatura] = selada.split('.');
    const forjado = Buffer.from(JSON.stringify({ ...novaViagem('//golpe.com', agora) })).toString('base64url');
    expect(abrirViagem(`${forjado}.${assinatura}`, segredo, agora)).toBeNull();
  });

  it('volta sem viagem ou com state trocado não chega a falar com o Google', async () => {
    const semViagem = await concluirComGoogle('https://downpipe.com.br', 'c', 's', null);
    expect(semViagem).toMatch(/^https:\/\/downpipe\.com\.br\/app\/entrar#error_description=/);
    const outroState = await concluirComGoogle('https://downpipe.com.br', 'c', 'outro', novaViagem(null));
    expect(outroState).toMatch(/#error_description=/);
  });

  it('lê o cookie do cabeçalho', () => {
    expect(lerCookie('a=1; dp_google=abc.def; b=2', 'dp_google')).toBe('abc.def');
    expect(lerCookie('a=1', 'dp_google')).toBeUndefined();
    expect(lerCookie(undefined, 'dp_google')).toBeUndefined();
  });
});

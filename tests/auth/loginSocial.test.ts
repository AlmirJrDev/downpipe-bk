import { describe, expect, it } from 'vitest';
import { enderecoDeIdaProGoogle, voltarSeguro } from '@/modules/auth/loginSocial';

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

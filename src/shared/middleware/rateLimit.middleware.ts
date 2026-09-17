import type { Request } from 'express';
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import { sendError } from '@/shared/utils/apiResponse';

/**
 * Limites de requisição.
 *
 * Antes não havia nenhum: dava pra tentar senhas no login sem parar, criar
 * contas em massa e disparar e-mail de recuperação à vontade.
 *
 * Os números são folgados de propósito, por causa do CGNAT. Operadora de
 * celular no Brasil põe milhares de pessoas atrás do mesmo IP, e um rolê é
 * justamente o lugar onde vinte pessoas na mesma antena criam conta ao
 * mesmo tempo. Limite só por IP apertado bloquearia gente de verdade.
 *
 * Por isso o que protege senha e e-mail é contado por CONTA, não por IP:
 * dez tentativas erradas num e-mail travam aquele e-mail, venham de onde
 * vierem, sem atrapalhar quem está na mesma rede. O limite por IP nessas
 * rotas existe só pra barrar quem testa milhares de contas diferentes.
 *
 * Contagem em memória: basta enquanto o backend roda numa instância só. Com
 * mais de uma, cada uma contaria separado e o limite real multiplicaria.
 */

const MINUTO = 60 * 1000;

function limite(
  opcoes: Pick<Options, 'windowMs' | 'limit'> & {
    mensagem: string;
    chave?: (req: Request) => string;
    /** Só conta o que deu errado — ver os limites de login. */
    soErros?: boolean;
  }
) {
  return rateLimit({
    windowMs: opcoes.windowMs,
    limit: opcoes.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(opcoes.chave ? { keyGenerator: opcoes.chave } : {}),
    ...(opcoes.soErros ? { skipSuccessfulRequests: true } : {}),
    handler: (_req, res) => sendError(res, 429, 'RATE_LIMITED', opcoes.mensagem),
  });
}

/**
 * Chave pelo e-mail do corpo. Sem e-mail no corpo, cai no IP: o pedido vai
 * ser recusado pela validação de qualquer jeito, mas ainda conta.
 */
function porEmail(prefixo: string) {
  return (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `${prefixo}:email:${email}` : `${prefixo}:ip:${ipKeyGenerator(req.ip ?? '')}`;
  };
}

const TENTE_DEPOIS = 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';

/**
 * Os dois limites de login contam só tentativa que falhou.
 *
 * Quem acerta a senha não é ataque, e cobrar dele o mesmo orçamento criava
 * dois falsos positivos: a pessoa que entra em três aparelhos no mesmo dia, e
 * a rede de operadora, onde milhares de pessoas saem pelo mesmo IP — num rolê
 * grande, cem logins bem-sucedidos em quinze minutos trancariam todo mundo que
 * chegasse depois.
 */
export const limiteLoginPorConta = limite({
  windowMs: 15 * MINUTO,
  limit: 10,
  chave: porEmail('login'),
  soErros: true,
  mensagem: 'Muitas tentativas de entrar nesta conta. Espere 15 minutos e tente de novo.',
});

export const limiteLoginPorIp = limite({
  windowMs: 15 * MINUTO,
  limit: 100,
  soErros: true,
  mensagem: TENTE_DEPOIS,
});

export const limiteCadastro = limite({ windowMs: 60 * MINUTO, limit: 30, mensagem: TENTE_DEPOIS });

export const limiteRecuperacaoPorConta = limite({
  windowMs: 60 * MINUTO,
  limit: 5,
  chave: porEmail('recuperacao'),
  mensagem: 'Já enviamos alguns e-mails de recuperação. Confira sua caixa de entrada e o spam antes de pedir de novo.',
});

export const limiteRecuperacaoPorIp = limite({ windowMs: 60 * MINUTO, limit: 30, mensagem: TENTE_DEPOIS });

/** Busca de endereço: cada chamada consome a cota do Nominatim. */
export const limiteGeocodificacao = limite({ windowMs: MINUTO, limit: 30, mensagem: TENTE_DEPOIS });

/**
 * Teto geral da API, contra robô.
 *
 * Aplicado só nos prefixos da API (ver PREFIXOS_DA_API em app.ts), e não no
 * app inteiro. A primeira versão ia no app todo e pulava o que "parecesse
 * arquivo estático", testando se o caminho terminava em ponto e extensão.
 * Isso abria um buraco: ponto é caractere válido em @, então
 * /profiles/joao.silva passava sem ser contado — e era só usar um @ com
 * ponto pra martelar a API à vontade. Escolher onde aplicar é mais seguro
 * do que tentar adivinhar o que pular.
 */
export const limiteGeral = limite({
  windowMs: MINUTO,
  limit: 600,
  mensagem: TENTE_DEPOIS,
});

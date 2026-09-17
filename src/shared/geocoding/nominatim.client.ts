/**
 * Todas as chamadas ao Nominatim passam por aqui.
 *
 * A política de uso do serviço público exige no máximo 1 requisição por
 * segundo, cache do lado de quem chama, e proíbe busca enquanto a pessoa
 * digita. O limite vale pro servidor inteiro, não por usuário: todo mundo
 * que usa o app sai pelo mesmo IP do backend. Sem esta fila, dez pessoas
 * criando rolê ao mesmo tempo estourariam o limite, e quem é bloqueado é o
 * servidor — somem a busca de endereço e a cidade automática pra todos.
 *
 * Três proteções, nesta ordem:
 *  1. cache: a mesma pergunta não sai duas vezes (pino no mesmo lugar,
 *     o mesmo endereço buscado de novo);
 *  2. fila: uma chamada por vez, com intervalo mínimo entre elas;
 *  3. fila cheia recusa na hora em vez de acumular espera — quem chama já
 *     trata "sem resposta" como "preencha na mão".
 */

const INTERVALO_MS = 1100;
const FILA_MAXIMA = 10;
const CACHE_MAXIMO = 500;
const CACHE_VALIDADE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

// A política exige identificar a aplicação com um contato de verdade.
const USER_AGENT = 'Downpipe/1.0 (+https://downpipe.onrender.com; downpipeapp@gmail.com)';

const cache = new Map<string, { valor: unknown; expira: number }>();
let fila: Promise<void> = Promise.resolve();
let naFila = 0;
let ultimaSaida = 0;

function doCache(url: string): unknown | undefined {
  const guardado = cache.get(url);
  if (!guardado) return undefined;
  if (guardado.expira < Date.now()) {
    cache.delete(url);
    return undefined;
  }
  // Reinsere pra marcar como usado agora: o descarte sai pelo mais antigo.
  cache.delete(url);
  cache.set(url, guardado);
  return guardado.valor;
}

function guardar(url: string, valor: unknown) {
  cache.set(url, { valor, expira: Date.now() + CACHE_VALIDADE_MS });
  if (cache.size > CACHE_MAXIMO) {
    const maisAntigo = cache.keys().next().value;
    if (maisAntigo !== undefined) cache.delete(maisAntigo);
  }
}

/** Espera a vez na fila, respeitando o intervalo desde a última saída. */
function esperarVez(): Promise<void> {
  const vez = fila.then(async () => {
    const espera = ultimaSaida + INTERVALO_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaSaida = Date.now();
  });
  // A fila guarda a versão que nunca rejeita. Se um dia algo aqui dentro
  // lançar, a promessa rejeitada viraria o elo seguinte da corrente e toda
  // chamada futura falharia pra sempre, sem chegar ao Nominatim.
  fila = vez.catch(() => undefined);
  return vez;
}

/**
 * GET no Nominatim. Devolve o JSON, ou null quando o serviço respondeu com
 * erro ou a fila está cheia. Lança em falha de rede ou timeout, que quem
 * chama já trata.
 */
export async function consultarNominatim(url: string): Promise<unknown | null> {
  const guardado = doCache(url);
  if (guardado !== undefined) return guardado;

  if (naFila >= FILA_MAXIMA) return null;

  naFila++;
  try {
    await esperarVez();
  } finally {
    naFila--;
  }

  // Pode ter chegado a mesma pergunta enquanto esta esperava a vez.
  const chegouNaEspera = doCache(url);
  if (chegouNaEspera !== undefined) return chegouNaEspera;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const valor = await response.json();
  guardar(url, valor);
  return valor;
}

/** Só pros testes: zera cache e fila entre um caso e outro. */
export function reiniciarNominatim() {
  cache.clear();
  fila = Promise.resolve();
  naFila = 0;
  ultimaSaida = 0;
}

/**
 * Prévia de link compartilhado (WhatsApp, Instagram, Telegram, X...).
 *
 * Esses apps não rodam o JavaScript da página: leem só as tags <meta> do HTML
 * que o servidor devolve. Como o app é uma página única, todo endereço
 * devolvia o mesmo HTML, e todo link compartilhado aparecia com o mesmo
 * "Downpipe" genérico, sem a foto do carro nem o nome do rolê. Aqui o
 * servidor preenche as tags com o conteúdo do link antes de devolver a casca
 * do app — quem abre no navegador recebe o app normal por cima.
 */
import { postsService } from '@/modules/posts/posts.service';
import { eventsService } from '@/modules/events/events.service';
import { profilesService } from '@/modules/profiles/profiles.service';
import { carsService } from '@/modules/cars/cars.service';

export interface Previa {
  titulo: string;
  descricao: string;
  imagem: string | null;
}

/**
 * Escapa pra dentro de um atributo HTML entre aspas duplas.
 *
 * Obrigatório: legenda, bio e nome de rolê são escritos por usuários. Sem
 * isto, uma legenda com `"><script>` viraria código rodando na página de
 * quem abrisse o link.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resumir(texto: string | null | undefined, limite = 160): string {
  const limpo = (texto ?? '').replace(/\s+/g, ' ').trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
}

function dataDoRole(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  return `${dia} às ${hora}`;
}

/**
 * Monta a prévia de um caminho do app. null quando o caminho não é de
 * conteúdo compartilhável, ou o conteúdo não existe mais — aí fica a prévia
 * padrão do app, em vez de um erro.
 */
export async function previaDoCaminho(tipo: string, chave: string): Promise<Previa | null> {
  try {
    switch (tipo) {
      case 'post': {
        const post = await postsService.getById(chave);
        const autor = post.author?.username;
        const foto = post.media.find((m) => m.mediaType === 'image');
        // No antes e depois, a segunda foto é o "depois" — a que vende o post.
        const imagem = post.type === 'evolution' ? (post.media[1] ?? foto) : foto;
        return {
          titulo: autor ? `@${autor} no Downpipe` : 'Publicação no Downpipe',
          descricao: resumir(post.title ?? post.caption) || 'Veja no Downpipe',
          imagem: imagem?.mediaUrl ?? null,
        };
      }
      case 'event': {
        const evento = await eventsService.getById(chave);
        const confirmados = evento.attendeesCount === 1 ? '1 confirmado' : `${evento.attendeesCount} confirmados`;
        return {
          titulo: evento.name,
          descricao: `${dataDoRole(evento.startsAt)} · ${evento.location}, ${evento.city} · ${confirmados}`,
          imagem: evento.photoUrl,
        };
      }
      case 'user': {
        const perfil = await profilesService.getPublicProfile(chave, undefined);
        const carros = perfil.carsCount === 1 ? '1 carro na garagem' : `${perfil.carsCount} carros na garagem`;
        return {
          titulo: `${perfil.displayName} (@${perfil.username})`,
          descricao: resumir(perfil.bio) || carros,
          imagem: perfil.avatarUrl,
        };
      }
      case 'car': {
        const carro = await carsService.getById(chave);
        const nome = carro.vehicle
          ? `${carro.vehicle.brand.name} ${carro.vehicle.model.name} ${carro.vehicle.year}`
          : carro.version ?? 'Carro';
        const dono = carro.owner?.username ? ` de @${carro.owner.username}` : '';
        return {
          titulo: `${nome}${dono}`,
          descricao: resumir(carro.description) || 'Garagem no Downpipe',
          imagem: carro.photoUrl,
        };
      }
      default:
        return null;
    }
  } catch {
    // Conteúdo apagado, id inválido, banco fora: prévia padrão, nunca erro.
    return null;
  }
}

/**
 * Troca título e descrição da casca do app pelos do link, e acrescenta as
 * tags Open Graph e de cartão do X. A imagem padrão entra quando o conteúdo
 * não tem foto, pra prévia nunca sair sem imagem.
 */
export function comPrevia(html: string, previa: Previa, urlDoLink: string, imagemPadrao: string): string {
  const titulo = escapar(previa.titulo);
  const descricao = escapar(previa.descricao);
  const imagem = escapar(previa.imagem ?? imagemPadrao);
  const url = escapar(urlDoLink);

  const tags = [
    `<title>${titulo}</title>`,
    `<meta name="description" content="${descricao}"/>`,
    `<meta property="og:site_name" content="Downpipe"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:locale" content="pt_BR"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta property="og:title" content="${titulo}"/>`,
    `<meta property="og:description" content="${descricao}"/>`,
    `<meta property="og:image" content="${imagem}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${titulo}"/>`,
    `<meta name="twitter:description" content="${descricao}"/>`,
    `<meta name="twitter:image" content="${imagem}"/>`,
  ].join('');

  return html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `${tags}</head>`);
}

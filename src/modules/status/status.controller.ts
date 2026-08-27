import path from 'node:path';
import { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { env } from '@/config/env';
import { AppError } from '@/shared/utils/AppError';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { statusService } from './status.service';
import { renderStatusPage } from './status.page';

const sessionSchema = z.object({
  // exp:// é o esquema que o Expo Go abre; https:// aceito porque o túnel do
  // Expo também responde nele.
  expoUrl: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('exp://') || v.startsWith('https://'), {
      message: 'expoUrl deve começar com exp:// ou https://',
    }),
});

function assertSecret(req: Request) {
  if (!env.STATUS_SECRET) {
    throw new AppError('STATUS_DISABLED', 'STATUS_SECRET não configurado no servidor', 503);
  }
  if (req.header('x-status-secret') !== env.STATUS_SECRET) {
    throw AppError.unauthorized('Segredo inválido');
  }
}

function relativeLabel(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h`;
}

/** Página pública de status — é o link que se manda pros testadores. */
export async function page(_req: Request, res: Response, next: NextFunction) {
  try {
    const session = statusService.getSession();
    const appOnline = !!session && !session.stale;

    // QR gerado aqui no servidor: a página não carrega nada de fora, então
    // funciona mesmo em conexão ruim e não depende de serviço de terceiro.
    const qrDataUri =
      appOnline && session
        ? await QRCode.toDataURL(session.expoUrl, { margin: 1, width: 480, color: { dark: '#121212', light: '#ffffff' } })
        : null;

    res
      .status(200)
      .type('html')
      .send(
        renderStatusPage({
          appOnline,
          expoUrl: appOnline && session ? session.expoUrl : null,
          qrDataUri,
          updatedAtLabel: session ? relativeLabel(session.updatedAt) : null,
        })
      );
  } catch (err) {
    next(err);
  }
}

/**
 * Logo da página de status.
 *
 * Servida como arquivo, e não embutida em base64 no HTML: a página recarrega
 * sozinha a cada 30s, e embutir 260 KB faria o testador baixar isso de novo a
 * cada refresh. Como arquivo, o navegador guarda em cache.
 *
 * Caminho a partir do cwd (raiz do projeto), que vale tanto pro `npm run dev`
 * quanto pro `npm start` — a pasta assets/ fica fora de src/ e não é copiada
 * pro dist/ no build.
 */
export function logo(_req: Request, res: Response, next: NextFunction) {
  res.sendFile(path.resolve(process.cwd(), 'assets/logo-downpipe.png'), { maxAge: '7d' }, (err) => {
    if (err) next(err);
  });
}

/** Chamado pelo `npm run share` do app ao subir o túnel do Expo. */
export async function publishSession(req: Request, res: Response, next: NextFunction) {
  try {
    assertSecret(req);
    const { expoUrl } = sessionSchema.parse(req.body);
    statusService.setSession(expoUrl);
    sendSuccess(res, { ok: true, expoUrl });
  } catch (err) {
    next(err);
  }
}

/** Marca o app como offline sem esperar a sessão expirar. */
export async function endSession(req: Request, res: Response, next: NextFunction) {
  try {
    assertSecret(req);
    statusService.clearSession();
    sendSuccess(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

import { Request, Response, NextFunction } from 'express';
import { supabaseAnon, supabaseAdmin, createUserScopedClient } from '@/config/supabase';
import { env } from '@/config/env';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema,
} from './auth.schema';

/**
 * O módulo auth NÃO reimplementa autenticação: apenas expõe uma API REST
 * consistente sobre o Supabase Auth, que já cuida de hashing de senha,
 * emissão/validação de JWT e fluxo de recuperação de senha.
 *
 * A criação do profile correspondente acontece automaticamente via trigger
 * de banco (handle_new_user), então este controller não precisa fazer isso.
 */

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, displayName } = registerSchema.parse(req.body);

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    if (error) {
      throw new AppError('REGISTER_FAILED', error.message, 400);
    }

    sendSuccess(
      res,
      {
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        session: data.session,
        // Quando a confirmação de e-mail está habilitada no projeto Supabase,
        // session vem null até o usuário confirmar o e-mail.
        requiresEmailConfirmation: !data.session,
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      throw new AppError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos', 401);
    }

    sendSuccess(res, {
      user: { id: data.user.id, email: data.user.email },
      session: data.session,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Troca um refresh token por uma sessão nova. O access token do Supabase dura
 * 1 hora; sem esta rota o app só teria como renovar pedindo login de novo, e
 * toda escrita passaria a falhar com 401 depois desse tempo.
 */
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new AppError('REFRESH_FAILED', 'Sessão expirada. Faça login novamente.', 401);
    }

    sendSuccess(res, {
      user: { id: data.user.id, email: data.user.email },
      session: data.session,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      throw AppError.unauthorized('Token de autenticação ausente');
    }

    // Usa um client "escopado" ao próprio token do usuário para invalidar
    // a sessão atual, sem precisar da service role key aqui.
    const userClient = createUserScopedClient(token);
    const { error } = await userClient.auth.signOut();

    if (error) {
      throw new AppError('LOGOUT_FAILED', error.message, 400);
    }

    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Define a senha nova.
 *
 * O token do e-mail de recuperação é um access token comum, então o
 * requireAuth já o valida e nos diz de quem é. Daí basta trocar a senha
 * desse usuário — sem pedir a senha antiga, que é justamente o que a
 * pessoa não tem.
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = resetPasswordSchema.parse(req.body);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, { password });

    if (error) {
      throw new AppError('RESET_PASSWORD_FAILED', error.message, 400);
    }

    sendSuccess(res, { message: 'Senha alterada. Entre com a nova senha.' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(
      email,
      // Sem redirectTo o Supabase usa o "Site URL" do painel dele. Apontar
      // explicitamente evita que o link do e-mail leve pra lugar nenhum.
      env.APP_URL ? { redirectTo: `${env.APP_URL}/app/nova-senha` } : undefined
    );

    if (error) {
      throw new AppError('FORGOT_PASSWORD_FAILED', error.message, 400);
    }

    // Sempre retorna sucesso, independente do e-mail existir ou não,
    // para não vazar quais e-mails estão cadastrados na base.
    sendSuccess(res, {
      message: 'Se o e-mail existir em nossa base, um link de recuperação foi enviado.',
    });
  } catch (err) {
    next(err);
  }
}

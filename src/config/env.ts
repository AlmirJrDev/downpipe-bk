import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Todas as variáveis de ambiente usadas pelo backend são validadas aqui.
 * Se algo obrigatório estiver faltando, a aplicação falha de forma clara
 * na inicialização, em vez de falhar silenciosamente em runtime.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL deve ser uma URL válida' }),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY é obrigatória'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY é obrigatória'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória').optional(),

  FIPE_API_URL: z.string().url().default('https://parallelum.com.br/fipe/api/v1'),

  /** Pasta do PWA exportado. Vazio = backend serve só a API. */
  WEB_DIST_PATH: z.string().optional(),

  /**
   * Endereço público do app, usado no link do e-mail de recuperação de
   * senha. Sem ele o Supabase manda pro "Site URL" configurado no painel
   * dele, que pode não ser o nosso — e a pessoa clica no link e não chega
   * a lugar nenhum.
   */
  APP_URL: z.string().url().optional(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:19006')
    .transform((val) => val.split(',').map((origin) => origin.trim())),

  /**
   * Segredo que autoriza o script `npm run share` do app a publicar a URL
   * atual do Expo na página de status. Sem ele, qualquer pessoa que
   * alcançasse o backend poderia trocar o link que os testadores escaneiam.
   * Se ficar vazio, a página funciona mas nunca mostra o app como online.
   */
  STATUS_SECRET: z.string().min(8, 'STATUS_SECRET deve ter ao menos 8 caracteres').optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Configuração de ambiente inválida. Verifique o arquivo .env.');
}

export const env = parsed.data;

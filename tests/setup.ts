// Variáveis de ambiente fake usadas apenas durante a execução dos testes,
// para que módulos que importam '@/config/env' não quebrem por falta de
// configuração real do Supabase.
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key';
process.env.FIPE_API_URL = process.env.FIPE_API_URL ?? 'https://parallelum.com.br/fipe/api/v1';

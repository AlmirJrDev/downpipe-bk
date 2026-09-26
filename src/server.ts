import { createApp } from '@/app';
import { env } from '@/config/env';
import { iniciarLembretesDeRole } from '@/modules/events/event-reminders.service';

const app = createApp();

app.listen(env.PORT, () => {
  // Lembrete do rolê que está chegando — ver event-reminders.service.
  iniciarLembretesDeRole();

  // eslint-disable-next-line no-console
  console.log(`🚗 Downpipe backend rodando na porta ${env.PORT} (${env.NODE_ENV})`);
});

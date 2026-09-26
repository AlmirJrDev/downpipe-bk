import { createApp } from '@/app';
import { env } from '@/config/env';
import { iniciarLembretes } from '@/modules/events/event-reminders.service';

const app = createApp();

app.listen(env.PORT, () => {
  // Rolê chegando e manutenção vencida — ver event-reminders.service.
  iniciarLembretes();

  // eslint-disable-next-line no-console
  console.log(`🚗 Downpipe backend rodando na porta ${env.PORT} (${env.NODE_ENV})`);
});

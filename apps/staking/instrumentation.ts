export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNotificationsWorker } = await import('./lib/notifications/worker');
    startNotificationsWorker();
  }
}

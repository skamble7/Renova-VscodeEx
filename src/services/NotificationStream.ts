type Listener = (event: any) => void;

export class NotificationStream {
  private listeners: Listener[] = [];
  connect() { /* attach to RabbitMQ SSE/proxy later */ }
  on(fn: Listener) { this.listeners.push(fn); }
  emit(e: any) { this.listeners.forEach(l => l(e)); }
}

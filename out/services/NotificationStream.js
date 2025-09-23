"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStream = void 0;
class NotificationStream {
    listeners = [];
    connect() { }
    on(fn) { this.listeners.push(fn); }
    emit(e) { this.listeners.forEach(l => l(e)); }
}
exports.NotificationStream = NotificationStream;
//# sourceMappingURL=NotificationStream.js.map
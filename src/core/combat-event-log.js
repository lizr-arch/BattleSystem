export class CombatEventLog {
  constructor(maxEvents = 240) {
    this.maxEvents = maxEvents;
    this.events = [];
    this.unread = [];
  }

  push(frame, type, message, data = {}) {
    const event = { frame, type, message, data };
    this.events.unshift(event);
    this.unread.push(event);

    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }

    return event;
  }

  clear() {
    this.events = [];
    this.unread = [];
  }

  consumeUnread() {
    const result = this.unread;
    this.unread = [];
    return result;
  }

  format(event) {
    return `F${String(event.frame).padStart(5, '0')}  ${event.message}`;
  }

  toText() {
    return this.events.map((event) => this.format(event)).join('\n');
  }
}

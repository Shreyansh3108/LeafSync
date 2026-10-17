class EventHub {
  constructor() {
    // channelName -> Set of Express `res` objects
    this.channels = new Map();

    // 25s heartbeat comment to prevent proxy idle timeouts
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 25_000);
    this.heartbeatTimer.unref?.();
  }

  subscribe(channel, res) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(res);

    return () => {
      const set = this.channels.get(channel);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.channels.delete(channel);
        }
      }
    };
  }

  publish(channel, payload) {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of subscribers) {
      try {
        res.write(message);
      } catch {
        subscribers.delete(res);
      }
    }
  }

  emitTicketEvent({ type, ticketId, authorId = null }) {
    const payload = {
      type,
      ticketId: Number(ticketId),
      timestamp: Date.now(),
    };

    // Always notify admins
    this.publish('admin', payload);

    // Notify the specific owning author channel if applicable
    if (authorId) {
      this.publish(`author:${authorId}`, payload);
    }
  }

  sendHeartbeat() {
    for (const subscribers of this.channels.values()) {
      for (const res of subscribers) {
        try {
          res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          subscribers.delete(res);
        }
      }
    }
  }
}

module.exports = new EventHub();
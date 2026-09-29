export function createMockLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
    child: function () {
      return this;
    },
  };
}

export function createMockEventPublisher() {
  const publishedEvents: unknown[] = [];
  return {
    publish: async (event: unknown) => {
      publishedEvents.push(event);
    },
    getPublishedEvents: () => publishedEvents,
    clear: () => {
      publishedEvents.length = 0;
    },
  };
}

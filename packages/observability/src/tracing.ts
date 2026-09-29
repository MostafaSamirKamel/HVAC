export function createSpan(name: string) {
  const startTime = performance.now();
  return {
    name,
    end: () => {
      const durationMs = performance.now() - startTime;
      return durationMs;
    },
  };
}

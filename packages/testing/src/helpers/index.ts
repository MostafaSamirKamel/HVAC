export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 50,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
}

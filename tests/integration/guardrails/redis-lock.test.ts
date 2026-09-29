import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistributedLock } from '@hvac/redis';
import { ConflictError } from '@hvac/errors';

describe('Phase 0 Guardrail: Redis Distributed Lock Contention Mitigation', () => {
  let mockRedis: any;
  let lock: DistributedLock;

  beforeEach(() => {
    mockRedis = {
      set: vi.fn(),
      eval: vi.fn(),
    };
    lock = new DistributedLock(mockRedis);
  });

  it('should acquire lock when resource is not held (SET NX PX returns OK)', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');

    const handle = await lock.acquire('stock:comp_1:wh_cairo:prod_101', 5000);

    expect(handle).not.toBeNull();
    expect(handle?.resource).toBe('stock:comp_1:wh_cairo:prod_101');
    expect(handle?.token).toBeDefined();
    expect(mockRedis.set).toHaveBeenCalledWith(
      'lock:stock:comp_1:wh_cairo:prod_101',
      expect.any(String),
      'PX',
      5000,
      'NX',
    );
  });

  it('should return null when resource is already locked by another operation', async () => {
    mockRedis.set.mockResolvedValueOnce(null); // Lock already held

    const handle = await lock.acquire('stock:comp_1:wh_cairo:prod_101', 5000);

    expect(handle).toBeNull();
  });

  it('should safely release lock only if the token matches (via Lua script)', async () => {
    mockRedis.eval.mockResolvedValueOnce(1); // Script returned 1 (deleted)

    const released = await lock.release({
      resource: 'treasury:comp_1:bank_cib',
      token: 'uuid-owner-token',
    });

    expect(released).toBe(true);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
      1,
      'lock:treasury:comp_1:bank_cib',
      'uuid-owner-token',
    );
  });

  it('should throw ConflictError (409) in withLock when contention occurs to protect system from dogpiling', async () => {
    mockRedis.set.mockResolvedValueOnce(null); // Contention

    await expect(
      lock.withLock('order:comp_1:ord_500', 3000, async () => {
        return 'success';
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should execute operation and automatically release lock on completion', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    mockRedis.eval.mockResolvedValueOnce(1);

    const result = await lock.withLock('order:comp_1:ord_500', 3000, async () => {
      return 'processed';
    });

    expect(result).toBe('processed');
    expect(mockRedis.set).toHaveBeenCalled();
    expect(mockRedis.eval).toHaveBeenCalled();
  });
});

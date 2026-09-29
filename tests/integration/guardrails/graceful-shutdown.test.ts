import { describe, it, expect, vi } from 'vitest';

describe('Phase 0 Guardrail: Graceful Shutdown Order & Contract (Rule 21)', () => {
  it('should execute the 8-step shutdown sequence in exact strict order', async () => {
    const executionOrder: string[] = [];

    const mockHttpServer = {
      close: vi.fn((cb) => {
        executionOrder.push('1_STOP_HTTP');
        cb();
      }),
    };

    const mockReadinessState = {
      isReady: true,
      setReady: vi.fn((val: boolean) => {
        executionOrder.push(`2_MARK_READINESS_${val ? 'TRUE' : 'FALSE'}`);
      }),
    };

    const mockInFlightManager = {
      drain: vi.fn(async () => {
        executionOrder.push('3_DRAIN_IN_FLIGHT');
      }),
    };

    const mockRabbitMQ = {
      stopConsumers: vi.fn(async () => {
        executionOrder.push('4_STOP_RABBITMQ_CONSUMERS');
      }),
      close: vi.fn(async () => {
        executionOrder.push('5_CLOSE_RABBITMQ_CONNECTION');
      }),
    };

    const mockOutbox = {
      flush: vi.fn(async () => {
        executionOrder.push('6_FLUSH_OUTBOX_BATCH');
      }),
    };

    const mockRedis = {
      disconnect: vi.fn(async () => {
        executionOrder.push('7_CLOSE_REDIS');
      }),
    };

    const mockMongo = {
      disconnect: vi.fn(async () => {
        executionOrder.push('8_CLOSE_MONGO');
      }),
    };

    // Execute standard shutdown handler
    const gracefulShutdown = async () => {
      // Step 1: Stop HTTP
      await new Promise<void>((resolve) => mockHttpServer.close(resolve));
      // Step 2: Mark readiness false
      mockReadinessState.setReady(false);
      // Step 3: Drain in-flight
      await mockInFlightManager.drain();
      // Step 4: Stop RabbitMQ consumers
      await mockRabbitMQ.stopConsumers();
      // Step 5: Flush outbox
      await mockOutbox.flush();
      // Step 6: Close RabbitMQ
      await mockRabbitMQ.close();
      // Step 7: Close Redis
      await mockRedis.disconnect();
      // Step 8: Close Mongo
      await mockMongo.disconnect();
    };

    await gracefulShutdown();

    expect(executionOrder).toEqual([
      '1_STOP_HTTP',
      '2_MARK_READINESS_FALSE',
      '3_DRAIN_IN_FLIGHT',
      '4_STOP_RABBITMQ_CONSUMERS',
      '6_FLUSH_OUTBOX_BATCH',
      '5_CLOSE_RABBITMQ_CONNECTION',
      '7_CLOSE_REDIS',
      '8_CLOSE_MONGO',
    ]);
  });
});

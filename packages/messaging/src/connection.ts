import amqp, { ChannelModel, Channel, ConfirmChannel } from 'amqplib';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'messaging:connection' });

export class RabbitMQConnection {
  private connection: ChannelModel | null = null;
  private publisherChannel: ConfirmChannel | null = null;
  private isConnecting = false;

  constructor(private readonly amqpUrl: string) {}

  async connect(): Promise<ChannelModel> {
    if (this.connection) return this.connection;
    if (this.isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return this.connect();
    }

    this.isConnecting = true;
    try {
      logger.info('Connecting to RabbitMQ...');
      const conn = await amqp.connect(this.amqpUrl);
      this.connection = conn;

      conn.on('error', (err: unknown) => {
        logger.error({ err }, 'RabbitMQ connection error');
      });

      conn.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting reconnect...');
        this.connection = null;
        this.publisherChannel = null;
      });

      logger.info('Connected to RabbitMQ');
      return conn;
    } catch (error) {
      logger.fatal({ err: error }, 'Failed to connect to RabbitMQ');
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async getConfirmChannel(): Promise<ConfirmChannel> {
    if (this.publisherChannel) return this.publisherChannel;
    const conn = await this.connect();
    const ch = await conn.createConfirmChannel();
    this.publisherChannel = ch;
    return ch;
  }

  async createChannel(): Promise<Channel> {
    const conn = await this.connect();
    return conn.createChannel();
  }

  async close(): Promise<void> {
    try {
      if (this.publisherChannel) {
        await this.publisherChannel.close().catch(() => {});
        this.publisherChannel = null;
      }
      if (this.connection) {
        await this.connection.close().catch(() => {});
        this.connection = null;
      }
      logger.info('RabbitMQ connection closed gracefully');
    } catch (err) {
      logger.error({ err }, 'Error closing RabbitMQ connection');
    }
  }
}

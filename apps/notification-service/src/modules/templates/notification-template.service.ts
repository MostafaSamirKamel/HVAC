import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { ConflictError, NotFoundError } from '@hvac/errors';
import {
  NotificationTemplateModel,
  INotificationTemplate,
} from './notification-template.model.js';
import { NotificationChannel } from '../notifications/notification.model.js';

export interface CreateTemplateInput {
  companyId: string;
  templateId?: string;
  templateCode: string;
  channel: NotificationChannel;
  language?: 'ar' | 'en';
  title: string;
  body: string;
  variables?: string[];
  isActive?: boolean;
}

export interface UpdateTemplateInput {
  title?: string;
  body?: string;
  variables?: string[];
  isActive?: boolean;
}

export class NotificationTemplateService {
  public static async createTemplate(
    input: CreateTemplateInput
  ): Promise<INotificationTemplate> {
    const templateId = input.templateId || `tmpl_${randomUUID()}`;
    const language = input.language || 'ar';

    if (mongoose.connection.readyState === 1) {
      const existing = await NotificationTemplateModel.findOne({
        companyId: input.companyId,
        $or: [
          { templateId },
          { templateCode: input.templateCode, channel: input.channel, language },
        ],
      });
      if (existing) {
        throw new ConflictError(
          `Template with code '${input.templateCode}' for channel '${input.channel}' and language '${language}' already exists`
        );
      }
    }

    const [template] = await NotificationTemplateModel.create([
      {
        companyId: input.companyId,
        templateId,
        templateCode: input.templateCode,
        channel: input.channel,
        language,
        title: input.title,
        body: input.body,
        variables: input.variables || [],
        isActive: input.isActive ?? true,
      },
    ]);

    return template;
  }

  public static async updateTemplate(
    companyId: string,
    templateId: string,
    update: UpdateTemplateInput
  ): Promise<INotificationTemplate> {
    const template = await NotificationTemplateModel.findOne({ companyId, templateId });
    if (!template) {
      throw new NotFoundError(`Template '${templateId}' not found`);
    }

    if (update.title !== undefined) template.title = update.title;
    if (update.body !== undefined) template.body = update.body;
    if (update.variables !== undefined) template.variables = update.variables;
    if (update.isActive !== undefined) template.isActive = update.isActive;

    await template.save();
    return template;
  }

  public static async getTemplateById(
    companyId: string,
    templateId: string
  ): Promise<INotificationTemplate> {
    const template = await NotificationTemplateModel.findOne({ companyId, templateId });
    if (!template) {
      throw new NotFoundError(`Template '${templateId}' not found`);
    }
    return template;
  }

  public static async listTemplates(
    companyId: string,
    filter: { channel?: NotificationChannel; templateCode?: string; isActive?: boolean } = {}
  ): Promise<INotificationTemplate[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.channel) query.channel = filter.channel;
    if (filter.templateCode) query.templateCode = filter.templateCode;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;

    return NotificationTemplateModel.find(query).sort({ templateCode: 1, language: 1 });
  }

  public static async renderTemplate(
    companyId: string,
    templateCode: string,
    channel: NotificationChannel,
    language: 'ar' | 'en' = 'ar',
    data: Record<string, unknown> = {}
  ): Promise<{ title: string; body: string }> {
    let template: INotificationTemplate | null = null;

    if (mongoose.connection.readyState === 1) {
      template = await NotificationTemplateModel.findOne({
        companyId,
        templateCode,
        channel,
        language,
        isActive: true,
      });
    }

    if (!template) {
      // Default fallback rendering
      return {
        title: `${templateCode} Alert`,
        body: JSON.stringify(data),
      };
    }

    let renderedTitle = template.title;
    let renderedBody = template.body;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      const replacement = String(value ?? '');
      renderedTitle = renderedTitle.replace(placeholder, replacement);
      renderedBody = renderedBody.replace(placeholder, replacement);
    }

    return {
      title: renderedTitle,
      body: renderedBody,
    };
  }
}

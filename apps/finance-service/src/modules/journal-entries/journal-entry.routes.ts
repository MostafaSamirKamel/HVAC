import { Router } from 'express';
import { JournalEntryController } from './journal-entry.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const journalEntryRoutes: Router = Router();

journalEntryRoutes.use(requireInternalAuth);

journalEntryRoutes.post('/', JournalEntryController.create);
journalEntryRoutes.get('/', JournalEntryController.list);
journalEntryRoutes.get('/:id', JournalEntryController.getById);
journalEntryRoutes.post('/:id/reverse', JournalEntryController.reverse);

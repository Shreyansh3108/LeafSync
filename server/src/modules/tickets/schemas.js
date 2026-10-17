const { z } = require('zod');

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().trim().min(1).max(100),
});

const createTicketSchema = z.object({
  bookId: z.number().int().positive().nullable().optional().default(null),
  subject: z.string().trim().min(5, 'min length 5').max(120, 'max length 120'),
  description: z.string().trim().min(20, 'min length 20').max(5000, 'max length 5000'),
  attachments: z.array(attachmentSchema).max(5).optional().default([]),
});

const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body is required').max(5000, 'max length 5000'),
});

module.exports = {
  createTicketSchema,
  createMessageSchema,
};
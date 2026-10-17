const { z } = require('zod');

const VALID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const VALID_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const VALID_CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

const patchTicketSchema = z
  .object({
    status: z.enum(VALID_STATUSES).optional(),
    priority: z.enum(VALID_PRIORITIES).optional(),
    category: z.enum(VALID_CATEGORIES).optional(),
    assignedTo: z.union([z.literal('me'), z.number().int().positive(), z.null()]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

const adminReplySchema = z.object({
  body: z.string().trim().min(1, 'Reply body is required').max(5000),
  aiAssisted: z.boolean().optional().default(false),
});

const internalNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note body is required').max(3000),
});

module.exports = {
  patchTicketSchema,
  adminReplySchema,
  internalNoteSchema,
};
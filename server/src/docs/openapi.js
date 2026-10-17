const express = require('express');
const router = express.Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'LeafSync — BookLeaf Publishing Support & Operations API',
    version: '1.0.0',
    description:
      'Role-scoped REST + SSE API for the BookLeaf Publishing Author Portal and Operations Admin Workspace.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate author or admin and set httpOnly JWT cookie',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'priya.sharma@email.com' },
                  password: { type: 'string', example: 'Password123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated user object' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Clear JWT session cookie',
        responses: { 200: { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user claims',
        responses: { 200: { description: 'Current user' }, 401: { description: 'Unauthenticated' } },
      },
    },
    '/books': {
      get: {
        tags: ['Author - Books'],
        summary: 'List authenticated author books and royalty figures',
        responses: { 200: { description: 'Array of author books' } },
      },
    },
    '/books/{id}': {
      get: {
        tags: ['Author - Books'],
        summary: 'Get single book owned by authenticated author',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Book detail' }, 404: { description: 'Not found' } },
      },
    },
    '/tickets': {
      get: {
        tags: ['Author - Tickets'],
        summary: 'List tickets owned by authenticated author (excludes admin-only fields)',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['Open', 'In Progress', 'Resolved', 'Closed'] },
          },
        ],
        responses: { 200: { description: 'Author tickets list' } },
      },
      post: {
        tags: ['Author - Tickets'],
        summary: 'Create a new support ticket and trigger async AI classification',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subject', 'description'],
                properties: {
                  bookId: { type: 'integer', nullable: true, example: 1 },
                  subject: { type: 'string', minLength: 5, maxLength: 120 },
                  description: { type: 'string', minLength: 20, maxLength: 5000 },
                  attachments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        filename: { type: 'string' },
                        size: { type: 'integer' },
                        mime: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Ticket created' }, 400: { description: 'Validation error' } },
      },
    },
    '/tickets/{id}': {
      get: {
        tags: ['Author - Tickets'],
        summary: 'Get author ticket detail and conversation thread (404 if owned by another author)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Ticket detail' }, 404: { description: 'Not found' } },
      },
    },
    '/tickets/{id}/messages': {
      post: {
        tags: ['Author - Tickets'],
        summary: 'Post author follow-up message (reopens Resolved ticket to In Progress)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: { body: { type: 'string' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Message added' }, 409: { description: 'Ticket is Closed' } },
      },
    },
    '/admin/tickets': {
      get: {
        tags: ['Admin - Operations'],
        summary: 'Filterable ticket queue sorted by urgency and waiting time',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'assignedTo', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated admin queue' } },
      },
    },
    '/admin/tickets/{id}': {
      get: {
        tags: ['Admin - Operations'],
        summary: 'Full ticket detail including book context, internal notes, and audit events',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Full admin ticket workspace payload' } },
      },
      patch: {
        tags: ['Admin - Operations'],
        summary: 'Update status, assignment, or override AI category/priority (logged in ticket_events)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated ticket' }, 409: { description: 'Invalid transition' } },
      },
    },
    '/admin/tickets/{id}/messages': {
      post: {
        tags: ['Admin - Operations'],
        summary: 'Send admin reply to author (auto-transitions Open -> In Progress & sets first_response_at)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 201: { description: 'Reply sent' } },
      },
    },
    '/admin/tickets/{id}/notes': {
      get: {
        tags: ['Admin - Operations'],
        summary: 'List private admin-only internal notes',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Internal notes list' } },
      },
      post: {
        tags: ['Admin - Operations'],
        summary: 'Add a private internal note (never visible to authors or AI prompts)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 201: { description: 'Internal note created' } },
      },
    },
    '/admin/tickets/{id}/draft': {
      get: {
        tags: ['Admin - AI'],
        summary: 'Get cached or newly generated KB-grounded AI draft + fallback template',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Draft payload with aiAvailable flag and fallback template' } },
      },
    },
    '/admin/tickets/{id}/draft/regenerate': {
      post: {
        tags: ['Admin - AI'],
        summary: 'Force regeneration of AI response draft (rate-limited)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'New draft payload' }, 429: { description: 'Rate limited' } },
      },
    },
    '/admin/tickets/{id}/classify': {
      post: {
        tags: ['Admin - AI'],
        summary: 'Re-run AI classification & priority guardrails (preserves admin overrides)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated ticket classification' } },
      },
    },
    '/admin/stats': {
      get: {
        tags: ['Admin - Telemetry'],
        summary: 'Operational SLA and status/priority breakdown metrics',
        responses: { 200: { description: 'Operational metrics' } },
      },
    },
    '/admin/ai/usage': {
      get: {
        tags: ['Admin - Telemetry'],
        summary: 'AI token consumption, latency, and fallback rate audit log',
        responses: { 200: { description: 'AI usage stats' } },
      },
    },
    '/events': {
      get: {
        tags: ['Realtime - SSE'],
        summary: 'Role-scoped Server-Sent Events stream with 25s heartbeat',
        responses: { 200: { description: 'text/event-stream' } },
      },
    },
  },
};

router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

router.get('/docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LeafSync API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0; background:#fafafa;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`);
});

module.exports = router;
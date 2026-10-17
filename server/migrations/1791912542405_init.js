exports.up = (pgm) => {
  // Enums
  pgm.createType('user_role', ['author', 'admin']);
  pgm.createType('ticket_status', ['Open', 'In Progress', 'Resolved', 'Closed']);
  pgm.createType('ticket_priority', ['Critical', 'High', 'Medium', 'Low']);
  pgm.createType('ticket_category', [
    'Royalty & Payments', 'ISBN & Metadata Issues',
    'Printing & Quality', 'Distribution & Availability',
    'Book Status & Production Updates', 'General Inquiry'
  ]);
  pgm.createType('field_source', ['ai', 'fallback', 'admin']);
  pgm.createType('ai_state', ['pending', 'done', 'failed', 'skipped']);

  // Users & Authors
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'user_role', notNull: true },
    name: { type: 'varchar(255)', notNull: true }
  });

  pgm.createTable('authors', {
    id: 'id',
    external_id: { type: 'varchar(50)', notNull: true, unique: true },
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    phone: { type: 'varchar(50)' },
    city: { type: 'varchar(100)' },
    joined_date: { type: 'date', notNull: true }
  });

  // Books
  pgm.createTable('books', {
    id: 'id',
    external_id: { type: 'varchar(50)', notNull: true, unique: true },
    author_id: { type: 'integer', notNull: true, references: 'authors', onDelete: 'CASCADE' },
    title: { type: 'varchar(255)', notNull: true },
    isbn: { type: 'varchar(50)', notNull: true },
    genre: { type: 'varchar(100)' },
    publication_date: { type: 'date' },
    status: { type: 'varchar(100)', notNull: true },
    production_stage: { type: 'varchar(100)' },
    mrp: { type: 'integer' },
    royalty_per_copy: { type: 'integer' },
    copies_sold: { type: 'integer', notNull: true, default: 0 },
    royalty_earned: { type: 'integer', notNull: true, default: 0 },
    royalty_paid: { type: 'integer', notNull: true, default: 0 },
    royalty_pending: { type: 'integer', notNull: true, default: 0 },
    last_payout_date: { type: 'date' },
    print_partner: { type: 'varchar(100)' }
  });

  pgm.createTable('book_platforms', {
    book_id: { type: 'integer', notNull: true, references: 'books', onDelete: 'CASCADE' },
    platform: { type: 'varchar(100)', notNull: true }
  });

  // Tickets & Threads
  pgm.createTable('tickets', {
    id: 'id',
    ticket_no: { type: 'varchar(50)', notNull: true, unique: true },
    author_id: { type: 'integer', notNull: true, references: 'authors', onDelete: 'CASCADE' },
    book_id: { type: 'integer', references: 'books', onDelete: 'SET NULL' },
    subject: { type: 'text', notNull: true },
    description: { type: 'text', notNull: true },
    status: { type: 'ticket_status', notNull: true, default: 'Open' },
    category: { type: 'ticket_category' },
    category_source: { type: 'field_source' },
    priority: { type: 'ticket_priority' },
    priority_source: { type: 'field_source' },
    ai_state: { type: 'ai_state', notNull: true, default: 'pending' },
    ai_reason: { type: 'text' },
    ai_confidence: { type: 'numeric(3,2)' },
    assigned_to: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
    sla_due_at: { type: 'timestamp' },
    first_response_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    resolved_at: { type: 'timestamp' }
  });

  pgm.createTable('ticket_messages', {
    id: 'id',
    ticket_id: { type: 'integer', notNull: true, references: 'tickets', onDelete: 'CASCADE' },
    sender_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    sender_role: { type: 'user_role', notNull: true },
    body: { type: 'text', notNull: true },
    ai_assisted: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('internal_notes', {
    id: 'id',
    ticket_id: { type: 'integer', notNull: true, references: 'tickets', onDelete: 'CASCADE' },
    admin_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    body: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('ticket_attachments', {
    id: 'id',
    ticket_id: { type: 'integer', notNull: true, references: 'tickets', onDelete: 'CASCADE' },
    filename: { type: 'varchar(255)', notNull: true },
    size: { type: 'integer', notNull: true },
    mime: { type: 'varchar(100)', notNull: true }
  });

  pgm.createTable('ticket_events', {
    id: 'id',
    ticket_id: { type: 'integer', notNull: true, references: 'tickets', onDelete: 'CASCADE' },
    actor_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    type: { type: 'varchar(100)', notNull: true },
    from_value: { type: 'varchar(255)' },
    to_value: { type: 'varchar(255)' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // AI Persistence
  pgm.createTable('ai_drafts', {
    id: 'id',
    ticket_id: { type: 'integer', notNull: true, references: 'tickets', onDelete: 'CASCADE', unique: true },
    body: { type: 'text', notNull: true },
    model: { type: 'varchar(100)', notNull: true },
    based_on_message_id: { type: 'integer' },
    kb_sections: { type: 'varchar(255)' },
    tokens_in: { type: 'integer' },
    tokens_out: { type: 'integer' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('ai_call_log', {
    id: 'id',
    ticket_id: { type: 'integer', references: 'tickets', onDelete: 'SET NULL' },
    kind: { type: 'varchar(50)', notNull: true },
    provider: { type: 'varchar(50)', notNull: true },
    model: { type: 'varchar(100)', notNull: true },
    tokens_in: { type: 'integer' },
    tokens_out: { type: 'integer' },
    latency_ms: { type: 'integer' },
    ok: { type: 'boolean', notNull: true },
    error_code: { type: 'varchar(100)' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Indexes
  pgm.createIndex('tickets', ['author_id', { name: 'created_at', sort: 'DESC' }]);
  pgm.createIndex('tickets', ['status', 'priority', 'created_at']);
  pgm.createIndex('tickets', 'category');
  pgm.createIndex('tickets', 'assigned_to');
  pgm.createIndex('ticket_messages', ['ticket_id', 'created_at']);
  pgm.createIndex('books', 'author_id');
};
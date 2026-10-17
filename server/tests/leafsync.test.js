const test = require('node:test');
const assert = require('node:assert/strict');

const { canTransition, assertTransition } = require('../src/modules/tickets/stateMachine');
const { computeSlaDueAt } = require('../src/config/sla');
const { buildContextFacts } = require('../src/ai/prompts/buildContext');
const { applyPriorityGuardrails } = require('../src/ai/prompts/classify');
const { classifyByKeywords } = require('../src/ai/fallback/keywordClassifier');

test('State Machine: allows valid transitions and rejects transitions out of Closed', () => {
  assert.equal(canTransition('Open', 'In Progress'), true);
  assert.equal(canTransition('Resolved', 'In Progress'), true);
  assert.equal(canTransition('Closed', 'In Progress'), false);

  assert.throws(
    () => assertTransition('Closed', 'In Progress'),
    (err) => err.code === 'INVALID_TRANSITION' && err.statusCode === 409
  );
});

test('SLA Configuration: computes exact SLA due timestamps for all priorities', () => {
  const base = new Date('2026-10-15T00:00:00.000Z');
  assert.equal(
    computeSlaDueAt('Critical', base).toISOString(),
    '2026-10-15T04:00:00.000Z'
  );
  assert.equal(
    computeSlaDueAt('High', base).toISOString(),
    '2026-10-16T00:00:00.000Z'
  );
  assert.equal(
    computeSlaDueAt('Medium', base).toISOString(),
    '2026-10-17T00:00:00.000Z'
  );
  assert.equal(
    computeSlaDueAt('Low', base).toISOString(),
    '2026-10-18T00:00:00.000Z'
  );
});

test('Context Builder: enforces zero-PII rule and detects Rs 850 below-threshold rollover', () => {
  const author = {
    name: 'Kavita Deshmukh',
    email: 'kavita.deshmukh@email.com',
    phone: '+91-9890123456',
    city: 'Nagpur',
  };
  const book = {
    title: 'The Nagpur Notebooks',
    external_id: 'BK016',
    isbn: '978-93-5XXXX-16-5',
    status: 'Published & Live',
    publication_date: '2025-11-10',
    mrp: 299,
    royalty_per_copy: 25,
    copies_sold: 34,
    royalty_earned: 850,
    royalty_paid: 0,
    royalty_pending: 850,
    last_payout_date: null,
    print_partner: 'In-House',
    available_on: ['Amazon India', 'BookLeaf Store'],
  };

  const ctx = buildContextFacts({ author, book });

  assert.equal(ctx.authorFirstName, 'Kavita');
  assert.equal(ctx.belowThreshold, true);
  assert.equal(ctx.text.includes('kavita.deshmukh@email.com'), false, 'Must not leak email');
  assert.equal(ctx.text.includes('+91-9890123456'), false, 'Must not leak phone');
  assert.equal(ctx.text.includes('Deshmukh'), false, 'Must only include first name');
  assert.equal(ctx.text.includes('below Rs 1,000 minimum, rolls over'), true);
});

test('Priority Guardrails: enforces High floor on ISBN and Low cap on bio/description updates', () => {
  const isbnResult = applyPriorityGuardrails(
    {
      category: 'ISBN & Metadata Issues',
      priority: 'Low',
      confidence: 0.9,
      reason: 'ISBN mismatch reported',
    },
    {
      subject: 'Wrong ISBN on Amazon',
      description: 'My book is showing a different ISBN on Amazon than the physical copy.',
      overdueRoyalty: false,
    }
  );
  assert.equal(isbnResult.priority, 'High');

  const bioResult = applyPriorityGuardrails(
    {
      category: 'General Inquiry',
      priority: 'High',
      confidence: 0.85,
      reason: 'Author wants to update book description',
    },
    {
      subject: 'Update book description',
      description: 'Can I update the description of my book on Amazon after it is live?',
      overdueRoyalty: false,
    }
  );
  assert.equal(bioResult.priority, 'Low');
});

test('Keyword Fallback Classifier: accurately classifies all 6 canonical BookLeaf categories', () => {
  const cases = [
    {
      subject: 'Royalty not received after 6 months',
      description: 'I published my book 6 months ago and still have not received any royalty payout.',
      expectedCategory: 'Royalty & Payments',
      expectedPriority: 'High',
    },
    {
      subject: 'Different ISBN on Amazon',
      description: 'My book is showing a different ISBN on Amazon than the physical print copy.',
      expectedCategory: 'ISBN & Metadata Issues',
      expectedPriority: 'High',
    },
    {
      subject: 'Blurry images and misaligned pages',
      description: 'I received my author copies and the print quality is terrible with blurry images.',
      expectedCategory: 'Printing & Quality',
      expectedPriority: 'High',
    },
    {
      subject: 'Book showing Currently Unavailable',
      description: 'My book is published but showing as Currently Unavailable on Amazon India.',
      expectedCategory: 'Distribution & Availability',
      expectedPriority: 'Medium',
    },
    {
      subject: 'Book stuck in typesetting for 3 weeks',
      description: 'It has been 3 weeks and my book is still in typesetting. When will it be done?',
      expectedCategory: 'Book Status & Production Updates',
      expectedPriority: 'Medium',
    },
    {
      subject: 'Update description on Amazon',
      description: 'Can I update the description of my book on Amazon after it is already live?',
      expectedCategory: 'General Inquiry',
      expectedPriority: 'Low',
    },
  ];

  for (const c of cases) {
    const res = classifyByKeywords({ subject: c.subject, description: c.description });
    assert.equal(res.category, c.expectedCategory);
    assert.equal(res.priority, c.expectedPriority);
  }
});
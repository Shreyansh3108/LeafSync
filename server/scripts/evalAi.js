const { classifyByKeywords } = require('../src/ai/fallback/keywordClassifier');
const { applyPriorityGuardrails } = require('../src/ai/prompts/classify');
const { buildContextFacts } = require('../src/ai/prompts/buildContext');
const { getCannedTemplate } = require('../src/ai/fallback/cannedTemplates');

const EVAL_SCENARIOS = [
  {
    id: 'EVAL-01',
    author: { name: 'Ananya Reddy' },
    book: {
      title: 'The Silent Monsoon',
      external_id: 'BK005',
      isbn: '978-93-5XXXX-05-9',
      status: 'Published & Live',
      publication_date: '2025-05-18',
      mrp: 350,
      royalty_per_copy: 30,
      copies_sold: 215,
      royalty_earned: 6450,
      royalty_paid: 0,
      royalty_pending: 6450,
      last_payout_date: null,
      print_partner: 'In-House',
      available_on: ['Amazon India', 'Flipkart', 'BookLeaf Store'],
    },
    subject: 'No royalty received 4 months after publication',
    description: "I published my book 4 months ago and still haven't received any royalty. What's going on?",
    expectedCategory: 'Royalty & Payments',
    expectedPriority: 'High',
  },
  {
    id: 'EVAL-02',
    author: { name: 'Vikram Joshi' },
    book: {
      title: 'Code & Chai',
      external_id: 'BK011',
      isbn: '978-93-5XXXX-11-0',
      status: 'Published & Live',
      publication_date: '2024-07-01',
      mrp: 499,
      royalty_per_copy: 48,
      copies_sold: 412,
      royalty_earned: 19776,
      royalty_paid: 14400,
      royalty_pending: 5376,
      last_payout_date: '2025-11-10',
      print_partner: 'Repro India',
      available_on: ['Amazon India', 'Flipkart', 'Amazon US', 'BookLeaf Store'],
    },
    subject: 'ISBN mismatch on Amazon listing',
    description: "My book is showing a different ISBN on Amazon than what's on the physical copy.",
    expectedCategory: 'ISBN & Metadata Issues',
    expectedPriority: 'High',
  },
  {
    id: 'EVAL-03',
    author: { name: 'Meera Nair' },
    book: {
      title: 'Backwaters & Beyond',
      external_id: 'BK008',
      isbn: '978-93-5XXXX-08-0',
      status: 'Published & Live',
      publication_date: '2023-09-12',
      mrp: 375,
      royalty_per_copy: 33,
      copies_sold: 280,
      royalty_earned: 9240,
      royalty_paid: 9240,
      royalty_pending: 0,
      last_payout_date: '2025-12-01',
      print_partner: 'Epitome Books',
      available_on: ['Amazon India', 'BookLeaf Store'],
    },
    subject: 'Defective author copies received',
    description: 'I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.',
    expectedCategory: 'Printing & Quality',
    expectedPriority: 'High',
  },
  {
    id: 'EVAL-04',
    author: { name: 'Rohit Kapoor' },
    book: {
      title: 'Startup Sutras',
      external_id: 'BK003',
      isbn: '978-93-5XXXX-03-5',
      status: 'Published & Live',
      publication_date: '2023-11-05',
      mrp: 499,
      royalty_per_copy: 48,
      copies_sold: 610,
      royalty_earned: 29280,
      royalty_paid: 24000,
      royalty_pending: 5280,
      last_payout_date: '2025-10-15',
      print_partner: 'Repro India',
      available_on: ['Amazon India', 'Flipkart', 'Amazon US', 'Amazon UK', 'BookLeaf Store'],
    },
    subject: 'Book showing Currently Unavailable on Amazon',
    description: "My book is published but it's showing as 'Currently Unavailable' on Amazon.",
    expectedCategory: 'Distribution & Availability',
    expectedPriority: 'Medium',
  },
  {
    id: 'EVAL-05',
    author: { name: 'Kavita Deshmukh' },
    book: {
      title: 'Verses from Vidarbha',
      external_id: 'BK015',
      isbn: '978-93-5XXXX-15-8',
      status: 'In Production — Typesetting',
      production_stage: 'Typesetting',
      publication_date: null,
      mrp: null,
      royalty_per_copy: null,
      copies_sold: 0,
      royalty_earned: 0,
      royalty_paid: 0,
      royalty_pending: 0,
      last_payout_date: null,
      print_partner: null,
      available_on: [],
    },
    subject: 'Delayed in typesetting stage',
    description: "It's been 3 weeks and my book is still in typesetting. When will it be done?",
    expectedCategory: 'Book Status & Production Updates',
    expectedPriority: 'Medium',
  },
  {
    id: 'EVAL-06',
    author: { name: 'Priya Sharma' },
    book: null,
    subject: 'Updating Amazon book description',
    description: "Can I update the description of my book on Amazon after it's already live?",
    expectedCategory: 'General Inquiry',
    expectedPriority: 'Low',
  },
];

function runEval() {
  console.log('\n=== LeafSync AI Classification, Guardrails & Context Evaluation ===\n');
  let passed = 0;

  const rows = EVAL_SCENARIOS.map((sc) => {
    const ctx = buildContextFacts({ author: sc.author, book: sc.book });
    const raw = classifyByKeywords({
      subject: sc.subject,
      description: sc.description,
      overdueRoyalty: ctx.overdueRoyalty,
    });
    const guarded = applyPriorityGuardrails(raw, {
      subject: sc.subject,
      description: sc.description,
      overdueRoyalty: ctx.overdueRoyalty,
    });
    const draft = getCannedTemplate(guarded.category, ctx);

    const categoryMatch = guarded.category === sc.expectedCategory;
    const priorityMatch = guarded.priority === sc.expectedPriority;
    const hasDraft = draft && draft.length > 80;
    const ok = categoryMatch && priorityMatch && hasDraft;
    if (ok) passed += 1;

    return {
      ID: sc.id,
      Predicted_Category: guarded.category,
      Expected_Category: sc.expectedCategory,
      Priority: `${guarded.priority} (exp: ${sc.expectedPriority})`,
      Draft_Words: draft.split(/\s+/).length,
      Result: ok ? 'PASS' : 'FAIL',
    };
  });

  console.table(rows);
  console.log(`\nScorecard: ${passed}/${EVAL_SCENARIOS.length} scenarios passed (100% deterministic baseline).\n`);
  if (passed !== EVAL_SCENARIOS.length) process.exit(1);
}

runEval();
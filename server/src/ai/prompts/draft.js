const fs = require('fs');
const path = require('path');

const CATEGORY_TO_FILE = {
  'Royalty & Payments': 'royalty.md',
  'ISBN & Metadata Issues': 'isbn.md',
  'Printing & Quality': 'printing.md',
  'Distribution & Availability': 'distribution.md',
  'Book Status & Production Updates': 'production.md',
  'General Inquiry': 'general.md',
};

function loadKbSection(filename) {
  const filePath = path.join(__dirname, '..', 'knowledge', filename);
  return fs.readFileSync(filePath, 'utf8');
}

function buildDraftPrompt({ category, contextFactsText, subject, description, recentMessages = [] }) {
  const coreMd = loadKbSection('core.md');
  const categoryFile = CATEGORY_TO_FILE[category] || 'general.md';
  const categoryMd = loadKbSection(categoryFile);

  const system = `Role: You are a BookLeaf Publishing author-support representative.
Tone rules (from KB): empathetic, partner not customer, acknowledge before solving, specific numbers and dates, own BookLeaf's mistakes directly, give a clear timeline when escalating, always end with a next step.
Hard rules:
- Use ONLY facts in CONTEXT FACTS and POLICY; never invent amounts, dates, bank details or statuses.
- If a fact is missing (such as bank-details status, printing cost, or per-platform sales), say the team will verify it or ask the author to confirm, and give a timeline.
- Do not blame the author.
- Do not mention being an AI.
- Keep length between 120 and 180 words.
- Sign off as "BookLeaf Author Support Team".

POLICY:
${coreMd}

${categoryMd}`;

  const lastFour = recentMessages.slice(-4).map((m) => `${m.sender_role.toUpperCase()}: ${m.body}`).join('\n');

  const user = `<context_facts>
${contextFactsText}
</context_facts>

<ticket>
Subject: ${subject}
Description: ${String(description || '').slice(0, 2500)}
</ticket>

<recent_messages>
${lastFour || 'None'}
</recent_messages>

Write the plain-text support response draft for the author now:`;

  return {
    system,
    user,
    kbSections: `core.md,${categoryFile}`,
  };
}

module.exports = { buildDraftPrompt };
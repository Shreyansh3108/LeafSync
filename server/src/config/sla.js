const SLA_HOURS = {
  Critical: 4,
  High: 24,
  Medium: 48,
  Low: 72,
};

function computeSlaDueAt(priority, fromDate = new Date()) {
  const hours = SLA_HOURS[priority];
  if (!hours) return null;
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}

module.exports = {
  SLA_HOURS,
  computeSlaDueAt,
};
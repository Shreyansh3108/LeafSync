const AppError = require('../../utils/AppError');

const ALLOWED_TRANSITIONS = {
  'Open': ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Resolved', 'Closed'],
  'Resolved': ['In Progress', 'Closed'],
  'Closed': [], // Terminal state
};

function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new AppError(
      'INVALID_TRANSITION',
      409,
      `Illegal status transition from "${fromStatus}" to "${toStatus}"`
    );
  }
}

module.exports = {
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
};
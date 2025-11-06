// ==========================================================
// Shared Utility Functions
// Centralized helper functions to avoid code duplication
// ==========================================================

/**
 * Flash messages middleware
 * Use this in all route files instead of duplicating
 */
const flashMessages = (req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
};

/**
 * Get date range for today
 * @returns {Object} { today, tomorrow }
 */
const getTodayRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
};

/**
 * Get date range for current month
 * @returns {Object} { thisMonth, nextMonth }
 */
const getMonthRange = () => {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { thisMonth, nextMonth };
};

/**
 * Format date range for queries
 * Ensures end date includes the entire day (23:59:59.999)
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {Object} { $gte, $lte }
 */
const formatDateRange = (startDate, endDate) => {
  return {
    $gte: new Date(startDate),
    $lte: new Date(endDate + 'T23:59:59.999Z')
  };
};

/**
 * Safe populate - handles missing references
 * @param {Array} items - Array of items to filter
 * @param {Array} requiredFields - Fields that must exist
 * @returns {Array} Filtered items
 */
const filterValidPopulated = (items, requiredFields = []) => {
  return items.filter(item => {
    return requiredFields.every(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], item);
      return value != null;
    });
  });
};

/**
 * Calculate total stock from inventory aggregate
 * @param {Array} aggregateResult - MongoDB aggregate result
 * @returns {number} Total stock
 */
const getTotalFromAggregate = (aggregateResult) => {
  return aggregateResult[0]?.total || 0;
};

/**
 * Format currency with commas (e.g., 200,000)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount
 */
const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '0.00';
  return parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Format currency for display (with Rs prefix)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount with currency symbol
 */
const formatRupees = (amount) => {
  return `Rs ${formatCurrency(amount)}`;
};

module.exports = {
  flashMessages,
  getTodayRange,
  getMonthRange,
  formatDateRange,
  filterValidPopulated,
  getTotalFromAggregate,
  formatCurrency,
  formatRupees
};

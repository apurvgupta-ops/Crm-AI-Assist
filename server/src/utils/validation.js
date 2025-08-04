const logger = require('./logger');

/**
 * Validate required environment variables
 */
const validateEnv = () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    // 'OPENAI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_API_ENDPOINT',
    'JWT_SECRET'
  ];

  const missingVars = [];

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  });

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please check your .env file and ensure all required variables are set');
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate MongoDB URI format
  if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string');
  }

  // Validate Google API key format
  if (!process.env.GOOGLE_API_KEY.startsWith('AIza')) {
    logger.warn('GOOGLE_API_KEY does not appear to be in the expected format (should start with "AIza")');
  }

  // Validate JWT secret length
  if (process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET should be at least 32 characters long for better security');
  }

  logger.info('✅ Environment validation passed');
};

/**
 * Validate MongoDB query object to prevent injection attacks
 */
const validateMongoQuery = (query) => {
  if (!query || typeof query !== 'object') {
    throw new Error('Query must be a valid object');
  }

  // Check for dangerous operators
  const dangerousOperators = ['$where', '$regex'];
  const queryString = JSON.stringify(query);

  dangerousOperators.forEach(op => {
    if (queryString.includes(op)) {
      // Allow $regex but validate it
      if (op === '$regex') {
        // Basic validation for regex patterns
        const regexMatches = queryString.match(/"\$regex":\s*"([^"]+)"/g);
        if (regexMatches) {
          regexMatches.forEach(match => {
            const pattern = match.match(/"\$regex":\s*"([^"]+)"/)[1];
            // Check for potentially dangerous regex patterns
            if (pattern.includes('.*.*') || pattern.length > 100) {
              throw new Error('Regex pattern appears to be potentially dangerous');
            }
          });
        }
      } else {
        throw new Error(`Dangerous operator ${op} is not allowed`);
      }
    }
  });

  return true;
};

/**
 * Sanitize user input for database queries
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    // Remove potential script tags and other dangerous content
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;

  if (pageNum < 1) {
    throw new Error('Page number must be greater than 0');
  }

  if (limitNum < 1 || limitNum > 1000) {
    throw new Error('Limit must be between 1 and 1000');
  }

  return { page: pageNum, limit: limitNum };
};

/**
 * Validate date range parameters
 */
const validateDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (start && isNaN(start.getTime())) {
    throw new Error('Invalid start date format');
  }

  if (end && isNaN(end.getTime())) {
    throw new Error('Invalid end date format');
  }

  if (start && end && start > end) {
    throw new Error('Start date must be before end date');
  }

  return { startDate: start, endDate: end };
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

module.exports = {
  validateEnv,
  validateMongoQuery,
  sanitizeInput,
  validatePagination,
  validateDateRange,
  validateEmail,
  validatePhone
};

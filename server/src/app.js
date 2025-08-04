const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('express-async-errors');
require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { validateEnv } = require('./utils/validation');

const queryRoutes = require('./routes/queryRoutes');
const leadRoutes = require('./routes/leadRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
const port = process.env.PORT || 3000;

function initializeMiddlewares() {
  app.use(helmet());

  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  };
  app.use(cors(corsOptions));

  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
  }

  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
}

function initializeRoutes() {
  app.use('/health', healthRoutes);

  app.use('/api/v1/query', queryRoutes);
  app.use('/api/v1/leads', leadRoutes);

  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
    });
  });
}

function initializeErrorHandling() {
  app.use(errorHandler);
}

async function startServer() {
  try {
    validateEnv();
    await connectDB();
    initializeMiddlewares();
    initializeRoutes();
    initializeErrorHandling();

    app.listen(port, () => {
      logger.info(`🚀 Server running on port ${port} in ${process.env.NODE_ENV} mode`);
      logger.info(`📚 API Documentation available at http://localhost:${port}/api/v1/docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Error handling for unhandled rejections and exceptions
process.on('unhandledRejection', err => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});
process.on('uncaughtException', err => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Only start server if this is the main module
if (require.main === module) {
  startServer();
}

module.exports = app;

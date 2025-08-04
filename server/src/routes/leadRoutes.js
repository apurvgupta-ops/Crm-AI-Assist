const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { validatePagination, validateDateRange } = require('../utils/validation');

const router = express.Router();

// Validation middleware for creating leads
const validateCreateLead = [
  body('firstName').notEmpty().trim().isLength({ max: 50 }).withMessage('First name is required and must be less than 50 characters'),
  body('lastName').notEmpty().trim().isLength({ max: 50 }).withMessage('Last name is required and must be less than 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('temperature').optional().isIn(['hot', 'warm', 'cold']).withMessage('Temperature must be hot, warm, or cold'),
  body('status').optional().isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost']).withMessage('Invalid status'),
];

// Validation middleware for updating leads
const validateUpdateLead = [
  param('id').isMongoId().withMessage('Valid lead ID is required'),
  body('firstName').optional().trim().isLength({ max: 50 }).withMessage('First name must be less than 50 characters'),
  body('lastName').optional().trim().isLength({ max: 50 }).withMessage('Last name must be less than 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('temperature').optional().isIn(['hot', 'warm', 'cold']).withMessage('Temperature must be hot, warm, or cold'),
  body('status').optional().isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost']).withMessage('Invalid status'),
];

/**
 * GET /api/v1/leads
 * Get all leads with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      temperature,
      status,
      source,
      assignedTo,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination
    const { page: pageNum, limit: limitNum } = validatePagination(page, limit);

    // Build query
    const query = { isActive: true };

    // Add filters
    if (temperature) query.temperature = temperature;
    if (status) query.status = status;
    if (source) query.source = source;
    if (assignedTo) query.assignedTo = assignedTo;

    // Date range filter
    if (startDate || endDate) {
      const { startDate: start, endDate: end } = validateDateRange(startDate, endDate);
      if (start || end) {
        query.createdAt = {};
        if (start) query.createdAt.$gte = start;
        if (end) query.createdAt.$lte = end;
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'company.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (pageNum - 1) * limitNum;
    const leads = await Lead.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalCount = await Lead.countDocuments(query);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leads',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/leads/:id
 * Get a single lead by ID
 */
router.get('/:id', [
  param('id').isMongoId().withMessage('Valid lead ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const lead = await Lead.findOne({ _id: req.params.id, isActive: true });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: { lead }
    });

  } catch (error) {
    logger.error('Error fetching lead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lead',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/leads
 * Create a new lead
 */
router.post('/', validateCreateLead, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const lead = new Lead(req.body);
    await lead.save();

    logger.info(`New lead created: ${lead.fullName} (${lead.email})`);

    res.status(201).json({
      success: true,
      data: { lead },
      message: 'Lead created successfully'
    });

  } catch (error) {
    logger.error('Error creating lead:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Lead with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create lead',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/v1/leads/:id
 * Update a lead
 */
router.put('/:id', validateUpdateLead, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      req.body,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    logger.info(`Lead updated: ${lead.fullName} (${lead.email})`);

    res.json({
      success: true,
      data: { lead },
      message: 'Lead updated successfully'
    });

  } catch (error) {
    logger.error('Error updating lead:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update lead',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/v1/leads/:id
 * Soft delete a lead
 */
router.delete('/:id', [
  param('id').isMongoId().withMessage('Valid lead ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    logger.info(`Lead soft deleted: ${lead.fullName} (${lead.email})`);

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting lead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/leads/:id/notes
 * Add a note to a lead
 */
router.post('/:id/notes', [
  param('id').isMongoId().withMessage('Valid lead ID is required'),
  body('content').notEmpty().trim().isLength({ max: 1000 }).withMessage('Note content is required and must be less than 1000 characters'),
  body('createdBy').notEmpty().trim().withMessage('Created by is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { content, createdBy } = req.body;

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        $push: {
          notes: {
            content,
            createdBy,
            createdAt: new Date()
          }
        },
        $set: { lastContactDate: new Date() }
      },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    logger.info(`Note added to lead: ${lead.fullName} by ${createdBy}`);

    res.json({
      success: true,
      data: { lead },
      message: 'Note added successfully'
    });

  } catch (error) {
    logger.error('Error adding note to lead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/leads/analytics/summary
 * Get leads analytics summary
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const summary = await Lead.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          hotLeads: { $sum: { $cond: [{ $eq: ['$temperature', 'hot'] }, 1, 0] } },
          warmLeads: { $sum: { $cond: [{ $eq: ['$temperature', 'warm'] }, 1, 0] } },
          coldLeads: { $sum: { $cond: [{ $eq: ['$temperature', 'cold'] }, 1, 0] } },
          qualifiedLeads: { $sum: { $cond: ['$isQualified', 1, 0] } },
          avgLeadScore: { $avg: '$leadScore' },
          totalEstimatedValue: { $sum: '$estimatedValue' }
        }
      }
    ]);

    const statusBreakdown = await Lead.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const sourceBreakdown = await Lead.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {},
        statusBreakdown,
        sourceBreakdown,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

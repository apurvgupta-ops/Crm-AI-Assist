const express = require("express");
const { body, validationResult } = require("express-validator");
// const openaiService = require('../services/openaiService');
const geminiService = require("../services/geminiService");
const Lead = require("../models/Lead");
const logger = require("../utils/logger");
const { handleUserQuery } = require("../services/handleChatHistory");
const { upload } = require("../utils/fileUpload");
const { handleUserQuerys } = require("../services/handleChatHistory2");
const { handleUserQuery: frameworks } = require('../services/frameworks')
const router = express.Router();

// Validation middleware for query requests
const validateQueryRequest = [
  body("query")
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Query must be between 3 and 500 characters"),
  body("limit")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Limit must be between 1 and 1000"),
  body("fields")
    .optional()
    .isArray()
    .withMessage("Fields must be an array of field names"),
];

/**
 * POST /api/v1/query/natural-language
 * Convert natural language query to database query and execute it
 */
router.post("/natural-language", validateQueryRequest, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { query, limit = 50, fields } = req.body;
    const startTime = Date.now();

    logger.info(`Processing natural language query: "${query}"`);

    // Step 1: Convert natural language to MongoDB query using OpenAI
    // const openaiResponse = await openaiService.convertQueryToMongoDB(query);
    /**
     * GET /api/v1/query/chat-history
     * Get chat history for a given sessionId
     * Query param: sessionId (required)
     */

    const geminiResponse = await geminiService.convertQueryToMongoDB(query);

    const { mongoQuery, explanation, suggestedFields, estimatedResults } =
      geminiResponse;

    // Step 2: Execute the MongoDB query
    let mongooseQuery = Lead.find(mongoQuery);

    // Apply field selection
    const fieldsToSelect = fields || suggestedFields;
    if (fieldsToSelect && fieldsToSelect.length > 0) {
      const fieldSelection = fieldsToSelect.join(" ");
      mongooseQuery = mongooseQuery.select(fieldSelection);
    }

    // Apply limit
    mongooseQuery = mongooseQuery.limit(parseInt(limit));

    // Execute the query
    const results = await mongooseQuery.exec();
    const executionTime = Date.now() - startTime;

    // Log successful query
    logger.info(
      `Query executed successfully in ${executionTime}ms, returned ${results.length} results`
    );

    // Step 3: Return structured response
    res.json({
      success: true,
      data: {
        query: {
          original: query,
          explanation,
          mongoQuery,
          estimatedResults,
        },
        results: results,
        metadata: {
          totalFound: results.length,
          limit: parseInt(limit),
          executionTime: `${executionTime}ms`,
          fieldsReturned: fieldsToSelect || suggestedFields,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error("Error processing natural language query:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process query",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/**
 * POST /api/v1/query/mongodb
 * Direct MongoDB query execution (for advanced users)
 */
router.post("/mongodb", async (req, res) => {
  try {
    const { query, limit = 50, fields, sort } = req.body;

    if (!query || typeof query !== "object") {
      return res.status(400).json({
        success: false,
        message: "Valid MongoDB query object is required",
      });
    }

    const startTime = Date.now();

    // Build mongoose query
    let mongooseQuery = Lead.find(query);

    // Apply field selection
    if (fields && Array.isArray(fields) && fields.length > 0) {
      mongooseQuery = mongooseQuery.select(fields.join(" "));
    }

    // Apply sorting
    if (sort && typeof sort === "object") {
      mongooseQuery = mongooseQuery.sort(sort);
    }

    // Apply limit
    mongooseQuery = mongooseQuery.limit(parseInt(limit));

    const results = await mongooseQuery.exec();
    const executionTime = Date.now() - startTime;

    logger.info(
      `Direct MongoDB query executed in ${executionTime}ms, returned ${results.length} results`
    );

    res.json({
      success: true,
      data: {
        results,
        metadata: {
          totalFound: results.length,
          limit: parseInt(limit),
          executionTime: `${executionTime}ms`,
          query,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error("Error executing MongoDB query:", error);

    res.status(500).json({
      success: false,
      message: "Failed to execute query",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/**
 * GET /api/v1/query/suggestions
 * Get example queries that users can try
 */
router.get("/suggestions", async (req, res) => {
  try {
    const suggestions = await openaiService.generateQuerySuggestions();

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    logger.error("Error generating query suggestions:", error);

    // Fallback suggestions if OpenAI fails
    const fallbackSuggestions = {
      examples: [
        "Show me all cold leads from July",
        "Find hot leads with estimated value over $50000",
        "Get all qualified leads from tech companies",
        "Show leads that haven't been contacted in 30 days",
        "Find all leads from California",
        "Show me leads with high engagement scores",
        "Get all leads from this month",
        "Find leads assigned to John Smith",
        "Show all new leads from social media",
        "Get leads with follow-up dates this week",
      ],
    };

    res.json({
      success: true,
      data: fallbackSuggestions,
    });
  }
});

/**
 * GET /api/v1/query/schema
 * Get the lead schema information for reference
 */
router.get("/schema", (req, res) => {
  const schema = {
    fields: {
      firstName: { type: "String", required: true },
      lastName: { type: "String", required: true },
      email: { type: "String", required: true, unique: true },
      phone: { type: "String" },
      status: {
        type: "String",
        enum: [
          "new",
          "contacted",
          "qualified",
          "proposal",
          "negotiation",
          "closed-won",
          "closed-lost",
        ],
        default: "new",
      },
      temperature: {
        type: "String",
        enum: ["hot", "warm", "cold"],
        default: "cold",
      },
      company: {
        name: { type: "String" },
        industry: { type: "String" },
        size: {
          type: "String",
          enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
        },
        website: { type: "String" },
      },
      source: {
        type: "String",
        enum: [
          "website",
          "social-media",
          "email-campaign",
          "referral",
          "cold-call",
          "event",
          "advertisement",
          "other",
        ],
        default: "other",
      },
      campaign: { type: "String" },
      estimatedValue: { type: "Number", min: 0 },
      budget: { type: "Number", min: 0 },
      expectedCloseDate: { type: "Date" },
      lastContactDate: { type: "Date" },
      nextFollowUpDate: { type: "Date" },
      location: {
        country: { type: "String" },
        state: { type: "String" },
        city: { type: "String" },
        zipCode: { type: "String" },
      },
      engagementScore: { type: "Number", min: 0, max: 100 },
      leadScore: { type: "Number", min: 0, max: 100 },
      assignedTo: { type: "String" },
      preferredContactMethod: {
        type: "String",
        enum: ["email", "phone", "sms", "linkedin"],
      },
      isQualified: { type: "Boolean", default: false },
      isActive: { type: "Boolean", default: true },
      createdAt: { type: "Date" },
      updatedAt: { type: "Date" },
    },
    examples: {
      temperatureQuery: { temperature: "cold", isActive: true },
      dateRangeQuery: {
        createdAt: {
          $gte: new Date("2024-07-01"),
          $lte: new Date("2024-07-31"),
        },
        isActive: true,
      },
      companyQuery: {
        "company.industry": { $regex: "tech", $options: "i" },
        isActive: true,
      },
      valueQuery: {
        estimatedValue: { $gt: 10000 },
        isQualified: true,
        isActive: true,
      },
    },
  };

  res.json({
    success: true,
    data: schema,
  });
});

/**
 * GET /api/v1/query/stats
 * Get query execution statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          avgLeadScore: { $avg: "$leadScore" },
          avgEngagementScore: { $avg: "$engagementScore" },
          hotLeads: {
            $sum: { $cond: [{ $eq: ["$temperature", "hot"] }, 1, 0] },
          },
          warmLeads: {
            $sum: { $cond: [{ $eq: ["$temperature", "warm"] }, 1, 0] },
          },
          coldLeads: {
            $sum: { $cond: [{ $eq: ["$temperature", "cold"] }, 1, 0] },
          },
          qualifiedLeads: { $sum: { $cond: ["$isQualified", 1, 0] } },
        },
      },
    ]);

    const statusStats = await Lead.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const sourceStats = await Lead.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        statusBreakdown: statusStats,
        sourceBreakdown: sourceStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error fetching query stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
});

router.get("/chat-history", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "sessionId query parameter is required",
      });
    }

    const Message = require("../models/MessageSchema");
    const history = await Message.find({ sessionId }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        result: history
      },
    });
  } catch (error) {
    logger.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat history",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// router.post("/chat", upload.array("files", 10), frameworks)
router.post("/chat", upload.array("files", 10), handleUserQuery);
// router.post("/chats", upload.array("files", 10), handleUserQuerys);

// router.post('/chat', async (req, res) => {
//   try {
//     const { sessionId, message } = req.body;
//     if (!sessionId || !message) {
//       return res.status(400).json({ error: 'Session ID and message are required' });
//     }

//     const aiResponse = await handleUserQuery(sessionId, message);

//     res.json({ success: true, response: aiResponse });

//   } catch (error) {
//     console.error('Chat error:', error);
//     res.status(500).json({ success: false, error: 'Failed to process query' });
//   }
// });

module.exports = router;

const OpenAI = require('openai');
const logger = require('../utils/logger');

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OpenAI API key is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPENAI_MODEL || 'gpt-4';

// System prompt for query conversion
function getSystemPrompt() {
  return `You are an expert MongoDB query generator for a CRM system. Your task is to convert natural language queries into MongoDB queries for a Lead collection.

LEAD SCHEMA STRUCTURE:
{
  "firstName": String,
  "lastName": String,
  "email": String,
  "phone": String,
  "status": ["new", "contacted", "qualified", "proposal", "negotiation", "closed-won", "closed-lost"],
  "temperature": ["hot", "warm", "cold"],
  "company": {
    "name": String,
    "industry": String,
    "size": ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
    "website": String
  },
  "source": ["website", "social-media", "email-campaign", "referral", "cold-call", "event", "advertisement", "other"],
  "campaign": String,
  "estimatedValue": Number,
  "budget": Number,
  "expectedCloseDate": Date,
  "lastContactDate": Date,
  "nextFollowUpDate": Date,
  "location": {
    "country": String,
    "state": String,
    "city": String,
    "zipCode": String
  },
  "engagementScore": Number (0-100),
  "leadScore": Number (0-100),
  "notes": Array,
  "tags": Array,
  "assignedTo": String,
  "interests": Array,
  "preferredContactMethod": ["email", "phone", "sms", "linkedin"],
  "isQualified": Boolean,
  "qualificationCriteria": {
    "hasDecisionMakingPower": Boolean,
    "hasBudget": Boolean,
    "hasTimeframe": Boolean,
    "hasNeed": Boolean
  },
  "isActive": Boolean,
  "createdAt": Date,
  "updatedAt": Date
}

INSTRUCTIONS:
1. Convert natural language queries to MongoDB find() queries
2. Handle date queries intelligently (e.g., "July" should include the current year unless specified)
3. Use case-insensitive regex for text searches when appropriate
4. Always include { isActive: true } unless specifically asking for inactive leads
5. Use proper MongoDB operators like $gte, $lte, $in, $regex, etc.
6. For date ranges, use start and end of the period
7. Interpret "recent" as last 30 days, "this month" as current month, etc.
8. Always format dates as ISO 8601 strings: e.g. "2025-07-01T00:00:00Z"
9. Do NOT include any JavaScript constructors like "new Date()" or functions.
10. The "mongoQuery" must be a valid JSON object without any code.

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "mongoQuery": {}, // The MongoDB query object
  "explanation": "string", // Brief explanation of what the query does
  "suggestedFields": [], // Array of field names to include in response
  "estimatedResults": "string" // Estimated number/type of results
}

EXAMPLES:
- "cold leads in July" → Find leads with temperature "cold" created in July of current year
- "hot leads from last month" → Find leads with temperature "hot" from previous month
- "leads from tech companies" → Find leads where company.industry contains "tech" (case-insensitive)
- "qualified leads over $10000" → Find leads where isQualified is true and estimatedValue > 10000`;
}

// User prompt with date context
function getUserPrompt(query) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  return `Convert this natural language query to a MongoDB query: "${query}"

Current date context:
- Current year: ${currentYear}
- Current month: ${currentMonth}
- Current date: ${currentDate.toISOString().split('T')[0]}

Remember to:
1. Use proper date handling for month/year references
2. Make text searches case-insensitive
3. Include isActive: true by default
4. Provide helpful field suggestions for the response`;
}

function validateResponse(response) {
  if (!response || typeof response !== 'object') return false;

  const requiredFields = ['mongoQuery', 'explanation', 'suggestedFields', 'estimatedResults'];
  for (const field of requiredFields) {
    if (!(field in response)) return false;
  }

  if (typeof response.mongoQuery !== 'object') return false;
  if (!Array.isArray(response.suggestedFields)) return false;

  return true;
}

async function convertQueryToMongoDB(naturalLanguageQuery) {
  try {
    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(naturalLanguageQuery);

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1500,
      // response_format: { type: "json_object" } // Add if model supports it
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error('No response from OpenAI');

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (e) {
      logger.error('Failed to parse OpenAI response:', e, 'Raw response:', response);
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!validateResponse(parsedResponse)) {
      throw new Error('Invalid response structure from OpenAI');
    }

    logger.info(`Natural language query converted: "${naturalLanguageQuery}"`);
    logger.debug('Generated MongoDB query:', parsedResponse.mongoQuery);

    return parsedResponse;
  } catch (error) {
    logger.error('Error converting query with OpenAI:', error);
    throw new Error(`Failed to convert query: ${error.message}`);
  }
}

async function generateQuerySuggestions() {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Generate 10 example natural language queries for a CRM system that users might ask about leads.'
        },
        {
          role: 'user',
          content: 'Provide diverse examples including queries about lead temperature, status, time periods, company information, and lead scoring.'
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      // response_format: { type: "json_object" } // Add if model supports it
    });

    const response = completion.choices[0]?.message?.content;
    return JSON.parse(response);
  } catch (error) {
    logger.error('Error generating query suggestions:', error);
    throw new Error('Failed to generate query suggestions');
  }
}

module.exports = {
  convertQueryToMongoDB,
  generateQuerySuggestions,
};

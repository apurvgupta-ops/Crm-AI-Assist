const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';

if (!GEMINI_API_KEY) {
    throw new Error('Google Gemini API key (GEMINI_API_KEY) is required');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// System prompt for query conversion
function getSystemPrompt() {
    return `You are an expert MongoDB query generator for a CRM system. Your task is to convert natural language queries into MongoDB queries for a Lead collection.

LEAD SCHEMA STRUCTURE:
{
  "firstName": String,
  "lastName": String,
  "email": String,
  "phone": String,
  "temperature": ["cold", "warm", "hot"],
  "status": ["new", "contacted", "qualified", "proposal", "negotiation", "closed-won", "closed-lost"],
  "company": {
    "name": String,
    "industry": String,
    "size": ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
    "website": String
  },
  "budget": Number,
  "location": {
    "country": String,
    "state": String,
    "city": String,
    "zipCode": String
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
- "qualified leads over $10000" → Find leads where isQualified is true and estimatedValue > 10000

IMPORTANT:
Return ONLY the pure JSON object as specified, with no explanations, notes, or extra content.
`;
}

// User prompt with date context
function getUserPrompt(query) {
    const currentDate = new Date();
    return `Convert this natural language query to a MongoDB query: "${query}"

Current date context:
- Current year: ${currentDate.getFullYear()}
- Current month: ${currentDate.getMonth() + 1}
- Current date: ${currentDate.toISOString().split('T')[0]}

Remember to:
1. Use proper date handling for month/year references
2. Make text searches case-insensitive
3. Include isActive: true by default
4. Provide helpful field suggestions for the response

IMPORTANT:
Return ONLY the pure JSON object as specified, with no explanations, notes, or extra content.
`;
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

// Clean possible markdown/code fences to extract JSON string
function cleanJSONResponse(response) {
    // Remove code fencing and extra text before/after JSON
    let match = response.match(/({[\s\S]*})/m);
    if (match) return match[1].trim();

    // Fallback to previous method as backup
    const fencedJSON = response.match(/``````/i);
    if (fencedJSON) return fencedJSON[1].trim();
    const fencedAny = response.match(/``````/);
    if (fencedAny) return fencedAny[1].trim();
    return response.trim();
}
async function convertQueryToMongoDB(naturalLanguageQuery) {
    try {
        const systemPrompt = getSystemPrompt();
        const userPrompt = getUserPrompt(naturalLanguageQuery);

        // Wrap prompt in contents/parts structure for Gemini
        const contents = [
            {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n${userPrompt}` }]
            }
        ];

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            temperature: 0.1,
            maxOutputTokens: 1500
        });

        const rawMessage = response.text ?? response.candidates?.[0]?.content ?? '';

        if (!rawMessage) {
            throw new Error('No content returned from Gemini API');
        }

        // Clean and parse JSON
        const cleanedMessage = cleanJSONResponse(rawMessage);

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(cleanedMessage);
        } catch (e) {
            logger.error('Failed to parse Gemini response:', e, 'Raw response:', cleanedMessage);
            throw new Error('Invalid JSON response from Gemini API');
        }

        if (!validateResponse(parsedResponse)) {
            throw new Error('Invalid response structure from Gemini API');
        }

        logger.info(`Natural language query converted: "${naturalLanguageQuery}"`);
        logger.debug('Generated MongoDB query:', parsedResponse.mongoQuery);

        return parsedResponse;
    } catch (error) {
        logger.error('Error converting query with Gemini:', error);
        throw new Error(`Failed to convert query: ${error.message}`);
    }
}

async function generateQuerySuggestions() {
    try {
        const prompt = [
            'Generate 10 example natural language queries for a CRM system that users might ask about leads.',
            'Provide diverse examples including queries about lead temperature, status, time periods, company information, and lead scoring.'
        ].join('\n');

        const contents = [{ parts: [{ text: prompt }] }];

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            temperature: 0.7,
            maxOutputTokens: 500
        });

        const rawMessage = response.text ?? response.candidates?.[0]?.content ?? '';

        if (!rawMessage) {
            throw new Error('No content returned from Gemini API');
        }

        const cleanedMessage = cleanJSONResponse(rawMessage);

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(cleanedMessage);
        } catch (e) {
            logger.error('Failed to parse Gemini suggestions response:', e, 'Raw response:', cleanedMessage);
            throw new Error('Invalid JSON response from Gemini API');
        }

        return parsedResponse;
    } catch (error) {
        logger.error('Error generating query suggestions:', error);
        throw new Error('Failed to generate query suggestions');
    }
}

module.exports = {
    convertQueryToMongoDB,
    generateQuerySuggestions,
};

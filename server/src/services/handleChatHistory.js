const Lead = require('../models/Lead');
const ChatSession = require('../models/MessageSchema');
const logger = require('../utils/logger');
const { convertQueryToMongoDB } = require('./geminiService');

// const { v4: uuidv4 } = require('uuid');
// const sessionId = uuidv4()

async function handleUserQuery(req, res) {
    try {
        const { sessionId, message } = req.body;

        // 1. Chat history/context handling (as above)
        let session = await ChatSession.findOne({ sessionId }) || new ChatSession({ sessionId, history: [] });
        session.history.push({ role: 'user', content: message });

        // 2. Query conversion using Gemini
        const geminiResponse = await convertQueryToMongoDB(message);

        // 3. Actually run the mongoQuery on your leads collection
        const dbResults = await Lead.find(geminiResponse.mongoQuery).limit(100); // Add projection if needed

        // 4. Save Gemini reply and reply data to history
        session.history.push({ role: 'assistant', content: JSON.stringify(geminiResponse) });
        session.lastActive = new Date();
        await session.save();

        // 5. Send response in the desired format
        res.json({
            success: true,
            data: [{
                original: message,
                total: dbResults.length,
                explanation: geminiResponse.explanation,
                mongoQuery: geminiResponse.mongoQuery,
                estimatedResults: geminiResponse.estimatedResults,
                results: dbResults,
            }]
        });
    } catch (error) {
        logger.error('API error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to process query",
            error: error.message,
        });
    }
}

module.exports = {
    handleUserQuery
};
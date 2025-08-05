const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });


function extractFirstJson(raw) {
    // This regex finds the first {...} block (including newlines)
    const match = raw.match(/{[\s\S]+}/);
    return match ? match[0] : raw;
}

async function geminiComposeEmailAgent(userMessage) {
    try {
        // Prompt to instruct Gemini to extract all relevant fields for agentic email work
        const systemPrompt = `
You are an AI CRM assistant. If a user message involves writing and/or sending an email, you must:
- Understand the user's intent.
- Extract one or more recipient email addresses if mentioned.
- Generate a professional, context-appropriate subject and body for the email.
- Reply with a JSON object ONLY, in this format:
{
  "intent": "send_welcome_email", // or other concise intent
  "recipients": ["foo@example.com"], // array of emails (from message or inferred group, e.g., all cold leads)
  "subject": "Your Subject Here",
  "body": "Your email body here. Use {{name}} as a placeholder if you are addressing multiple people."
}

Only respond with the JSON object. Do not include additional explanation, markdown, code blocks, or commentary.`.trim();

        const prompt = `${systemPrompt}\n\nUser message: "${userMessage}"`;

        const contents = [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ];

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            temperature: 0.4,
            maxOutputTokens: 400
        });

        const rawMessage = response.text ?? response.candidates?.[0]?.content ?? '';
        if (!rawMessage) throw new Error('No content returned from Gemini API');

        // Clean markdown/code block formatting, if any
        const cleaned = extractFirstJson(rawMessage).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'); // Optionally fix curly quotes


        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            logger.error('Failed to parse Gemini agent JSON:', e, cleaned);
            throw new Error('Invalid JSON from Gemini agent');
        }

        // Optionally validate required fields
        if (!parsed.intent || !parsed.subject || !parsed.body || !Array.isArray(parsed.recipients) || !parsed.recipients.length) {
            throw new Error('Incomplete response from Gemini agent');
        }

        return parsed;

    } catch (error) {
        logger.error('Error in geminiComposeEmailAgent:', error);
        throw new Error(`Failed to compose email: ${error.message}`);
    }
}

module.exports = geminiComposeEmailAgent;

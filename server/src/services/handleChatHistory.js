const { GoogleGenAI } = require("@google/genai");
const path = require("path");
const logger = require("../utils/logger");
const ChatSession = require("../models/MessageSchema");  // adjust if necessary
const Lead = require("../models/Lead");
const sendEmail = require("../utils/sendMails");
const geminiComposeEmailAgent = require("../services/geminiComposeEmailAgent");

const signatureImagePath = path.resolve(__dirname, "../../email-signature.jpeg");

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

if (!GEMINI_API_KEY) {
    throw new Error("Google Gemini API key (GEMINI_API_KEY) is required");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// System prompt with instructions for CRM assistant
function getSystemPrompt() {
    return `
You are an expert CRM AI assistant that can:

1. Convert natural language queries into MongoDB queries for the Lead collection.
2. Detect if the input is NOT a data query but a greeting, thanks, farewell, small talk, or FAQ.
3. Detect if the user wants to SEND AN EMAIL (requests like "send mail to...", "write email to...", "draft an email for...").

Return ONLY one of the following JSON objects:

- For small talk / chit-chat / FAQ:
  {
    "type": "smalltalk",
    "category": "<category>",   // e.g., greeting, thank_you, farewell, faq
    "reply": "<friendly response string>"
  }

- For email intent:
  {
    "type": "email",
    "recipientName": "<recipient full name>",
    "recipientEmail": "<recipient email if known or empty string>",
    "subject": "<email subject>",
    "body": "<email body text>",
    "drafted": true,
    "reply": "Here is your draft email to <recipientName>. Would you like to send this email now? Reply YES to confirm."
  }

- For data queries:
  {
    "type": "query",
    "mongoQuery": {...},            // MongoDB find() query object
    "explanation": "string",        // Brief explanation of query
    "suggestedFields": [],          // Array of fields to include in results (e.g., ["firstName", "email", "company.industry"])
    "estimatedResults": "string"    // Estimated number/type of results
  }

Lead collection schema is:
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

Important:
- Use start/end ISO 8601 strings for dates.
- Use case-insensitive regex searches when appropriate.
- Always include { isActive: true } unless querying for inactive leads.
- Return ONLY pure JSON objects, no extra explanations or markdown.
`;
}

// User prompt includes recent chat context for conversational continuity
function getUserPrompt(currentQuery, recentHistory) {
    const currentDate = new Date();

    // Format recent history as turns with roles
    const historyText = recentHistory
        .map((m) => {
            let contentText = "";

            // ✅ Handle both string and array content
            if (typeof m.content === "string") {
                contentText = m.content.trim();
            } else if (Array.isArray(m.content)) {
                // Summarize array content for context
                contentText = `Found ${m.content.length} leads with details`;
            } else if (typeof m.content === "object") {
                // Handle other object types
                contentText = JSON.stringify(m.content);
            } else {
                contentText = String(m.content);
            }

            return `${m.role === "user" ? "User" : "Assistant"}: ${contentText}`;
        })
        .join("\n");

    return `
Given the prior conversation context:

${historyText}

User's new query:

"${currentQuery}"

Current date context:
- Current year: ${currentDate.getFullYear()}
- Current month: ${currentDate.getMonth() + 1}
- Current date: ${currentDate.toISOString().split("T")[0]}

Return ONLY the JSON object as specified in the system prompt.
`;
}


// Clean and parse AI JSON response
function cleanJSONResponse(response) {
    const match = response.match(/({[\s\S]*})/m);
    if (match) return match[1].trim();
    return response.trim();
}

function validateAIResponse(obj) {
    if (!obj || typeof obj !== "object" || !obj.type) return false;
    if (obj.type === "smalltalk") {
        return typeof obj.reply === "string" && typeof obj.category === "string";
    }
    if (obj.type === "email") {
        return (
            typeof obj.recipientName === "string" &&
            typeof obj.subject === "string" &&
            typeof obj.body === "string" &&
            typeof obj.reply === "string"
        );
    }
    if (obj.type === "query") {
        const keys = [
            "mongoQuery",
            "explanation",
            "suggestedFields",
            "estimatedResults",
        ];
        return (
            keys.every((k) => k in obj) &&
            typeof obj.mongoQuery === "object" &&
            Array.isArray(obj.suggestedFields)
        );
    }
    return false;
}

// Calls AI model with system prompt + user prompt with context
async function convertQueryToMongoDB(naturalLanguageQuery, chatHistory) {
    try {
        const systemPrompt = getSystemPrompt();
        const userPrompt = getUserPrompt(naturalLanguageQuery, chatHistory);

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: systemPrompt + "\n\n" + userPrompt,
            config: {
                temperature: 0.1,
                maxOutputTokens: 1500,
            }
        });

        const rawMessage = response.text;

        if (!rawMessage) {
            throw new Error("No content returned from Gemini API");
        }

        const cleanedMessage = cleanJSONResponse(rawMessage);

        const parsedResponse = JSON.parse(cleanedMessage);

        if (!validateAIResponse(parsedResponse)) {
            throw new Error("Invalid response structure from Gemini API");
        }

        logger.info(`Converted query: "${naturalLanguageQuery}"`);
        logger.debug("AI response:", parsedResponse);

        return parsedResponse;
    } catch (error) {
        logger.error("Error converting query with Gemini:", error);
        throw new Error(`Failed to convert query: ${error.message}`);
    }
}

async function handleUserQuery(req, res) {
    try {
        const sessionId = "123456"; // Adjust for dynamic session as needed
        const { message } = req.body;
        const attachments = req.files;

        let session = await ChatSession.findOne({ sessionId });
        if (!session) {
            session = new ChatSession({ sessionId, history: [] });
        }

        // Push user message to history BEFORE intents are processed
        session.history.push({ role: "user", content: message });

        // ------------------------------------------------------
        // Handle email confirmation replies ("yes"/"no"/"cancel") FIRST
        if (
            session.pendingEmail &&
            session.pendingEmail.recipients &&
            session.pendingEmail.recipients.length > 0
        ) {
            const userText = message.trim().toLowerCase();

            if (userText === "yes") {
                let sent = 0;
                const emailAttachments = [
                    ...(session.pendingEmail.attachments || []).map((file) => ({
                        filename: file.filename,
                        path: file.path,
                        contentType: file.mimetype,
                    })),
                    {
                        filename: "email-signature.jpeg",
                        path: signatureImagePath,
                        cid: "signature_img",
                    },
                ];

                for (const recipient of session.pendingEmail.recipients) {
                    await sendEmail({
                        to: recipient,
                        subject: session.pendingEmail.subject,
                        text: session.pendingEmail.body,
                        attachments: emailAttachments,
                    });
                    sent++;
                }

                const confirmationMsg = `✅ Email sent to ${sent} recipient(s): ${session.pendingEmail.recipients.join(
                    ", "
                )}.`;
                session.history.push({ role: "assistant", content: confirmationMsg });
                session.pendingEmail = undefined;
                session.lastActive = new Date();
                await session.save();

                return res.json({ success: true, message: confirmationMsg });
            } else if (userText === "no" || userText === "cancel") {
                session.pendingEmail = undefined;
                const cancelMsg = "❌ Email sending canceled.";
                session.history.push({ role: "assistant", content: cancelMsg });
                session.lastActive = new Date();
                await session.save();

                return res.json({ success: true, message: cancelMsg });
            }
            // Could choose fallback for other inputs or forward to AI...
        }

        // ------------------------------------------------------
        // CONTEXT-AWARE AI INTENT DETECTION AND PROCESSING

        // Pass recent history to AI prompt for context awareness (e.g. last 6 messages)
        const recentHistory = session.history.slice(-6);

        const aiResponse = await convertQueryToMongoDB(message, recentHistory);

        if (aiResponse.type === "smalltalk") {
            session.history.push({ role: "assistant", content: aiResponse.reply });
            session.lastActive = new Date();
            await session.save();

            return res.json({
                success: true,
                message: aiResponse.reply,
                data: [],
            });
        }

        if (aiResponse.type === "email") {
            // Try to lookup recipient email if missing:
            let foundEmail = aiResponse.recipientEmail;
            let foundName = aiResponse.recipientName;

            if ((!foundEmail || foundEmail === "") && foundName) {
                const [first, ...lastArr] = foundName.trim().split(" ");
                const last = lastArr.join(" ");

                const lead = await Lead.findOne({
                    firstName: new RegExp(`^${first}$`, "i"),
                    lastName: last ? new RegExp(`^${last}$`, "i") : /.*/,
                });

                if (lead) {
                    foundEmail = lead.email;
                    foundName = `${lead.firstName} ${lead.lastName}`;
                }
            }

            if (!foundEmail) {
                const msg =
                    "❗ I could not find an email address for that lead. Please specify the recipient or check the name.";
                session.history.push({ role: "assistant", content: msg });
                session.lastActive = new Date();
                await session.save();

                return res.json({
                    success: false,
                    message: msg,
                    data: [],
                });
            }

            session.pendingEmail = {
                subject: aiResponse.subject,
                body: aiResponse.body,
                recipients: [foundEmail],
                intent: "send_email",
                attachments: attachments
                    ? attachments.map((file) => ({
                        filename: file.originalname,
                        path: file.path,
                        mimetype: file.mimetype,
                    }))
                    : [],
                createdAt: new Date(),
            };

            const reply = aiResponse.reply.replace(/<recipientName>/g, foundName);
            session.history.push({
                role: "assistant",
                content: {
                    message: reply,
                    type: "email_draft",
                    draft: {
                        subject: aiResponse.subject,
                        body: aiResponse.body,
                        recipients: [foundEmail],
                        to: foundEmail,
                        recipientName: foundName
                    }
                }
            });
            session.lastActive = new Date();
            await session.save();

            return res.json({
                success: true,
                message: reply,
                data: [],
                draft: {
                    subject: aiResponse.subject,
                    body: aiResponse.body,
                    to: foundEmail,
                    recipientName: foundName
                },
            });
        }

        if (aiResponse.type === "query") {
            // Email intent fallback handling as before (optional)
            if (/email|mail|send/i.test(message)) {
                try {
                    logger.debug("Running Gemini Email Agent (fallback)");
                    const nameMatch = message.match(
                        /(?:mail to|email to|send mail to|write mail to|write email to)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i
                    );
                    let recipientName = nameMatch ? nameMatch[1] : null;

                    let enrichedMessage = message;

                    if (recipientName) {
                        const [firstName, lastName] = recipientName.split(" ");
                        const lead = await Lead.findOne({
                            firstName: new RegExp(`^${firstName}$`, "i"),
                            lastName: lastName ? new RegExp(`^${lastName}$`, "i") : /.*/,
                        });

                        if (!lead) {
                            return res.status(404).json({
                                success: false,
                                message: "Recipient lead not found",
                            });
                        }

                        enrichedMessage = `
              Send an email to:
              Name: ${lead.firstName} ${lead.lastName}
              Email: ${lead.email}
              Company: ${lead.company?.name || ""}
              User's message: ${message}
            `;
                    }

                    const agentResult = await geminiComposeEmailAgent(enrichedMessage);
                    if (
                        agentResult.intent &&
                        agentResult.subject &&
                        agentResult.body &&
                        agentResult.recipients?.length
                    ) {
                        session.pendingEmail = {
                            subject: agentResult.subject,
                            body: agentResult.body,
                            recipients: agentResult.recipients,
                            intent: agentResult.intent,
                            attachments: attachments
                                ? attachments.map((file) => ({
                                    filename: file.originalname,
                                    path: file.path,
                                    mimetype: file.mimetype,
                                }))
                                : [],
                            createdAt: new Date(),
                        };

                        const draftReply = `Here is your draft email to ${agentResult.recipients.join(
                            ", "
                        )}:\nSubject: ${agentResult.subject}\n\n${agentResult.body}\n\nWould you like to send this email now? Reply YES to confirm.`;

                        session.history.push({
                            role: "assistant",
                            content: {
                                message: draftReply,
                                type: "email_draft",
                                draft: {
                                    subject: agentResult.subject,
                                    body: agentResult.body,
                                    recipients: agentResult.recipients,
                                    to: agentResult.recipients[0] // first recipient
                                }
                            }
                        });
                        session.lastActive = new Date();
                        await session.save();

                        return res.json({ success: true, message: draftReply });
                    }
                } catch (error) {
                    logger.error("Gemini email agent error:", error);
                }
            }

            // Run MongoDB query with dynamic selected fields
            try {
                const baseFields = ["firstName", "lastName"];
                const suggestedFieldsSet = new Set([
                    ...baseFields,
                    ...(aiResponse.suggestedFields || []),
                ]);
                const selectFieldsStr = Array.from(suggestedFieldsSet).join(" ");

                const dbResults = await Lead.find(aiResponse.mongoQuery)
                    .select(selectFieldsStr)
                    .limit(100);

                // session.history.push({
                //     role: "assistant",
                //     content: dbResults
                // });

                // Map fields including nested ones
                const filteredResults = dbResults.map((doc) => {
                    const result = {};
                    for (const field of suggestedFieldsSet) {
                        if (field.includes(".")) {
                            const parts = field.split(".");
                            let value = doc;
                            for (const part of parts) {
                                if (!value) break;
                                value = value[part];
                            }
                            result[parts[parts.length - 1]] = value;
                        } else {
                            result[field] = doc[field];
                        }
                    }
                    return result;
                });

                session.history.push({
                    role: "assistant",
                    content: filteredResults
                });

                session.lastActive = new Date();
                await session.save();
                return res.json({
                    success: true,
                    data: [
                        {
                            original: message,
                            total: filteredResults.length,
                            // explanation: aiResponse.explanation,
                            // mongoQuery: aiResponse.mongoQuery,
                            // estimatedResults: aiResponse.estimatedResults,
                            results: filteredResults,
                        },
                    ],
                });
            } catch (error) {
                logger.error("Normal query error:", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to process the query",
                    error: error.message,
                });
            }
        }

        // Unknown AI response type fallback
        session.history.push({
            role: "assistant",
            content: "I couldn't understand your request. Please try asking differently.",
        });
        session.lastActive = new Date();
        await session.save();

        return res.json({
            success: false,
            message: "Invalid AI response format",
        });
    } catch (error) {
        logger.error("API error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process query",
            error: error.message,
        });
    }
}

module.exports = {
    handleUserQuery,
    convertQueryToMongoDB,
};

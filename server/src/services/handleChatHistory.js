const Lead = require("../models/Lead");
const ChatSession = require("../models/MessageSchema");
const logger = require("../utils/logger");
const { convertQueryToMongoDB } = require("./geminiService");
const sendEmail = require("../utils/sendMails");
const geminiComposeEmailAgent = require("./geminiComposeEmailAgent");
const path = require("path");

// const { v4: uuidv4 } = require('uuid');
// const sessionId = uuidv4()

// async function handleUserQuery(req, res) {
//     try {
//         const { sessionId, message } = req.body;

//         // 1. Chat history/context handling (as above)
//         let session = await ChatSession.findOne({ sessionId }) || new ChatSession({ sessionId, history: [] });
//         session.history.push({ role: 'user', content: message });

//         // 2. Query conversion using Gemini
//         const geminiResponse = await convertQueryToMongoDB(message);

//         // 3. Actually run the mongoQuery on your leads collection
//         const dbResults = await Lead.find(geminiResponse.mongoQuery).limit(100); // Add projection if needed

//         // 4. Save Gemini reply and reply data to history
//         session.history.push({ role: 'assistant', content: JSON.stringify(geminiResponse) });
//         session.lastActive = new Date();
//         await session.save();

//         // 5. Send response in the desired format
//         res.json({
//             success: true,
//             data: [{
//                 original: message,
//                 total: dbResults.length,
//                 explanation: geminiResponse.explanation,
//                 mongoQuery: geminiResponse.mongoQuery,
//                 estimatedResults: geminiResponse.estimatedResults,
//                 results: dbResults,
//             }]
//         });
//     } catch (error) {
//         logger.error('API error:', error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to process query",
//             error: error.message,
//         });
//     }
// }
const signatureImagePath = path.resolve(
    __dirname,
    "../../email-signature.jpeg"
);

async function handleUserQuery(req, res) {
    try {
        const sessionId = "123456";
        const { message } = req.body;
        const attachments = req.files;

        // 1. Find/create session
        let session = await ChatSession.findOne({ sessionId }); // || new ChatSession({ sessionId, history: [] });

        if (!session) {
            session = new ChatSession({
                sessionId,
                history: [],
            });
        }

        // console.log({ attachments })
        session.history.push({ role: "user", content: message });

        // --- EMAIL PENDING CONFIRMATION HANDLING ---
        if (
            session.pendingEmail &&
            session.pendingEmail.recipients &&
            session.pendingEmail.recipients.length > 0
        ) {
            const userText = message.trim().toLowerCase();
            if (userText === "yes") {
                // User confirmed, send the emails
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
                const confirmationMsg = `✅ Email sent to ${sent} recipient(s): ${session.pendingEmail.recipients.join(", ")}.`;
                session.history.push({ role: "assistant", content: confirmationMsg });
                session.pendingEmail = undefined;
                session.lastActive = new Date();
                await session.save();
                return res.json({ success: true, message: confirmationMsg });
            } else {
                // User said no or canceled
                session.pendingEmail = undefined;
                const cancelMsg = "❌ Email sending canceled.";
                session.history.push({ role: "assistant", content: cancelMsg });
                session.lastActive = new Date();
                await session.save();
                return res.json({ success: true, message: cancelMsg });
            }
        }

        // --- EMAIL INTENT DETECTION & DRAFTING ---
        if (/email|mail|send/i.test(message)) {
            try {
                logger.debug("Running Gemini Email Agent");
                const nameMatch = message.match(
                    /(?:mail to|email to|send mail to|write mail to|write email to)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i
                );
                console.log({ nameMatch });
                let recipientName = nameMatch ? nameMatch[1] : null;

                let enrichedMessage = message;

                if (recipientName) {
                    const [firstName, lastName] = recipientName.split(" ");
                    const lead = await Lead.findOne({
                        firstName: new RegExp(`^${firstName}$`, "i"),
                        lastName: lastName ? new RegExp(`^${lastName}$`, "i") : /.*/,
                    });

                    if (!lead) {
                        return res
                            .status(404)
                            .json({ success: false, message: "Recipient lead not found" });
                    }
                    // Continue with enriched message & email drafting

                    // Enrich message for Gemini
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
                    const draftReply = `Here is your draft email to ${agentResult.recipients.join(", ")}:\nSubject: ${agentResult.subject}\n\n${agentResult.body}\n\nWould you like to send this email now? Reply YES to confirm.`;
                    session.history.push({ role: "assistant", content: draftReply });
                    session.lastActive = new Date();
                    await session.save();
                    return res.json({ success: true, message: draftReply });
                }
                // fall through and do normal query if the intent wasn't a proper email send
            } catch (error) {
                logger.error("Gemini email agent error:", error);
            }
        } else {
            try {
                logger.debug("Running Normal Query");
                // --- EXISTING QUERY TO MONGODB + RESPONSE PIPELINE ---
                // Always include firstName and lastName by default (if you want)
                const baseFields = ["firstName", "lastName"];
                const geminiResponse = await convertQueryToMongoDB(message);
                console.log({ geminiResponse });
                // Combine with suggested fields (avoid duplicates)
                const suggestedFieldsSet = new Set([
                    ...baseFields,
                    ...(geminiResponse.suggestedFields || []),
                ]);

                // Build select string for mongoose
                // Note, handle nested fields like "company.industry" appropriately in select:
                const selectFieldsStr = Array.from(suggestedFieldsSet)
                    .map((field) => field) // field names should work as `.select()` accepts dot notation
                    .join(" ");
                console.log({ selectFieldsStr });
                // Now pass select dynamically
                const dbResults = await Lead.find(geminiResponse.mongoQuery)
                    .select(selectFieldsStr)
                    .limit(100);

                console.log({ dbResults });

                if (!geminiResponse || !geminiResponse.mongoQuery) {
                    return res.status(400).json({
                        success: false,
                        message: "Failed to convert query to MongoDB format",
                    });
                }
                session.history.push({
                    role: "assistant",
                    content: JSON.stringify(geminiResponse),
                });
                session.lastActive = new Date();
                await session.save();

                // Map results, safely access nested fields
                const filteredResults = dbResults.map((doc) => {
                    const result = {};
                    for (const field of suggestedFieldsSet) {
                        if (field.includes(".")) {
                            // Traverse nested objects for e.g. company.industry
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
                res.json({
                    success: true,
                    data: [
                        {
                            original: message,
                            total: filteredResults.length,
                            explanation: geminiResponse.explanation,
                            mongoQuery: geminiResponse.mongoQuery,
                            estimatedResults: geminiResponse.estimatedResults,
                            results: filteredResults,
                        },
                    ],
                });
            } catch (error) {
                logger.error("Normal query error:", error);
            }
        }
    } catch (error) {
        logger.error("API error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process query",
            error: error.message,
        });
    }
}

module.exports = {
    handleUserQuery,
};

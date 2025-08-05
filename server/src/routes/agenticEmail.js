const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const geminiComposeEmailAgent = require('../services/geminiAgent');
const sendEmail = require('../services/emailService');

// Entry-point route for chat/commands
router.post('/api/v1/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    let session = await ChatSession.findOne({ sessionId }) || new ChatSession({ sessionId });

    // Save user message
    session.history.push({ role: 'user', content: message });

    // 1. Confirmation Workflow: Do we have a pending email?
    if (session.pendingEmail) {
        if (message.trim().toLowerCase() === 'yes') {
            // User confirms, send email(s)
            let sent = 0;
            for (const recipient of session.pendingEmail.recipients) {
                await sendEmail({
                    to: recipient,
                    subject: session.pendingEmail.subject,
                    text: session.pendingEmail.body
                });
                sent++;
            }
            const msg = `✅ Email sent to ${sent} recipient(s): ${session.pendingEmail.recipients.join(', ')}.`;
            session.history.push({ role: 'assistant', content: msg });
            session.pendingEmail = undefined;
            session.lastActive = new Date();
            await session.save();
            return res.json({ success: true, message: msg });
        } else {
            // Cancellation
            session.pendingEmail = undefined;
            const msg = '❌ Email sending canceled.';
            session.history.push({ role: 'assistant', content: msg });
            session.lastActive = new Date();
            await session.save();
            return res.json({ success: true, message: msg });
        }
    }

    // 2. New instruction
    // Pass user message to Gemini agent to interpret/generate email
    const agentResult = await geminiComposeEmailAgent(message);

    if (agentResult.intent && agentResult.subject && agentResult.body && agentResult.recipients?.length) {
        // Save as pending email
        session.pendingEmail = {
            subject: agentResult.subject,
            body: agentResult.body,
            recipients: agentResult.recipients,
            intent: agentResult.intent,
            createdAt: new Date(),
        };
        // Draft preview with confirmation
        const reply = `Here is your draft email to ${agentResult.recipients.join(', ')}:\nSubject: ${agentResult.subject}\n\n${agentResult.body}\n\nWould you like to send this email now? Reply YES to confirm.`;
        session.history.push({ role: 'assistant', content: reply });
        session.lastActive = new Date();
        await session.save();
        return res.json({ success: true, message: reply });
    } else {
        // Default handling for other requests (not an email send intent)
        // Optionally: forward to your existing query handling logic
        session.lastActive = new Date();
        await session.save();
        return res.json({ success: false, message: 'No valid email intent detected, or missing fields.' });
    }
});

module.exports = router;

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: {
        type: String, // 'user' or 'assistant'
        enum: ['user', 'assistant', 'system'],
        required: true,
    },
    content: {
        type: mongoose.Schema.Types.Mixed,  // ✅ Allows strings AND objects
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

const AttachmentSchema = new mongoose.Schema({
    filename: String,
    path: String,
    mimetype: String,
}, { _id: false });

const PendingEmailSchema = new mongoose.Schema({
    subject: String,
    body: String,
    recipients: [String],
    intent: String,
    createdAt: { type: Date, default: Date.now },
    attachments: [AttachmentSchema],
}, { _id: false });

const ChatSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true,
        unique: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },

    // response: {

    // },
    history: {
        type: [MessageSchema],
        default: [],
    },
    lastActive: {
        type: Date,
        default: Date.now,
        index: true,
    },
    pendingEmail: PendingEmailSchema,

});

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
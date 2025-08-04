const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: {
        type: String, // 'user' or 'assistant'
        enum: ['user', 'assistant', 'system'],
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

const ChatSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true,
        unique: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId, // or String if you use plain IDs
        ref: 'User', // optional: reference to your User model
        required: false,
    },
    history: {
        type: [MessageSchema], // Array of user/assistant messages
        default: [],
    },
    lastActive: {
        type: Date,
        default: Date.now,
        index: true,
    }
});

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
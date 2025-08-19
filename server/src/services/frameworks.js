// crmAgent.js
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { RunnableSequence } = require("@langchain/core/runnables");
const { StateGraph } = require("@langchain/langgraph");
const { z } = require("zod");

const Lead = require("../models/Lead");
const sendEmail = require("../utils/sendMails");
const logger = require("../utils/logger");

// Setup LLM
const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-001",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.1,
});

// Prompt template
const systemPrompt = `
You are an expert CRM AI assistant.

- Interpret user queries.
- RETURN ONLY JSON in the following strict formats:

For smalltalk:
  {{"type": "smalltalk", "category": "greeting", "reply": "Hello! 👋"}}
For email intent:
  {{"type": "email", "recipientName": "...", "recipientEmail": "...", "subject": "...", "body": "...", "drafted": true, "reply": "Draft ready"}}
For MongoDB query:
  {{"type": "query", "mongoQuery": {{}}, "explanation": "...", "suggestedFields": ["firstName", "email"], "estimatedResults": "string"}}
`;

const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["user", "{message}"],
]);

const parser = new JsonOutputParser();
const aiPipeline = RunnableSequence.from([prompt, llm, parser]);

// State schema
const crmStateSchema = z.object({
    message: z.string(),
    session: z.any().default(() => ({})),
    aiResponse: z.any().optional(),
    result: z.any().optional()
});

// Node functions (updated to return full state)
async function handleSmallTalk(state) {
    return {
        ...state,
        result: { type: "smalltalk", reply: state.aiResponse.reply }
    };
}

async function handleEmail(state) {
    try {
        const { recipientEmail, recipientName, subject, body } = state.aiResponse;
        if (!recipientEmail) {
            return {
                ...state,
                result: { type: "error", message: "Missing recipient email." }
            };
        }

        state.session.pendingEmail = {
            subject,
            body,
            recipients: [recipientEmail],
        };

        return {
            ...state,
            result: {
                type: "email",
                message: `Draft prepared for ${recipientName}. Reply YES to confirm.`,
                draft: { subject, body, recipientEmail }
            }
        };
    } catch (err) {
        logger.error("Email node failed", err);
        return {
            ...state,
            result: { type: "error", message: err.message }
        };
    }
}

async function handleMongoQuery(state) {
    try {
        const { mongoQuery, suggestedFields, explanation } = state.aiResponse;

        const results = await Lead.find(mongoQuery)
            .select(suggestedFields.join(" "))
            .limit(100);

        return {
            ...state,
            result: {
                type: "query",
                explanation,
                query: mongoQuery,
                results,
            }
        };
    } catch (err) {
        return {
            ...state,
            result: { type: "error", message: "Query failed: " + err.message }
        };
    }
}

async function handleFallback(state) {
    return {
        ...state,
        result: { type: "error", message: "I couldn't understand your request." }
    };
}

// Create workflow
const workflow = new StateGraph(crmStateSchema)
    .addNode("entry", async (state) => {
        const aiResponse = await aiPipeline.invoke({ message: state.message });
        return { ...state, aiResponse };
    })
    .addNode("smalltalk", handleSmallTalk)
    .addNode("email", handleEmail)
    .addNode("query", handleMongoQuery)
    .addNode("fallback", handleFallback);

// Add conditional edges
workflow.addConditionalEdges(
    "entry",
    (state) => {
        if (state.aiResponse?.type === "smalltalk") return "smalltalk";
        if (state.aiResponse?.type === "email") return "email";
        if (state.aiResponse?.type === "query") return "query";
        return "fallback";
    },
    {
        smalltalk: "smalltalk",
        email: "email",
        query: "query",
        fallback: "fallback"
    }
);

// Add end edges
workflow.addEdge("smalltalk", "__end__");
workflow.addEdge("email", "__end__");
workflow.addEdge("query", "__end__");
workflow.addEdge("fallback", "__end__");

workflow.setEntryPoint("entry");

// Express Handler
async function handleUserQuery(req, res) {
    try {
        const { message } = req.body;

        const graph = workflow.compile();
        const output = await graph.invoke({ message, session: {} });

        console.log("Full output:", output);

        const result = output.result;

        if (!result) {
            return res.json({
                success: false,
                message: "No result from workflow"
            });
        }

        // Handle different response types
        if (result.type === "smalltalk") {
            return res.json({
                success: true,
                message: result.reply
            });
        } else if (result.type === "email") {
            return res.json({
                success: true,
                message: result.message,
                draft: result.draft || null
            });
        } else if (result.type === "query") {
            return res.json({
                success: true,
                message: result.explanation,
                data: result.results
            });
        } else if (result.type === "error") {
            return res.json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message: "Request processed successfully",
            data: result
        });

    } catch (error) {
        logger.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports = { handleUserQuery };

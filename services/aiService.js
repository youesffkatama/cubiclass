const { pipeline } = require('@xenova/transformers');
const OpenAI = require('openai');
const CONFIG = require('../config');
const logger = require('./logger');

let embeddingPipeline = null;

async function initEmbeddings() {
    try {
        logger.info('🧠 Loading embedding model...');
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        logger.info('✅ Embedding model loaded');
    } catch (error) {
        logger.error('Failed to load embedding model:', error);
        throw error;
    }
}

async function generateEmbedding(text) {
    if (!embeddingPipeline) {
        await initEmbeddings();
    }

    const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

async function generateEmbeddingsBatch(texts) {
    if (!embeddingPipeline) {
        await initEmbeddings();
    }

    const embeddings = await Promise.all(
        texts.map(text => generateEmbedding(text))
    );

    return embeddings;
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/<script.*?>.*?<\/script>/gi, '');
}

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: CONFIG.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://scholar.ai',
        'X-Title': 'Scholar.AI',
    }
});

module.exports = {
    initEmbeddings,
    generateEmbedding,
    generateEmbeddingsBatch,
    sanitizeInput,
    openai
};

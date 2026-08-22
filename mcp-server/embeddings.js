import { pipeline } from '@xenova/transformers';

let embedder = null;

/**
 * Initializes and returns the embedding pipeline.
 * The model is loaded once and cached at the module level.
 */
export async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    }
    return embedder;
}

/**
 * Embeds the provided text using the Xenova/bge-small-en-v1.5 model.
 * @param {string} text The text to embed.
 * @returns {Promise<number[]>} The 384-dimensional embedding vector.
 */
export async function embedText(text) {
    const generateEmbedding = await getEmbedder();
    const output = await generateEmbedding(text, { pooling: 'mean', normalize: true });
    // Convert Float32Array to standard JavaScript array
    return Array.from(output.data);
}

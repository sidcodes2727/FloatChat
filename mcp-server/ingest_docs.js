import fs from 'fs';
import path from 'path';
import { embedText } from './embeddings.js';
import pool from './db.js';

const DOCS_DIR = path.join(process.cwd(), 'reference_docs');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

/**
 * Splits text into chunks based on word boundaries to roughly approximate tokens.
 */
function chunkText(text, size, overlap) {
    const words = text.split(/\s+/);
    const chunks = [];
    let i = 0;
    while (i < words.length) {
        const chunk = words.slice(i, i + size).join(' ');
        chunks.push(chunk);
        i += (size - overlap);
    }
    return chunks;
}

async function ingestDocuments() {
    console.log('Starting document ingestion...');

    if (!fs.existsSync(DOCS_DIR)) {
        console.error(`Directory not found: ${DOCS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    console.log(`Found ${files.length} files to process.`);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`\nProcessing file ${i + 1} of ${files.length}: ${file}`);

        // Check if file is already ingested to prevent duplicates
        const checkRes = await pool.query('SELECT 1 FROM ocean_docs WHERE source = $1 LIMIT 1', [file]);
        if (checkRes.rowCount > 0) {
            console.log(`Skipping ${file} - already ingested.`);
            continue;
        }

        const filePath = path.join(DOCS_DIR, file);
        const text = fs.readFileSync(filePath, 'utf8');

        // Basic chunking (a more robust tokenizer could be used, but word-based is sufficient for now)
        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`Split into ${chunks.length} chunks. Generating embeddings...`);

        for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            try {
                const embedding = await embedText(chunk);
                // Convert JS array to Postgres vector format: '[v1, v2, ...]'
                const embeddingStr = `[${embedding.join(',')}]`;
                
                await pool.query(
                    'INSERT INTO ocean_docs (content, source, embedding) VALUES ($1, $2, $3)',
                    [chunk, file, embeddingStr]
                );
            } catch (err) {
                console.error(`Error processing chunk ${j} of ${file}:`, err);
            }
        }
        console.log(`Completed ${file}.`);
    }

    console.log('\nDocument ingestion complete.');
    process.exit(0);
}

ingestDocuments().catch(err => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});

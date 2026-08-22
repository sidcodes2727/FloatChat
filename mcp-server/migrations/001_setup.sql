-- Enable the pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the ocean_docs table to store unstructured reference data and their embeddings
CREATE TABLE IF NOT EXISTS ocean_docs (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    embedding VECTOR(384) NOT NULL
);

-- Create an HNSW index on the embedding column using vector_cosine_ops
CREATE INDEX IF NOT EXISTS ocean_docs_embedding_idx ON ocean_docs USING hnsw (embedding vector_cosine_ops);

-- Assuming the Argo readings table is 't1', create a spatial index on lat/lon to speed up bounding box queries
-- First, ensure latitude and longitude are indexed
CREATE INDEX IF NOT EXISTS t1_lat_lon_idx ON t1 (latitude, longitude);

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pool from './db.js';
import { embedText } from './embeddings.js';

// Initialize the MCP Server
const server = new McpServer({
    name: 'FloatChat MCP Server',
    version: '1.0.0'
});

/**
 * Tool 1: query_argo_stats
 * User question example: "What is the average temperature near Hawaii (lat 20, lon -156)?"
 * Fetches aggregated stats (min/max/mean/count) within a geographic region.
 * Includes a fallback to nearest points if no exact matches are found.
 */
server.tool(
    'query_argo_stats',
    'Get aggregated ocean statistics for floats within a geographic region and optional date range',
    {
        lat: z.number().describe("Latitude coordinate"),
        lon: z.number().describe("Longitude coordinate"),
        radius_deg: z.number().optional().default(2).describe("Search radius in degrees"),
        start_date: z.string().optional().describe("Start date (ISO format)"),
        end_date: z.string().optional().describe("End date (ISO format)")
    },
    async ({ lat, lon, radius_deg, start_date, end_date }) => {
        try {
            const minLat = lat - radius_deg;
            const maxLat = lat + radius_deg;
            const dbLon = lon < 0 ? lon + 360 : lon;
            const minLon = dbLon - radius_deg;
            const maxLon = dbLon + radius_deg;

            let query = `
                SELECT 
                    MIN(temperature) as min_temp, MAX(temperature) as max_temp, AVG(temperature) as mean_temp,
                    MIN(salinity) as min_salinity, MAX(salinity) as max_salinity, AVG(salinity) as mean_salinity,
                    MIN(depth) as min_depth, MAX(depth) as max_depth, AVG(depth) as mean_depth,
                    MIN(oxygen) as min_oxygen, MAX(oxygen) as max_oxygen, AVG(oxygen) as mean_oxygen,
                    COUNT(*) as count
                FROM t1
                WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
            `;
            
            const params = [minLat, maxLat, minLon, maxLon];
            let paramIdx = 5;

            if (start_date) {
                query += ` AND time_ts >= $${paramIdx++}`;
                params.push(start_date);
            }
            if (end_date) {
                query += ` AND time_ts <= $${paramIdx++}`;
                params.push(end_date);
            }

            let result = await pool.query(query, params);

            // Fallback: If no data found in radius, find the nearest 10 points and aggregate them
            if (parseInt(result.rows[0].count) === 0) {
                console.error(`query_argo_stats: No data found within ${radius_deg} degrees. Falling back to nearest points.`);
                const fallbackQuery = `
                    WITH nearest AS (
                        SELECT * FROM t1
                        ORDER BY ((latitude - $1)^2 + (longitude - $2)^2) ASC
                        LIMIT 10
                    )
                    SELECT 
                        MIN(temperature) as min_temp, MAX(temperature) as max_temp, AVG(temperature) as mean_temp,
                        MIN(salinity) as min_salinity, MAX(salinity) as max_salinity, AVG(salinity) as mean_salinity,
                        MIN(depth) as min_depth, MAX(depth) as max_depth, AVG(depth) as mean_depth,
                        MIN(oxygen) as min_oxygen, MAX(oxygen) as max_oxygen, AVG(oxygen) as mean_oxygen,
                        COUNT(*) as count
                    FROM nearest
                `;
                result = await pool.query(fallbackQuery, [lat, dbLon]);
                
                // Add a note explaining the fallback
                result.rows[0].fallback_note = "No data in exact region. Returned stats from the 10 nearest data points instead.";
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result.rows[0]) }]
            };
        } catch (error) {
            console.error('Error in query_argo_stats:', error, { lat, lon });
            return {
                isError: true,
                content: [{ type: 'text', text: `Database error querying Argo stats: ${error.message}` }]
            };
        }
    }
);

/**
 * Tool 2: vector_search
 * User question example: "What is a thermocline?" or "How does an Argo float transmit data?"
 * Embeds the user query and performs semantic search across reference documents.
 */
server.tool(
    'vector_search',
    'Search oceanography reference documentation by semantic similarity to answer conceptual questions',
    {
        query_text: z.string().describe("The conceptual question or phrase to search for"),
        top_k: z.number().optional().default(5).describe("Number of results to return")
    },
    async ({ query_text, top_k }) => {
        try {
            const queryEmbedding = await embedText(query_text);
            const embeddingStr = `[${queryEmbedding.join(',')}]`;

            const query = `
                SELECT content, source, 1 - (embedding <=> $1) as similarity
                FROM ocean_docs
                ORDER BY embedding <=> $1
                LIMIT $2
            `;
            
            const result = await pool.query(query, [embeddingStr, top_k]);
            
            return {
                content: [{ type: 'text', text: JSON.stringify(result.rows) }]
            };
        } catch (error) {
            console.error('Error in vector_search:', error, { query_text });
            return {
                isError: true,
                content: [{ type: 'text', text: `Database error during vector search: ${error.message}` }]
            };
        }
    }
);

/**
 * Tool 3: get_regional_timeseries
 * User question example: "Show me the recent temperature changes near the equator at lat 0, lon 10."
 * Replaces trajectory search because platform_id is not available in t1.
 * Fetches chronological points near a location.
 */
server.tool(
    'get_regional_timeseries',
    'Get chronological ocean metric readings for a specific geographic region',
    {
        lat: z.number().describe("Latitude coordinate"),
        lon: z.number().describe("Longitude coordinate"),
        radius_deg: z.number().optional().default(2).describe("Search radius in degrees")
    },
    async ({ lat, lon, radius_deg }) => {
        try {
            const minLat = lat - radius_deg;
            const maxLat = lat + radius_deg;
            const dbLon = lon < 0 ? lon + 360 : lon;
            const minLon = dbLon - radius_deg;
            const maxLon = dbLon + radius_deg;

            let query = `
                SELECT latitude, longitude, time_ts, depth, temperature, salinity, oxygen
                FROM t1
                WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
                ORDER BY time_ts ASC
                LIMIT 100
            `;
            
            let result = await pool.query(query, [minLat, maxLat, minLon, maxLon]);

            // Fallback to nearest points if region has no data
            if (result.rowCount === 0) {
                console.error(`get_regional_timeseries: No data found in region. Falling back to nearest points.`);
                const fallbackQuery = `
                    SELECT latitude, longitude, time_ts, depth, temperature, salinity, oxygen
                    FROM t1
                    ORDER BY ((latitude - $1)^2 + (longitude - $2)^2) ASC
                    LIMIT 20
                `;
                result = await pool.query(fallbackQuery, [lat, dbLon]);
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result.rows) }]
            };
        } catch (error) {
            console.error('Error in get_regional_timeseries:', error, { lat, lon });
            return {
                isError: true,
                content: [{ type: 'text', text: `Database error querying timeseries: ${error.message}` }]
            };
        }
    }
);

async function startServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FloatChat MCP Server running on stdio');
}

startServer().catch(err => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
});

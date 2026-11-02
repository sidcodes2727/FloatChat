const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const client = require("./database/db");
const { ChromaClient } = require('chromadb');

const chroma = new ChromaClient({ path: "http://localhost:8000" });

// Helper: normalize metrics
function normalizeMetrics(row) {
    const out = { ...row };
    const coerce = (v, min, max) => {
        if (v === null || v === undefined) return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < min || n > max) return null;
        return n;
    };
    if ('temperature' in out) out.temperature = coerce(out.temperature, -5, 50);
    if ('salinity' in out) out.salinity = coerce(out.salinity, 0, 60);
    if ('oxygen' in out) out.oxygen = coerce(out.oxygen, 0, 1000);
    if ('pressure' in out) out.pressure = coerce(out.pressure, -10, 12000);
    if ('depth' in out) out.depth = coerce(out.depth, -10, 12000);
    if ('year' in out) out.year = out.year != null ? Number(out.year) : null;
    return out;
}

const server = new Server({
    name: "floatchat-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    }
});

// Expose tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query_argo_database",
                description: "Queries the PostgreSQL database for ARGO oceanographic data (temperature, salinity, etc.) in a specific bounding box.",
                inputSchema: {
                    type: "object",
                    properties: {
                        latitude: { type: "number", description: "Latitude coordinate of the region center" },
                        longitude: { type: "number", description: "Longitude coordinate of the region center" },
                        rangeDeg: { type: "number", description: "Bounding box range in degrees (e.g. 5)" },
                        year: { type: ["number", "null"], description: "Optional year to filter the data by" },
                        locationName: { type: "string", description: "Optional name of the location being queried (e.g. 'Arabian Sea')" }
                    },
                    required: ["latitude", "longitude", "rangeDeg"]
                }
            },
            {
                name: "search_ocean_knowledge",
                description: "Searches the Chroma vector database for definitions, metadata, and background knowledge about oceanography.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The concept or question to search for (e.g. 'What is a BGC float?')" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "geocode_location",
                description: "Geocodes a human-readable location name (e.g. 'Arabian Sea') into latitude and longitude coordinates.",
                inputSchema: {
                    type: "object",
                    properties: {
                        locationName: { type: "string", description: "Name of the location to geocode" }
                    },
                    required: ["locationName"]
                }
            }
        ]
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (request.params.name === "query_argo_database") {
            const { latitude, longitude, rangeDeg, year } = request.params.arguments;
            const latMin = latitude - rangeDeg;
            const latMax = latitude + rangeDeg;
            
            const lonMin1 = longitude - rangeDeg;
            const lonMax1 = longitude + rangeDeg;
            
            const lon360 = longitude < 0 ? longitude + 360 : longitude;
            const lonMin2 = lon360 - rangeDeg;
            const lonMax2 = lon360 + rangeDeg;

            let q = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
                     FROM t1
                     WHERE latitude BETWEEN $1 AND $2
                       AND ( (longitude BETWEEN $3 AND $4) OR (longitude BETWEEN $5 AND $6) )
                       AND (temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL)`;
            let params = [latMin, latMax, lonMin1, lonMax1, lonMin2, lonMax2];
            
            if (year) {
               q += ` AND EXTRACT(YEAR FROM time_ts) = $7`;
               params.push(year);
            }
            q += ` ORDER BY time_ts DESC, depth ASC LIMIT 500`;

            const dbRes = await client.query(q, params);
            let rows = (dbRes.rows || []).map(normalizeMetrics);
            
            return {
                content: [{ type: "text", text: JSON.stringify({ data: rows, rowCount: rows.length }) }]
            };
        } 
        
        else if (request.params.name === "search_ocean_knowledge") {
            const { query } = request.params.arguments;
            let vectorContext = "No context found.";
            try {
                const collection = await chroma.getCollection({ name: "ocean_metadata" });
                const results = await collection.query({
                    queryTexts: [query],
                    nResults: 2
                });
                
                if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
                    vectorContext = results.documents[0].join(" ");
                }
            } catch (e) {
                console.error("Vector DB error:", e);
            }
            return {
                content: [{ type: "text", text: vectorContext }]
            };
        }
        
        else if (request.params.name === "geocode_location") {
            const { locationName } = request.params.arguments;
            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
            const geoResp = await fetch(geoUrl, { headers: { 'User-Agent': 'FloatChatApp/1.0' } });
            if (geoResp.ok) {
                const geoData = await geoResp.json();
                if (geoData && geoData.length > 0) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ lat: parseFloat(geoData[0].lat), lon: parseFloat(geoData[0].lon) }) }]
                    };
                }
            }
            return {
                content: [{ type: "text", text: JSON.stringify({ error: "Location not found" }) }]
            };
        }
        
        throw new Error("Tool not found");
    } catch (err) {
        return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);

#!/usr/bin/env node

/**
 * OBIS Marine Biodiversity MCP Server
 * Protocol: Model Context Protocol (stdio transport / JSON-RPC 2.0)
 * Allows AI models to query real-time species occurrences from OBIS API v3.
 */

const { fetchObisSpecies } = require('../services/obis_service');

// Handle stdin / stdout JSON-RPC messages
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep last incomplete line in buffer

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const req = JSON.parse(line);
            await handleRequest(req);
        } catch (e) {
            sendError(null, -32700, 'Parse error');
        }
    }
});

async function handleRequest(req) {
    const { id, method, params } = req;

    if (method === 'initialize') {
        sendResult(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'obis-marine-biodiversity-mcp',
                version: '1.0.0'
            }
        });
        return;
    }

    if (method === 'notifications/initialized') {
        return; // No response required
    }

    if (method === 'tools/list') {
        sendResult(id, {
            tools: [
                {
                    name: 'get_marine_biodiversity',
                    description: 'Fetch recorded marine species occurrences (fish, algae/vegetation, corals, crustaceans, mollusks) from OBIS API v3 for specified lat/lon coordinates.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            lat: { type: 'number', description: 'Latitude (-90 to 90)' },
                            lon: { type: 'number', description: 'Longitude (-180 to 180)' },
                            rangeDeg: { type: 'number', description: 'Bounding box radius/range in degrees (default: 5)' },
                            limit: { type: 'number', description: 'Max occurrence records to fetch (default: 35)' }
                        },
                        required: ['lat', 'lon']
                    }
                }
            ]
        });
        return;
    }

    if (method === 'tools/call') {
        const toolName = params?.name;
        const args = params?.arguments || {};

        if (toolName === 'get_marine_biodiversity') {
            const { lat, lon, rangeDeg = 5, limit = 35 } = args;
            
            if (typeof lat !== 'number' || typeof lon !== 'number') {
                sendError(id, -32602, 'Invalid params: lat and lon must be numbers');
                return;
            }

            try {
                const obisData = await fetchObisSpecies(lat, lon, rangeDeg, limit);
                if (!obisData) {
                    sendResult(id, {
                        content: [{ type: 'text', text: `Failed to fetch OBIS biodiversity data for Lat=${lat}, Lon=${lon}` }]
                    });
                    return;
                }

                sendResult(id, {
                    content: [
                        {
                            type: 'text',
                            text: obisData.summaryText
                        }
                    ]
                });
            } catch (err) {
                sendError(id, -32603, `Internal error: ${err.message}`);
            }
            return;
        }

        sendError(id, -32601, `Tool not found: ${toolName}`);
        return;
    }

    sendError(id, -32601, `Method not found: ${method}`);
}

function sendResult(id, result) {
    const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
    process.stdout.write(msg + '\n');
}

function sendError(id, code, message) {
    const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
    process.stdout.write(msg + '\n');
}

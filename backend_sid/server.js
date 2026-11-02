require('dotenv').config();
const express = require("express");
const client = require("./database/db");
const { ChromaClient } = require('chromadb');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const app = express();
const port = process.env.PORT || 3001;
const cors = require("cors");

const chroma = new ChromaClient({ path: "http://localhost:8000" });

let mcpClient = null;
async function getMcpClient() {
  if (mcpClient) return mcpClient;
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./mcp_server.js"]
  });
  mcpClient = new Client({ name: "floatchat-backend", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(transport);
  return mcpClient;
}
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

// Load unstructured reference documentation for RAG
let referenceDocs = [];
try {
  const docsPath = path.join(__dirname, 'database', 'reference_docs.json');
  if (fs.existsSync(docsPath)) {
    referenceDocs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
    console.log(`Loaded ${referenceDocs.length} unstructured reference docs.`);
  } else {
    console.warn("Warning: database/reference_docs.json not found.");
  }
} catch (e) {
  console.error("Failed to load reference_docs.json:", e);
}

// Retrieve relevant documentation passages using keyword/token matching
function retrieveDocs(queryText, limit = 3) {
  if (!queryText || typeof queryText !== 'string') return [];
  const cleanQuery = queryText.toLowerCase().replace(/[^\w\s]/g, ' ');
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const scored = referenceDocs.map(doc => {
    let score = 0;
    tokens.forEach(token => {
      // Direct keyword match gets a higher weight
      if (doc.keywords && doc.keywords.includes(token)) {
        score += 3;
      }
      // Content substring match gets a lower weight
      if (doc.text && doc.text.toLowerCase().includes(token)) {
        score += 1;
      }
    });
    return { ...doc, score };
  });

  return scored
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(doc => doc.text);
}

// Named ocean / sea region → bounding box { centerLat, centerLon, rangeDeg }
const OCEAN_REGIONS = {
  // Major Oceans
  'indian ocean':      { centerLat: -20,  centerLon:  80,  rangeDeg: 40 },
  'pacific ocean':     { centerLat:   0,  centerLon: 180,  rangeDeg: 60 },
  'north pacific':     { centerLat:  30,  centerLon: 180,  rangeDeg: 35 },
  'south pacific':     { centerLat: -30,  centerLon: 200,  rangeDeg: 35 },
  'atlantic ocean':    { centerLat:   0,  centerLon: -30,  rangeDeg: 50 },
  'north atlantic':    { centerLat:  40,  centerLon: -35,  rangeDeg: 30 },
  'south atlantic':    { centerLat: -30,  centerLon: -20,  rangeDeg: 30 },
  'arctic ocean':      { centerLat:  85,  centerLon:   0,  rangeDeg: 15 },
  'southern ocean':    { centerLat: -65,  centerLon:   0,  rangeDeg: 20 },
  'antarctic ocean':   { centerLat: -65,  centerLon:   0,  rangeDeg: 20 },
  // Seas
  'arabian sea':       { centerLat:  15,  centerLon:  65,  rangeDeg: 12 },
  'bay of bengal':     { centerLat:  13,  centerLon:  88,  rangeDeg: 10 },
  'mediterranean':     { centerLat:  36,  centerLon:  18,  rangeDeg: 12 },
  'mediterranean sea': { centerLat:  36,  centerLon:  18,  rangeDeg: 12 },
  'caribbean sea':     { centerLat:  15,  centerLon: -75,  rangeDeg: 10 },
  'caribbean':         { centerLat:  15,  centerLon: -75,  rangeDeg: 10 },
  'red sea':           { centerLat:  20,  centerLon:  38,  rangeDeg:  6 },
  'gulf of mexico':    { centerLat:  25,  centerLon: -90,  rangeDeg:  8 },
  'south china sea':   { centerLat:  12,  centerLon: 114,  rangeDeg: 10 },
  'coral sea':         { centerLat: -18,  centerLon: 154,  rangeDeg: 10 },
  'tasman sea':        { centerLat: -38,  centerLon: 160,  rangeDeg:  8 },
  'bering sea':        { centerLat:  58,  centerLon: 180,  rangeDeg: 10 },
  'north sea':         { centerLat:  57,  centerLon:   4,  rangeDeg:  6 },
  'persian gulf':      { centerLat:  26,  centerLon:  52,  rangeDeg:  4 },
};

/**
 * Given a user message string, return a region match { centerLat, centerLon, rangeDeg, name }
 * or null if no named region is found.
 */
function resolveNamedRegion(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  // Sort keys longest-first so more specific matches win (e.g. "north atlantic" before "atlantic")
  const keys = Object.keys(OCEAN_REGIONS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) {
      return { ...OCEAN_REGIONS[key], name: key };
    }
  }
  return null;
}

const SYSTEM_PROMPT = `You are floatCHAT, a concise expert oceanographic AI assistant embedded in FloatChat.

## Response Style Guidelines (STRICT REQUIREMENT)
1. **Be Short and Concise**: Keep your total answer under 120 words.
2. **Key Insights Only**: Give 3-4 bullet points maximum.
3. **Data Grounding**: Use real temperature (°C), salinity (PSU), depth (m), and oxygen (µmol/kg) from the provided DATA CONTEXT.
4. **Ecosystem Summary**: Briefly mention marine vegetation/life impact in 1 short bullet point.
5. **No Verbose Essays**: Do not output long multi-paragraph sections or excessive markdown headers. Get straight to the point.`;

app.get("/", (req, res) => {
  res.send("🌊 ARGO Backend API is running!");
});

// Helper: normalize metrics to numbers with nulls instead of 0s for invalid data
function normalizeMetrics(row) {
  const out = { ...row };
  const coerce = (v, min, max) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (n < min || n > max) return null; // Filter out 99999 placeholder sensor values
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

// Unified Chat endpoint with Groq and MCP Tool Calling
app.post('/ai/chat', async (req, res) => {
  console.log('Chat request received');
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set on server' });
    }
    const { messages = [] } = req.body || {};

    // Connect to MCP Server
    const mcp = await getMcpClient();

    // Fetch available tools from MCP
    const toolsResp = await mcp.listTools();
    const groqTools = toolsResp.tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    // Setup initial messages
    let systemPrompt = "You are floatCHAT — your ocean data assistant. You have access to tools to search ocean knowledge and query live ARGO data. Use them when necessary to answer the user's questions. CRITICAL RULE: When you receive data summaries from the database, explain them naturally and conversationally to the user in 1-3 sentences. Do not just copy-paste the raw summary text.";

    const groqMessages = [{ role: 'system', content: systemPrompt }];
    messages.forEach(m => {
      if (m.role === 'user' || m.role === 'assistant') {
        groqMessages.push({ role: m.role, content: m.content });
      }
    });

    let summaries = []; // For frontend charts
    let totalRowsUsed = 0;

    // Loop for tool calling (up to 10 iterations)
    for (let i = 0; i < 10; i++) {
      const groqReq = {
        model: 'openai/gpt-oss-120b',
        messages: groqMessages,
        tools: groqTools,
        tool_choice: "auto",
        temperature: 0.1
      };

      const finalResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(groqReq)
      });

      if (!finalResp.ok) {
        const errText = await finalResp.text();
        return res.status(500).json({ error: 'Groq API error', details: errText });
      }

      const data = await finalResp.json();
      const responseMessage = data.choices[0].message;

      // Add model's response to history
      groqMessages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Model wants to call a tool
        for (const toolCall of responseMessage.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`LLM called tool: ${name} with args:`, args);

          // Execute tool via MCP
          const result = await mcp.callTool({ name, arguments: args });
          let resultText = result.content[0].text;

          // If it's the database query, extract chart data for the frontend
          if (name === "query_argo_database") {
            try {
              const parsed = JSON.parse(resultText);
              totalRowsUsed += parsed.rowCount;
              if (parsed.rowCount > 0) {
                const rows = parsed.data;
                const nums = (arr) => arr.filter(n => n !== null && n !== undefined).map(Number).filter(n => Number.isFinite(n));
                const stat = (v) => {
                  const vals = nums(v);
                  if (!vals.length) return null;
                  return { count: vals.length, min: Math.min(...vals), max: Math.max(...vals), mean: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) };
                };
                summaries.push({
                  region: { name: args.locationName || `Region (${args.latitude.toFixed(1)}, ${args.longitude.toFixed(1)})`, center: { lat: args.latitude, lon: args.longitude }, rangeDeg: args.rangeDeg, year: args.year || "All Years" },
                  totals: parsed.rowCount,
                  depth: stat(rows.map(r => r.depth)),
                  temperature: stat(rows.map(r => r.temperature)),
                  salinity: stat(rows.map(r => r.salinity)),
                  oxygen: stat(rows.map(r => r.oxygen)),
                  points: rows.slice(0, 300)
                });
                const depthStat = stat(rows.map(r => r.depth));
                const tempStat = stat(rows.map(r => r.temperature));
                const salStat = stat(rows.map(r => r.salinity));
                const oxyStat = stat(rows.map(r => r.oxygen));
                // Condense text for LLM to avoid context overflow
                resultText = `Database search successful. Found ${parsed.rowCount} records. ` +
                  (depthStat ? `Depth ranged ${depthStat.min} - ${depthStat.max} m (mean ${depthStat.mean} m), ` : '') +
                  (tempStat ? `Temperature ${tempStat.min} - ${tempStat.max}°C (mean ${tempStat.mean}°C), ` : '') +
                  (salStat ? `Salinity ${salStat.min} - ${salStat.max} PSU (mean ${salStat.mean} PSU), ` : '') +
                  (oxyStat ? `Oxygen ${oxyStat.min} - ${oxyStat.max} µmol/kg (mean ${oxyStat.mean} µmol/kg).` : '');
              } else {
                resultText = "Database returned 0 rows.";
              }
            } catch (e) {
              console.error("Error parsing DB tool output", e);
            }
          }

          groqMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: name,
            content: resultText,
          });
        }
        // Loop back to send tool results to LLM
      } else {
        // Final textual response received
        return res.json({ text: responseMessage.content || '', usedRows: totalRowsUsed, plottingData: summaries });
      }
    }

    // Fallback if loop exceeded
    res.json({ text: groqMessages[groqMessages.length - 1].content || 'Max tool iterations reached.', usedRows: totalRowsUsed, plottingData: summaries });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

app.get("/everything", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /everything:', err);
    res.status(500).json({ error: 'Failed to retrieve data.' });
  }
});

app.get("/latlong", async (req, res) => {
  const { lat, lon } = req.query;
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  let dbLon = lonNum < 0 ? lonNum + 360 : lonNum;
  try {
    const result = await client.query(
      "SELECT * FROM t1 WHERE latitude=$1 AND longitude=$2 ORDER BY time_ts ASC, depth ASC LIMIT 50",
      [latNum, dbLon]
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /latlong:', err);
    res.status(500).json({ error: 'Failed to retrieve data for coordinates.' });
  }
});

app.get("/temperature", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, temperature, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /temperature:', err);
    res.status(500).json({ error: 'Failed to retrieve temperature profiles.' });
  }
});

app.get("/pressure", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, pressure, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND pressure IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /pressure:', err);
    res.status(500).json({ error: 'Failed to retrieve pressure measurements.' });
  }
});

app.get("/salinity", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, salinity, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /salinity:', err);
    res.status(500).json({ error: 'Failed to retrieve salinity parameters.' });
  }
});

app.get("/oxygen", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, oxygen, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /oxygen:', err);
    res.status(500).json({ error: 'Failed to retrieve oxygen levels.' });
  }
});

app.get("/nitrate", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, nitrate, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND nitrate IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error in /nitrate:', err);
    res.status(500).json({ error: 'Failed to retrieve nitrate values.' });
  }
});

app.get("/depth", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, depth, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND depth IS NOT NULL AND time_ts IS NOT NULL ORDER BY time_ts DESC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /depth:', err);
    res.status(500).json({ error: 'Failed to retrieve depth parameters.' });
  }
});

app.get("/profiles", async (req, res) => {
  try {
    const { lat, lon, rangeDeg } = req.query;
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const rangeNum = parseFloat(rangeDeg);
    let dbLon = lonNum < 0 ? lonNum + 360 : lonNum;

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(rangeNum)) {
      return res.status(400).json({ error: "lat, lon, rangeDeg (numbers) are required" });
    }

    const dbLon = lonNum < 0 ? lonNum + 360 : lonNum;

    const effectiveRange = rangeNum === 0 ? 0.01 : rangeNum;
    const latMin = latNum - effectiveRange;
    const latMax = latNum + effectiveRange;
    const lonMin = dbLon - effectiveRange;
    const lonMax = dbLon + effectiveRange;

    const result = await client.query(
      `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
       FROM t1
       WHERE latitude BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4
         AND depth IS NOT NULL
         AND time_ts IS NOT NULL
       ORDER BY time_ts ASC, depth ASC`,
      [latMin, latMax, lonMin, lonMax]
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    console.error('Database query error in /profiles:', err);
    res.status(500).json({ error: 'Failed to retrieve spatial profile dataset.' });
  }
});

app.get("/time", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, time_ts FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL ORDER BY time_ts DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error in /time:', err);
    res.status(500).json({ error: 'Failed to retrieve timeseries metadata.' });
  }
});

app.get("/api/obis/species", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const rangeDeg = parseFloat(req.query.rangeDeg) || 5;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "lat and lon query parameters are required" });
    }
    const obisData = await fetchObisSpecies(lat, lon, rangeDeg);
    if (!obisData) {
      return res.status(500).json({ error: "Failed to fetch OBIS biodiversity data" });
    }
    res.json(obisData);
  } catch (err) {
    console.error("OBIS API error:", err);
    res.status(500).json({ error: err.message });
  }
});

// The `/ai/chat` proxy to Google Gemini has been removed as it is now integrated above

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

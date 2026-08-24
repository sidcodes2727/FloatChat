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
                // Condense text for LLM to avoid context overflow
                resultText = `Database search successful. Found ${parsed.rowCount} records. Average Temperature: ${stat(rows.map(r => r.temperature))?.mean}°C, Average Salinity: ${stat(rows.map(r => r.salinity))?.mean} PSU.`;
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// New GET route for latitude, longitude, and temperature
app.get("/temperature", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, temperature, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    const rows = (result.rows || []).map(normalizeMetrics);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.get("/nitrate", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, nitrate, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND nitrate IS NOT NULL AND time_ts IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC"
    );
    // Nitrate is left as-is; no normalization to 0 requested
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Query profiles within latitude/longitude ± rangeDeg (degrees)
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
    res.status(500).json({ error: err.message });
  }
});

app.get("/time", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, time_ts FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL ORDER BY time_ts DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The `/ai/chat` proxy to Google Gemini has been removed as it is now integrated above

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

require('dotenv').config();
const express = require("express");
const client = require("./database/db");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const app = express();
const port = process.env.PORT || 3001;
const cors = require("cors");

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

const SYSTEM_PROMPT = `You are floatCHAT, the AI research assistant embedded in FloatChat — a deep-ocean visualization dashboard powered by real ARGO float data.

## Your role
Help users understand oceanographic data by combining:
1. Retrieved statistical summaries from the ARGO float database (structured data)
2. Retrieved reference knowledge about oceanography and the ARGO program (unstructured docs)

You will be given a CONTEXT block before each user question containing one or both of:
- DATA CONTEXT: real statistics (min/max/mean/count) for temperature, salinity, depth, and oxygen from floats matching the user's specified region/time range
- REFERENCE CONTEXT: retrieved passages from oceanography documentation

## Rules
1. Ground every factual claim about actual ocean conditions in the DATA CONTEXT provided. Never invent specific numbers, float IDs, or coordinates that were not given to you.
2. When the DATA CONTEXT provides "approximate nearby data", USE that data! Present it as approximate/nearby data and include the distance. Do NOT refuse to answer. Say something like "I don't have exact data for your coordinate, but the nearest ARGO observations (~X° away) show..."
3. ONLY if the DATA CONTEXT explicitly states "(No matching data found)" or "(No ARGO data found globally)", explicitly state: "I don't have ARGO observations for that region in the current dataset; could you select that region on the map so I can retrieve the relevant profiles?"
4. Use REFERENCE CONTEXT for explaining concepts (e.g., "what is a thermocline", "how does ARGO measure salinity") — cite it naturally without saying "according to the context."
5. If a question requires data you don't have context for, tell the user to select that region on the map first, or ask a clarifying question.
6. Keep answers concise and data-forward. Prefer a short paragraph plus key numbers over long essays. This is a dashboard sidebar chat, not a report.
7. When relevant, describe patterns in plain oceanographic terms (e.g., "this indicates a strong halocline around 200m") rather than just repeating numbers back.
8. Never fabricate float IDs, timestamps, or precise coordinates. If asked for specifics not present in DATA CONTEXT, say you don't have that specific reading available.
9. If the user's question is ambiguous about location or time range, ask ONE clarifying question rather than guessing.

## Tone
Precise, calm, and scientifically literate — like a knowledgeable colleague, not a generic chatbot. Avoid excessive enthusiasm or filler phrases.`;

app.get("/", (req, res) => {
  res.send("🌊 ARGO Backend API is running!");
});

// Helper: normalize metrics to numbers with nulls -> 0
function normalizeMetrics(row) {
  const out = { ...row };
  const coerce = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (Math.abs(n) > 1e6) return 0;
    return n;
  };
  if ('temperature' in out) out.temperature = coerce(out.temperature);
  if ('salinity' in out) out.salinity = coerce(out.salinity);
  if ('oxygen' in out) out.oxygen = coerce(out.oxygen);
  if ('pressure' in out) out.pressure = coerce(out.pressure);
  if ('depth' in out) out.depth = coerce(out.depth);
  return out;
}

// Chat with contextual data from Postgres near given lat/lon ± rangeDeg (degrees)
app.post('/ai/chat_context', async (req, res) => {
  console.log('Chat context request received');
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set on server' });
    }
    const { messages = [], lat, lon, rangeDeg, limit = 100 } = req.body || {};
    let latNum = parseFloat(lat);
    let lonNum = parseFloat(lon);
    const rangeNum = parseFloat(rangeDeg);

    // Try to auto-extract lat/lon from user messages (in case they typed coords while a map point is active)
    let extractedLat = null;
    let extractedLon = null;
    const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || '';
    const normalizedText = lastUserMessage.replace(/[°˚º]/g, ' ').replace(/\u200B/g, '');
    const coordPatterns = [
      /(-?\d+\.?\d*)\s*([NS])\s*[,;\s]+\s*(-?\d+\.?\d*)\s*([EW])/i,
      /lat(?:itude)?\s*[:=]?\s*(-?\d+\.?\d*)\s*[,;\s]+\s*lon(?:gitude)?\s*[:=]?\s*(-?\d+\.?\d*)/i,
      /\(?\s*(-?\d+\.?\d*)\s*(?:and|,|;|\s)+\s*(-?\d+\.?\d*)\s*\)?/i,
    ];
    for (const pattern of coordPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        if (match[2] && /[NSEW]/i.test(match[2])) {
          extractedLat = parseFloat(match[1]);
          if (/[Ss]/.test(match[2])) extractedLat = -extractedLat;
          extractedLon = parseFloat(match[3]);
          if (/[Ww]/.test(match[4])) extractedLon = -extractedLon;
        } else {
          const a = parseFloat(match[1]);
          const b = parseFloat(match[2]);
          if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
            extractedLat = a;
            extractedLon = b;
          }
        }
        if (extractedLat !== null) break;
      }
    }

    if (extractedLat !== null && extractedLon !== null) {
      console.log(`[CONTEXT-OVERRIDE] Extracted coords from text: ${extractedLat}, ${extractedLon}`);
      latNum = extractedLat;
      lonNum = extractedLon;
    }

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(rangeNum)) {
      return res.status(400).json({ error: 'lat, lon, rangeDeg must be valid numbers' });
    }

    const dbLon = lonNum < 0 ? lonNum + 360 : lonNum;

    const latMin = latNum - rangeNum;
    const latMax = latNum + rangeNum;
    const lonMin = dbLon - rangeNum;
    const lonMax = dbLon + rangeNum;

    // Pull a bounded set of rows for context
    const q = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
               FROM t1
               WHERE latitude BETWEEN $1 AND $2
                 AND longitude BETWEEN $3 AND $4
                 AND (temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL)
               ORDER BY time_ts DESC, depth ASC
               LIMIT $5`;
    let db = await client.query(q, [latMin, latMax, lonMin, lonMax, Math.max(1, Math.min(1000, Number(limit) || 100))]);
    let rows = (db.rows || []).map(normalizeMetrics);
    
    let isFallback = false;
    let nearestDistDeg = 0;
    let nearestLat = null;
    let nearestLon = null;
    const MAX_DISTANCE_THRESHOLD = 30; // degrees — beyond this, data is too far to be useful

    if (rows.length === 0) {
      console.log('No data found in region, falling back to nearest points');
      const fallbackQ = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts,
                                SQRT(POWER(latitude - $1, 2) + POWER(longitude - $2, 2)) as dist_deg
                         FROM t1
                         WHERE temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL
                         ORDER BY ((latitude - $1)^2 + (longitude - $2)^2) ASC
                         LIMIT 20`;
      db = await client.query(fallbackQ, [latNum, dbLon]);
      rows = (db.rows || []).map(normalizeMetrics);
      isFallback = true;

      if (rows.length > 0) {
        nearestDistDeg = parseFloat(db.rows[0].dist_deg) || 0;
        nearestLat = db.rows[0].latitude;
        // Convert DB lon back to -180..180 for display
        nearestLon = db.rows[0].longitude > 180 ? db.rows[0].longitude - 360 : db.rows[0].longitude;
      }
    }

    // Summarize basic stats to keep prompt small
    const nums = (arr) => arr.map(Number).filter(n => Number.isFinite(n));
    function stat(values) {
      const v = nums(values);
      if (!v.length) return null;
      const min = Math.min(...v), max = Math.max(...v);
      const mean = v.reduce((s, x) => s + x, 0) / v.length;
      return { count: v.length, min, max, mean };
    }
    const summary = {
      region: { center: { lat: latNum, lon: lonNum }, rangeDeg: rangeNum },
      totals: rows.length,
      depth: stat(rows.map(r => r.depth)),
      temperature: stat(rows.map(r => r.temperature)),
      salinity: stat(rows.map(r => r.salinity)),
      oxygen: stat(rows.map(r => r.oxygen)),
      sample: rows.slice(0, 10)
    };

    // Retrieve unstructured reference text for RAG
    const retrievedDocsList = retrieveDocs(lastUserMessage, 3);

    // Build context preamble
    let preambleText = `=== CONTEXT BLOCK ===\n`;
    if (isFallback && nearestDistDeg > MAX_DISTANCE_THRESHOLD) {
      // Too far — no useful data
      preambleText += `[DATA CONTEXT]\n(No ARGO float data found anywhere near Lat=${latNum}, Lon=${lonNum}. The closest data point is ${nearestDistDeg.toFixed(1)}° away, which is too far to be representative. No statistics available.)\n`;
    } else if (summary.totals > 0) {
      preambleText += `[DATA CONTEXT]\n`;
      if (isFallback) {
        preambleText += `Approximate nearby data for Lat=${latNum}, Lon=${lonNum}. (Used ${summary.totals} nearest reference points. The closest point is at Lat=${nearestLat}, Lon=${nearestLon?.toFixed(2)}, which is ${nearestDistDeg.toFixed(1)}° away.)\n`;
      } else {
        preambleText += `Region/Range: Center Lat=${latNum}, Lon=${lonNum}, RangeDeg=${rangeNum}\n`;
      }
      preambleText += `Total float observations: ${summary.totals}\n`;
      if (summary.depth) preambleText += `Depth Stats (m): Min=${summary.depth.min.toFixed(2)}, Max=${summary.depth.max.toFixed(2)}, Mean=${summary.depth.mean.toFixed(2)}, Count=${summary.depth.count}\n`;
      if (summary.temperature) preambleText += `Temperature Stats (°C): Min=${summary.temperature.min.toFixed(2)}, Max=${summary.temperature.max.toFixed(2)}, Mean=${summary.temperature.mean.toFixed(2)}, Count=${summary.temperature.count}\n`;
      if (summary.salinity) preambleText += `Salinity Stats (PSU): Min=${summary.salinity.min.toFixed(2)}, Max=${summary.salinity.max.toFixed(2)}, Mean=${summary.salinity.mean.toFixed(2)}, Count=${summary.salinity.count}\n`;
      if (summary.oxygen) preambleText += `Oxygen Stats (µmol/kg): Min=${summary.oxygen.min.toFixed(2)}, Max=${summary.oxygen.max.toFixed(2)}, Mean=${summary.oxygen.mean.toFixed(2)}, Count=${summary.oxygen.count}\n`;
    } else {
      preambleText += `[DATA CONTEXT]\n(No matching data found)\n`;
    }


    if (retrievedDocsList.length > 0) {
      preambleText += `\n[REFERENCE CONTEXT]\n`;
      retrievedDocsList.forEach((passage, idx) => {
        preambleText += `${idx + 1}. ${passage}\n`;
      });
    }
    preambleText += `=====================\n`;

    // Map conversation messages to Groq chat format
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      })),
      {
        role: 'user',
        content: `${preambleText}\n\nUser Question:\n${messages[messages.length - 1]?.content || ''}`
      }
    ];

    // Debug: log context and message count
    console.log(`[DEBUG] Rows found: ${rows.length}, isFallback: ${isFallback}, message count: ${chatMessages.length}`);
    console.log(`[DEBUG] Preamble snippet: ${preambleText.substring(0, 300)}...`);

    const completion = await groq.chat.completions.create({
      messages: chatMessages,
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      max_tokens: 500
    });

    const text = completion.choices[0]?.message?.content || '';
    console.log(`[DEBUG] AI response: ${text.substring(0, 200)}...`);
    
    const responsePayload = { text, usedRows: rows.length };
    
    // If the user explicitly typed coordinates, or if we fell back, send back coordinates to shift the map/panel
    if (extractedLat !== null && extractedLon !== null) {
      if (isFallback && nearestLat !== null && nearestLon !== null) {
        responsePayload.extractedCoords = { lat: nearestLat, lon: nearestLon };
      } else {
        responsePayload.extractedCoords = { lat: extractedLat, lon: extractedLon };
      }
    } else if (isFallback && nearestLat !== null && nearestLon !== null) {
      responsePayload.extractedCoords = { lat: nearestLat, lon: nearestLon };
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('Chat context handler failed:', err);
    res.status(500).json({ error: 'An error occurred while communicating with the Groq AI service.' });
  }
});

// Simple proxy to Groq for chat, enhanced with RAG
// Now auto-extracts coordinates from the user's message to query the database
app.post('/ai/chat', async (req, res) => {
  console.log("Chat request received");
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set on server' });
    }
    const { messages = [] } = req.body || {};

    const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || '';
    const retrievedDocsList = retrieveDocs(lastUserMessage, 3);

    // Try to auto-extract lat/lon from the latest user message
    let extractedLat = null;
    let extractedLon = null;

    // Normalize degree-like characters: °, ˚, º, and unicode variants
    const normalizedText = lastUserMessage.replace(/[°˚º]/g, ' ').replace(/\u200B/g, '');

    // Match patterns like: "26 N, 66 W", "26N 66W", "lat 26 lon -66", etc.
    const coordPatterns = [
      // "26 N, 66 W" or "26N, 66W" or "26 N 66 W" — with optional degree symbol already stripped
      /(-?\d+\.?\d*)\s*([NS])\s*[,;\s]+\s*(-?\d+\.?\d*)\s*([EW])/i,
      // "lat 26, lon -66" or "latitude 26 longitude -66"
      /lat(?:itude)?\s*[:=]?\s*(-?\d+\.?\d*)\s*[,;\s]+\s*lon(?:gitude)?\s*[:=]?\s*(-?\d+\.?\d*)/i,
      // Bare coordinates like "26, -66" or "(26, -66)" or "26 and -66"
      /\(?\s*(-?\d+\.?\d*)\s*(?:and|,|;|\s)+\s*(-?\d+\.?\d*)\s*\)?/i,
    ];

    for (const pattern of coordPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        if (match[2] && /[NSEW]/i.test(match[2])) {
          // Pattern with N/S E/W directions
          extractedLat = parseFloat(match[1]);
          if (/[Ss]/.test(match[2])) extractedLat = -extractedLat;
          extractedLon = parseFloat(match[3]);
          if (/[Ww]/.test(match[4])) extractedLon = -extractedLon;
        } else {
          // Pattern with raw numbers — only use if they look like coordinates
          const a = parseFloat(match[1]);
          const b = parseFloat(match[2]);
          if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
            extractedLat = a;
            extractedLon = b;
          }
        }
        if (extractedLat !== null) break;
      }
    }

    console.log(`[AUTO-EXTRACT] normalizedText snippet: "${normalizedText.substring(0, 150)}"`);
    console.log(`[AUTO-EXTRACT] extractedLat=${extractedLat}, extractedLon=${extractedLon}`);

    let preambleText = `=== CONTEXT BLOCK ===\n`;
    let isFallback = false;
    let nearestLat = null;
    let nearestLon = null;

    // If we extracted coordinates, auto-query the database
    if (Number.isFinite(extractedLat) && Number.isFinite(extractedLon) &&
        Math.abs(extractedLat) <= 90 && Math.abs(extractedLon) <= 180) {
      console.log(`[AUTO-EXTRACT] Detected coordinates: Lat=${extractedLat}, Lon=${extractedLon}`);
      
      const dbLon = extractedLon < 0 ? extractedLon + 360 : extractedLon;
      const rangeNum = 2;
      const latMin = extractedLat - rangeNum;
      const latMax = extractedLat + rangeNum;
      const lonMin = dbLon - rangeNum;
      const lonMax = dbLon + rangeNum;

      const q = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
                 FROM t1
                 WHERE latitude BETWEEN $1 AND $2
                   AND longitude BETWEEN $3 AND $4
                   AND (temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL)
                 ORDER BY time_ts DESC, depth ASC
                 LIMIT 100`;
      let db = await client.query(q, [latMin, latMax, lonMin, lonMax]);
      let rows = (db.rows || []).map(normalizeMetrics);

      let nearestDistDeg = 0;

      if (rows.length === 0) {
        console.log('[AUTO-EXTRACT] No data in region, falling back to nearest');
        const fallbackQ = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts,
                                  SQRT(POWER(latitude - $1, 2) + POWER(longitude - $2, 2)) as dist_deg
                           FROM t1
                           WHERE temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL
                           ORDER BY ((latitude - $1)^2 + (longitude - $2)^2) ASC
                           LIMIT 20`;
        db = await client.query(fallbackQ, [extractedLat, dbLon]);
        rows = (db.rows || []).map(normalizeMetrics);
        isFallback = true;
        if (rows.length > 0) {
          nearestDistDeg = parseFloat(db.rows[0].dist_deg) || 0;
          nearestLat = db.rows[0].latitude;
          nearestLon = db.rows[0].longitude > 180 ? db.rows[0].longitude - 360 : db.rows[0].longitude;
        }
      }

      // Compute stats
      const nums = (arr) => arr.map(Number).filter(n => Number.isFinite(n));
      function stat(values) {
        const v = nums(values);
        if (!v.length) return null;
        const min = Math.min(...v), max = Math.max(...v);
        const mean = v.reduce((s, x) => s + x, 0) / v.length;
        return { count: v.length, min, max, mean };
      }
      const summary = {
        totals: rows.length,
        depth: stat(rows.map(r => r.depth)),
        temperature: stat(rows.map(r => r.temperature)),
        salinity: stat(rows.map(r => r.salinity)),
        oxygen: stat(rows.map(r => r.oxygen)),
      };

      if (isFallback && nearestDistDeg > 30) {
        preambleText += `[DATA CONTEXT]\n(No ARGO float data found anywhere near Lat=${extractedLat}, Lon=${extractedLon}. Closest is ${nearestDistDeg.toFixed(1)}° away — too far to be useful.)\n`;
      } else if (summary.totals > 0) {
        preambleText += `[DATA CONTEXT]\n`;
        if (isFallback) {
          preambleText += `Approximate nearby data for Lat=${extractedLat}, Lon=${extractedLon}. (Used ${summary.totals} nearest reference points. The closest point is at Lat=${nearestLat}, Lon=${nearestLon?.toFixed(2)}, which is ${nearestDistDeg.toFixed(1)}° away.)\n`;
        } else {
          preambleText += `Auto-detected Region: Lat=${extractedLat}, Lon=${extractedLon} ±2°\n`;
        }
        preambleText += `Total observations: ${summary.totals}\n`;
        if (summary.depth) preambleText += `Depth (m): Min=${summary.depth.min.toFixed(2)}, Max=${summary.depth.max.toFixed(2)}, Mean=${summary.depth.mean.toFixed(2)}\n`;
        if (summary.temperature) preambleText += `Temperature (°C): Min=${summary.temperature.min.toFixed(2)}, Max=${summary.temperature.max.toFixed(2)}, Mean=${summary.temperature.mean.toFixed(2)}\n`;
        if (summary.salinity) preambleText += `Salinity (PSU): Min=${summary.salinity.min.toFixed(2)}, Max=${summary.salinity.max.toFixed(2)}, Mean=${summary.salinity.mean.toFixed(2)}\n`;
        if (summary.oxygen) preambleText += `Oxygen (µmol/kg): Min=${summary.oxygen.min.toFixed(2)}, Max=${summary.oxygen.max.toFixed(2)}, Mean=${summary.oxygen.mean.toFixed(2)}\n`;
      } else {
        preambleText += `[DATA CONTEXT]\n(No matching data found)\n`;
      }
    } else {
      preambleText += `[DATA CONTEXT]\n(No coordinates detected in the user's message and no region selected on the map.)\n`;
    }

    if (retrievedDocsList.length > 0) {
      preambleText += `\n[REFERENCE CONTEXT]\n`;
      retrievedDocsList.forEach((passage, idx) => {
        preambleText += `${idx + 1}. ${passage}\n`;
      });
    }
    preambleText += `=====================\n`;

    console.log(`[DEBUG /ai/chat] Preamble: ${preambleText.substring(0, 300)}...`);

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      })),
      {
        role: 'user',
        content: `${preambleText}\n\nUser Question:\n${messages[messages.length - 1]?.content || ''}`
      }
    ];

    const completion = await groq.chat.completions.create({
      messages: chatMessages,
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      max_tokens: 500
    });

    const text = completion.choices[0]?.message?.content || '';
    console.log(`[DEBUG /ai/chat] AI response: ${text.substring(0, 200)}...`);
    
    // Return extracted coordinates so the frontend can trigger the Visualization Panel
    const responsePayload = { text };
    if (extractedLat !== null && extractedLon !== null) {
      if (isFallback && nearestLat !== null && nearestLon !== null) {
        // If we fell back to nearest points, open the visualization panel at that nearest location
        responsePayload.extractedCoords = { lat: nearestLat, lon: nearestLon };
      } else {
        responsePayload.extractedCoords = { lat: extractedLat, lon: extractedLon };
      }
    }
    
    res.json(responsePayload);
  } catch (err) {
    console.error('Chat handler failed:', err);

    res.status(500).json({ error: 'An error occurred while communicating with the Groq AI service.' });
  }
});

app.get("/everything", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * FROM t1 ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 100"
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
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return res.status(400).json({ error: 'lat and lon parameters must be valid numbers' });
  }
  const dbLon = lonNum < 0 ? lonNum + 360 : lonNum;
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
      "SELECT latitude, longitude, temperature FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
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
      "SELECT latitude, longitude, pressure FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND pressure IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
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
      "SELECT latitude, longitude, salinity FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
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
      "SELECT latitude, longitude, oxygen FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
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
      "SELECT latitude, longitude, nitrate FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND nitrate IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
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
      "SELECT latitude, longitude, depth FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
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

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(rangeNum)) {
      return res.status(400).json({ error: "lat, lon, rangeDeg (numbers) are required" });
    }

    const dbLon = lonNum < 0 ? lonNum + 360 : lonNum;

    const latMin = latNum - rangeNum;
    const latMax = latNum + rangeNum;
    const lonMin = dbLon - rangeNum;
    const lonMax = dbLon + rangeNum;

    const result = await client.query(
      `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
       FROM t1
       WHERE latitude BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4
         AND depth IS NOT NULL
       ORDER BY time_ts ASC, depth ASC
       LIMIT 5000`,
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
      "SELECT latitude, longitude, time_ts FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL ORDER BY time_ts ASC, latitude ASC, longitude ASC LIMIT 5000"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error in /time:', err);
    res.status(500).json({ error: 'Failed to retrieve timeseries metadata.' });
  }
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

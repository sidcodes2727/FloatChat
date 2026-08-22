require('dotenv').config();
const express = require("express");
const client = require("./database/db");
const { fetchObisSpecies } = require("./services/obis_service");
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

const SYSTEM_PROMPT = `You are floatCHAT, the expert oceanographic AI research assistant embedded in FloatChat — a deep-ocean visualization dashboard powered by real ARGO float data.

## Your Role & Capabilities
Help users explore physical, chemical, and biological oceanography by synthesizing:
1. **ARGO Float Data (Data Context)**: Temperature (°C), Salinity (PSU), Depth (m), and Dissolved Oxygen (µmol/kg).
2. **Marine Biology & Ecosystem Science**: Insights on marine vegetation (phytoplankton, seagrasses, kelp, macroalgae), marine life (pelagic fish, coral reefs, benthic fauna, migratory species), and primary productivity.
3. **Physical & Chemical Oceanography**: Thermocline depth, halocline layer, upwelling dynamics, Oxygen Minimum Zones (OMZs), and water mass characteristics.

## Answer Structure & Guidelines
Provide well-structured, clear, and informative answers using markdown formatting:
1. **Summary & Key Metrics**: Present observed ARGO data clearly with units (°C, PSU, µmol/kg, m).
2. **Oceanographic Analysis**: Explain physical patterns (e.g. thermocline layer, salinity gradients, oxygen concentration at depth).
3. **Ecosystem & Marine Life Insights**:
   - **Marine Vegetation / Primary Production**: Explain photic zone constraints (0–200m depth where sunlight enables photosynthesis by phytoplankton & algae), nutrient availability, and upwelling impact.
   - **Marine Fauna & Biodiversity**: Explain how ocean temperatures and dissolved oxygen levels support marine life (e.g. fish species, marine mammals, coral habitats, or deep-sea organisms affected by hypoxic OMZs).
4. **Comparative Analysis**: When multiple locations are mentioned, contrast temperature, salinity, oxygen levels, and ecological traits between the regions.

## Core Rules
1. Ground actual physical data claims in the provided DATA CONTEXT. Never invent specific numerical float measurements not given to you.
2. If approximate nearby data is provided, use it constructively (e.g., "Nearest observations ~X° away indicate...").
3. Use established oceanographic & marine biological knowledge for explaining ecosystems, vegetation, and species behavior.
4. Format responses cleanly with bolding, bullet points, and subheadings where helpful. Keep explanations clear, engaging, and scientifically accurate.`;

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

    // Check for named ocean region first
    const namedRegion = resolveNamedRegion(lastUserMessage);
    if (namedRegion) {
      console.log(`[CONTEXT-REGION] Resolved named region: ${namedRegion.name}`);
      extractedLat = namedRegion.centerLat;
      extractedLon = namedRegion.centerLon;
      latNum = namedRegion.centerLat;
      lonNum = namedRegion.centerLon;
    }

    if (!namedRegion) {
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


    // Retrieve OBIS Marine Biodiversity data
    let obisSummary = '';
    try {
      const obisData = await fetchObisSpecies(latNum, lonNum, rangeNum, 35);
      if (obisData && obisData.summaryText) {
        obisSummary = obisData.summaryText;
      }
    } catch (err) {
      console.error('[OBIS] Error in chat_context:', err.message);
    }

    if (obisSummary) {
      preambleText += `\n[OBIS BIODIVERSITY CONTEXT]\n${obisSummary}\n`;
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
      max_tokens: 2000
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
    let resolvedRangeDeg = 2; // default range

    // Normalize degree-like characters: °, ˚, º, and unicode variants
    const normalizedText = lastUserMessage.replace(/[°˚º]/g, ' ').replace(/\u200B/g, '');

    // Check for named ocean region first
    const namedRegion = resolveNamedRegion(lastUserMessage);
    if (namedRegion) {
      console.log(`[AUTO-EXTRACT] Resolved named region: ${namedRegion.name}`);
      extractedLat = namedRegion.centerLat;
      extractedLon = namedRegion.centerLon;
      resolvedRangeDeg = namedRegion.rangeDeg;
    }

    if (!namedRegion) {
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
    }

    console.log(`[AUTO-EXTRACT] normalizedText snippet: "${normalizedText.substring(0, 150)}"`);
    console.log(`[AUTO-EXTRACT] extractedLat=${extractedLat}, extractedLon=${extractedLon}`);

    let preambleText = `=== CONTEXT BLOCK ===\n`;
    let isFallback = false;
    let nearestLat = null;
    let nearestLon = null;

    // If we extracted coordinates, auto-query the database
    if (Number.isFinite(extractedLat) && Number.isFinite(extractedLon) &&
        Math.abs(extractedLat) <= 90) {
      console.log(`[AUTO-EXTRACT] Detected coordinates: Lat=${extractedLat}, Lon=${extractedLon}`);
      
      const dbLon = extractedLon < 0 ? extractedLon + 360 : extractedLon;
      const rangeNum = resolvedRangeDeg;
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
      // Retrieve OBIS Marine Biodiversity data for extracted region
      try {
        const obisData = await fetchObisSpecies(extractedLat, extractedLon, resolvedRangeDeg, 35);
        if (obisData && obisData.summaryText) {
          preambleText += `\n[OBIS BIODIVERSITY CONTEXT]\n${obisData.summaryText}\n`;
        }
      } catch (err) {
        console.error('[OBIS] Error in /ai/chat:', err.message);
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
      max_tokens: 2000
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

// ── Compare endpoint: fetch profile data for multiple locations ──────────────
// Body: { locations: [{ lat, lon, label }, ...] }
app.post('/compare', async (req, res) => {
  try {
    const { locations = [] } = req.body || {};
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'locations array is required' });
    }
    if (locations.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 locations allowed for comparison' });
    }

    const results = await Promise.all(locations.map(async (loc) => {
      const latNum = parseFloat(loc.lat);
      const lonNum = parseFloat(loc.lon);
      const rangeDeg = parseFloat(loc.rangeDeg) || 2;

      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        return { label: loc.label || 'Unknown', lat: latNum, lon: lonNum, records: [], error: 'Invalid coordinates' };
      }

      const dbLon = lonNum < 0 ? lonNum + 360 : lonNum;
      const latMin = latNum - rangeDeg;
      const latMax = latNum + rangeDeg;
      const lonMin = dbLon - rangeDeg;
      const lonMax = dbLon + rangeDeg;

      try {
        const result = await client.query(
          `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
           FROM t1
           WHERE latitude BETWEEN $1 AND $2
             AND longitude BETWEEN $3 AND $4
             AND depth IS NOT NULL
           ORDER BY depth ASC
           LIMIT 2000`,
          [latMin, latMax, lonMin, lonMax]
        );
        const records = (result.rows || []).map(normalizeMetrics);

        // If no direct data, fall back to nearest
        if (records.length === 0) {
          const fallback = await client.query(
            `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
             FROM t1
             WHERE (temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL)
             ORDER BY ((latitude - $1)^2 + (longitude - $2)^2) ASC
             LIMIT 500`,
            [latNum, dbLon]
          );
          return {
            label: loc.label || `${latNum.toFixed(1)}, ${lonNum.toFixed(1)}`,
            lat: latNum, lon: lonNum,
            records: (fallback.rows || []).map(normalizeMetrics),
            isFallback: true
          };
        }

        return {
          label: loc.label || `${latNum.toFixed(1)}, ${lonNum.toFixed(1)}`,
          lat: latNum, lon: lonNum,
          records
        };
      } catch (e) {
        return { label: loc.label || 'Error', lat: latNum, lon: lonNum, records: [], error: e.message };
      }
    }));

    res.json({ locations: results });
  } catch (err) {
    console.error('Compare endpoint failed:', err);
    res.status(500).json({ error: 'Failed to compare locations.' });
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

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

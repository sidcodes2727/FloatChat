require('dotenv').config();
const express = require("express");
const client = require("./database/db");
const app = express();
const port = process.env.PORT || 3001;
const cors = require("cors");
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

// Unified Chat endpoint with natural language geocoding and Groq API
app.post('/ai/chat', async (req, res) => {
  console.log('Chat request received');
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set on server' });
    }
    const { messages = [] } = req.body || {};
    
    // Step 1: Extract intent and location from the last user message
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    let extractedLocs = [];
    let wantsData = true; // Default to true
    let extractedYear = null;

    if (lastUserMsg) {
      const extractPrompt = `Extract all locations mentioned in the text. Also determine if the user is asking for oceanographic data, statistics, measurements, or charts (set "wants_data" to true). If they are asking general questions (e.g. aquatic life, fishes, history) set "wants_data" to false.
If explicit latitude and longitude are provided, extract them as "lat" and "lon" (numbers).
If a region or place name is provided, extract it as "location_name".
If a specific year is mentioned (e.g., 2025, 2023), extract it as "year" (number). Otherwise set "year" to null.
Return ONLY a JSON object in this format: {"locations": [{"location_name": string | null, "lat": number | null, "lon": number | null, "rangeDeg": number | null}], "wants_data": boolean, "year": number | null}. If no location is found, return {"locations": [], "wants_data": false, "year": null}.

Text: "${lastUserMsg.content}"`;

      const extractResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: extractPrompt }],
          response_format: { type: "json_object" },
          temperature: 0
        })
      });
      
      if (extractResp.ok) {
        const extractData = await extractResp.json();
        try {
          const parsed = JSON.parse(extractData.choices[0].message.content);
          if (parsed.wants_data !== undefined) {
             wantsData = parsed.wants_data;
          }
          if (parsed.year !== undefined && parsed.year !== null) {
             extractedYear = Number(parsed.year);
          }
          // Only process locations if they actually want data
          if (wantsData) {
            if (parsed.locations && Array.isArray(parsed.locations)) {
               extractedLocs = parsed.locations;
            } else if (parsed.location_name || parsed.lat !== null) {
               extractedLocs = [parsed];
            }
          }
        } catch(e) {
          console.error("Failed to parse JSON from Groq", e);
        }
      }
    }

    let summaries = [];
    let totalRowsUsed = 0;

    for (let loc of extractedLocs) {
       let latNum = loc.lat !== null && loc.lat !== undefined ? parseFloat(loc.lat) : null;
       let lonNum = loc.lon !== null && loc.lon !== undefined ? parseFloat(loc.lon) : null;
       let rangeNum = loc.rangeDeg ? parseFloat(loc.rangeDeg) : 5;
       let locationName = loc.location_name || null;

       // Step 2: Geocode location name if provided but no lat/lon
       if (locationName && latNum === null) {
         const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
         const geoResp = await fetch(geoUrl, { headers: { 'User-Agent': 'FloatChatApp/1.0' } });
         if (geoResp.ok) {
           const geoData = await geoResp.json();
           if (geoData && geoData.length > 0) {
             latNum = parseFloat(geoData[0].lat);
             lonNum = parseFloat(geoData[0].lon);
             rangeNum = 5;
           }
         }
       }

       // Step 3: Fetch Data from Database if lat/lon is available
       if (latNum !== null && lonNum !== null && !isNaN(latNum) && !isNaN(lonNum)) {
         const latMin = latNum - rangeNum;
         const latMax = latNum + rangeNum;
         const lonMin = lonNum - rangeNum;
         const lonMax = lonNum + rangeNum;

         let q = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
                    FROM t1
                    WHERE latitude BETWEEN $1 AND $2
                      AND longitude BETWEEN $3 AND $4
                      AND (temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL)`;
         let params = [latMin, latMax, lonMin, lonMax];
         
         if (extractedYear) {
            q += ` AND EXTRACT(YEAR FROM time_ts) = $5`;
            params.push(extractedYear);
         }
         
         q += ` ORDER BY time_ts DESC, depth ASC LIMIT 500`;

         const dbRes = await client.query(q, params);
         let rows = (dbRes.rows || []).map(normalizeMetrics);
         
         // Fallback
         if (rows.length === 0) {
           let fallbackQ = `SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
                      FROM t1
                      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                        AND (temperature IS NOT NULL OR salinity IS NOT NULL OR oxygen IS NOT NULL)`;
           let fallbackParams = [latNum, lonNum];
           
           if (extractedYear) {
             fallbackQ += ` AND EXTRACT(YEAR FROM time_ts) = $3`;
             fallbackParams.push(extractedYear);
           }
           
           fallbackQ += ` ORDER BY ((latitude - $1)*(latitude - $1) + (longitude - $2)*(longitude - $2)) ASC LIMIT 100`;
           
           const fallbackRes = await client.query(fallbackQ, fallbackParams);
           rows = (fallbackRes.rows || []).map(normalizeMetrics);
         }

         const nums = (arr) => arr.filter(n => n !== null && n !== undefined).map(Number).filter(n => Number.isFinite(n));
         function stat(values) {
           const v = nums(values);
           if (!v.length) return null;
           const min = Math.min(...v), max = Math.max(...v);
           const mean = v.reduce((s, x) => s + x, 0) / v.length;
           return { count: v.length, min, max, mean: parseFloat(mean.toFixed(2)) };
         }
         
         if (rows.length > 0) {
           totalRowsUsed += rows.length;
           summaries.push({
             region: { name: locationName || "Custom Coordinates", center: { lat: latNum, lon: lonNum }, rangeDeg: rangeNum, year: extractedYear || "All Years" },
             totals: rows.length,
             depth: stat(rows.map(r => r.depth)),
             temperature: stat(rows.map(r => r.temperature)),
             salinity: stat(rows.map(r => r.salinity)),
             oxygen: stat(rows.map(r => r.oxygen)),
             points: rows.slice(0, 300) // Send up to 300 points for frontend area charts
           });
         }
       }
    }

    // Step 4: Final Chat Generation
    let systemPrompt = "You are floatCHAT — your ocean data assistant. Answer very concisely (1-2 sentences). CRITICAL RULE: NEVER mention or include ARGO temperature, salinity, oxygen, or depth statistics in your answer unless the user EXPLICITLY asks for oceanographic data, measurements, or stats. If the user asks about aquatic life, fishes, animals, geography, or history, DO NOT append any ARGO data or numbers to your response. Answer naturally without stats.";
    if (summaries.length > 0) {
      // Strip raw points so we don't blow up the LLM token limit
      const llmContext = summaries.map(({ points, ...rest }) => rest);
      systemPrompt += `\n\nContext JSON (ONLY use this if the user specifically asks for data/stats. Otherwise, IGNORE it completely):\n${JSON.stringify(llmContext)}`;
    } else if (extractedLocs.length > 0) {
      const locNames = extractedLocs.map(l => l.location_name).filter(Boolean).join(", ");
      const yearStr = extractedYear ? ` for the year ${extractedYear}` : '';
      systemPrompt += `\n\nNo ocean data was found for the requested locations: ${locNames || 'coordinates provided'}${yearStr}.`;
    }

    const groqMessages = [{ role: 'system', content: systemPrompt }];
    messages.forEach(m => {
      // Don't inject system prompts into user messages, just use normal roles
      if (m.role === 'user' || m.role === 'assistant') {
        groqMessages.push({ role: m.role, content: m.content });
      }
    });

    const finalResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: groqMessages,
        temperature: 0.3
      })
    });

    if (!finalResp.ok) {
      const errText = await finalResp.text();
      return res.status(500).json({ error: 'Groq API error', details: errText });
    }
    const data = await finalResp.json();
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text, usedRows: totalRowsUsed, plottingData: summaries });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message || 'Chat failed' });
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
    res.status(500).json({ error: err.message });
  }
});

app.get("/latlong", async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const result = await client.query(
      "SELECT * FROM t1 WHERE latitude=$1 AND longitude=$2 ORDER BY time_ts ASC, depth ASC LIMIT 50",
      [lat, lon]
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
      "SELECT latitude, longitude, temperature, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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
      "SELECT latitude, longitude, pressure, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND pressure IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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
      "SELECT latitude, longitude, salinity, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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
      "SELECT latitude, longitude, oxygen, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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
      "SELECT latitude, longitude, nitrate, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND nitrate IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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
      "SELECT latitude, longitude, depth, EXTRACT(YEAR FROM time_ts) as year FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND depth IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(rangeNum)) {
      return res.status(400).json({ error: "lat, lon, rangeDeg (numbers) are required" });
    }

    const latMin = latNum - rangeNum;
    const latMax = latNum + rangeNum;
    const lonMin = lonNum - rangeNum;
    const lonMax = lonNum + rangeNum;

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
    res.status(500).json({ error: err.message });
  }
});

app.get("/time", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT latitude, longitude, time_ts FROM t1 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND time_ts IS NOT NULL ORDER BY time_ts DESC LIMIT 20000"
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

/**
 * OBIS (Ocean Biodiversity Information System) API Integration
 * API Base: https://api.obis.org/v3
 */

/**
 * Build WKT POLYGON bounding box string from lat, lon, rangeDeg
 */
function buildWktPolygon(lat, lon, rangeDeg = 5) {
    const minLat = Math.max(-90, lat - rangeDeg);
    const maxLat = Math.min(90, lat + rangeDeg);
    
    // Normalize longitudes to [-180, 180]
    let minLon = lon - rangeDeg;
    let maxLon = lon + rangeDeg;
    
    // Clamp or wrap
    if (minLon < -180) minLon = -180;
    if (maxLon > 180) maxLon = 180;

    return `POLYGON((${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat}))`;
}

/**
 * Categorize taxon by Phylum / Kingdom / Class
 */
function categorizeTaxon(item) {
    const phylum = (item.phylum || '').toLowerCase();
    const kingdom = (item.kingdom || '').toLowerCase();
    const className = (item.class || '').toLowerCase();

    if (phylum === 'chordata' || className.includes('actinopterygii') || className.includes('elasmobranchii')) {
        return 'Fish & Vertebrates';
    }
    if (phylum === 'cnidaria' || className.includes('anthozoa')) {
        return 'Corals & Jellyfish';
    }
    if (phylum === 'mollusca') {
        return 'Mollusks & Shellfish';
    }
    if (phylum === 'arthropoda' || className.includes('malacostraca') || className.includes('hexanauplia')) {
        return 'Crustaceans & Zooplankton';
    }
    if (
        phylum === 'chlorophyta' || 
        phylum === 'rhodophyta' || 
        phylum === 'ochrophyta' || 
        phylum === 'tracheophyta' ||
        kingdom === 'plantae' ||
        kingdom === 'chromista'
    ) {
        return 'Marine Vegetation & Algae';
    }
    if (phylum === 'echinodermata') {
        return 'Echinoderms (Starfish/Urchins)';
    }
    if (phylum === 'porifera') {
        return 'Sponges';
    }
    return 'Other Plankton & Microorganisms';
}

/**
 * Fetch marine biodiversity occurrences from OBIS API v3
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} rangeDeg - Bounding box range in degrees
 * @param {number} size - Maximum records to fetch
 */
async function fetchObisSpecies(lat, lon, rangeDeg = 5, size = 40) {
    try {
        const wkt = buildWktPolygon(lat, lon, rangeDeg);
        const encodedWkt = encodeURIComponent(wkt);
        const url = `https://api.obis.org/v3/occurrence?geometry=${encodedWkt}&size=${size}`;

        console.log(`[OBIS] Fetching species for Lat=${lat}, Lon=${lon} (range=${rangeDeg}°)...`);
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.error(`[OBIS] API error HTTP ${res.status}`);
            return null;
        }

        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
            return {
                totalCount: 0,
                categories: {},
                speciesList: [],
                summaryText: `No recorded OBIS species occurrences found in Lat=${lat}, Lon=${lon} (±${rangeDeg}°).`
            };
        }

        // Aggregate and deduplicate species
        const speciesMap = new Map();
        const categoryMap = {
            'Fish & Vertebrates': [],
            'Marine Vegetation & Algae': [],
            'Corals & Jellyfish': [],
            'Crustaceans & Zooplankton': [],
            'Mollusks & Shellfish': [],
            'Echinoderms (Starfish/Urchins)': [],
            'Sponges': [],
            'Other Plankton & Microorganisms': []
        };

        for (const r of results) {
            const sciName = r.scientificName || r.species || r.genus;
            if (!sciName) continue;

            const category = categorizeTaxon(r);
            const commonName = r.vernacularName || r.common_name || null;

            if (!speciesMap.has(sciName)) {
                const entry = {
                    scientificName: sciName,
                    commonName: commonName,
                    category: category,
                    family: r.family || null,
                    order: r.order || null,
                    phylum: r.phylum || null,
                    count: 1
                };
                speciesMap.set(sciName, entry);
                if (categoryMap[category]) {
                    categoryMap[category].push(entry);
                }
            } else {
                const existing = speciesMap.get(sciName);
                existing.count += 1;
                if (!existing.commonName && commonName) existing.commonName = commonName;
            }
        }

        const speciesList = Array.from(speciesMap.values());

        // Format summary text for RAG AI context
        let summaryText = `OBIS Marine Biodiversity Context for Lat=${lat}, Lon=${lon} (±${rangeDeg}°):\n`;
        summaryText += `Total unique species sampled: ${speciesList.length} (from ${results.length} occurrence records)\n\n`;

        for (const [catName, list] of Object.entries(categoryMap)) {
            if (list.length > 0) {
                summaryText += `• ${catName} (${list.length} species):\n`;
                list.slice(0, 5).forEach(sp => {
                    const cNameStr = sp.commonName ? ` ("${sp.commonName}")` : '';
                    summaryText += `  - ${sp.scientificName}${cNameStr}\n`;
                });
            }
        }

        return {
            totalRecords: results.length,
            uniqueSpeciesCount: speciesList.length,
            categories: categoryMap,
            speciesList: speciesList,
            summaryText: summaryText
        };
    } catch (err) {
        console.error('[OBIS] Exception during fetch:', err.message);
        return null;
    }
}

module.exports = {
    fetchObisSpecies,
    buildWktPolygon
};

const client = require('../database/db');

async function main() {
  await client.connect();
  console.log("Connected to database.");

    // Using a 7-day lookback to get a large global snapshot of recent profiles.
    const url = "https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.json?platform_number,time,latitude,longitude,pres,temp,psal&time>=max(time)-7days";
    
    console.log(`Fetching data from: ${url}`);
    console.log("This might take a minute depending on the download size...");
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      
      // Check structure
      if (!data.table || !data.table.rows) {
          throw new Error("Invalid data format received.");
      }
      
      const rows = data.table.rows;
      console.log(`Received ${rows.length} records. Inserting into database...`);
      
      await client.query('BEGIN');
      
      // Reset the ID sequence in case it's out of sync
      await client.query("SELECT setval(pg_get_serial_sequence('t1', 'id'), coalesce(max(id), 0) + 1, false) FROM t1;");
      
      let inserted = 0;
    for (let i = 0; i < rows.length; i++) {
        // columns: ["platform_number", "time", "latitude", "longitude", "pres", "temp", "psal"]
        const row = rows[i];
        const timeStr = row[1];
        const lat = row[2];
        const lon = row[3];
        const pres = row[4];
        const temp = row[5];
        const psal = row[6];
        
        // Skip if critical values are missing or NaN
        if (lat == null || lon == null || temp == null || psal == null || pres == null) {
            continue;
        }
        
        // Insert into table (ERDDAP returns time in ISO string format which postgres handles natively)
        await client.query(
          `INSERT INTO t1 (temperature, latitude, longitude, pressure, salinity, time_ts)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [temp, lat, lon, pres, psal, timeStr]
        );
        
        inserted++;
        if (inserted % 20000 === 0) {
            console.log(`Inserted ${inserted} rows...`);
        }
    }
    
    await client.query('COMMIT');
    console.log(`Success! Inserted ${inserted} global Argo float records.`);
    
  } catch (error) {
    console.error("Error during ingestion:", error.message || error);
    try {
        await client.query('ROLLBACK');
    } catch(e) {}
  } finally {
    await client.end();
  }
}

main();

const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_lsLN3He7pKSF@ep-autumn-shape-az4yd3d6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});
async function run() {
  await client.connect();
  const latNum = 10.02;
  const lonNum = -52.49;
  const rangeNum = 5;
  let dbLon = lonNum < 0 ? lonNum + 360 : lonNum;
  const effectiveRange = rangeNum === 0 ? 0.01 : rangeNum;
  const latMin = latNum - effectiveRange;
  const latMax = latNum + effectiveRange;
  const lonMin = dbLon - effectiveRange;
  const lonMax = dbLon + effectiveRange;
  
  console.log({ latMin, latMax, lonMin, lonMax });

  const res = await client.query(`SELECT latitude, longitude, depth, temperature, salinity, oxygen, time_ts
       FROM t1
       WHERE latitude BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4
         AND depth IS NOT NULL
         AND time_ts IS NOT NULL
       ORDER BY time_ts ASC, depth ASC`, [latMin, latMax, lonMin, lonMax]);
  console.log('Result count:', res.rows.length);
  await client.end();
}
run();

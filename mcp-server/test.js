import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

async function main() {
    console.log("Setting up MCP Client to test index.js...");

    // Setup client transport to run 'node index.js' as a child process
    const transport = new StdioClientTransport({
        command: 'node',
        args: [path.join(process.cwd(), 'index.js')],
        env: process.env // Pass down process.env to ensure it has DB access if needed (though it handles its own)
    });

    const client = new Client({
        name: "test-client",
        version: "1.0.0"
    });

    await client.connect(transport);
    console.log("Connected to MCP server.\n");

    try {
        console.log("--- Testing query_argo_stats ---");
        // Sending arbitrary point that will likely hit the nearest-neighbor fallback 
        // because 99, 99 is on land or has no floats. Or we could test 0, 0.
        const statsResult = await client.callTool({
            name: "query_argo_stats",
            arguments: { lat: 0, lon: 0, radius_deg: 5 }
        });
        console.log("Result:\n", JSON.stringify(statsResult, null, 2), "\n");

        console.log("--- Testing vector_search ---");
        const searchResult = await client.callTool({
            name: "vector_search",
            arguments: { query_text: "what is a thermocline?", top_k: 2 }
        });
        console.log("Result:\n", JSON.stringify(searchResult, null, 2), "\n");

        console.log("--- Testing get_regional_timeseries ---");
        const timeseriesResult = await client.callTool({
            name: "get_regional_timeseries",
            arguments: { lat: 0, lon: 0, radius_deg: 5 }
        });
        // We only log a small portion of the output to prevent console flood
        const parsedTimeseries = JSON.parse(timeseriesResult.content[0].text);
        console.log(`Result: ${parsedTimeseries.length} points returned.`);
        console.log("First item:\n", JSON.stringify(parsedTimeseries[0], null, 2), "\n");

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await transport.close();
        console.log("Transport closed. Tests complete.");
    }
}

main().catch(console.error);

const { ChromaClient } = require('chromadb');

// Note: To run this script, you must have a ChromaDB server running locally.
// The easiest way is via Docker:
// docker run -p 8000:8000 chromadb/chroma
// Or using Python:
// pip install chromadb
// chroma run --path ./chroma_data

const client = new ChromaClient({
    path: "http://localhost:8000"
});

const oceanMetadata = [
    {
        id: "doc1",
        text: "ARGO floats are autonomous profiling floats used to measure ocean water properties like temperature, salinity, and pressure across the world's oceans.",
        metadata: { category: "definition", topic: "argo" }
    },
    {
        id: "doc2",
        text: "BGC (Bio-Geo-Chemical) floats are an extension of the ARGO program. In addition to temperature and salinity, they measure oxygen, nitrate, pH, chlorophyll-a, and suspended particles.",
        metadata: { category: "definition", topic: "bgc" }
    },
    {
        id: "doc3",
        text: "Salinity is the saltiness or dissolved salt content of a body of water. In oceanography, it is often measured in Practical Salinity Units (PSU).",
        metadata: { category: "definition", topic: "salinity" }
    },
    {
        id: "doc4",
        text: "The Arabian Sea is a region of the northern Indian Ocean bounded on the north by Pakistan and Iran, on the west by the Gulf of Aden, Guardafui Channel and the Arabian Peninsula, and on the east by India.",
        metadata: { category: "geography", topic: "arabian_sea" }
    },
    {
        id: "doc5",
        text: "NetCDF (Network Common Data Form) is a set of software libraries and self-describing, machine-independent data formats that support the creation, access, and sharing of array-oriented scientific data.",
        metadata: { category: "definition", topic: "netcdf" }
    },
    {
        id: "doc6",
        text: "Ocean depth is measured in meters. Pressure increases by about 1 decibar (dbar) for every meter of depth. Therefore, pressure is often used as a proxy for depth.",
        metadata: { category: "science", topic: "depth_pressure" }
    }
];

async function setupVectorDB() {
    console.log("Connecting to ChromaDB...");
    try {
        // Heartbeat to check if server is running
        await client.heartbeat();
        console.log("Connected successfully!");

        console.log("Creating/Getting collection 'ocean_metadata'...");
        const collection = await client.getOrCreateCollection({
            name: "ocean_metadata",
            metadata: { "description": "Oceanographic context for RAG" }
        });

        console.log("Embedding and storing documents...");
        
        const ids = oceanMetadata.map(doc => doc.id);
        const documents = oceanMetadata.map(doc => doc.text);
        const metadatas = oceanMetadata.map(doc => doc.metadata);

        await collection.upsert({
            ids: ids,
            documents: documents,
            metadatas: metadatas,
        });

        console.log("Vector DB setup complete! Stored", documents.length, "documents.");
        
        const count = await collection.count();
        console.log(`Collection now contains ${count} documents.`);
    } catch (err) {
        console.error("Error setting up ChromaDB. Make sure the Chroma server is running on http://localhost:8000!");
        console.error(err.message);
    }
}

setupVectorDB();

const DIRECTUS_URL = "http://goatedcodoer:8091";
const DIRECTUS_TOKEN = "rTilKSsclzuQW8WfQWK1ba8wrD_LetNn";

async function run() {
    try {
        const headers = { Authorization: `Bearer ${DIRECTUS_TOKEN}` };

        // Check division collection
        console.log("=== Checking division collection ===");
        const resDiv = await fetch(`${DIRECTUS_URL}/items/division?limit=1`, { headers });
        if (resDiv.ok) {
            const jsonDiv = await resDiv.json();
            console.log("Division sample:", JSON.stringify(jsonDiv.data?.[0], null, 2));
        } else {
            console.log("Division collection not found or forbidden, status:", resDiv.status);
        }

        // Check salesman collection fields
        console.log("\n=== Checking salesman collection ===");
        const resSalesman = await fetch(`${DIRECTUS_URL}/items/salesman?limit=1`, { headers });
        const jsonSalesman = await resSalesman.json();
        console.log("Salesman sample:", JSON.stringify(jsonSalesman.data?.[0], null, 2));

        // Check customer collection fields
        console.log("\n=== Checking customer collection ===");
        const resCustomer = await fetch(`${DIRECTUS_URL}/items/customer?limit=1`, { headers });
        const jsonCustomer = await resCustomer.json();
        console.log("Customer sample:", JSON.stringify(jsonCustomer.data?.[0], null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

run();

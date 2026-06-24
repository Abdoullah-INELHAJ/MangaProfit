const urls = [
    "https://www.vinted.fr/catalog?search_text=one+piece&catalog[]=1058",
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_id=1058",
    "https://www.vinted.fr/catalog?search_text=one+piece&catalog_id=1058",
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_ids=1058",
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_ids[]=1058"
];

async function test() {
    for (const url of urls) {
        try {
            console.log(`\nTesting: ${url}`);
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "fr-FR,fr;q=0.9"
                }
            });
            const html = await res.text();
            const index = html.indexOf('\\"items\\":[]');
            if (index !== -1) {
                console.log("No items found.");
                continue;
            }
            const itemIndex = html.indexOf('\\"items\\":[');
            if (itemIndex !== -1) {
                const startIndex = itemIndex + 10;
                let bracketCount = 0;
                let endIndex = -1;
                for (let i = startIndex; i < html.length; i++) {
                    const char = html[i];
                    if (char === '[') bracketCount++;
                    else if (char === ']') {
                        bracketCount--;
                        if (bracketCount === 0) { endIndex = i; break; }
                    }
                }
                let rawChunk = html.substring(startIndex, endIndex + 1);
                let processed = rawChunk
                    .replace(/\\\\"/g, '__ESCAPED_QUOTE__')
                    .replace(/\\"/g, '"')
                    .replace(/__ESCAPED_QUOTE__/g, '\\"')
                    .replace(/\\u003c/g, '<')
                    .replace(/\\u003e/g, '>')
                    .replace(/\\u0026/g, '&')
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\\\/g, '\\');
                const items = JSON.parse(processed);
                console.log(`Status: ${res.status}. Found ${items.length} items.`);
                console.log("First 3 titles:");
                items.slice(0, 3).forEach(item => {
                    console.log(` - ${item.title} (Brand: ${item.brand_title || 'N/A'}, Path: ${item.path})`);
                });
            } else {
                console.log("Items pattern not found.");
            }
        } catch (err) {
            console.error("Error:", err.message);
        }
    }
}

test();

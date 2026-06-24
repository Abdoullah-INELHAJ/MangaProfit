const urlOptions = [
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_id=1058", // Default
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_id=1058&order=newest_first",
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_id=1058&order=newest",
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_id=1058&sort_by=newest_first",
    "https://www.vinted.fr/vetements?search_text=one+piece&catalog_id=1058&sort=newest"
];

async function testSorts() {
    for (const url of urlOptions) {
        try {
            console.log(`\nURL: ${url}`);
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "fr-FR,fr;q=0.9"
                }
            });
            const html = await res.text();
            const index = html.indexOf('\\"items\\":[');
            if (index !== -1) {
                const startIndex = index + 10;
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
                const ids = items.slice(0, 10).map(item => item.id);
                console.log("First 10 item IDs:", ids);
                // Check if IDs are strictly descending
                let isSorted = true;
                for (let i = 0; i < ids.length - 1; i++) {
                    if (ids[i] < ids[i+1]) {
                        isSorted = false;
                        break;
                    }
                }
                console.log("Are IDs sorted descending? (Newest first):", isSorted);
            } else {
                console.log("No items found");
            }
        } catch (err) {
            console.error("Error:", err.message);
        }
    }
}

testSorts();

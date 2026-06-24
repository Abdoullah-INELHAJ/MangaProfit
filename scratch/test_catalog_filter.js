async function checkCatalogFilter() {
    const url = "https://www.vinted.fr/vetements?search_text=one+piece&catalog[]=1058";
    console.log("Fetching URL:", url);
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "fr-FR,fr;q=0.9"
            }
        });
        const html = await res.text();
        const index = html.indexOf('\\"items\\":[');
        if (index !== -1) {
            console.log("Items found! Status:", res.status);
            // Let's see the first item
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
            console.log(`Parsed ${items.length} items from catalog filter.`);
            if (items.length > 0) {
                console.log("Item 1 Title:", items[0].title);
            }
        } else {
            console.log("No items found or failed.");
        }
    } catch (err) {
        console.error(err);
    }
}
checkCatalogFilter();

async function test() {
    const queries = [
        "https://www.vinted.fr/api/v2/catalog/items?search_text=one+piece&per_page=5",
        "https://www.vinted.be/api/v2/catalog/items?search_text=one+piece&per_page=5",
        "https://www.vinted.fr/vetements?search_text=one+piece",
        "https://www.vinted.be/vetements?search_text=one+piece"
    ];
    
    for (const url of queries) {
        try {
            console.log(`\nTesting URL: ${url}`);
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "fr-FR,fr;q=0.9"
                }
            });
            console.log(`Status: ${res.status}`);
            const text = await res.text();
            console.log(`Length: ${text.length}`);
            console.log(`Sample: ${text.substring(0, 300)}`);
        } catch (err) {
            console.error(`Error for ${url}:`, err);
        }
    }
}

test();

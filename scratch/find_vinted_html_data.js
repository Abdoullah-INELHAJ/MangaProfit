const fs = require('fs');

async function checkHtml() {
    try {
        console.log("Fetching search page...");
        const res = await fetch("https://www.vinted.fr/vetements?search_text=one+piece", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "fr-FR,fr;q=0.9"
            }
        });
        const html = await res.text();
        console.log("HTML length:", html.length);
        
        // Find scripts containing JSON or state data
        const regexes = [
            /window\.__INITIAL_STATE__\s*=\s*({.+?});/,
            /<script[^>]*type="application\/json"[^>]*class="js-react-on-rails-component"[^>]*>([\s\S]+?)<\/script>/,
            /<script id="[^"]*" type="application\/json">([\s\S]+?)<\/script>/,
            /data-react-class="[^"]*" data-react-props="([^"]+)"/
        ];
        
        for (let i = 0; i < regexes.length; i++) {
            const match = html.match(regexes[i]);
            if (match) {
                console.log(`\nMatch found for regex index ${i}:`);
                console.log(`Content sample (300 chars):`, match[1].substring(0, 300));
                
                // Write to a temporary file for analysis
                fs.writeFileSync("C:\\Users\\Pavillon\\Projet Antigravity\\AchatReventeVintedManga\\scratch\\extracted_data.txt", match[1], 'utf8');
                console.log("Written extracted match to scratch\\extracted_data.txt");
                break;
            }
        }
    } catch (err) {
        console.error(err);
    }
}

checkHtml();

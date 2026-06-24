const fs = require('fs');

async function analyze() {
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

        // Find all script tags in the HTML
        const scriptTags = [];
        const regex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const attrs = match[1];
            const content = match[2];
            scriptTags.push({ attrs, length: content.length, preview: content.substring(0, 100).trim() });
        }
        
        console.log(`Found ${scriptTags.length} script tags.`);
        scriptTags.forEach((s, idx) => {
            console.log(`Script ${idx}: attrs="${s.attrs}", length=${s.length}, preview="${s.preview}"`);
        });

        // Let's also check for specific strings
        const keywords = ["initial-state", "window.", "__INITIAL_STATE__", "z-index", "items", "catalogItems", "client-context"];
        keywords.forEach(kw => {
            console.log(`Occurrences of "${kw}":`, html.split(kw).length - 1);
        });

        // Write the HTML to file to analyze manually if needed (first 2MB)
        fs.writeFileSync("scratch/vinted_sample.html", html, "utf8");
        console.log("Wrote HTML to scratch/vinted_sample.html");
    } catch (err) {
        console.error(err);
    }
}

analyze();

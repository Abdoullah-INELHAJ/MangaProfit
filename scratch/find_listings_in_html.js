const fs = require('fs');

function search() {
    const html = fs.readFileSync("scratch/vinted_sample.html", "utf8");
    
    // Find all occurrences of "self.__next_f.push" and extract their contents
    const pushRegex = /self\.__next_f\.push\(\[1,\s*"([\s\S]*?)"\]\)/g;
    let match;
    let found = [];
    
    while ((match = pushRegex.exec(html)) !== null) {
        let str = match[1];
        // Unescape JSON-like escape sequences
        str = str.replace(/\\"/g, '"')
                 .replace(/\\n/g, '\n')
                 .replace(/\\u003c/g, '<')
                 .replace(/\\u003e/g, '>')
                 .replace(/\\u0026/g, '&');
        found.push(str);
    }
    
    console.log(`Found ${found.length} next_f.push items`);
    
    // Look for items: we can search for a common Vinted structure like "items" array, "price", "title"
    // Let's filter the next_f items by length or content
    found.forEach((content, idx) => {
        if (content.length > 5000) {
            console.log(`\n--- Large push block ${idx} (Length: ${content.length}) ---`);
            // Check if it contains keywords like "items", "title", "price", "url"
            const score = ["\"title\"", "\"price\"", "\"id\"", "\"user\"", "\"photos\""].filter(k => content.includes(k)).length;
            console.log(`Keywords found: ${score}/5`);
            if (score >= 3) {
                console.log("Looks like it contains items! Previewing first 1000 chars:");
                console.log(content.substring(0, 1000));
                
                // Let's search for JSON structures in this string
                // Write it to a file to examine
                fs.writeFileSync(`scratch/push_block_${idx}.json`, content, 'utf8');
                console.log(`Saved block ${idx} to scratch/push_block_${idx}.json`);
            }
        }
    });
}

search();

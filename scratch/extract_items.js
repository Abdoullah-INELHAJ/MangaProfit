const fs = require('fs');

function extractItems() {
    const html = fs.readFileSync("scratch/vinted_sample.html", "utf8");
    
    // Find the first occurrence of '"items":['
    const index = html.indexOf('"items":[');
    if (index === -1) {
        console.log("Could not find '\"items\":[' in HTML.");
        return;
    }
    
    console.log("Found '\"items\":[' at index", index);
    
    // We want the text starting with the bracket: '['
    const startIndex = index + 8; // length of '"items":'
    let bracketCount = 0;
    let endIndex = -1;
    
    for (let i = startIndex; i < html.length; i++) {
        const char = html[i];
        if (char === '[') {
            bracketCount++;
        } else if (char === ']') {
            bracketCount--;
            if (bracketCount === 0) {
                endIndex = i;
                break;
            }
        }
    }
    
    if (endIndex === -1) {
        console.log("Could not find matching closing bracket for items array.");
        return;
    }
    
    const itemsJsonStr = html.substring(startIndex, endIndex + 1);
    console.log("Extracted items JSON string length:", itemsJsonStr.length);
    
    // Clean up escaped backslashes if needed, but since it is inside a script tag
    // it might be serialized. Let's see if JSON.parse parses it directly.
    try {
        // Let's first clean any escape backslashes like \" inside Next.js data stream
        // Wait, Next.js serialize formats might have strings escaped as \" in JSON strings.
        // Let's try parsing directly first.
        let cleaned = itemsJsonStr;
        
        // Sometimes Next.js data streams use string escapes if the whole chunk is in a string literal.
        // Let's inspect the first 200 characters of itemsJsonStr
        console.log("Raw itemsJsonStr preview:", itemsJsonStr.substring(0, 300));
        
        // Let's parse. If it fails, we'll try to clean it.
        const items = JSON.parse(cleaned);
        console.log(`Successfully parsed! Found ${items.length} items.`);
        if (items.length > 0) {
            const first = items[0];
            console.log("Item 1 keys:", Object.keys(first));
            console.log("Item 1 example detail:");
            console.log("ID:", first.id);
            console.log("Title:", first.title);
            console.log("Price:", first.price);
            console.log("Photos:", first.photos ? first.photos.length : 0);
            if (first.photos && first.photos.length > 0) {
                console.log("Photo URL:", first.photos[0].url);
            }
            console.log("Url / path:", first.path);
        }
    } catch (err) {
        console.error("Direct JSON parse failed:", err.message);
        
        // Let's try resolving escape sequences
        try {
            // Next.js serializes JSON inside a string sometimes. If it's escaped, we can do:
            const unescaped = itemsJsonStr.replace(/\\"/g, '"')
                                           .replace(/\\\\/g, '\\')
                                           .replace(/\\n/g, '\n')
                                           .replace(/\\r/g, '\r');
            console.log("Unescaped preview:", unescaped.substring(0, 300));
            const items = JSON.parse(unescaped);
            console.log(`Unescaped parse success! Found ${items.length} items.`);
        } catch (err2) {
            console.error("Unescaped parse failed too:", err2.message);
        }
    }
}

extractItems();

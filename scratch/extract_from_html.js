const fs = require('fs');

function extract() {
    const html = fs.readFileSync("scratch/vinted_sample.html", "utf8");
    
    // Find the first occurrence of '\"items\":['
    const index = html.indexOf('\\"items\\":[');
    if (index === -1) {
        console.log("Could not find '\\\"items\\\":[' in HTML.");
        return;
    }
    
    console.log("Found '\\\"items\\\":[' at index", index);
    
    // The items array starts at the bracket: '['
    const startIndex = index + 10; // length of '\\"items\\":'
    let bracketCount = 0;
    let endIndex = -1;
    
    for (let i = startIndex; i < html.length; i++) {
        const char = html[i];
        // Handle escaped brackets in next_f format. Let's trace carefully:
        // Wait, inside next_f push string, brackets are NOT escaped, i.e. they are [ and ].
        // But double quotes are escaped as \"
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
    
    let rawChunk = html.substring(startIndex, endIndex + 1);
    console.log("Raw chunk length:", rawChunk.length);
    console.log("Raw chunk preview:", rawChunk.substring(0, 300));
    
    // Unescape next_f push string format
    // Double quotes are escaped as \" -> "
    // Forward slashes as \/ -> /
    // Control characters or other backslashes like \\" -> \"
    let unescaped = rawChunk;
    
    // Let's replace \" with "
    // and \\ with \
    // Wait, let's write a standard decoder or JSON parse of a wrapped string
    try {
        // NextJS flight data uses JSON strings, we can decode it by wrapping in quotes and parsing if it's a simple string,
        // or we can just replace escaped characters.
        // Let's replace:
        // \\" -> \" (which is what we want for nested quotes, or maybe they become regular quotes if they are escaped)
        // Wait, let's look at the structure:
        // {"id":9243049180,"title":"Lot Cartes \\"Waifu\\" One Piece – Fan Art – Neuf"}
        // Inside the NextJS payload, a normal quote is escaped once: \"
        // An internal quote in a string is escaped twice: \\"
        // So we can do:
        // 1. replace \\" with some temporary token (e.g. __ESCAPED_QUOTE__)
        // 2. replace \" with "
        // 3. replace __ESCAPED_QUOTE__ with \"
        // 4. replace \\/ with /
        // 5. replace \\\\ with \\
        let processed = unescaped
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
        console.log(`Successfully parsed items! Count: ${items.length}`);
        if (items.length > 0) {
            console.log("First item details:");
            console.log("ID:", items[0].id);
            console.log("Title:", items[0].title);
            console.log("Price:", items[0].price);
            console.log("Path/URL:", items[0].path);
            console.log("Photo URL:", items[0].photo?.url || items[0].photos?.[0]?.url);
        }
    } catch (err) {
        console.error("Failed to parse processed chunk:", err.message);
    }
}

extract();

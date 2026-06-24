const fs = require('fs');

function inspect() {
    const html = fs.readFileSync("scratch/vinted_sample.html", "utf8");
    const index = html.indexOf('\\"items\\":[');
    if (index === -1) {
        console.log("Not found");
        return;
    }
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
    console.log("Item keys:", Object.keys(items[0]));
    console.log("Sample items (first 3):");
    items.slice(0, 3).forEach((item, i) => {
        console.log(`\nItem ${i}:`);
        console.log("ID:", item.id);
        console.log("Title:", item.title);
        console.log("Price:", item.price);
        console.log("Status / Condition:", item.status || item.item_box?.second_line || item.item_box?.accessibility_label);
        console.log("Path:", item.path);
        console.log("Photos:", item.photos ? item.photos.map(p => p.url) : null);
        console.log("Brand:", item.brand_title);
        console.log("Promoted?:", item.is_promoted);
        console.log("User:", item.user);
    });
}
inspect();

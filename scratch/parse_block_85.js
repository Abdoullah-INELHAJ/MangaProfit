const fs = require('fs');

function parse() {
    let content = fs.readFileSync("scratch/push_block_85.json", "utf8");
    
    // The content is a Next.js server actions / flight data chunk. It starts with something like `98:[...`
    // Let's strip the prefix (e.g., `98:`) to get a valid JSON string if possible.
    const colonIndex = content.indexOf(':');
    if (colonIndex !== -1 && colonIndex < 10) {
        content = content.substring(colonIndex + 1);
    }
    
    // Now let's try parsing it as JSON
    try {
        const parsed = JSON.parse(content);
        console.log("Successfully parsed JSON!");
        console.log("Type of root:", typeof parsed);
        if (Array.isArray(parsed)) {
            console.log("Root is an array of length:", parsed.length);
            // Let's inspect the elements
            // Usually it's ["$", "$L58", null, { ... }]
            const propsObj = parsed[3];
            if (propsObj) {
                console.log("Keys of propsObj:", Object.keys(propsObj));
                // Find where the items might be
                // We can search the object recursively
                const foundItems = findKeys(propsObj, "items");
                console.log("Found 'items' key locations:", foundItems.map(f => f.path));
                
                // Let's print the first item if found
                if (foundItems.length > 0) {
                    const items = foundItems[0].value;
                    if (Array.isArray(items)) {
                        console.log(`First items list has length: ${items.length}`);
                        if (items.length > 0) {
                            console.log("First item sample:", JSON.stringify(items[0], null, 2));
                        }
                    } else {
                        console.log("Items is not an array:", typeof items);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Failed to parse JSON directly:", err.message);
        // Let's search inside the text using regex
        console.log("Trying regex search...");
        const itemsRegex = /"items"\s*:\s*(\[[^\]]+\])/; // simplistic
        const match = content.match(itemsRegex);
        if (match) {
            console.log("Regex match found!");
            console.log(match[1].substring(0, 500));
        } else {
            // Let's do a broader check
            const index = content.indexOf('"items":[');
            if (index !== -1) {
                console.log("Found '\"items\":[' at index", index);
                console.log(content.substring(index, index + 1000));
            } else {
                console.log("Could not find '\"items\":['");
            }
        }
    }
}

function findKeys(obj, targetKey, path = "") {
    let results = [];
    if (!obj || typeof obj !== "object") return results;
    
    for (let key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        if (key === targetKey) {
            results.push({ path: currentPath, value: obj[key] });
        }
        if (typeof obj[key] === "object") {
            results = results.concat(findKeys(obj[key], targetKey, currentPath));
        }
    }
    return results;
}

parse();

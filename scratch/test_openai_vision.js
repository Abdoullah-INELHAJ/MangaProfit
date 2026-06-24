const fs = require('fs');


async function testVision() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("OpenAI API key not found in environment.");
        return;
    }

    // Two test URLs from Vinted
    const testCases = [
        {
            title: "Lot Cartes \"Waifu\" One Piece",
            imageUrl: "https://images1.vinted.net/t/01_000d8_L7unWNsuKSgc3GBd5rEXKQDk/f800/1782254731.webp?s=b56f1be70afa25e0a4375b82cb75d59a70b8624c",
            expected: "Should be classified as NOT a book (is cards)"
        },
        {
            title: "Manga one Piece 15-18 manga one Piece lot",
            imageUrl: "https://images1.vinted.net/t/06_01ff2_hyv23GcnwGQpXUgRPoKBJdiW/f800/1782319538.webp?s=00e14617a0f91cb2834ba7867bd072ffffe504a8",
            expected: "Should be classified as a book"
        }
    ];

    for (const testCase of testCases) {
        console.log(`\nTesting: "${testCase.title}" - Expected: ${testCase.expected}`);
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Analyze this Vinted listing image and its title: "${testCase.title}". Determine if the main product shown in the image is a book (manga volume, novel, comic book, or light novel). Respond strictly in JSON format with two keys: "is_book" (boolean) and "reason" (string, short explanation in French). Do not include any markdown formatting like \`\`\`json.`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: testCase.imageUrl
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 150,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content;
                console.log("Response:", JSON.parse(content));
            } else {
                console.log("Invalid response structure:", JSON.stringify(data));
            }
        } catch (err) {
            console.error("Vision request failed:", err);
        }
    }
}

// Simple dotenv fallback helper
const path = require('path');
try {
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
        const env = fs.readFileSync(envLocalPath, 'utf8');
        env.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                    value = value.replace(/\\n/gm, '\n');
                }
                process.env[key] = value.replace(/(^['"]|['"]$)/g, '');
            }
        });
    }
} catch (e) {}

testVision();

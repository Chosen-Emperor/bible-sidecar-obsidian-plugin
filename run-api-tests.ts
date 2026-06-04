import * as fs from 'fs';
import * as path from 'path';
import { request } from 'https';
import {
    compileCopyMessage,
    compileAutoExpandOutput,
    highlightGospelQuotes
} from "./utils";

// Colors for beautiful CLI output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    bold: "\x1b[1m"
};

console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
console.log(`${colors.cyan}${colors.bold}     API.Bible Translation Compliance Suite         ${colors.reset}`);
console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}\n`);

// ----------------------------------------------------
// LIGHT MOCK DOM IMPLEMENTATION
// ----------------------------------------------------
class ClassList {
    classes = new Set<string>();
    add(c: string) { this.classes.add(c); }
    contains(c: string) { return this.classes.has(c); }
}

class MockNode {
    nodeType: number; // 1 for Element, 3 for Text
    tagName = "";
    classList = new ClassList();
    attributes: Record<string, string> = {};
    textContent = "";
    childNodes: MockNode[] = [];
    parentNode: MockNode | null = null;
    nextSibling: MockNode | null = null;

    get parentElement(): MockNode | null {
        return this.parentNode;
    }

    getAttribute(name: string): string | null {
        return this.attributes[name] || null;
    }

    querySelectorAll(selector: string): MockNode[] {
        const results: MockNode[] = [];
        const recurse = (node: MockNode) => {
            if (node.nodeType === 1 && matchesSelector(node, selector)) {
                results.push(node);
            }
            node.childNodes.forEach(recurse);
        };
        recurse(this);
        return results;
    }

    querySelector(selector: string): MockNode | null {
        const matches = this.querySelectorAll(selector);
        return matches.length > 0 ? matches[0] : null;
    }

    remove() {
        if (this.parentNode) {
            const index = this.parentNode.childNodes.indexOf(this);
            if (index !== -1) {
                this.parentNode.childNodes.splice(index, 1);
                // rebuild nextSiblings
                for (let i = 0; i < this.parentNode.childNodes.length; i++) {
                    this.parentNode.childNodes[i].nextSibling = this.parentNode.childNodes[i + 1] || null;
                }
            }
        }
    }
}

function matchesSelector(node: MockNode, selector: string): boolean {
    const parts = selector.split(",");
    return parts.some(part => {
        part = part.trim();
        let tagName = "";
        let className = "";
        if (part.includes(".")) {
            const split = part.split(".");
            tagName = split[0].toLowerCase();
            className = split[1];
        } else {
            tagName = part.toLowerCase();
        }

        if (tagName && node.tagName !== tagName) return false;
        if (className && !node.classList.contains(className)) return false;
        return true;
    });
}

function parseHTML(html: string): MockNode {
    const root = new MockNode();
    root.nodeType = 1;
    root.tagName = "root";

    const stack: MockNode[] = [root];
    const regex = /(<\/?[a-zA-Z0-9:-]+(?:\s+[a-zA-Z0-9:-]+=(?:"[^"]*"|'[^']*'))*\s*\/?>)|([^<]+)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        if (match[1]) {
            const tagStr = match[1];
            if (tagStr.startsWith("</")) {
                if (stack.length > 1) {
                    stack.pop();
                }
            } else {
                const node = new MockNode();
                node.nodeType = 1;
                
                const tagNameMatch = tagStr.match(/<([a-zA-Z0-9:-]+)/);
                node.tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : "";

                const attrRegex = /([a-zA-Z0-9:-]+)=(?:"([^"]*)"|'([^']*)')/g;
                let attrMatch;
                while ((attrMatch = attrRegex.exec(tagStr)) !== null) {
                    const name = attrMatch[1];
                    const val = attrMatch[2] || attrMatch[3] || "";
                    node.attributes[name] = val;
                    if (name === "class") {
                        val.split(/\s+/).forEach(c => {
                            if (c) node.classList.add(c);
                        });
                    }
                }

                const parent = stack[stack.length - 1];
                node.parentNode = parent;
                
                if (parent.childNodes.length > 0) {
                    parent.childNodes[parent.childNodes.length - 1].nextSibling = node;
                }
                parent.childNodes.push(node);

                if (!tagStr.endsWith("/>") && !["br", "hr", "img", "input"].includes(node.tagName)) {
                    stack.push(node);
                }
            }
        } else if (match[2]) {
            const textContent = match[2];
            const node = new MockNode();
            node.nodeType = 3;
            node.textContent = textContent;
            
            const parent = stack[stack.length - 1];
            node.parentNode = parent;
            
            if (parent.childNodes.length > 0) {
                parent.childNodes[parent.childNodes.length - 1].nextSibling = node;
            }
            parent.childNodes.push(node);
        }
    }

    const computeTextContent = (node: MockNode): string => {
        if (node.nodeType === 3) return node.textContent;
        const text = node.childNodes.map(computeTextContent).join("");
        node.textContent = text;
        return text;
    };
    computeTextContent(root);

    return root;
}

// ----------------------------------------------------
// BIBLE PARSING FUNCTION
// ----------------------------------------------------
function parseApiBibleHtml(html: string): { verse: number; text: string }[] {
    const doc = parseHTML(html);
    const spans = doc.querySelectorAll("span.v");
    const versesArray: { verse: number; text: string }[] = [];
    
    spans.forEach((span) => {
        const verseNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
        if (verseNum === 0) return;
        
        let text = "";
        let next = span.nextSibling;
        if (!next && span.parentElement && span.parentElement.classList.contains("verse-span")) {
            next = span.parentElement.nextSibling;
        }
        while (next && !(next.nodeType === 1 && (next.classList.contains("v") || next.querySelector(".v")))) {
            text += next.textContent || "";
            next = next.nextSibling;
        }
        let cleanText = text.trim().replace(/\n+/g, " ");
        cleanText = cleanText.replace(/^\d+:\d+\s*/, "");

        versesArray.push({ verse: verseNum, text: cleanText });
    });
    
    return versesArray;
}

// ----------------------------------------------------
// HELPER FOR REQUESTS
// ----------------------------------------------------
function makeRequest(path: string, apiKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.scripture.api.bible',
            path,
            method: 'GET',
            headers: {
                'api-key': apiKey
            }
        };

        const req = request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject({ statusCode: res.statusCode, data });
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// ----------------------------------------------------
// MAIN RUNNER
// ----------------------------------------------------
async function main() {
    let apiKey = "";
    try {
        const dataPath = path.join(process.cwd(), "data.json");
        if (fs.existsSync(dataPath)) {
            const dataObj = JSON.parse(fs.readFileSync(dataPath, "utf8"));
            apiKey = dataObj.apiBibleKey || "";
        }
    } catch (err) {
        console.error("Error loading key from data.json:", err);
    }

    if (!apiKey) {
        console.error(`${colors.red}❌ Error: apiBibleKey not found in data.json.${colors.reset}`);
        process.exit(1);
    }

    console.log("Fetching bibles list from scripture.api.bible...");
    let bibles: any[] = [];
    try {
        const res = await makeRequest("/v1/bibles", apiKey);
        bibles = res.data || [];
    } catch (err: any) {
        console.error(`${colors.red}❌ Failed to fetch bibles list: ${err.message || JSON.stringify(err)}${colors.reset}`);
        process.exit(1);
    }

    console.log(`Found ${bibles.length} bibles. Testing compliance on each translation...`);
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    const batchSize = 10;
    for (let i = 0; i < bibles.length; i += batchSize) {
        const batch = bibles.slice(i, i + batchSize);
        await Promise.all(batch.map(async (bible) => {
            const bibleName = `${bible.name} (${bible.abbreviation || bible.id})`;
            try {
                // Fetch John 3 (JHN.3)
                const res = await makeRequest(`/v1/bibles/${bible.id}/chapters/JHN.3?include-verse-spans=true`, apiKey);
                const htmlContent = res.data?.content || "";

                if (!htmlContent) {
                    throw new Error("Empty HTML content returned by API");
                }

                // Feature 1: Parser compliance
                const parsedVerses = parseApiBibleHtml(htmlContent);
                if (parsedVerses.length === 0) {
                    throw new Error("Parser returned 0 verses");
                }

                // Check specifically for John 3:16 and 3:17
                const v16 = parsedVerses.find(v => v.verse === 16);
                const v17 = parsedVerses.find(v => v.verse === 17);

                if (!v16) throw new Error("Verse 16 missing in parsed output");
                if (!v17) throw new Error("Verse 17 missing in parsed output");

                if (!v16.text.trim()) throw new Error("Verse 16 text is empty");
                if (!v17.text.trim()) throw new Error("Verse 17 text is empty");

                if (v16.text.includes("<span") || v16.text.includes("<p")) {
                    throw new Error("Parsed verse text contains raw HTML tags: " + v16.text);
                }

                // Feature 2: Copy formatting compliance
                const mockCopySettings = {
                    copyVerseReference: true,
                    copyFormat: "plain",
                    verseReferenceStyle: "- ",
                    verseReferenceFormat: "full",
                    verseReferenceInternalLinking: false
                };
                const accumulatedText = `¹⁶ ${v16.text}\n¹⁷ ${v17.text}`;
                const copyMessage = compileCopyMessage("John", 3, accumulatedText, mockCopySettings);
                if (!copyMessage || !copyMessage.finalText.includes("John 3:16-17")) {
                    throw new Error("Copy formatting did not compile range reference correctly");
                }

                // Feature 3: Auto-expand compliance
                const mockAutoExpandSettings = {
                    gospelQuotesRed: true,
                    verseReferenceStyle: "- ",
                    autoExpandReferenceStyle_p: "plain",
                    autoExpandScriptureStyle_p: "plain"
                };
                const versesData = [
                    { verse: 16, text: v16.text },
                    { verse: 17, text: v17.text }
                ];
                const autoExpandOutput = compileAutoExpandOutput(versesData, "John", 3, "p", "[John 3:16-17](...)", mockAutoExpandSettings);
                if (!autoExpandOutput || !autoExpandOutput.includes("¹⁶")) {
                    throw new Error("Auto-expand formatting did not compile correctly");
                }

                // Feature 4: Gospel words in red compliance
                const redHighlightText = highlightGospelQuotes(`“${v16.text}”`, "John", true);
                if (v16.text.includes("“") || v16.text.includes("”") || v16.text.includes('"')) {
                    // If translation has quotes, check if highlight worked
                    const hasRedSpan = redHighlightText.includes('<span style="color: red;">');
                    if (!hasRedSpan && (v16.text.match(/“|”|"/g) || []).length >= 2) {
                        throw new Error("Gospel words in red did not style quotes");
                    }
                }

                passed++;
                console.log(`  ${colors.green}✓ Passed:${colors.reset} ${bibleName}`);
            } catch (err: any) {
                // If it is a 403 Forbidden or 404 Not Found, it means the key does not have access or translation lacks JHN, which is a warning/skip rather than compliance failure
                if (err.statusCode === 403 || err.statusCode === 404) {
                    skipped++;
                    console.log(`  ${colors.yellow}⚠ Skipped (Access restricted/Not found):${colors.reset} ${bibleName} - Status ${err.statusCode}`);
                } else {
                    failed++;
                    console.log(`  ${colors.red}✗ Failed:${colors.reset} ${bibleName} - ${err.message || JSON.stringify(err)}`);
                }
            }
        }));

        // Throttling delay to avoid hitting 60 req/min rate limit
        await new Promise(r => setTimeout(r, 250));
    }

    console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
    console.log(`COMPLIANCE TEST SUMMARY:`);
    console.log(`  Passed: ${colors.green}${passed}${colors.reset}`);
    console.log(`  Failed: ${colors.red}${failed}${colors.reset}`);
    console.log(`  Skipped: ${colors.yellow}${skipped}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log(`${colors.green}${colors.bold}🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉${colors.reset}\n`);
        process.exit(0);
    }
}

main().catch((e) => {
    console.error("Unhandled execution error:", e);
    process.exit(1);
});

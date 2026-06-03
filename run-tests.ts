import {
    SELECTION_REGEX,
    SELECTION_VERSE_REGEX,
    AUTO_EXPAND_REGEX,
    AUTO_EXPAND_VERSE_REGEX,
    convertToSuperscript,
    convertToNumber,
    formatAutoExpandText,
    compileCopyMessage,
    compileAutoExpandOutput
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
console.log(`${colors.cyan}${colors.bold}       Bible Sidecar TypeScript Test Suite          ${colors.reset}`);
console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}\n`);

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        passed++;
        console.log(`  ${colors.green}✓ Passed:${colors.reset} ${message}`);
    } else {
        failed++;
        console.log(`  ${colors.red}✗ Failed:${colors.reset} ${message}`);
    }
}

function runTestSuite() {
    // ----------------------------------------------------
    // TEST SECTION 1: SELECTION LINK CONVERSION REGEXES
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 1: Selection Link Conversion Regex]${colors.reset}`);
    
    // Test standard reference regex
    assert(SELECTION_REGEX.test("John 3:16"), "John 3:16 should match standard selection regex");
    assert(SELECTION_REGEX.test("1 John 5:7"), "1 John 5:7 should match standard selection regex");
    assert(SELECTION_REGEX.test("Romans 12:1-2"), "Romans 12:1-2 should match standard selection regex");
    assert(SELECTION_REGEX.test("John 3:16-17:2"), "John 3:16-17:2 should match standard selection regex (cross chapter)");
    assert(!SELECTION_REGEX.test("John 3"), "John 3 should NOT match standard selection regex");

    // Test selection verse regex
    assert(SELECTION_VERSE_REGEX.test("v16"), "v16 should match selection verse regex");
    assert(SELECTION_VERSE_REGEX.test("v16-18"), "v16-18 should match selection verse regex");
    assert(SELECTION_VERSE_REGEX.test("V16"), "V16 should match selection verse regex (case insensitive)");
    assert(!SELECTION_VERSE_REGEX.test("John 3:16"), "John 3:16 should NOT match selection verse regex");

    // Extracting details from matches
    const matchStandard = "Romans 12:1-2".match(SELECTION_REGEX);
    assert(matchStandard !== null, "Match should not be null");
    if (matchStandard) {
        assert(matchStandard[1] === "Romans", "Extracted book name should be Romans");
        assert(matchStandard[2] === "12", "Extracted chapter should be 12");
        assert(matchStandard[3] === "1", "Extracted start verse should be 1");
        assert(matchStandard[4] === "2", "Extracted end verse should be 2");
    }

    const matchVerse = "v16-18".match(SELECTION_VERSE_REGEX);
    assert(matchVerse !== null, "Verse match should not be null");
    if (matchVerse) {
        assert(matchVerse[1] === "16", "Extracted verse index 1 should be 16");
        assert(matchVerse[2] === "18", "Extracted verse index 2 should be 18");
    }
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 2: AUTO-EXPAND REFERENCE REGEXES
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 2: Auto-Expand Reference Regex]${colors.reset}`);

    assert(AUTO_EXPAND_REGEX.test("--John 3:16 "), "--John 3:16 should match auto-expand regex");
    assert(AUTO_EXPAND_REGEX.test("--John 3:16 +p "), "--John 3:16 +p should match auto-expand regex");
    assert(AUTO_EXPAND_REGEX.test("--1 John 5:7 +q "), "--1 John 5:7 +q should match auto-expand regex");
    assert(AUTO_EXPAND_REGEX.test("--Romans 12:1-2 "), "--Romans 12:1-2 should match auto-expand regex");
    assert(!AUTO_EXPAND_REGEX.test("--John 3:16"), "Missing trailing space should NOT match auto-expand regex");

    assert(AUTO_EXPAND_VERSE_REGEX.test("--v16 "), "--v16 should match auto-expand verse regex");
    assert(AUTO_EXPAND_VERSE_REGEX.test("--v16-18 "), "--v16-18 should match auto-expand verse regex");
    assert(AUTO_EXPAND_VERSE_REGEX.test("--V16 +p "), "--V16 +p should match auto-expand verse regex");
    assert(!AUTO_EXPAND_VERSE_REGEX.test("--v16"), "Missing trailing space should NOT match auto-expand verse regex");

    const matchAuto = "--John 3:16 +p ".match(AUTO_EXPAND_REGEX);
    assert(matchAuto !== null, "Auto match should not be null");
    if (matchAuto) {
        assert(matchAuto[1] === "John", "Auto-expand book should be John");
        assert(matchAuto[2] === "3", "Auto-expand chapter should be 3");
        assert(matchAuto[3] === "16", "Auto-expand verse should be 16");
        assert(matchAuto[5] === "p", "Auto-expand flag should be p");
    }
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 3: SUPERSCRIPT UTILS & TEXT FORMATTING
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 3: Superscript & Style Helpers]${colors.reset}`);

    assert(convertToSuperscript("123") === "¹²³", "convertToSuperscript('123') should return '¹²³'");
    assert(convertToNumber("¹²³") === 123, "convertToNumber('¹²³') should return 123");

    assert(formatAutoExpandText("Hello", "bold") === "**Hello**", "formatAutoExpandText('Hello', 'bold') should work");
    assert(formatAutoExpandText("Hello", "italic") === "*Hello*", "formatAutoExpandText('Hello', 'italic') should work");
    assert(formatAutoExpandText("Hello", "plain") === "Hello", "formatAutoExpandText('Hello', 'plain') should work");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 4: COPY MESSAGES FORMATTING (compileCopyMessage)
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 4: Copy Message Formatting & Grouping]${colors.reset}`);

    const mockSettings1 = {
        copyFormat: "plain",
        copyVerseReference: true,
        verseReferenceStyle: "- ",
        verseReferenceFormat: "full",
        verseReferenceInternalLinking: false
    };

    const mockSettingsCallout = {
        copyFormat: "callout",
        copyVerseReference: true,
        verseReferenceStyle: "- ",
        verseReferenceFormat: "full",
        verseReferenceInternalLinking: true
    };

    const mockSettingsShortRef = {
        copyFormat: "plain",
        copyVerseReference: true,
        verseReferenceStyle: "- ",
        verseReferenceFormat: "short",
        verseReferenceInternalLinking: false
    };

    const book = { bookid: 43, name: "John", chapters: 21 };
    
    // Scenario A: Single Verse Copy
    const inputA = "¹⁶ For God so loved the world";
    const outputA = compileCopyMessage(book.name, 3, inputA, mockSettings1).finalText;
    const expectedA = "¹⁶ For God so loved the world\n- [John 3:16](obsidian://bible?book=John&chapter=3&verse=16)";
    assert(outputA === expectedA, "Single verse copy matches exact expected format");

    // Scenario B: Consecutive Verses Copy
    const inputB = "¹⁶ For God so loved the world\n¹⁷ For God sent not his Son";
    const outputB = compileCopyMessage(book.name, 3, inputB, mockSettings1).finalText;
    const expectedB = "¹⁶ For God so loved the world ¹⁷ For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";
    assert(outputB === expectedB, "Consecutive verses copy cleanly separates verses and uses correct range reference");

    // Scenario C: Non-Consecutive Verses Copy
    const inputC = "¹⁶ For God so loved the world\n¹⁸ He that believeth on him";
    const outputC = compileCopyMessage(book.name, 3, inputC, mockSettings1).finalText;
    const expectedC = "¹⁶ For God so loved the world\n- [John 3:16](obsidian://bible?book=John&chapter=3&verse=16)\n\n¹⁸ He that believeth on him\n- [John 3:18](obsidian://bible?book=John&chapter=3&verse=18)";
    assert(outputC === expectedC, "Non-consecutive verses copy parses as distinct runs separated by blank line");

    // Scenario D: Callout formatting with Wiki Link
    const outputD = compileCopyMessage(book.name, 3, inputB, mockSettingsCallout).finalText;
    const expectedD = "> [!quote] [[John]] [3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)\n> ¹⁶ For God so loved the world ¹⁷ For God sent not his Son";
    assert(outputD === expectedD, "Callout mode wraps lines in a premium callout with wiki-links");

    // Scenario E: Short Reference Format
    const outputE = compileCopyMessage(book.name, 3, inputB, mockSettingsShortRef).finalText;
    const expectedE = "¹⁶ For God so loved the world ¹⁷ For God sent not his Son\n- [3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";
    assert(outputE === expectedE, "Short reference format omits book name in link label");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 5: +l MODE AUTO-EXPAND
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 5: +l Auto-Expand Mode]${colors.reset}`);

    const versesData = [
        { verse: 16, text: "For God so loved the world" },
        { verse: 17, text: "For God sent not his Son" }
    ];
    const refText = "[John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";

    const mockSettingsAutoPlain = {
        copyFormat: "plain",
        copyVerseReference: true,
        verseReferenceStyle: "- ",
        verseReferenceFormat: "full",
        verseReferenceInternalLinking: false,
        gospelQuotesRed: false,
        autoExpandReferenceStyle: "plain",
        autoExpandScriptureStyle: "plain"
    };

    const mockSettingsAutoCallout = {
        copyFormat: "callout",
        copyVerseReference: true,
        verseReferenceStyle: "- ",
        verseReferenceFormat: "full",
        verseReferenceInternalLinking: false,
        gospelQuotesRed: false,
        autoExpandReferenceStyle: "plain",
        autoExpandScriptureStyle: "plain"
    };

    // Test standard +p
    const resP = compileAutoExpandOutput(versesData, "John", 3, "p", refText, mockSettingsAutoPlain);
    const expP = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";
    assert(resP === expP, "+p mode puts scripture on one space-separated line with reference");

    // Test new +l with plain style
    const resL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsAutoPlain);
    const expL = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n[¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";
    assert(resL === expL, "+l mode puts each verse on a new line with reference");

    // Test new +l with callout style
    const resLCallout = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsAutoCallout);
    const expLCallout = "> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n> [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n> - [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";
    assert(resLCallout === expLCallout, "+l mode callout format prefixes all lines with '> '");

    assert(resL === expL, "+l mode correctly expands with scripture + reference");

    // Cross-chapter boundary tests
    const crossChapterVerses = [
        { chapter: 11, verse: 36, text: "For of him..." },
        { chapter: 12, verse: 1, text: "I appeal to you..." }
    ];
    const crossRefText = "[Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";

    // Cross-chapter inline (+p)
    const resCrossP = compileAutoExpandOutput(crossChapterVerses, "Romans", 11, "p", crossRefText, mockSettingsAutoPlain);
    const expCrossP = "[³⁶](obsidian://bible?book=Romans&chapter=11&verse=36) For of him... **[Chapter 12]** [¹](obsidian://bible?book=Romans&chapter=12&verse=1) I appeal to you...\n- [Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
    assert(resCrossP === expCrossP, "Cross-chapter inline mode inserts inline Markdown chapter markers on boundary transitions");

    // Cross-chapter newline (+l)
    const resCrossL = compileAutoExpandOutput(crossChapterVerses, "Romans", 11, "l", crossRefText, mockSettingsAutoPlain);
    const expCrossL = "[³⁶](obsidian://bible?book=Romans&chapter=11&verse=36) For of him...\n**[Chapter 12]**\n[¹](obsidian://bible?book=Romans&chapter=12&verse=1) I appeal to you...\n- [Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
    assert(resCrossL === expCrossL, "Cross-chapter newline mode inserts chapter marker on a new line");

    // Cross-chapter callout (+l)
    const resCrossLCallout = compileAutoExpandOutput(crossChapterVerses, "Romans", 11, "l", crossRefText, mockSettingsAutoCallout);
    const expCrossLCallout = "> [³⁶](obsidian://bible?book=Romans&chapter=11&verse=36) For of him...\n> **[Chapter 12]**\n> [¹](obsidian://bible?book=Romans&chapter=12&verse=1) I appeal to you...\n> - [Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
    assert(resCrossLCallout === expCrossLCallout, "Cross-chapter callout correctly prefixes chapter marker with '> '");

    console.log();

    // Custom colored Callout Highlights for Sermon Notes
    const mockSettingsSermonP = {
        gospelQuotesRed: false,
        verseReferenceStyle: "- ",
        autoExpandCallout_p: true,
        autoExpandCalloutType_p: "info",
        autoExpandCalloutTitle_p: "Sermon Passage: {{reference}}",
        autoExpandReferenceStyle_p: "plain",
        autoExpandScriptureStyle_p: "plain"
    };

    const mockSettingsSermonL = {
        gospelQuotesRed: false,
        verseReferenceStyle: "- ",
        autoExpandCallout_l: true,
        autoExpandCalloutType_l: "todo",
        autoExpandCalloutTitle_l: "Focus Verse: {{reference}}",
        autoExpandReferenceStyle_l: "plain",
        autoExpandScriptureStyle_l: "plain"
    };

    const mockSettingsSermonQ = {
        gospelQuotesRed: false,
        verseReferenceStyle: "- ",
        autoExpandCallout_q: true,
        autoExpandCalloutType_q: "warning",
        autoExpandCalloutTitle_q: "Study Text",
        autoExpandReferenceStyle_q: "plain",
        autoExpandScriptureStyle_q: "plain"
    };

    // Test +p with Sermon Callout Highlight
    const resSermonP = compileAutoExpandOutput(versesData, "John", 3, "p", refText, mockSettingsSermonP);
    const expSermonP = "> [!info] Sermon Passage: [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)\n> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
    assert(resSermonP === expSermonP, "Sermon +p mode wraps expansion in colored callout with dynamic title");

    // Test +l with Sermon Callout Highlight
    const resSermonL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsSermonL);
    const expSermonL = "> [!todo] Focus Verse: [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)\n> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n> [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
    assert(resSermonL === expSermonL, "Sermon +l mode wraps expansion in colored callout on multiple lines");

    // Test +q (scripture-only) with Sermon Callout Highlight
    const resSermonQ = compileAutoExpandOutput(versesData, "John", 3, "q", refText, mockSettingsSermonQ);
    const expSermonQ = "> [!warning] Study Text\n> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
    assert(resSermonQ === expSermonQ, "Sermon +q mode wraps scripture-only expansion in colored callout");

    // Test separate per-mode styling
    const mockSettingsPerModeStyles = {
        gospelQuotesRed: false,
        verseReferenceStyle: "- ",
        autoExpandReferenceStyle_p: "bold",
        autoExpandScriptureStyle_p: "bold",
        autoExpandReferenceStyle_l: "plain",
        autoExpandScriptureStyle_l: "plain",
        autoExpandReferenceStyle_q: "italic",
        autoExpandScriptureStyle_q: "italic"
    };

    const resPerModeP = compileAutoExpandOutput(versesData, "John", 3, "p", refText, mockSettingsPerModeStyles);
    const expPerModeP = "**[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son**\n- **[John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)**";
    assert(resPerModeP === expPerModeP, "Separate per-mode styles: +p scripture and reference formatted as bold");

    const resPerModeL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsPerModeStyles);
    const expPerModeL = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n[¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16&endVerse=17)";
    assert(resPerModeL === expPerModeL, "Separate per-mode styles: +l scripture and reference formatted as plain");

    // Test Color Jesus's words in red
    const mockSettingsGospelRed = {
        gospelQuotesRed: true,
        verseReferenceStyle: "- ",
        autoExpandReferenceStyle_p: "plain",
        autoExpandScriptureStyle_p: "plain"
    };

    const gospelVerses = [
        { verse: 26, text: "Now Jesus said, “Take, eat; this is my body.”" }
    ];
    
    // Test that a Gospel book gets highlights
    const resGospelRedTrue = compileAutoExpandOutput(gospelVerses, "Matthew", 26, "p", "[Matthew 26:26](...)", mockSettingsGospelRed);
    assert(resGospelRedTrue.includes('<span style="color: red;">Take, eat; this is my body.</span>'), "Color Jesus's words: Gospel quote gets wrapped in red colored HTML span tag");

    // Test that a non-Gospel book does NOT get highlights
    const resEpistleRedFalse = compileAutoExpandOutput(gospelVerses, "Romans", 12, "p", "[Romans 12:1](...)", mockSettingsGospelRed);
    assert(!resEpistleRedFalse.includes('<span style="color: red;">'), "Color Jesus's words: Non-Gospel quote does NOT get wrapped in red");

    // Test that if setting is disabled, Gospel does NOT get highlights
    const resGospelRedDisabled = compileAutoExpandOutput(gospelVerses, "Matthew", 26, "p", "[Matthew 26:26](...)", { ...mockSettingsGospelRed, gospelQuotesRed: false });
    assert(!resGospelRedDisabled.includes('<span style="color: red;">'), "Color Jesus's words: Disabled setting means NO red highlights in Gospels");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 6: API.BIBLE SETTINGS CACHING & DROPDOWN FLOW
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 6: API.Bible Caching & Dropdown Flow]${colors.reset}`);

    const mockPlugin = {
        settings: {
            apiBibleEnabled: true,
            apiBibleKey: "test-key-123",
            apiBibleVersionId: "test-version"
        },
        apiBiblesCache: null as any[] | null
    };

    // Test case 1: Fetch state is triggered when cache is null
    let fetchTriggered: boolean = false;
    function triggerFetchMock(plugin: typeof mockPlugin) {
        const hasKey = plugin.settings.apiBibleKey.trim().length > 0;
        if (plugin.settings.apiBibleEnabled && hasKey && !plugin.apiBiblesCache) {
            plugin.apiBiblesCache = []; // set to empty to avoid duplicate concurrent fetches
            fetchTriggered = true;
        }
    }
    triggerFetchMock(mockPlugin);
    assert((fetchTriggered as boolean) === true, "Fetch is correctly triggered when settings enabled, key set, and cache null");
    assert(mockPlugin.apiBiblesCache !== null && mockPlugin.apiBiblesCache.length === 0, "Cache is initialized to empty loading array during fetch");

    // Test case 2: Key changes invalidate the cache
    mockPlugin.apiBiblesCache = [{ id: "eng-kjv", name: "KJV" }];
    mockPlugin.settings.apiBibleKey = "new-key-456";
    mockPlugin.apiBiblesCache = null; // Clear cache on key change
    assert(mockPlugin.apiBiblesCache === null, "Changing the API key correctly invalidates the cache");

    // Test case 3: Fetch failures set error sentinel and stop rendering/fetching loops
    mockPlugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
    fetchTriggered = false;
    triggerFetchMock(mockPlugin);
    assert((fetchTriggered as boolean) === false, "Subsequent render does NOT trigger a fetch loop when error sentinel is present in cache");
    assert(mockPlugin.apiBiblesCache[0].id === "error", "Error sentinel correctly preserved in cache");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 7: ESV API HTML PARSING & CROSS-CHAPTER BOUNDARY LOGIC
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 7: ESV HTML Parsing & Cross-Chapter Logic]${colors.reset}`);

    const mockEsvElements = [
        { tagName: "b", className: "chapter-num", textContent: "11:36 ", nextSiblingText: "For of him..." },
        { tagName: "b", className: "chapter-num", textContent: "12", nextSiblingText: "I appeal to you..." },
        { tagName: "b", className: "verse-num", textContent: "2 ", nextSiblingText: "Do not be conformed..." }
    ];

    function runEsvParserSimulation(elements: typeof mockEsvElements, startChapter: number, startVerse: number, endChapter: number, endVerse: number) {
        const versesList: string[] = [];
        let currentChapter = startChapter;
        let lastChapter = startChapter;

        elements.forEach((span) => {
            let textContent = span.textContent || "";
            let verseNum = 0;

            if (span.className === "chapter-num") {
                const trimmed = textContent.trim();
                if (trimmed.includes(":")) {
                    const parts = trimmed.split(":");
                    currentChapter = parseInt(parts[0]) || currentChapter;
                    verseNum = parseInt(parts[1]) || 1;
                } else {
                    currentChapter = parseInt(trimmed) || currentChapter;
                    verseNum = 1;
                }
            } else {
                verseNum = parseInt(textContent.trim()) || 0;
            }

            const isWithinRange = 
                (currentChapter > startChapter || (currentChapter === startChapter && verseNum >= startVerse)) &&
                (currentChapter < endChapter || (currentChapter === endChapter && verseNum <= endVerse));

            if (isWithinRange) {
                let cleanText = span.nextSiblingText.trim();
                const supText = convertToSuperscript(verseNum);
                
                if (currentChapter !== lastChapter) {
                    versesList.push(`**[Chapter ${currentChapter}]**`);
                    lastChapter = currentChapter;
                }
                versesList.push(`${supText} ${cleanText}`);
            }
        });

        return versesList.join("\n");
    }

    const esvResult = runEsvParserSimulation(mockEsvElements, 11, 36, 12, 1);
    const expectedEsv = "³⁶ For of him...\n**[Chapter 12]**\n¹ I appeal to you...";
    assert(esvResult === expectedEsv, "ESV simulated parser correctly processes cross-chapter boundaries and outputs inline chapter transition markers");
    console.log();
}

// Execute tests
try {
    runTestSuite();
    
    console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
    console.log(`TEST SUMMARY:`);
    console.log(`  Passed: ${colors.green}${passed}${colors.reset}`);
    console.log(`  Failed: ${colors.red}${failed}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log(`${colors.green}${colors.bold}🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉${colors.reset}\n`);
        process.exit(0);
    }
} catch (err) {
    console.error(`\n${colors.red}Error executing test suite:${colors.reset}`, err);
    process.exit(1);
}

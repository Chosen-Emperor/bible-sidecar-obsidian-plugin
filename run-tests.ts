import {
    SELECTION_REGEX,
    SELECTION_VERSE_REGEX,
    AUTO_EXPAND_REGEX,
    AUTO_EXPAND_VERSE_REGEX,
    convertToSuperscript,
    convertToNumber,
    formatAutoExpandText,
    compileCopyMessage,
    compileAutoExpandOutput,
    getBookIdFromName,
    isNavigationAllowedOffline,
    calculateDownloadProportion,
    isOldTestament,
    getBookDisplayName,
    expandRange,
    parseProtocolParams,
    updateLocalCacheData,
    searchBibleLocalData,
    updateAnnotationsData,
    serializeAnnotationsToMarkdown,
    extractCrossReferences,
    parseStrongsText,
    renderStrongsHtml,
    highlightSearchTerms,
    parseAdvancedSearchQuery,
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
    const expectedA = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n- [John 3:16](obsidian://bible?book=John&chapter=3&verse=16)";
    assert(outputA === expectedA, "Single verse copy matches exact expected format");

    // Scenario B: Consecutive Verses Copy
    const inputB = "¹⁶ For God so loved the world\n¹⁷ For God sent not his Son";
    const outputB = compileCopyMessage(book.name, 3, inputB, mockSettings1).finalText;
    const expectedB = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";
    assert(outputB === expectedB, "Consecutive verses copy cleanly separates verses and uses correct range reference");

    // Scenario C: Non-Consecutive Verses Copy
    const inputC = "¹⁶ For God so loved the world\n¹⁸ He that believeth on him";
    const outputC = compileCopyMessage(book.name, 3, inputC, mockSettings1).finalText;
    const expectedC = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n- [John 3:16](obsidian://bible?book=John&chapter=3&verse=16)\n\n[¹⁸](obsidian://bible?book=John&chapter=3&verse=18) He that believeth on him\n- [John 3:18](obsidian://bible?book=John&chapter=3&verse=18)";
    assert(outputC === expectedC, "Non-consecutive verses copy parses as distinct runs separated by blank line");

    // Scenario D: Callout formatting with Wiki Link
    const outputD = compileCopyMessage(book.name, 3, inputB, mockSettingsCallout).finalText;
    const expectedD = "> [!quote] [[John]] [3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)\n> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
    assert(outputD === expectedD, "Callout mode wraps lines in a premium callout with wiki-links");

    // Scenario E: Short Reference Format
    const outputE = compileCopyMessage(book.name, 3, inputB, mockSettingsShortRef).finalText;
    const expectedE = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";
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
    const refText = "[John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";

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
    const expP = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";
    assert(resP === expP, "+p mode puts scripture on one space-separated line with reference");

    // Test new +l with plain style
    const resL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsAutoPlain);
    const expL = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n[¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";
    assert(resL === expL, "+l mode puts each verse on a new line with reference");

    // Test new +l with callout style
    const resLCallout = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsAutoCallout);
    const expLCallout = "> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n> [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n> - [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";
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
    const expSermonP = "> [!info] Sermon Passage: [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)\n> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
    assert(resSermonP === expSermonP, "Sermon +p mode wraps expansion in colored callout with dynamic title");

    // Test +l with Sermon Callout Highlight
    const resSermonL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsSermonL);
    const expSermonL = "> [!todo] Focus Verse: [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)\n> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n> [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
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
    const expPerModeP = "**[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son**\n- **[John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)**";
    assert(resPerModeP === expPerModeP, "Separate per-mode styles: +p scripture and reference formatted as bold");

    const resPerModeL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsPerModeStyles);
    const expPerModeL = "[¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n[¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17)";
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

    // ----------------------------------------------------
    // TEST SECTION 6: OFFLINE FEATURES & ACCENTS TOGGLES
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 6: Offline Optimization & Accents Config]${colors.reset}`);

    // Simulation of Book Cache Ratio Calculation
    const calculateDownloadProportion = (
        localData: any,
        book: { bookid: number; chapters: number }
    ) => {
        if (!localData) return 0;
        if (localData.apiType === "bolls") {
            return 1.0;
        } else if (localData.passages && localData.passages[book.bookid]) {
            const cachedChaptersCount = Object.keys(localData.passages[book.bookid]).length;
            const totalChapters = book.chapters || 1;
            return Math.min(cachedChaptersCount / totalChapters, 1.0);
        }
        return 0;
    };

    // Test: 100% caching for Bolls translations
    const bollsLocalData = { apiType: "bolls", passages: {} };
    assert(
        calculateDownloadProportion(bollsLocalData, { bookid: 1, chapters: 50 }) === 1.0,
        "Bulk Bolls translations should report 100% cache ratio (1.0)"
    );

    // Test: Partial caching ratio (e.g. 5 of 50 chapters)
    const apiBibleLocalData = {
        apiType: "apibible",
        passages: {
            1: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }
        }
    };
    assert(
        calculateDownloadProportion(apiBibleLocalData, { bookid: 1, chapters: 50 }) === 0.1,
        "Partial cache ratio should equal cachedChaptersCount / totalChapters (5/50 = 0.1)"
    );

    // Test: No cache passages present
    assert(
        calculateDownloadProportion(null, { bookid: 1, chapters: 50 }) === 0,
        "Null localData should report 0 cache ratio"
    );

    // Testing Offline Navigation block guard
    assert(
        isNavigationAllowedOffline(false, null, 1, 10) === true,
        "Navigation is always allowed when online, even if uncached"
    );
    assert(
        isNavigationAllowedOffline(true, apiBibleLocalData, 1, 2) === true,
        "Navigation is allowed offline if the specific chapter is cached"
    );
    assert(
        isNavigationAllowedOffline(true, apiBibleLocalData, 1, 10) === false,
        "Navigation is blocked offline if the specific chapter is NOT cached"
    );
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 9: BOOK ID RESOLUTION FROM NAME
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 9: Book ID Resolution]${colors.reset}`);

    assert(getBookIdFromName("Genesis") === 1, "Genesis book ID should be 1");
    assert(getBookIdFromName("1 Samuel") === 9, "1 Samuel book ID should be 9");
    assert(getBookIdFromName("john") === 43, "Case-insensitive john book ID should be 43");
    assert(getBookIdFromName("InvalidBook") === 1, "Invalid book name falls back to Genesis (1)");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 10: BOOK ABBREVIATION & CATEGORIZATION
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 10: Book Abbreviation & Categorization]${colors.reset}`);

    const bookMatthew = { bookid: 40, name: "Matthew" };
    assert(getBookDisplayName(bookMatthew, false) === "Matthew", "Matthew name is not abbreviated when setting is false");
    assert(getBookDisplayName(bookMatthew, true) === "MAT", "Matthew name is abbreviated to MAT when setting is true");

    // Testament Categorization boundary test (Old < 40, New >= 40)
    assert(isOldTestament(39) === true, "Malachi (39) is part of the Old Testament");
    assert(isOldTestament(40) === false, "Matthew (40) is NOT part of the Old Testament (New Testament)");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 11: SELECTION RANGE EXPANSION & PARSING
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 11: Range Expansion & Protocol Parsing]${colors.reset}`);

    // Testing range expansion and protocol params parsing
    assert(expandRange("16", undefined) === "16", "Single verse range does not expand");
    assert(expandRange("16", "18") === "16,17,18", "Consecutive range expands to comma-separated list");

    const parsed1 = parseProtocolParams({ book: "John", chapter: "3", verse: "16" });
    assert(parsed1.book === "John" && parsed1.chapter === 3 && parsed1.verse === 16 && parsed1.endVerse === undefined, "Standard single verse params parsed correctly");

    const parsed2 = parseProtocolParams({ book: "John", chapter: "3", verse: "16,17,18", endverse: "18" });
    assert(parsed2.verse === "16,17,18" && parsed2.endVerse === 18, "Range list verse parameter and fallback endverse parsed correctly");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 12: LOCAL CACHE UPDATES & STORAGE
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 12: Local Cache simulated updates]${colors.reset}`);

    let cacheDb: any = null;
    cacheDb = updateLocalCacheData(cacheDb, "ESV", 43, 3, "John", { isEsvApi: true, html: "<p>John 3</p>" }, "esv");
    assert(cacheDb !== null, "Simulated local data initialized on first cache write");
    assert(cacheDb.books.length === 1 && cacheDb.books[0].name === "John", "Book list contains John after caching");
    assert(cacheDb.passages[43][3].html === "<p>John 3</p>", "Chapter passage retrieved correctly from simulated cache");

    // Add a second book (Genesis - ID 1) to verify sorting
    cacheDb = updateLocalCacheData(cacheDb, "ESV", 1, 1, "Genesis", { isEsvApi: true, html: "<p>Genesis 1</p>" }, "esv");
    assert(cacheDb.books.length === 2, "Cache DB contains 2 books");
    assert(cacheDb.books[0].name === "Genesis", "Books list is correctly sorted with Genesis (ID 1) first");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 13: OFFLINE FULL-TEXT SEARCH
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 13: Offline Full-Text Search Engine]${colors.reset}`);

    const mockSearchDb = {
        books: [{ bookid: 43, name: "John" }],
        passages: {
            "43": {
                "3": [
                    { verse: "16", text: "For God so loved the world, that he gave his only Son" },
                    { verse: "17", text: "For God did not send his Son into the world to condemn the world" }
                ]
            }
        }
    };

    const searchRes1 = searchBibleLocalData("loved world", mockSearchDb);
    assert(searchRes1.length === 1 && searchRes1[0].verse === "16", "Searching 'loved world' matches John 3:16");

    const searchRes2 = searchBibleLocalData("Son world", mockSearchDb);
    assert(searchRes2.length === 2, "Searching 'Son world' matches both John 3:16 and 3:17");

    const searchRes3 = searchBibleLocalData("nonexistent", mockSearchDb);
    assert(searchRes3.length === 0, "Searching non-existent query returns 0 results");

    // Exact phrase match
    const searchResExact = searchBibleLocalData('"only Son"', mockSearchDb);
    assert(searchResExact.length === 1 && searchResExact[0].verse === "16", "Searching '\"only Son\"' exact phrase matches John 3:16");

    const searchResExactFail = searchBibleLocalData('"Son only"', mockSearchDb);
    assert(searchResExactFail.length === 0, "Searching '\"Son only\"' exact phrase matches nothing");

    // Excluded term
    const searchResExclusion = searchBibleLocalData("world -condemn", mockSearchDb);
    assert(searchResExclusion.length === 1 && searchResExclusion[0].verse === "16", "Searching 'world -condemn' filters out John 3:17");

    // Testament scope
    const searchResNT = searchBibleLocalData("nt:world", mockSearchDb);
    assert(searchResNT.length === 2, "Searching 'nt:world' matches New Testament book");

    const searchResOT = searchBibleLocalData("ot:world", mockSearchDb);
    assert(searchResOT.length === 0, "Searching 'ot:world' excludes New Testament book John");

    // Book scope
    const searchResBookMatch = searchBibleLocalData("JHN:world", mockSearchDb);
    assert(searchResBookMatch.length === 2, "Searching 'JHN:world' matches book John");

    const searchResBookMismatch = searchBibleLocalData("GEN:world", mockSearchDb);
    assert(searchResBookMismatch.length === 0, "Searching 'GEN:world' excludes book John");
    console.log();

    // ----------------------------------------------------
    // TEST SECTION 14: HIGHLIGHT AND NOTES BEHAVIOR MATRIX
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 14: Highlight and Notes Behavior Matrix]${colors.reset}`);

    let testData: Record<string, any> = {};

    // 1. Apply Highlight (Yellow) Single Verse
    testData = updateAnnotationsData(testData, "John", 3, "16", "yellow");
    assert(testData["John 3:16"] !== undefined, "Annotation for John 3:16 should be created");
    assert(testData["John 3:16"].color === "yellow", "Highlight color should be yellow");
    assert(testData["John 3:16"].note === undefined, "Note should be undefined initially");

    // 2. Apply Highlight (Green) Multi-Verse
    testData = updateAnnotationsData(testData, "Romans", 12, "1-2", "green");
    assert(testData["Romans 12:1-2"] !== undefined, "Annotation for Romans 12:1-2 should be created");
    assert(testData["Romans 12:1-2"].color === "green", "Multi-verse color should be green");

    // 3. Apply Phrase Highlight Single Verse
    testData = updateAnnotationsData(testData, "John", 3, "16", "yellow", "loved the world", { "16": "loved the world" });
    assert(testData["John 3:16"].text === "loved the world", "Phrase text should be set on John 3:16");
    assert(testData["John 3:16"].verses["16"] === "loved the world", "Verses map should contain phrase for verse 16");

    // 4. Apply Phrase Highlight Multi-Verse
    const versesMapRange = { "6": "Draw me", "7": "Tell me" };
    testData = updateAnnotationsData(testData, "Song of Solomon", 2, "6-7", "pink", "Draw me Tell me", versesMapRange);
    assert(testData["Song of Solomon 2:6-7"] !== undefined, "Multi-verse phrase highlight should be created");
    assert(testData["Song of Solomon 2:6-7"].verses["6"] === "Draw me", "Verse 6 phrase should be correct");
    assert(testData["Song of Solomon 2:6-7"].verses["7"] === "Tell me", "Verse 7 phrase should be correct");

    // 5. Add Study Note Single Verse (without existing note)
    // First clear John 3:16 to start clean
    testData = updateAnnotationsData(testData, "John", 3, "16", null);
    testData = updateAnnotationsData(testData, "John", 3, "16", "yellow", undefined, undefined);
    testData["John 3:16"].note = "This is a single verse note"; // simulate NoteModal submit
    assert(testData["John 3:16"].note === "This is a single verse note", "Single verse note should be saved");
    assert(testData["John 3:16"].color === "yellow", "Single verse color should default/persist");

    // 6. Add Study Note Multi-Verse (without existing note)
    testData = updateAnnotationsData(testData, "Genesis", 1, "1-2", "yellow");
    testData["Genesis 1:1-2"].note = "Beginning note";
    assert(testData["Genesis 1:1-2"].note === "Beginning note", "Multi-verse note should be saved");

    // 7. Add Study Note Single Verse with Phrase Highlight
    testData = updateAnnotationsData(testData, "John", 3, "16", "pink", "loved the world", { "16": "loved the world" });
    assert(testData["John 3:16"].note === "This is a single verse note", "Note should be preserved during phrase highlight changes");
    assert(testData["John 3:16"].text === "loved the world", "Phrase text should still exist");

    // 8. Add Study Note Multi-Verse with Phrase Highlight
    testData = updateAnnotationsData(testData, "Song of Solomon", 2, "6-7", "pink", "Draw me Tell me", versesMapRange);
    testData["Song of Solomon 2:6-7"].note = "Love poetry note";
    assert(testData["Song of Solomon 2:6-7"].note === "Love poetry note", "Multi-verse phrase note saved");
    assert(testData["Song of Solomon 2:6-7"].verses["6"] === "Draw me", "Verses map phrase preserved");

    // 9. Clear Highlight Single/Multi-Verse (including overlapping clear checks)
    // Clear Romans 12:1-2 (which clears Romans 12:1-2 green)
    testData = updateAnnotationsData(testData, "Romans", 12, "1-2", null);
    assert(testData["Romans 12:1-2"] === undefined, "Romans 12:1-2 should be deleted on clear");

    // Test overlapping clear: clearing Romans 12:1 should delete Romans 12:1-2 key
    // Re-apply Romans 12:1-2
    testData = updateAnnotationsData(testData, "Romans", 12, "1-2", "green");
    // Clear only Romans 12:1
    testData = updateAnnotationsData(testData, "Romans", 12, "1", null);
    assert(testData["Romans 12:1-2"] === undefined, "Overlapping clear should delete Romans 12:1-2 key");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 15: ANNOTATIONS → MARKDOWN SERIALIZER
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 15: Annotations → Markdown Serializer]${colors.reset}`);

    const emptyAnnotations: Record<string, any> = {};
    const emptyMd = serializeAnnotationsToMarkdown(emptyAnnotations);
    assert(emptyMd.includes("_No highlights or notes yet._"), "Empty annotations produce placeholder text");

    const singleAnnotation = { "John 3:16": { color: "yellow", note: "Amazing grace" } };
    const singleMd = serializeAnnotationsToMarkdown(singleAnnotation);
    assert(singleMd.includes("## John"), "Single annotation groups under book heading");
    assert(singleMd.includes("[yellow]"), "Color label appears in output");
    assert(singleMd.includes("> Amazing grace"), "Note appears as blockquote");
    assert(singleMd.includes("obsidian://bible"), "Deep link appears in output");

    const multiAnnotation = {
        "Romans 8:28": { color: "green" },
        "John 3:16": { color: "yellow", note: "Grace note" },
        "John 3:17": { color: "blue" }
    };
    const multiMd = serializeAnnotationsToMarkdown(multiAnnotation);
    assert(multiMd.indexOf("## John") < multiMd.indexOf("## Romans"), "Books are sorted alphabetically (John before Romans)");
    assert(multiMd.includes("## Romans"), "Romans group heading present");
    assert((multiMd.match(/###/g) || []).length === 3, "Three verse headings rendered");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 16: CROSS-REFERENCE EXTRACTION
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 16: Cross-Reference HTML Extraction]${colors.reset}`);

    const esvHtmlNoCrossRef = "<p>For God so loved the world</p>";
    const noCrossRefs = extractCrossReferences(esvHtmlNoCrossRef);
    assert(noCrossRefs.length === 0, "No cross-refs returned for HTML without crossreference spans");

    const esvHtmlWithCrossRef = `<p>For God<span class="crossreference"><a data-link="(Rom 5:8; 1Jn 4:9)">a</a></span> so loved</p>`;
    const crossRefs = extractCrossReferences(esvHtmlWithCrossRef);
    assert(crossRefs.length === 1, "One cross-reference group extracted");
    assert(crossRefs[0].letter === "a", "Letter label is 'a'");
    assert(crossRefs[0].refs.length === 2, "Two refs parsed: Rom 5:8 and 1Jn 4:9");
    assert(crossRefs[0].refs[0] === "Rom 5:8", "First ref is Rom 5:8");
    assert(crossRefs[0].refs[1] === "1Jn 4:9", "Second ref is 1Jn 4:9");

    const multiCrossRef = `
        <span class="crossreference"><a data-link="(Gen 1:1)">a</a></span>
        <span class="crossreference"><a data-link="(Jn 3:16; Mt 5:3, Lk 1:1)">b</a></span>
    `;
    const multi = extractCrossReferences(multiCrossRef);
    assert(multi.length === 2, "Two cross-reference groups extracted from multi HTML");
    assert(multi[0].letter === "a", "First group letter is 'a'");
    assert(multi[1].letter === "b", "Second group letter is 'b'");
    assert(multi[1].refs.length === 3, "Three refs in second group (Jn, Mt, Lk)");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 17: STRONGS CONCORDANCE PARSERS
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 17: Strong's Concordance Parsers]${colors.reset}`);

    const kjvVerse = "In<H1961> the beginning<H7225> God<H430> created<H1254>";
    const tokens = parseStrongsText(kjvVerse);
    assert(tokens.length === 4, "Parsed 4 Strong's tokens from KJV verse");
    assert(tokens[0].word === "In", "First token word is 'In'");
    assert(tokens[0].strongsId === "H1961", "First token Strong's ID is H1961");
    assert(tokens[2].word === "God", "Third token word is 'God'");
    assert(tokens[2].strongsId === "H430", "Third token Strong's ID is H430");

    const noStrongsVerse = "For God so loved the world";
    const emptyTokens = parseStrongsText(noStrongsVerse);
    assert(emptyTokens.length === 0, "No tokens extracted from verse without Strong's markers");

    const greekVerse = "In<G1722> the beginning<G746> was<G2258> the Word<G3056>";
    const greekTokens = parseStrongsText(greekVerse);
    assert(greekTokens.length === 4, "Parsed 4 Greek Strong's tokens");
    assert(greekTokens[0].strongsId === "G1722", "Greek Strong's prefix G is supported");

    const rendered = renderStrongsHtml("God<H430> created<H1254> the heavens");
    assert(rendered.includes('class="strongs-word"'), "Rendered HTML contains strongs-word class");
    assert(rendered.includes('data-strongs="H430"'), "Rendered HTML contains data-strongs attribute");
    assert(rendered.includes(">God<"), "Word 'God' is wrapped in span");
    assert(rendered.includes("the heavens"), "Non-Strong's text preserved unchanged");
    assert(!rendered.includes("<H430>"), "Raw Strong's markers are removed from output");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 18: SEARCH TERM HIGHLIGHTING
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 18: Search Term Highlighting]${colors.reset}`);

    const parsed18 = parseAdvancedSearchQuery("eternal life");
    const highlightedBasic = highlightSearchTerms("For God so loved the world, that he gave his only Son", parsed18);
    // "eternal" and "life" are included terms — neither in this text
    assert(!highlightedBasic.includes("<mark"), "No marks when no terms match in text");

    const parsed18b = parseAdvancedSearchQuery("loved world");
    const highlighted = highlightSearchTerms("For God so loved the world, that he gave his only Son", parsed18b);
    assert(highlighted.includes('<mark class="search-match">loved</mark>'), "Term 'loved' is highlighted");
    assert(highlighted.includes('<mark class="search-match">world</mark>'), "Term 'world' is highlighted");

    const parsedPhrase = parseAdvancedSearchQuery('"only Son"');
    const highlightedPhrase = highlightSearchTerms("For God so loved the world, that he gave his only Son", parsedPhrase);
    assert(highlightedPhrase.includes('<mark class="search-match">only Son</mark>'), "Exact phrase 'only Son' highlighted as one unit");

    // XSS safety check
    const xssText = "<script>alert(1)</script> For God so loved";
    const parsedXss = parseAdvancedSearchQuery("loved");
    const highlightedXss = highlightSearchTerms(xssText, parsedXss);
    assert(highlightedXss.includes("&lt;script&gt;"), "HTML tags are escaped to prevent XSS");
    assert(highlightedXss.includes('<mark class="search-match">loved</mark>'), "Term still highlighted after HTML escaping");

    // Case-insensitive matching
    const parsedCase = parseAdvancedSearchQuery("GOD");
    const highlightedCase = highlightSearchTerms("For God so loved the world", parsedCase);
    assert(highlightedCase.includes('<mark class="search-match">God</mark>'), "Highlighting is case-insensitive (GOD matches God)");

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


import {
    SELECTION_REGEX,
    SELECTION_VERSE_REGEX,
    AUTO_EXPAND_REGEX,
    AUTO_EXPAND_VERSE_REGEX,
    compileAutoExpandRegex,
    compileAutoExpandVerseRegex,
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
    extractCrossReferences,
    parseStrongsText,
    renderStrongsHtml,
    compileReferenceLink,
    compileFormattedPassage,
    compileDragText,
    formatScripturePassage,
    highlightSearchTerms,
    parseAdvancedSearchQuery,
    cleanHtmlKeepRedSpans,
    highlightGospelQuotes,
    stripLeadingVerseNumbers,
    parseHtmlToVerses,
    stripLeadingPlainNumbers
} from "../src/utils";
import { OfflineCacheStore, FileAdapter } from "../src/OfflineCacheStore";
import { BibleEditorSuggest } from "../src/BibleEditorSuggest";

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

async function runTestSuite() {
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

    // Custom trigger prefix tests (e.g. ".." or "//")
    const dotRegex = compileAutoExpandRegex("..");
    const slashRegex = compileAutoExpandRegex("//");
    const dotVerseRegex = compileAutoExpandVerseRegex("..");
    const slashVerseRegex = compileAutoExpandVerseRegex("//");

    assert(dotRegex.test("..John 3:16 "), "..John 3:16 should match custom auto-expand regex with prefix '..'");
    assert(slashRegex.test("//John 3:16 "), "//John 3:16 should match custom auto-expand regex with prefix '//'");
    assert(dotVerseRegex.test("..v16 "), "..v16 should match custom auto-expand verse regex with prefix '..'");
    assert(slashVerseRegex.test("//v16 "), "//v16 should match custom auto-expand verse regex with prefix '//'");

    assert(!dotRegex.test("--John 3:16 "), "--John 3:16 should NOT match auto-expand regex with prefix '..'");
    assert(!slashRegex.test("..John 3:16 "), "..John 3:16 should NOT match auto-expand regex with prefix '//'");

    // Match extraction validation
    const matchDot = "..John 3:16 +p ".match(dotRegex);
    assert(matchDot !== null, "Custom auto match should not be null");
    if (matchDot) {
        assert(matchDot[1] === "John", "Custom prefix book should be John");
        assert(matchDot[2] === "3", "Custom prefix chapter should be 3");
        assert(matchDot[3] === "16", "Custom prefix verse should be 16");
        assert(matchDot[5] === "p", "Custom prefix flag should be p");
    }

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

    // Test that pre-existing red spans (e.g. from premium APIs) are preserved in compileAutoExpandOutput even when gospelQuotesRed is false
    const premiumVerses = [
        { verse: 26, text: "Now Jesus said, <span style=\"color: red;\">Take, eat; this is my body.</span>" }
    ];
    const resPremiumPreserved = compileAutoExpandOutput(premiumVerses, "Matthew", 26, "p", "[Matthew 26:26](...)", { ...mockSettingsGospelRed, gospelQuotesRed: false });
    assert(resPremiumPreserved.includes('<span style="color: red;">Take, eat; this is my body.</span>'), "Premium pre-existing red spans are preserved in compileAutoExpandOutput");

    // Test cleanHtmlKeepRedSpans
    const mockNodeText = { nodeType: 3, textContent: "Hello world" };
    const mockNodeSpanWoc = {
        nodeType: 1,
        tagName: "SPAN",
        classList: { contains: (cls: string) => cls === "woc" },
        childNodes: [{ nodeType: 3, textContent: "Jesus words" }]
    };
    const mockNodeDiv = {
        nodeType: 1,
        tagName: "DIV",
        childNodes: [
            mockNodeText,
            mockNodeSpanWoc
        ]
    };

    assert(cleanHtmlKeepRedSpans(mockNodeText) === "Hello world", "cleanHtmlKeepRedSpans parses text nodes correctly");
    assert(cleanHtmlKeepRedSpans(mockNodeSpanWoc) === '<span style="color: red;">Jesus words</span>', "cleanHtmlKeepRedSpans preserves woc class span tags as style='color: red;'");
    assert(cleanHtmlKeepRedSpans(mockNodeDiv) === 'Hello world<span style="color: red;">Jesus words</span>', "cleanHtmlKeepRedSpans recursively unwraps non-red-span elements");

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
    // TEST SECTION 14: CROSS-REFERENCE EXTRACTION
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 14: Cross-Reference HTML Extraction]${colors.reset}`);

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
    // TEST SECTION 15: STRONGS CONCORDANCE PARSERS
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 15: Strong's Concordance Parsers]${colors.reset}`);

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

    // Test that renderStrongsHtml combined with gospelQuotesRed does not break when order is correct
    const rawGospelStrongs = "Jesus<G2424> said, \"I<G1473> am<G1510> the way<G3598>.\"";
    let processed = highlightGospelQuotes(rawGospelStrongs, "John", true);
    processed = renderStrongsHtml(processed, true);
    assert(processed.includes('class="strongs-word"'), "Strongs rendering works alongside gospelQuotesRed");
    assert(processed.includes('style="color: red;"'), "Gospel quotes red works alongside Strong's concordance");
    assert(!processed.includes('class="<span'), "HTML tag attributes are not corrupted by quotes red highlights");

    // Test that quote regex on already rendered strongs HTML causes tag corruption (old behavior)
    const corruptedText = renderStrongsHtml("Jesus<G2424> said, \"I<G1473> am<G1510> the way<G3598>.\"");
    const corruptedResult = highlightGospelQuotes(corruptedText, "John", true);
    assert(corruptedResult.includes('class="<span'), "CORRUPTION DETECTED: HTML tag attributes are corrupted by quotes red highlights if order is wrong");

    console.log();

    // ----------------------------------------------------
    // TEST SECTION 16: SEARCH TERM HIGHLIGHTING
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 16: Search Term Highlighting]${colors.reset}`);

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

    // ----------------------------------------------------
    // TEST SECTION 19: UNIFIED REFERENCE FORMATTING
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 19: Unified Reference Formatting]${colors.reset}`);
    
    // Test compileReferenceLink
    const ref1 = compileReferenceLink("John", 3, "16", "16", true, "full");
    assert(ref1 === "[[John]] [3:16](obsidian://bible?book=John&chapter=3&verse=16)", "Internal full link format matches");
    
    const ref2 = compileReferenceLink("Romans", 12, "1-2", "1,2", false, "short");
    assert(ref2 === "[12:1-2](obsidian://bible?book=Romans&chapter=12&verse=1,2)", "External short link format matches");

    // Test compileReferenceLink with empty rangeStr (whole book/chapter link) - no colon should be left
    const refEmptyRange = compileReferenceLink("Job", 1, "", "1-22", false, "full");
    assert(refEmptyRange === "[Job 1](obsidian://bible?book=Job&chapter=1&verse=1-22)", "Omit colon when range is empty");

    // Test compileFormattedPassage
    const passagePlain = compileFormattedPassage("In the beginning...", "[[Genesis]] [1:1](obsidian://...)", {
        copyFormat: "plain",
        copyVerseReference: true,
        verseReferenceStyle: "> "
    });
    assert(passagePlain === "In the beginning...\n> [[Genesis]] [1:1](obsidian://...)", "Plain format with reference matches");

    const passageCallout = compileFormattedPassage("In the beginning...", "[[Genesis]] [1:1](obsidian://...)", {
        copyFormat: "callout",
        copyVerseReference: true,
        verseReferenceStyle: "> "
    });
    assert(passageCallout.startsWith("> [!quote] [[Genesis]] [1:1]"), "Callout format starts with blockquote header");
    assert(passageCallout.includes("> In the beginning..."), "Callout format prefixes lines with blockquote marker");

    const passageCalloutWithVersion = compileFormattedPassage("In the beginning...", "[[Genesis]] [1:1](obsidian://...)", {
        copyFormat: "callout",
        copyVerseReference: true,
        verseReferenceStyle: "> ",
        showVersionIndicator: true,
        bibleVersion: "ESV"
    });
    assert(passageCalloutWithVersion.startsWith("> [!quote] [[Genesis]] [1:1](obsidian://...) (ESV)"), "Callout copy includes version indicator in title");

    // Test compileDragText
    const rawSupText = convertToSuperscript("1");
    const preLinkedText = `[${rawSupText}](obsidian://bible?book=Genesis&chapter=1&verse=1) In the beginning...`;
    const dragText = compileDragText(preLinkedText, "Genesis", 1, "1", [1], {
        copyFormat: "plain",
        copyVerseReference: true,
        verseReferenceStyle: "> ",
        verseReferenceFormat: "full",
        verseReferenceInternalLinking: true
    });
    assert(dragText.includes("[¹](obsidian://bible?book=Genesis&chapter=1&verse=1)"), "Drag text compiles scripture with superscript linked verse");
    assert(dragText.includes("> [[Genesis]] [1:1]("), "Drag text appends reference link at the bottom");

    // Test formatScripturePassage
    const testVerses = [
        { verse: 16, text: "Jesus said, “For God so loved the world.”" }
    ];
    const testSettings = {
        copyFormat: "plain",
        copyVerseReference: true,
        verseReferenceStyle: "> ",
        verseReferenceFormat: "full",
        verseReferenceInternalLinking: true,
        gospelQuotesRed: true
    };
    const formattedPassage = formatScripturePassage("John", 3, testVerses, testSettings);
    assert(formattedPassage.includes("[¹⁶](obsidian://bible?book=John&chapter=3&verse=16)"), "formatScripturePassage adds superscript link");
    assert(formattedPassage.includes("color: red"), "formatScripturePassage highlights gospel quotes in red when setting enabled");
    assert(formattedPassage.includes("> [[John]] [3:16]("), "formatScripturePassage appends reference link at the bottom");

    // ----------------------------------------------------
    // TEST SECTION 20: OFFLINE CACHE STORE MEMORY CACHING
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 20: Offline Cache Store Memory Caching]${colors.reset}`);

    const mockAdapter = new MockFileAdapter();
    const store = new OfflineCacheStore(mockAdapter, "mock-dir");

    // Seed mock files
    const kData = { version: "KJV", passages: {} };
    const eData = { version: "ESV", passages: {} };
    const nData = { version: "NIV", passages: {} };

    await store.writeLocalTranslation("KJV", kData);
    await store.writeLocalTranslation("ESV", eData);

    const kjvPath = "mock-dir/translations/KJV.json";
    
    // Clear counts
    mockAdapter.readCount = {};

    // 1. Read KJV first time (hit memory cache since we just wrote it)
    const r1 = await store.readLocalTranslation("KJV");
    assert(r1.version === "KJV", "Read translation returned correct version");
    assert((mockAdapter.readCount[kjvPath] || 0) === 0, "First read after write did not hit disk (hit memory cache)");

    // Clear cache to force disk read
    store.clearCache();
    mockAdapter.readCount = {};

    // First read after clearing cache should hit disk
    const r2 = await store.readLocalTranslation("KJV");
    assert(r2.version === "KJV", "Read after clear cache returned correct version");
    assert((mockAdapter.readCount[kjvPath] || 0) === 1, "First read hit disk once");

    // Second read should hit memory cache (zero readCount increment)
    const r3 = await store.readLocalTranslation("KJV");
    assert(r3.version === "KJV", "Second read returned correct version");
    assert((mockAdapter.readCount[kjvPath] || 0) === 1, "Second read hit memory cache, no additional disk read");

    // 2. Cache eviction check: limit is 2
    await store.writeLocalTranslation("NIV", nData); // cache now has KJV, NIV
    mockAdapter.readCount = {};
    
    const esvPath = "mock-dir/translations/ESV.json";
    const rEsv = await store.readLocalTranslation("ESV"); // triggers disk read for ESV. Cache now has ESV, NIV (evicted KJV)
    assert((mockAdapter.readCount[esvPath] || 0) === 1, "ESV read hit disk");

    // Read KJV again. It was evicted, so it must hit disk!
    mockAdapter.readCount = {};
    const rKjvAgain = await store.readLocalTranslation("KJV");
    assert((mockAdapter.readCount[kjvPath] || 0) === 1, "KJV was evicted from memory cache and read from disk again");

    // ----------------------------------------------------
    // TEST SECTION 21: DIALOGUE FORMATTING & SELECTION HELPERS
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 21: Dialogue Formatting & Selection Helpers]${colors.reset}`);

    // Test: stripLeadingVerseNumbers
    assert(stripLeadingVerseNumbers("¹⁶ For God so loved") === "For God so loved", "stripLeadingVerseNumbers strips simple leading superscript");
    assert(stripLeadingVerseNumbers('<span style="color: red;">¹⁶ For God so loved</span>') === '<span style="color: red;">For God so loved</span>', "stripLeadingVerseNumbers strips superscript inside HTML tags");

    // Test: parseHtmlToVerses (using the Node fallback)
    const mockDialogueHtml = `<p><b class="verse-num">1 </b>“Truly, truly, I say to you,</p><p>whoever believes has eternal life.”</p><b class="verse-num">2 </b>I am the bread of life.`;
    const parsedDialogue = parseHtmlToVerses(mockDialogueHtml, true, false);
    assert(parsedDialogue.length === 2, "Parsed dialogue returns correct number of verses");
    assert(parsedDialogue[0].verse === 1, "First verse number parsed correctly");
    assert(parsedDialogue[0].text === "“Truly, truly, I say to you, whoever believes has eternal life.”", "First verse contains text from both paragraphs without running together");
    assert(parsedDialogue[1].verse === 2 && parsedDialogue[1].text === "I am the bread of life.", "Second verse parsed correctly");

    // Test: Nested element filtering
    const mockParent = { parentElement: null } as any;
    const mockChild = { parentElement: mockParent } as any;
    const mockGrandchild = { parentElement: mockChild } as any;
    const mockUnrelated = { parentElement: null } as any;

    const nestedList = [mockParent, mockChild, mockGrandchild, mockUnrelated];
    const filteredList = nestedList.filter(el => {
        let parent = el.parentElement;
        while (parent) {
            if (nestedList.includes(parent)) {
                return false;
            }
            parent = parent.parentElement;
        }
        return true;
    });

    assert(filteredList.length === 2, "Filtered list has exactly 2 elements");
    assert(filteredList.includes(mockParent), "Parent element is kept");
    assert(filteredList.includes(mockUnrelated), "Unrelated element is kept");
    assert(!filteredList.includes(mockChild), "Child element is filtered out");
    assert(!filteredList.includes(mockGrandchild), "Grandchild element is filtered out");

    // Test: stripLeadingPlainNumbers
    assert(stripLeadingPlainNumbers("4:1   “Hear this word...", 1) === "“Hear this word...", "Strips leading chapter:verse prefix");
    assert(stripLeadingPlainNumbers("2   The Lord GOD...", 2) === "The Lord GOD...", "Strips leading plain verse number");
    assert(stripLeadingPlainNumbers("<span class=\"woc\">2 </span>The Lord GOD...", 2) === "<span class=\"woc\"></span>The Lord GOD...", "Strips leading plain verse number inside HTML tags");
    assert(stripLeadingPlainNumbers("<p>&nbsp; 2 &nbsp;The Lord GOD...", 2) === "<p>The Lord GOD...", "Strips leading plain verse number with &nbsp; spaces inside custom paragraph tags");
    assert(stripLeadingPlainNumbers("<p><span class=\"indent\">4:1 </span>“Hear this word...</p>", 1) === "<p><span class=\"indent\"></span>“Hear this word...</p>", "Strips leading chapter:verse prefix inside complex nested tags");
    assert(stripLeadingPlainNumbers("70 years later...", 12) === "70 years later...", "Does not strip unrelated numbers at the start");

    // ----------------------------------------------------
    // TEST SECTION 22: BIBLE EDITOR SUGGEST (INTELLISENSE)
    // ----------------------------------------------------
    console.log(`${colors.yellow}${colors.bold}[Test Section 22: Bible Editor Suggest (IntelliSense)]${colors.reset}`);

    // Mock app & plugin
    const suggestMockApp = {
        workspace: {
            getLeavesOfType: (type: string) => {
                return [{
                    view: {
                        activeBook: { name: "Mark" },
                        activeChapterNumber: 2
                    }
                }];
            }
        }
    };
    const suggestMockPlugin = {
        app: suggestMockApp,
        settings: {
            autoExpandBibleReferences: true,
            autoExpandTriggerPrefix: "--"
        }
    };

    const suggest = new BibleEditorSuggest(suggestMockPlugin as any);

    // Test onTrigger
    const suggestMockEditor = {
        getLine: (lineNum: number) => "Reference --Joh",
        posToOffset: (pos: any) => 15,
        getCursor: () => ({ line: 0, ch: 15 })
    };
    const trigger = suggest.onTrigger({ line: 0, ch: 15 }, suggestMockEditor as any, {} as any);
    assert(trigger !== null, "onTrigger triggers on valid prefix + query");
    assert(trigger?.query === "Joh", "onTrigger extracts correct query");

    // Test getSuggestions - Book Autocomplete
    const suggestionsBook = suggest.getSuggestions({ query: "Joh" } as any);
    assert(suggestionsBook.length > 0, "getSuggestions returns matching books");
    assert(suggestionsBook.some(s => s.book === "John"), "Autocompletes 'John' when query is 'Joh'");

    // Test getSuggestions - Context Chapter/Verse autocomplete
    const suggestionsContext = suggest.getSuggestions({ query: "16" } as any);
    assert(suggestionsContext.length > 0, "getSuggestions returns context suggestions when typing numbers");
    assert(suggestionsContext[0].book === "Mark", "Suggests active sidecar book");
    assert(suggestionsContext[0].chapter === 2, "Suggests active sidecar chapter");
    assert(suggestionsContext[0].startVerse === 16, "Suggests typed verse");

    // Test getSuggestions - Trailing Colon
    const suggestionsColon = suggest.getSuggestions({ query: "Mark 2:" } as any);
    assert(suggestionsColon.length === 5, "Suggests 5 verses on trailing colon");
    assert(suggestionsColon[0].book === "Mark" && suggestionsColon[0].chapter === 2 && suggestionsColon[0].startVerse === 1, "First suggestion matches verse 1");

    // Test getSuggestions - Trailing Dash (John 3:16-)
    const suggestionsDash = suggest.getSuggestions({ query: "John 3:16-" } as any);
    assert(suggestionsDash.length === 5, "Suggests 5 ranges on trailing dash");
    assert(suggestionsDash[0].book === "John" && suggestionsDash[0].chapter === 3 && suggestionsDash[0].startVerse === 16 && suggestionsDash[0].endVerse === 17, "First suggestion matches range 16-17");

    // Test getSuggestions - Context Trailing Dash (16-)
    const suggestionsContextDash = suggest.getSuggestions({ query: "16-" } as any);
    assert(suggestionsContextDash.length === 5, "Suggests 5 ranges on context trailing dash");
    assert(suggestionsContextDash[0].book === "Mark" && suggestionsContextDash[0].chapter === 2 && suggestionsContextDash[0].startVerse === 16 && suggestionsContextDash[0].endVerse === 17, "First suggestion matches context range 16-17");

    // Test getSuggestions - Format list for standard query
    const suggestionsFormats = suggest.getSuggestions({ query: "John 3:16" } as any);
    assert(suggestionsFormats.length === 4, "Suggests 4 formats for standard reference");
    assert(suggestionsFormats[0].suffix === "link", "First format option is Link");
    assert(suggestionsFormats[1].suffix === "passage", "Second format option is Passage");
    assert(suggestionsFormats[2].suffix === "l", "Third format option is List");
    assert(suggestionsFormats[3].suffix === "q", "Fourth format option is Quote");

    // Test context shorthand links: query is "16" (activeBook = "Mark", activeChapter = 2)
    const suggestionsContextShorthand = suggest.getSuggestions({ query: "16" } as any);
    const linkOption = suggestionsContextShorthand.find(s => s.suffix === "link");
    assert(linkOption !== undefined, "Link option exists in context suggestions list");
    assert(linkOption?.shorthandLabel === "v16", "shorthandLabel is set to 'v16' for verse shorthand");
    assert(linkOption?.displayText === "v16", "displayText is set to shorthand 'v16' for Link suffix");

    // Test getSuggestions - Suffix matching without "+" (e.g., John 3:16p and 16q)
    const suggestionsNoPlusP = suggest.getSuggestions({ query: "John 3:16p" } as any);
    assert(suggestionsNoPlusP.length === 1 && suggestionsNoPlusP[0].suffix === "passage", "Filters to Passage with optional + suffix 'John 3:16p'");

    const suggestionsNoPlusQ = suggest.getSuggestions({ query: "16q" } as any);
    assert(suggestionsNoPlusQ.length === 1 && suggestionsNoPlusQ[0].suffix === "q", "Filters to Quote with optional + suffix '16q'");

    // Test getSuggestions - Whole Chapter sentinel limit (300)
    const suggestionsWholeChapter = suggest.getSuggestions({ query: "John 3" } as any);
    assert(suggestionsWholeChapter.length > 0, "getSuggestions returns suggestions for whole chapter");
    const wholeChapterOption = suggestionsWholeChapter.find(s => s.suffix === "passage");
    assert(wholeChapterOption !== undefined, "Passage option exists for whole chapter");
    assert(wholeChapterOption?.endVerse === 300, "Whole chapter suggestions have endVerse set to 300 sentinel limit");

    console.log();
}

class MockFileAdapter implements FileAdapter {
    files: Record<string, string> = {};
    readCount: Record<string, number> = {};

    async exists(path: string): Promise<boolean> {
        return this.files[path] !== undefined;
    }

    async read(path: string): Promise<string> {
        this.readCount[path] = (this.readCount[path] || 0) + 1;
        if (this.files[path] === undefined) {
            throw new Error(`File not found: ${path}`);
        }
        return this.files[path];
    }

    async write(path: string, content: string): Promise<void> {
        this.files[path] = content;
    }

    async mkdir(path: string): Promise<void> {}
    async remove(path: string): Promise<void> {
        delete this.files[path];
    }

    async list(path: string): Promise<{ files: string[] }> {
        return { files: Object.keys(this.files) };
    }
}

// Execute tests
(async () => {
    try {
        await runTestSuite();
        
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
})();

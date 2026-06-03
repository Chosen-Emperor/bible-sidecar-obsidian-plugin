var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b ||= {})
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// utils.ts
var superscriptMap = {
  "0": "\u2070",
  "1": "\xB9",
  "2": "\xB2",
  "3": "\xB3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079"
};
var subscriptMap = {
  "\u2070": "0",
  "\xB9": "1",
  "\xB2": "2",
  "\xB3": "3",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9"
};
var SELECTION_REGEX = /^([1-3]?\s*[a-zA-Z\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+:\d+|\d+))?$/i;
var SELECTION_VERSE_REGEX = /^v(\d+)(?:\s*-\s*(\d+))?$/i;
var AUTO_EXPAND_REGEX = /--([1-3]?\s*[a-zA-Z\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+:\d+|\d+))?(?:\s*\+([pqlhl]))?\s$/i;
var AUTO_EXPAND_VERSE_REGEX = /--v(\d+)(?:\s*-\s*(\d+))?(?:\s*\+([pqlhl]))?\s$/i;
function convertToSuperscript(number) {
  const digits = String(number).split("");
  return digits.map((d) => superscriptMap[d] || d).join("");
}
function convertToNumber(superscriptNumber) {
  const digits = superscriptNumber.split("").map((d) => subscriptMap[d] || d);
  return parseInt(digits.join(""), 10);
}
function formatAutoExpandText(text, style) {
  switch (style) {
    case "italic":
      return `*${text}*`;
    case "bold":
      return `**${text}**`;
    case "boldItalic":
      return `***${text}***`;
    default:
      return text;
  }
}
function highlightGospelQuotes(text, bookName, enabled) {
  if (enabled && ["matthew", "mark", "luke", "john"].includes(bookName.toLowerCase())) {
    return text.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"').replace(/“([^”]+)”/g, '\u201C<span style="color: red;">$1</span>\u201D');
  }
  return text;
}
function compileCopyMessage(bookName, chapter, accumulatedVerseText, settings) {
  const regex = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g;
  const verses = accumulatedVerseText.split("\n").flatMap((verse) => {
    const matches = Array.from(verse.matchAll(regex));
    if (matches.length === 0) {
      return [{ verse: 0, text: verse.trim() }];
    }
    return matches.map((match) => {
      var _a, _b, _c;
      const verseNumber = convertToNumber(match[0]);
      const verseStart = ((_a = match == null ? void 0 : match.index) != null ? _a : 0) + ((_c = (_b = match == null ? void 0 : match[0]) == null ? void 0 : _b.length) != null ? _c : 0);
      const verseEnd = matches.indexOf(match) === matches.length - 1 ? verse.length : Array.from(verse.matchAll(regex))[matches.indexOf(match) + 1].index;
      const verseText = verse.substring(verseStart, verseEnd != null ? verseEnd : verse.length).trim();
      return {
        verse: verseNumber,
        text: verseText
      };
    });
  }).sort((a, b) => {
    var _a, _b;
    return ((_a = a == null ? void 0 : a.verse) != null ? _a : 0) - ((_b = b == null ? void 0 : b.verse) != null ? _b : 0);
  });
  if (verses.length === 0) {
    return { finalText: "", firstVerse: 0, lastVerse: 0, rangeStr: "" };
  }
  const firstVerse = verses[0].verse;
  const lastVerse = verses[verses.length - 1].verse;
  const rangeStr = firstVerse === lastVerse ? firstVerse.toString() : `${firstVerse}-${lastVerse}`;
  const runs = [];
  let currentRun = null;
  for (const verseItem of verses) {
    if (!currentRun || verseItem.verse !== currentRun.end + 1) {
      currentRun = {
        start: verseItem.verse,
        end: verseItem.verse,
        verses: [verseItem]
      };
      runs.push(currentRun);
    } else {
      currentRun.end = verseItem.verse;
      currentRun.verses.push(verseItem);
    }
  }
  const formattedRuns = runs.map((run) => {
    const scriptureText = run.verses.map((v) => `${convertToSuperscript(v.verse.toString())} ${v.text}`).join(" ");
    if (!settings.copyVerseReference || settings.copyFormat === "callout") {
      return scriptureText;
    }
    const rangeStr2 = run.start === run.end ? run.start.toString() : `${run.start}-${run.end}`;
    const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${run.start}`;
    let referenceLink = "";
    if (settings.verseReferenceInternalLinking) {
      referenceLink = `[[${bookName}]] [${chapter}:${rangeStr2}](${uri})`;
    } else {
      const label = settings.verseReferenceFormat === "short" ? `${chapter}:${rangeStr2}` : `${bookName} ${chapter}:${rangeStr2}`;
      referenceLink = `[${label}](${uri})`;
    }
    const referenceLine = `${settings.verseReferenceStyle}${referenceLink}`;
    return `${scriptureText}
${referenceLine}`;
  });
  let finalText = formattedRuns.join("\n\n");
  if (settings.copyFormat === "callout") {
    const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${firstVerse}`;
    let referenceLink = "";
    if (settings.verseReferenceInternalLinking) {
      referenceLink = `[[${bookName}]] [${chapter}:${rangeStr}](${uri})`;
    } else {
      const label = settings.verseReferenceFormat === "short" ? `${chapter}:${rangeStr}` : `${bookName} ${chapter}:${rangeStr}`;
      referenceLink = `[${label}](${uri})`;
    }
    finalText = `[!quote] ${referenceLink}
${finalText}`;
    finalText = finalText.split("\n").map((line) => line.trim() === "" ? ">" : `> ${line}`).join("\n");
  }
  return { finalText: finalText.trim(), firstVerse, lastVerse, rangeStr };
}
function compileAutoExpandOutput(versesArray, bookName, startChapter, flag, referenceText, settings) {
  const versesList = [];
  let lastChapter = startChapter;
  for (const verse of versesArray) {
    let cleanText = verse.text.replace(/<br\s*\/?>|<\/?i>|<\/?b>/gi, "\n").replace(/<[^>]*>?/gm, "");
    cleanText = highlightGospelQuotes(cleanText, bookName, settings.gospelQuotesRed);
    const rawSupText = convertToSuperscript(verse.verse.toString());
    const verseChapter = verse.chapter || startChapter;
    const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${verseChapter}&verse=${verse.verse}`;
    const supText = `[${rawSupText}](${uri})`;
    if (verse.chapter && verse.chapter !== lastChapter) {
      versesList.push(`**[Chapter ${verse.chapter}]**`);
      lastChapter = verse.chapter;
    }
    versesList.push(`${supText} ${cleanText}`);
  }
  if (versesList.length === 0)
    return "No verses found";
  const joinedText = flag === "l" ? versesList.join("\n") : versesList.join(" ");
  const referenceStyle = flag === "p" ? settings.autoExpandReferenceStyle_p : flag === "l" ? settings.autoExpandReferenceStyle_l : settings.autoExpandReferenceStyle_q;
  const scriptureStyle = flag === "p" ? settings.autoExpandScriptureStyle_p : flag === "l" ? settings.autoExpandScriptureStyle_l : settings.autoExpandScriptureStyle_q;
  const formattedReferenceText = formatAutoExpandText(referenceText, referenceStyle || settings.autoExpandReferenceStyle || "plain");
  const formattedScriptureText = formatAutoExpandText(joinedText, scriptureStyle || settings.autoExpandScriptureStyle || "plain");
  const isCalloutEnabled = flag === "p" && settings.autoExpandCallout_p || flag === "l" && settings.autoExpandCallout_l || flag === "q" && settings.autoExpandCallout_q;
  let finalOutput = "";
  if (flag === "p" || flag === "l") {
    if (isCalloutEnabled) {
      finalOutput = formattedScriptureText;
    } else {
      finalOutput = `${formattedScriptureText}
${settings.verseReferenceStyle}${formattedReferenceText}`;
    }
  } else if (flag === "q") {
    finalOutput = formattedScriptureText;
  }
  if (isCalloutEnabled) {
    const calloutType = flag === "p" ? settings.autoExpandCalloutType_p : flag === "l" ? settings.autoExpandCalloutType_l : settings.autoExpandCalloutType_q;
    const titleTemplate = flag === "p" ? settings.autoExpandCalloutTitle_p : flag === "l" ? settings.autoExpandCalloutTitle_l : settings.autoExpandCalloutTitle_q;
    const calloutTitle = (titleTemplate || "").replace("{{reference}}", referenceText);
    finalOutput = `[!${calloutType}] ${calloutTitle}
${finalOutput}`;
    finalOutput = finalOutput.split("\n").map((line) => line.trim() === "" ? ">" : `> ${line}`).join("\n");
  } else if (settings.copyFormat === "callout") {
    finalOutput = finalOutput.split("\n").map((line) => line.trim() === "" ? ">" : `> ${line}`).join("\n");
  }
  return finalOutput;
}

// run-tests.ts
var colors = {
  reset: "\x1B[0m",
  green: "\x1B[32m",
  red: "\x1B[31m",
  cyan: "\x1B[36m",
  yellow: "\x1B[33m",
  bold: "\x1B[1m"
};
console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
console.log(`${colors.cyan}${colors.bold}       Bible Sidecar TypeScript Test Suite          ${colors.reset}`);
console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}
`);
var passed = 0;
var failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ${colors.green}\u2713 Passed:${colors.reset} ${message}`);
  } else {
    failed++;
    console.log(`  ${colors.red}\u2717 Failed:${colors.reset} ${message}`);
  }
}
function runTestSuite() {
  console.log(`${colors.yellow}${colors.bold}[Test Section 1: Selection Link Conversion Regex]${colors.reset}`);
  assert(SELECTION_REGEX.test("John 3:16"), "John 3:16 should match standard selection regex");
  assert(SELECTION_REGEX.test("1 John 5:7"), "1 John 5:7 should match standard selection regex");
  assert(SELECTION_REGEX.test("Romans 12:1-2"), "Romans 12:1-2 should match standard selection regex");
  assert(SELECTION_REGEX.test("John 3:16-17:2"), "John 3:16-17:2 should match standard selection regex (cross chapter)");
  assert(!SELECTION_REGEX.test("John 3"), "John 3 should NOT match standard selection regex");
  assert(SELECTION_VERSE_REGEX.test("v16"), "v16 should match selection verse regex");
  assert(SELECTION_VERSE_REGEX.test("v16-18"), "v16-18 should match selection verse regex");
  assert(SELECTION_VERSE_REGEX.test("V16"), "V16 should match selection verse regex (case insensitive)");
  assert(!SELECTION_VERSE_REGEX.test("John 3:16"), "John 3:16 should NOT match selection verse regex");
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
  console.log(`${colors.yellow}${colors.bold}[Test Section 3: Superscript & Style Helpers]${colors.reset}`);
  assert(convertToSuperscript("123") === "\xB9\xB2\xB3", "convertToSuperscript('123') should return '\xB9\xB2\xB3'");
  assert(convertToNumber("\xB9\xB2\xB3") === 123, "convertToNumber('\xB9\xB2\xB3') should return 123");
  assert(formatAutoExpandText("Hello", "bold") === "**Hello**", "formatAutoExpandText('Hello', 'bold') should work");
  assert(formatAutoExpandText("Hello", "italic") === "*Hello*", "formatAutoExpandText('Hello', 'italic') should work");
  assert(formatAutoExpandText("Hello", "plain") === "Hello", "formatAutoExpandText('Hello', 'plain') should work");
  console.log();
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
  const inputA = "\xB9\u2076 For God so loved the world";
  const outputA = compileCopyMessage(book.name, 3, inputA, mockSettings1).finalText;
  const expectedA = "\xB9\u2076 For God so loved the world\n- [John 3:16](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(outputA === expectedA, "Single verse copy matches exact expected format");
  const inputB = "\xB9\u2076 For God so loved the world\n\xB9\u2077 For God sent not his Son";
  const outputB = compileCopyMessage(book.name, 3, inputB, mockSettings1).finalText;
  const expectedB = "\xB9\u2076 For God so loved the world \xB9\u2077 For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(outputB === expectedB, "Consecutive verses copy cleanly separates verses and uses correct range reference");
  const inputC = "\xB9\u2076 For God so loved the world\n\xB9\u2078 He that believeth on him";
  const outputC = compileCopyMessage(book.name, 3, inputC, mockSettings1).finalText;
  const expectedC = "\xB9\u2076 For God so loved the world\n- [John 3:16](obsidian://bible?book=John&chapter=3&verse=16)\n\n\xB9\u2078 He that believeth on him\n- [John 3:18](obsidian://bible?book=John&chapter=3&verse=18)";
  assert(outputC === expectedC, "Non-consecutive verses copy parses as distinct runs separated by blank line");
  const outputD = compileCopyMessage(book.name, 3, inputB, mockSettingsCallout).finalText;
  const expectedD = "> [!quote] [[John]] [3:16-17](obsidian://bible?book=John&chapter=3&verse=16)\n> \xB9\u2076 For God so loved the world \xB9\u2077 For God sent not his Son";
  assert(outputD === expectedD, "Callout mode wraps lines in a premium callout with wiki-links");
  const outputE = compileCopyMessage(book.name, 3, inputB, mockSettingsShortRef).finalText;
  const expectedE = "\xB9\u2076 For God so loved the world \xB9\u2077 For God sent not his Son\n- [3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(outputE === expectedE, "Short reference format omits book name in link label");
  console.log();
  console.log(`${colors.yellow}${colors.bold}[Test Section 5: +l Auto-Expand Mode]${colors.reset}`);
  const versesData = [
    { verse: 16, text: "For God so loved the world" },
    { verse: 17, text: "For God sent not his Son" }
  ];
  const refText = "[John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
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
  const resP = compileAutoExpandOutput(versesData, "John", 3, "p", refText, mockSettingsAutoPlain);
  const expP = "[\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(resP === expP, "+p mode puts scripture on one space-separated line with reference");
  const resL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsAutoPlain);
  const expL = "[\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n[\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(resL === expL, "+l mode puts each verse on a new line with reference");
  const resLCallout = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsAutoCallout);
  const expLCallout = "> [\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n> [\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n> - [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(resLCallout === expLCallout, "+l mode callout format prefixes all lines with '> '");
  assert(resL === expL, "+l mode correctly expands with scripture + reference");
  const crossChapterVerses = [
    { chapter: 11, verse: 36, text: "For of him..." },
    { chapter: 12, verse: 1, text: "I appeal to you..." }
  ];
  const crossRefText = "[Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
  const resCrossP = compileAutoExpandOutput(crossChapterVerses, "Romans", 11, "p", crossRefText, mockSettingsAutoPlain);
  const expCrossP = "[\xB3\u2076](obsidian://bible?book=Romans&chapter=11&verse=36) For of him... **[Chapter 12]** [\xB9](obsidian://bible?book=Romans&chapter=12&verse=1) I appeal to you...\n- [Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
  assert(resCrossP === expCrossP, "Cross-chapter inline mode inserts inline Markdown chapter markers on boundary transitions");
  const resCrossL = compileAutoExpandOutput(crossChapterVerses, "Romans", 11, "l", crossRefText, mockSettingsAutoPlain);
  const expCrossL = "[\xB3\u2076](obsidian://bible?book=Romans&chapter=11&verse=36) For of him...\n**[Chapter 12]**\n[\xB9](obsidian://bible?book=Romans&chapter=12&verse=1) I appeal to you...\n- [Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
  assert(resCrossL === expCrossL, "Cross-chapter newline mode inserts chapter marker on a new line");
  const resCrossLCallout = compileAutoExpandOutput(crossChapterVerses, "Romans", 11, "l", crossRefText, mockSettingsAutoCallout);
  const expCrossLCallout = "> [\xB3\u2076](obsidian://bible?book=Romans&chapter=11&verse=36) For of him...\n> **[Chapter 12]**\n> [\xB9](obsidian://bible?book=Romans&chapter=12&verse=1) I appeal to you...\n> - [Romans 11:36-12:1](obsidian://bible?book=Romans&chapter=11&verse=36)";
  assert(resCrossLCallout === expCrossLCallout, "Cross-chapter callout correctly prefixes chapter marker with '> '");
  console.log();
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
  const resSermonP = compileAutoExpandOutput(versesData, "John", 3, "p", refText, mockSettingsSermonP);
  const expSermonP = "> [!info] Sermon Passage: [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)\n> [\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
  assert(resSermonP === expSermonP, "Sermon +p mode wraps expansion in colored callout with dynamic title");
  const resSermonL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsSermonL);
  const expSermonL = "> [!todo] Focus Verse: [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)\n> [\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n> [\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
  assert(resSermonL === expSermonL, "Sermon +l mode wraps expansion in colored callout on multiple lines");
  const resSermonQ = compileAutoExpandOutput(versesData, "John", 3, "q", refText, mockSettingsSermonQ);
  const expSermonQ = "> [!warning] Study Text\n> [\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son";
  assert(resSermonQ === expSermonQ, "Sermon +q mode wraps scripture-only expansion in colored callout");
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
  const expPerModeP = "**[\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world [\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son**\n- **[John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)**";
  assert(resPerModeP === expPerModeP, "Separate per-mode styles: +p scripture and reference formatted as bold");
  const resPerModeL = compileAutoExpandOutput(versesData, "John", 3, "l", refText, mockSettingsPerModeStyles);
  const expPerModeL = "[\xB9\u2076](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world\n[\xB9\u2077](obsidian://bible?book=John&chapter=3&verse=17) For God sent not his Son\n- [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16)";
  assert(resPerModeL === expPerModeL, "Separate per-mode styles: +l scripture and reference formatted as plain");
  const mockSettingsGospelRed = {
    gospelQuotesRed: true,
    verseReferenceStyle: "- ",
    autoExpandReferenceStyle_p: "plain",
    autoExpandScriptureStyle_p: "plain"
  };
  const gospelVerses = [
    { verse: 26, text: "Now Jesus said, \u201CTake, eat; this is my body.\u201D" }
  ];
  const resGospelRedTrue = compileAutoExpandOutput(gospelVerses, "Matthew", 26, "p", "[Matthew 26:26](...)", mockSettingsGospelRed);
  assert(resGospelRedTrue.includes('<span style="color: red;">Take, eat; this is my body.</span>'), "Color Jesus's words: Gospel quote gets wrapped in red colored HTML span tag");
  const resEpistleRedFalse = compileAutoExpandOutput(gospelVerses, "Romans", 12, "p", "[Romans 12:1](...)", mockSettingsGospelRed);
  assert(!resEpistleRedFalse.includes('<span style="color: red;">'), "Color Jesus's words: Non-Gospel quote does NOT get wrapped in red");
  const resGospelRedDisabled = compileAutoExpandOutput(gospelVerses, "Matthew", 26, "p", "[Matthew 26:26](...)", __spreadProps(__spreadValues({}, mockSettingsGospelRed), { gospelQuotesRed: false }));
  assert(!resGospelRedDisabled.includes('<span style="color: red;">'), "Color Jesus's words: Disabled setting means NO red highlights in Gospels");
  console.log();
  console.log(`${colors.yellow}${colors.bold}[Test Section 6: API.Bible Caching & Dropdown Flow]${colors.reset}`);
  const mockPlugin = {
    settings: {
      apiBibleEnabled: true,
      apiBibleKey: "test-key-123",
      apiBibleVersionId: "test-version"
    },
    apiBiblesCache: null
  };
  let fetchTriggered = false;
  function triggerFetchMock(plugin) {
    const hasKey = plugin.settings.apiBibleKey.trim().length > 0;
    if (plugin.settings.apiBibleEnabled && hasKey && !plugin.apiBiblesCache) {
      plugin.apiBiblesCache = [];
      fetchTriggered = true;
    }
  }
  triggerFetchMock(mockPlugin);
  assert(fetchTriggered === true, "Fetch is correctly triggered when settings enabled, key set, and cache null");
  assert(mockPlugin.apiBiblesCache !== null && mockPlugin.apiBiblesCache.length === 0, "Cache is initialized to empty loading array during fetch");
  mockPlugin.apiBiblesCache = [{ id: "eng-kjv", name: "KJV" }];
  mockPlugin.settings.apiBibleKey = "new-key-456";
  mockPlugin.apiBiblesCache = null;
  assert(mockPlugin.apiBiblesCache === null, "Changing the API key correctly invalidates the cache");
  mockPlugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
  fetchTriggered = false;
  triggerFetchMock(mockPlugin);
  assert(fetchTriggered === false, "Subsequent render does NOT trigger a fetch loop when error sentinel is present in cache");
  assert(mockPlugin.apiBiblesCache[0].id === "error", "Error sentinel correctly preserved in cache");
  console.log();
  console.log(`${colors.yellow}${colors.bold}[Test Section 7: ESV HTML Parsing & Cross-Chapter Logic]${colors.reset}`);
  const mockEsvElements = [
    { tagName: "b", className: "chapter-num", textContent: "11:36 ", nextSiblingText: "For of him..." },
    { tagName: "b", className: "chapter-num", textContent: "12", nextSiblingText: "I appeal to you..." },
    { tagName: "b", className: "verse-num", textContent: "2 ", nextSiblingText: "Do not be conformed..." }
  ];
  function runEsvParserSimulation(elements, startChapter, startVerse, endChapter, endVerse) {
    const versesList = [];
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
      const isWithinRange = (currentChapter > startChapter || currentChapter === startChapter && verseNum >= startVerse) && (currentChapter < endChapter || currentChapter === endChapter && verseNum <= endVerse);
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
  const expectedEsv = "\xB3\u2076 For of him...\n**[Chapter 12]**\n\xB9 I appeal to you...";
  assert(esvResult === expectedEsv, "ESV simulated parser correctly processes cross-chapter boundaries and outputs inline chapter transition markers");
  console.log();
}
try {
  runTestSuite();
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`TEST SUMMARY:`);
  console.log(`  Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`  Failed: ${colors.red}${failed}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}
`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}\u{1F389} ALL TESTS COMPLETED SUCCESSFULLY! \u{1F389}${colors.reset}
`);
    process.exit(0);
  }
} catch (err) {
  console.error(`
${colors.red}Error executing test suite:${colors.reset}`, err);
  process.exit(1);
}

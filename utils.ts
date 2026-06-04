const superscriptMap: Record<string, string> = {
	"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"
};

const subscriptMap: Record<string, string> = {
	"⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9"
};

export const SELECTION_REGEX = /^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+:\d+|\d+))?$/i;
export const SELECTION_VERSE_REGEX = /^v(\d+)(?:\s*-\s*(\d+))?$/i;
export const CONTEXT_REGEX = /(?:^|\s)([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+))?(?:\s|$)/i;
export const AUTO_EXPAND_REGEX = /--([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+:\d+|\d+))?(?:\s*\+([pqlhl]))?\s$/i;
export const AUTO_EXPAND_VERSE_REGEX = /--v(\d+)(?:\s*-\s*(\d+))?(?:\s*\+([pqlhl]))?\s$/i;

export function convertToSuperscript(number: string | number): string {
	const digits = String(number).split("");
	return digits.map(d => superscriptMap[d] || d).join("");
}

export function convertToNumber(superscriptNumber: string): number {
	const digits = superscriptNumber
		.split("")
		.map(d => subscriptMap[d] || d);
	return parseInt(digits.join(""), 10);
}

export function formatAutoExpandText(text: string, style: string): string {
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

export function highlightGospelQuotes(text: string, bookName: string, enabled: boolean): string {
	if (enabled && ["matthew", "mark", "luke", "john"].includes(bookName.toLowerCase())) {
		return text
			.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"')
			.replace(/“([^”]+)”/g, '“<span style="color: red;">$1</span>”');
	}
	return text;
}

export interface CopySettings {
	copyVerseReference: boolean;
	copyFormat: string;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
}

export function compileCopyMessage(
	bookName: string,
	chapter: number,
	accumulatedVerseText: string,
	settings: CopySettings
): { finalText: string; firstVerse: number; lastVerse: number; rangeStr: string } {
	const regex = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g;
	const verses = accumulatedVerseText
		.split("\n")
		.flatMap((verse) => {
			const matches = Array.from(verse.matchAll(regex));

			if (matches.length === 0) {
				return [{ verse: 0, text: verse.trim() }];
			}

			return matches.map((match) => {
				const verseNumber = convertToNumber(match[0]);
				const verseStart = (match?.index ?? 0) + (match?.[0]?.length ?? 0);
				const verseEnd =
					matches.indexOf(match) === matches.length - 1
						? verse.length
						: Array.from(verse.matchAll(regex))[
								matches.indexOf(match) + 1].index;
				const verseText = verse
					.substring(verseStart, verseEnd ?? verse.length)
					.trim();

				return {
					verse: verseNumber,
					text: verseText,
				};
			});
		})
		.sort((a, b) => {
			return (a?.verse ?? 0) - (b?.verse ?? 0);
		});

	if (verses.length === 0) {
		return { finalText: "", firstVerse: 0, lastVerse: 0, rangeStr: "" };
	}

	const firstVerse = verses[0].verse;
	const lastVerse = verses[verses.length - 1].verse;
	const rangeStr = firstVerse === lastVerse ? firstVerse.toString() : `${firstVerse}-${lastVerse}`;

	const runs: { start: number; end: number; verses: { verse: number; text: string }[] }[] = [];
	let currentRun: typeof runs[0] | null = null;

	for (const verseItem of verses) {
		if (!currentRun || verseItem.verse !== currentRun.end + 1) {
			currentRun = {
				start: verseItem.verse,
				end: verseItem.verse,
				verses: [verseItem],
			};
			runs.push(currentRun);
		} else {
			currentRun.end = verseItem.verse;
			currentRun.verses.push(verseItem);
		}
	}

	const formattedRuns = runs.map((run) => {
		const scriptureText = run.verses
			.map((v) => {
				const vUri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${v.verse}`;
				return `[${convertToSuperscript(v.verse.toString())}](${vUri}) ${v.text}`;
			})
			.join(" ");

		if (!settings.copyVerseReference || settings.copyFormat === "callout") {
			return scriptureText;
		}

		const rangeStr = run.start === run.end ? run.start.toString() : `${run.start}-${run.end}`;
		const runVersesStr = run.verses.map((v) => v.verse).join(",");
		const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${runVersesStr}`;
		
		let referenceLink = "";
		if (settings.verseReferenceInternalLinking) {
			referenceLink = `[[${bookName}]] [${chapter}:${rangeStr}](${uri})`;
		} else {
			const label = settings.verseReferenceFormat === "short"
				? `${chapter}:${rangeStr}`
				: `${bookName} ${chapter}:${rangeStr}`;
			referenceLink = `[${label}](${uri})`;
		}

		const referenceLine = `${settings.verseReferenceStyle}${referenceLink}`;

		return `${scriptureText}\n${referenceLine}`;
	});

	let finalText = formattedRuns.join("\n\n");

	if (settings.copyFormat === "callout") {
		const allVersesStr = verses.map((v) => v.verse).join(",");
		const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${allVersesStr}`;
		
		let referenceLink = "";
		if (settings.verseReferenceInternalLinking) {
			referenceLink = `[[${bookName}]] [${chapter}:${rangeStr}](${uri})`;
		} else {
			const label = settings.verseReferenceFormat === "short"
				? `${chapter}:${rangeStr}`
				: `${bookName} ${chapter}:${rangeStr}`;
			referenceLink = `[${label}](${uri})`;
		}

		finalText = `[!quote] ${referenceLink}\n${finalText}`;
		finalText = finalText
			.split("\n")
			.map((line) => (line.trim() === "" ? ">" : `> ${line}`))
			.join("\n");
	}

	return { finalText: finalText.trim(), firstVerse, lastVerse, rangeStr };
}

export interface AutoExpandSettings {
	gospelQuotesRed: boolean;
	verseReferenceStyle: string;
	autoExpandReferenceStyle?: string;
	autoExpandScriptureStyle?: string;
	autoExpandReferenceStyle_p?: string;
	autoExpandScriptureStyle_p?: string;
	autoExpandReferenceStyle_l?: string;
	autoExpandScriptureStyle_l?: string;
	autoExpandReferenceStyle_q?: string;
	autoExpandScriptureStyle_q?: string;
	autoExpandCallout_p?: boolean;
	autoExpandCalloutType_p?: string;
	autoExpandCalloutTitle_p?: string;
	autoExpandCallout_l?: boolean;
	autoExpandCalloutType_l?: string;
	autoExpandCalloutTitle_l?: string;
	autoExpandCallout_q?: boolean;
	autoExpandCalloutType_q?: string;
	autoExpandCalloutTitle_q?: string;
	copyFormat?: string;
}

export function compileAutoExpandOutput(
	versesArray: { verse: number; text: string; chapter?: number }[],
	bookName: string,
	startChapter: number,
	flag: string,
	referenceText: string,
	settings: AutoExpandSettings
): string {
	const versesList: string[] = [];
	let lastChapter = startChapter;

	for (const verse of versesArray) {
		let cleanText = verse.text.replace(/<br\s*\/?>|<\/?i>|<\/?b>/gi, "\n").replace(/<[^>]*>?/gm, '');
		
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

	if (versesList.length === 0) return "No verses found";

	const joinedText = flag === "l" ? versesList.join("\n") : versesList.join(" ");

	const referenceStyle = flag === "p" ? settings.autoExpandReferenceStyle_p :
	                       flag === "l" ? settings.autoExpandReferenceStyle_l :
	                       settings.autoExpandReferenceStyle_q;
	
	const scriptureStyle = flag === "p" ? settings.autoExpandScriptureStyle_p :
	                       flag === "l" ? settings.autoExpandScriptureStyle_l :
	                       settings.autoExpandScriptureStyle_q;

	const formattedReferenceText = formatAutoExpandText(referenceText, referenceStyle || settings.autoExpandReferenceStyle || "plain");
	const formattedScriptureText = formatAutoExpandText(joinedText, scriptureStyle || settings.autoExpandScriptureStyle || "plain");

	const isCalloutEnabled = (flag === "p" && settings.autoExpandCallout_p) ||
	                         (flag === "l" && settings.autoExpandCallout_l) ||
	                         (flag === "q" && settings.autoExpandCallout_q);

	let finalOutput = "";
	if (flag === "p" || flag === "l") {
		if (isCalloutEnabled) {
			finalOutput = formattedScriptureText;
		} else {
			finalOutput = `${formattedScriptureText}\n${settings.verseReferenceStyle}${formattedReferenceText}`;
		}
	} else if (flag === "q") {
		finalOutput = formattedScriptureText;
	}

	if (isCalloutEnabled) {
		const calloutType = flag === "p" ? settings.autoExpandCalloutType_p :
		                    flag === "l" ? settings.autoExpandCalloutType_l :
		                    settings.autoExpandCalloutType_q;
		const titleTemplate = flag === "p" ? settings.autoExpandCalloutTitle_p :
		                      flag === "l" ? settings.autoExpandCalloutTitle_l :
		                      settings.autoExpandCalloutTitle_q;

		// Replace {{reference}} with the active markdown link!
		const calloutTitle = (titleTemplate || "").replace("{{reference}}", referenceText);

		finalOutput = `[!${calloutType}] ${calloutTitle}\n${finalOutput}`;

		finalOutput = finalOutput
			.split("\n")
			.map((line) => (line.trim() === "" ? ">" : `> ${line}`))
			.join("\n");
	} else if (settings.copyFormat === "callout") {
		finalOutput = finalOutput
			.split("\n")
			.map((line) => (line.trim() === "" ? ">" : `> ${line}`))
			.join("\n");
	}

	return finalOutput;
}

export async function copyToClipboard(text: string): Promise<boolean> {
	if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (err) {
			console.warn("navigator.clipboard.writeText failed, trying fallback:", err);
		}
	}
	
	try {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		textArea.style.top = "0";
		textArea.style.left = "0";
		textArea.style.position = "fixed";
		textArea.style.opacity = "0";
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		const successful = document.execCommand("copy");
		document.body.removeChild(textArea);
		return successful;
	} catch (err) {
		console.error("Fallback clipboard copy failed:", err);
		return false;
	}
}

export const BIBLE_BOOK_IDS = [
	"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
	"1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
	"ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
	"OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
	"MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
	"PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
	"1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
];

export const BIBLE_BOOK_MAP: Record<string, string> = {
	"genesis": "GEN", "exodus": "EXO", "leviticus": "LEV", "numbers": "NUM", "deuteronomy": "DEU",
	"joshua": "JOS", "judges": "JDG", "ruth": "RUT", "1 samuel": "1SA", "2 samuel": "2SA",
	"1 kings": "1KI", "2 kings": "2KI", "1 chronicles": "1CH", "2 chronicles": "2CH",
	"ezra": "EZR", "nehemiah": "NEH", "esther": "EST", "job": "JOB",
	"psalms": "PSA", "psalm": "PSA", "proverbs": "PRO", "ecclesiastes": "ECC", "song of solomon": "SNG",
	"isaiah": "ISA", "jeremiah": "JER", "lamentations": "LAM", "ezekiel": "EZK", "daniel": "DAN",
	"hosea": "HOS", "joel": "JOL", "amos": "AMO", "obadiah": "OBD", "jonah": "JON", "micah": "MIC",
	"nahum": "NAM", "habakkuk": "HAB", "zephaniah": "ZEP", "haggai": "HAG", "zechariah": "ZEC",
	"malachi": "MAL", "matthew": "MAT", "mark": "MRK", "luke": "LUK", "john": "JHN",
	"acts": "ACT", "romans": "ROM", "1 corinthians": "1CO", "2 corinthians": "2CO", "galatians": "GAL",
	"ephesians": "EPH", "philippians": "PHP", "colossians": "COL", "1 thessalonians": "1TH",
	"2 thessalonians": "2TH", "1 timothy": "1TI", "2 timothy": "2TI", "titus": "TIT",
	"philemon": "PHM", "hebrews": "HEB", "james": "JAS", "1 peter": "1PE", "2 peter": "2PE",
	"1 john": "1JN", "2 john": "2JN", "3 john": "3JN", "jude": "JUD", "revelation": "REV"
};

export function getBookIdFromName(bookName: string): number {
	const code = BIBLE_BOOK_MAP[bookName.toLowerCase()] || bookName.toUpperCase().substring(0, 3);
	const idx = BIBLE_BOOK_IDS.indexOf(code);
	return idx !== -1 ? idx + 1 : 1;
}

export function isNavigationAllowedOffline(
	isOfflineState: boolean,
	localData: any,
	bookId: number,
	chapterNumber: number
): boolean {
	if (!isOfflineState) return true;
	const isChapterCached = localData && (
		localData.apiType === "bolls" ||
		(localData.passages && localData.passages[bookId] && localData.passages[bookId][chapterNumber])
	);
	return !!isChapterCached;
}

export function calculateDownloadProportion(
	localData: any,
	book: { bookid: number; chapters: number }
): number {
	if (!localData) return 0;
	if (localData.apiType === "bolls") {
		return 1.0;
	} else if (localData.passages && localData.passages[book.bookid]) {
		const cachedChaptersCount = Object.keys(localData.passages[book.bookid]).length;
		const totalChapters = book.chapters || 1;
		return Math.min(cachedChaptersCount / totalChapters, 1.0);
	}
	return 0;
}

export function isOldTestament(bookid: number): boolean {
	return bookid < 40;
}

export function getBookDisplayName(book: { bookid: number; name: string }, abbreviate: boolean): string {
	return abbreviate ? (BIBLE_BOOK_IDS[book.bookid - 1] || book.name) : book.name;
}

export function expandRange(startVerse: string, endVerse: string | undefined): string {
	let verseVal = startVerse;
	if (endVerse && !isNaN(parseInt(startVerse)) && !isNaN(parseInt(endVerse))) {
		const start = parseInt(startVerse);
		const end = parseInt(endVerse);
		const vList = [];
		for (let v = start; v <= end; v++) {
			vList.push(v);
		}
		verseVal = vList.join(",");
	}
	return verseVal;
}

export function parseProtocolParams(params: any) {
	const endVerse = params.endVerse || params.endverse;
	const verseParam = (params.verse && (params.verse.includes(",") || params.verse.includes("-")))
		? params.verse
		: parseInt(params.verse);
	return {
		book: params.book,
		chapter: parseInt(params.chapter),
		verse: verseParam,
		endVerse: endVerse ? parseInt(endVerse) : undefined
	};
}

export function updateLocalCacheData(
	localData: any,
	version: string,
	bookid: number,
	chapter: number,
	bookName: string,
	content: any,
	apiType: string
): any {
	if (!localData) {
		localData = {
			version,
			books: [],
			passages: {},
			apiType
		};
	}
	if (!localData.books.find((b: any) => b.bookid === bookid)) {
		localData.books.push({
			bookid,
			name: bookName,
			chapters: 150
		});
		localData.books.sort((a: any, b: any) => a.bookid - b.bookid);
	}
	if (!localData.passages[bookid]) {
		localData.passages[bookid] = {};
	}
	localData.passages[bookid][chapter] = content;
	return localData;
}

export function searchBibleLocalData(
	query: string,
	localData: any,
	esvHtmlParser?: (html: string) => { verse: number; text: string }[],
	apiBibleHtmlParser?: (html: string) => { verse: number; text: string }[]
): { bookName: string; bookid: number; chapter: number; verse: string; text: string }[] {
	if (!query || !localData) return [];
	const results: { bookName: string; bookid: number; chapter: number; verse: string; text: string }[] = [];
	const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t);

	const passages = localData.passages;
	const books = localData.books;

	for (const book of books) {
		const bookIdStr = book.bookid.toString();
		const chapters = passages[bookIdStr];
		if (!chapters) continue;

		for (const chStr in chapters) {
			const chapterNum = parseInt(chStr);
			const cachedChapter = chapters[chStr];
			if (!cachedChapter) continue;

			if (cachedChapter.isEsvApi || cachedChapter.isApiBible) {
				const verses = cachedChapter.isEsvApi
					? (esvHtmlParser ? esvHtmlParser(cachedChapter.html) : [])
					: (apiBibleHtmlParser ? apiBibleHtmlParser(cachedChapter.html) : []);
				for (const v of verses) {
					const cleanText = v.text.replace(/<[^>]*>?/gm, '').trim();
					const cleanLower = cleanText.toLowerCase();
					if (searchTerms.every(term => cleanLower.includes(term))) {
						results.push({
							bookName: book.name,
							bookid: book.bookid,
							chapter: chapterNum,
							verse: v.verse.toString(),
							text: cleanText
						});
					}
				}
			} else {
				for (const verse of cachedChapter) {
					const verseText = (verse.text || "").replace(/<[^>]*>?/gm, '').toLowerCase();
					const matchesAll = searchTerms.every(term => verseText.includes(term));
					
					if (matchesAll) {
						results.push({
							bookName: book.name,
							bookid: book.bookid,
							chapter: chapterNum,
							verse: verse.verse,
							text: verse.text.replace(/<[^>]*>?/gm, '').trim()
						});
					}
				}
			}
			if (results.length >= 150) break;
		}
		if (results.length >= 150) break;
	}
	return results;
}


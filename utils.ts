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
			.map((v) => `${convertToSuperscript(v.verse.toString())} ${v.text}`)
			.join(" ");

		if (!settings.copyVerseReference || settings.copyFormat === "callout") {
			return scriptureText;
		}

		const rangeStr = run.start === run.end ? run.start.toString() : `${run.start}-${run.end}`;
		const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${run.start}${run.start !== run.end ? `&endVerse=${run.end}` : ""}`;
		
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
		const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${firstVerse}${firstVerse !== lastVerse ? `&endVerse=${lastVerse}` : ""}`;
		
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


import { BibleView, BibleViewType } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";
import { Plugin, WorkspaceLeaf, Editor, Notice, requestUrl } from "obsidian";
import {
	SELECTION_REGEX,
	SELECTION_VERSE_REGEX,
	CONTEXT_REGEX,
	AUTO_EXPAND_REGEX,
	AUTO_EXPAND_VERSE_REGEX,
	convertToSuperscript,
	formatAutoExpandText,
	compileAutoExpandOutput,
	copyToClipboard
} from "./utils";

interface BibleSidecarSettings {
	bibleVersion: string;
	copyFormat: string;
	copyVerseReference: boolean;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
	autoExpandBibleReferences: boolean;
	autoExpandReferenceStyle: string;
	autoExpandScriptureStyle: string;
	bibleLanguage: string;
	autoExpandCallout_p: boolean;
	autoExpandCalloutType_p: string;
	autoExpandCalloutTitle_p: string;
	autoExpandCallout_l: boolean;
	autoExpandCalloutType_l: string;
	autoExpandCalloutTitle_l: string;
	autoExpandCallout_q: boolean;
	autoExpandCalloutType_q: string;
	autoExpandCalloutTitle_q: string;
	autoExpandReferenceStyle_p: string;
	autoExpandScriptureStyle_p: string;
	autoExpandReferenceStyle_l: string;
	autoExpandScriptureStyle_l: string;
	autoExpandReferenceStyle_q: string;
	autoExpandScriptureStyle_q: string;
	gospelQuotesRed: boolean;
	hideLinkIcon: boolean;
	separateVersesSidecar: boolean;
	apiBibleEnabled: boolean;
	apiBibleKey: string;
	apiBibleVersionId: string;
	esvApiEnabled: boolean;
	esvApiKey: string;
	enableLogging: boolean;
	abbreviateBookNames: boolean;
}

export const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "ESV",
	copyFormat: "plain",
	copyVerseReference: false,
	verseReferenceStyle: "- ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: false,
	autoExpandBibleReferences: false,
	autoExpandReferenceStyle: "plain",
	autoExpandScriptureStyle: "plain",
	bibleLanguage: "en",
	autoExpandCallout_p: false,
	autoExpandCalloutType_p: "quote",
	autoExpandCalloutTitle_p: "Scripture: {{reference}}",
	autoExpandCallout_l: false,
	autoExpandCalloutType_l: "quote",
	autoExpandCalloutTitle_l: "Scripture: {{reference}}",
	autoExpandCallout_q: false,
	autoExpandCalloutType_q: "quote",
	autoExpandCalloutTitle_q: "Scripture: {{reference}}",
	autoExpandReferenceStyle_p: "plain",
	autoExpandScriptureStyle_p: "plain",
	autoExpandReferenceStyle_l: "plain",
	autoExpandScriptureStyle_l: "plain",
	autoExpandReferenceStyle_q: "plain",
	autoExpandScriptureStyle_q: "plain",
	gospelQuotesRed: false,
	hideLinkIcon: false,
	separateVersesSidecar: true,
	apiBibleEnabled: false,
	apiBibleKey: "",
	apiBibleVersionId: "de4e12af7f28f599-01",
	esvApiEnabled: false,
	esvApiKey: "",
	enableLogging: false,
	abbreviateBookNames: false,
};

const LANGUAGE_DEFAULT_VERSIONS: Record<string, string> = {
	en: "ESV",
	de: "ELB",
	fr: "NBS",
	es: "BTX3",
	pt: "ARA",
	it: "NR06",
	nl: "NLD",
	ru: "SYNOD",
	ar: "SVD",
	in: "TB",
	af: "AFR53",
};

export default class BibleSidecarPlugin extends Plugin {
	settings: BibleSidecarSettings;
	private view: BibleView | undefined;
	apiBiblesCache: { id: string; name: string }[] | null = null;
	private saveDebounceTimer: NodeJS.Timeout | null = null;

	async getDownloadedTranslations(): Promise<string[]> {
		const dir = `${this.manifest.dir}/translations`;
		try {
			const exists = await this.app.vault.adapter.exists(dir);
			if (!exists) return [];
			const list = await this.app.vault.adapter.list(dir);
			const jsonFiles = list.files
				.filter(f => f.endsWith(".json"))
				.map(f => {
					const parts = f.replace(/\\/g, "/").split("/");
					const filename = parts[parts.length - 1];
					return filename.replace(".json", "");
				});
			return jsonFiles;
		} catch (e) {
			console.error("Failed to list downloaded translations:", e);
			return [];
		}
	}

	async isTranslationDownloaded(version: string): Promise<boolean> {
		const filePath = `${this.manifest.dir}/translations/${version.toUpperCase()}.json`;
		try {
			return await this.app.vault.adapter.exists(filePath);
		} catch (e) {
			return false;
		}
	}

	async readLocalTranslation(version: string): Promise<any | null> {
		const filePath = `${this.manifest.dir}/translations/${version.toUpperCase()}.json`;
		try {
			const exists = await this.app.vault.adapter.exists(filePath);
			if (!exists) return null;
			const content = await this.app.vault.adapter.read(filePath);
			return JSON.parse(content);
		} catch (e) {
			console.error(`Failed to read local translation ${version}:`, e);
			return null;
		}
	}

	async downloadTranslation(version: string, onProgress: (progress: number) => void): Promise<void> {
		const dir = `${this.manifest.dir}/translations`;
		const dirExists = await this.app.vault.adapter.exists(dir);
		if (!dirExists) {
			await this.app.vault.adapter.mkdir(dir);
		}

		// Determine API type
		let apiType: "bolls" | "esv" | "apibible" = "bolls";
		const isEsvApi = this.settings.esvApiEnabled && 
		                 this.settings.esvApiKey.trim() && 
		                 version.toUpperCase() === "ESV";
		const isApiBible = this.settings.apiBibleEnabled && 
		                   this.settings.apiBibleKey.trim() && 
		                   this.settings.apiBibleVersionId;

		if (isEsvApi) {
			apiType = "esv";
		} else if (isApiBible) {
			apiType = "apibible";
		}

		const BIBLE_BOOK_IDS = [
			"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
			"1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
			"ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
			"OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
			"MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
			"PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
			"1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
		];

		const STANDARD_BOOK_CHAPTERS: Record<string, number> = {
			"GEN": 50, "EXO": 40, "LEV": 27, "NUM": 36, "DEU": 34, "JOS": 24, "JDG": 21, "RUT": 4, "1SA": 31, "2SA": 24,
			"1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, "EZR": 10, "NEH": 13, "EST": 10, "JOB": 42, "PSA": 150, "PRO": 31,
			"ECC": 12, "SNG": 8, "ISA": 66, "JER": 52, "LAM": 5, "EZK": 48, "DAN": 12, "HOS": 14, "JOL": 3, "AMO": 9,
			"OBD": 1, "JON": 4, "MIC": 7, "NAM": 3, "HAB": 3, "ZEP": 3, "HAG": 2, "ZEC": 14, "MAL": 4,
			"MAT": 28, "MRK": 16, "LUK": 24, "JHN": 21, "ACT": 28, "ROM": 16, "1CO": 16, "2CO": 13, "GAL": 6, "EPH": 6,
			"PHP": 4, "COL": 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4, "TIT": 3, "PHM": 1, "HEB": 13, "JAS": 5,
			"1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1, "3JN": 1, "JUD": 1, "REV": 22
		};

		let books: any[] = [];
		if (apiType === "apibible") {
			const response = await requestUrl({
				url: `https://api.scripture.api.bible/v1/bibles/${this.settings.apiBibleVersionId}/books`,
				headers: { "api-key": this.settings.apiBibleKey.trim() }
			});
			if (response.status === 200 && response.json?.data) {
				const mappedBooks = response.json.data.map((book: any) => {
					const idUpper = book.id.toUpperCase();
					const bookIdx = BIBLE_BOOK_IDS.indexOf(idUpper);
					const bookid = bookIdx !== -1 ? bookIdx + 1 : 100;
					const chapters = STANDARD_BOOK_CHAPTERS[idUpper] || 1;
					return {
						bookid,
						name: book.name,
						chapters
					};
				});
				books = mappedBooks.sort((a: any, b: any) => a.bookid - b.bookid);
			} else {
				throw new Error("Failed to fetch books from API.Bible");
			}
		} else {
			const booksRes = await requestUrl({
				url: `https://bolls.life/get-books/${version}`,
				headers: { "Accept": "application/json" }
			});
			if (booksRes.status === 200) {
				books = booksRes.json;
			} else {
				const booksResFallback = await requestUrl({
					url: `https://bolls.life/get-books/ESV`,
					headers: { "Accept": "application/json" }
				});
				if (booksResFallback.status === 200) {
					books = booksResFallback.json;
				} else {
					throw new Error("Failed to fetch book names directory from online sources.");
				}
			}
		}

		let totalChapters = 0;
		const tasks: { bookid: number; chapter: number; bookName: string }[] = [];
		for (const book of books) {
			totalChapters += book.chapters;
			for (let ch = 1; ch <= book.chapters; ch++) {
				tasks.push({ bookid: book.bookid, chapter: ch, bookName: book.name });
			}
		}

		const passages: Record<string, Record<string, any>> = {};
		let completed = 0;

		const batchSize = 10;
		for (let i = 0; i < tasks.length; i += batchSize) {
			const batch = tasks.slice(i, i + batchSize);
			await Promise.all(
				batch.map(async (task) => {
					let attempts = 3;
					while (attempts > 0) {
						try {
							if (apiType === "esv") {
								const bookId = BIBLE_BOOK_IDS[task.bookid - 1] || "GEN";
								const query = `${bookId} ${task.chapter}`;
								const res = await requestUrl({
									url: `https://api.esv.org/v3/passage/html/?q=${encodeURIComponent(query)}&include-verse-numbers=true&include-first-verse-numbers=true&include-headings=false&include-footnotes=false&include-audio-link=false&include-passage-references=false&include-copyright=false&include-short-copyright=false&wrapping-div=false`,
									headers: { "Authorization": `Token ${this.settings.esvApiKey.trim()}` }
								});
								if (res.status === 200 && res.json?.passages?.[0]) {
									if (!passages[task.bookid]) passages[task.bookid] = {};
									passages[task.bookid][task.chapter] = {
										isEsvApi: true,
										html: res.json.passages[0]
									};
									break;
								}
							} else if (apiType === "apibible") {
								const bookId = BIBLE_BOOK_IDS[task.bookid - 1] || "GEN";
								const res = await requestUrl({
									url: `https://api.scripture.api.bible/v1/bibles/${this.settings.apiBibleVersionId}/chapters/${bookId}.${task.chapter}?include-verse-spans=true`,
									headers: { "api-key": this.settings.apiBibleKey.trim() }
								});
								if (res.status === 200 && res.json?.data?.content) {
									if (!passages[task.bookid]) passages[task.bookid] = {};
									passages[task.bookid][task.chapter] = {
										isApiBible: true,
										html: res.json.data.content
									};
									break;
								}
							} else {
								const res = await requestUrl({
									url: `https://bolls.life/get-chapter/${version}/${task.bookid}/${task.chapter}`,
									headers: { "Accept": "application/json" }
								});
								if (res.status === 200) {
									if (!passages[task.bookid]) passages[task.bookid] = {};
									passages[task.bookid][task.chapter] = res.json;
									break;
								}
							}
						} catch (err) {
							attempts--;
							if (attempts === 0) {
								throw new Error(`Failed to download chapter ${task.chapter} of book ${task.bookName} after 3 attempts`);
							}
							await new Promise((resolve) => setTimeout(resolve, 200));
						}
					}
					completed++;
					onProgress(Math.min(99, Math.round((completed / tasks.length) * 100)));
				})
			);
		}

		const fullData = {
			version,
			books,
			passages,
			apiType
		};

		const filePath = `${dir}/${version.toUpperCase()}.json`;
		await this.app.vault.adapter.write(filePath, JSON.stringify(fullData));
		onProgress(100);
	}

	async deleteTranslation(version: string): Promise<void> {
		const filePath = `${this.manifest.dir}/translations/${version.toUpperCase()}.json`;
		const exists = await this.app.vault.adapter.exists(filePath);
		if (exists) {
			await this.app.vault.adapter.remove(filePath);
		}
	}

	getBookIdFromName(bookName: string): number {
		const BIBLE_BOOK_IDS = [
			"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
			"1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
			"ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
			"OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
			"MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
			"PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
			"1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
		];
		const BIBLE_BOOK_MAP: Record<string, string> = {
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
		const code = BIBLE_BOOK_MAP[bookName.toLowerCase()] || bookName.toUpperCase().substring(0, 3);
		const idx = BIBLE_BOOK_IDS.indexOf(code);
		return idx !== -1 ? idx + 1 : 1;
	}

	async cachePassageLocally(version: string, bookid: number, chapter: number, bookName: string, content: any): Promise<void> {
		const dir = `${this.manifest.dir}/translations`;
		const filePath = `${dir}/${version.toUpperCase()}.json`;
		try {
			const dirExists = await this.app.vault.adapter.exists(dir);
			if (!dirExists) {
				await this.app.vault.adapter.mkdir(dir);
			}

			let localData: any = {
				version,
				books: [],
				passages: {},
				apiType: this.settings.esvApiEnabled ? "esv" : (this.settings.apiBibleEnabled ? "apibible" : "bolls")
			};

			const fileExists = await this.app.vault.adapter.exists(filePath);
			if (fileExists) {
				const contentStr = await this.app.vault.adapter.read(filePath);
				localData = JSON.parse(contentStr);
			}

			// Add book list entry if missing
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

			await this.app.vault.adapter.write(filePath, JSON.stringify(localData));
		} catch (e) {
			console.error("Failed to auto-cache chapter locally:", e);
		}
	}


	async writeLog(message: string) {
		if (!this.settings.enableLogging) return;
		try {
			const logPath = `${this.manifest.dir}/bible-sidecar-plus-debug.log`;
			const timestamp = new Date().toISOString();
			const formattedMessage = `[${timestamp}] ${message}\n`;
			
			const exists = await this.app.vault.adapter.exists(logPath);
			if (!exists) {
				await this.app.vault.adapter.write(logPath, formattedMessage);
			} else {
				await this.app.vault.adapter.append(logPath, formattedMessage);
			}
		} catch (err) {
			console.error("Failed to write to bible-sidecar-plus-debug.log:", err);
		}
	}

	async onload() {
		await this.loadSettings();

		document.body.classList.toggle("bible-hide-link-icons", this.settings.hideLinkIcon);

		this.addSettingTab(new BibleSidecarSettingsTab(this.app, this));

		this.registerView(
			BibleViewType,
			(leaf: WorkspaceLeaf) => {
				const view = new BibleView(leaf);
				this.view = view;
				view.plugin = this;
				view.settings = this.settings;
				return view;
			}
		);

		this.addRibbonIcon(
			"book-open-text",
			"Bible Sidecar",
			(evt: MouseEvent) => {
				this.toggleBibleSidecarView();
			}
		);

		this.addCommand({
			id: "open-bible-sidecar",
			name: "Open Bible Sidecar",
			callback: this.toggleBibleSidecarView,
			icon: "book-open-text",
		});
		
		this.addCommand({
			id: "convert-to-sidecar-link",
			name: "Convert Selection to Sidecar Link",
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection().trim();
				const regex = SELECTION_REGEX;
				const verseRegex = SELECTION_VERSE_REGEX;
				const match = selection.match(regex);
				const verseMatch = !match ? selection.match(verseRegex) : null;
				
				if (match) {
					const book = match[1].trim();
					const chapter = match[2];
					const startVerse = match[3];
					const endVerse = match[4]; // This captures the end of the range if it exists
					
					const rangeStr = endVerse ? `${startVerse}-${endVerse}` : startVerse;
					const uri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${startVerse}${endVerse ? `&endVerse=${endVerse}` : ""}`;
					
					let referenceText = "";
					if (this.settings.verseReferenceInternalLinking) {
						referenceText = `[[${book}]] [${chapter}:${rangeStr}](${uri})`;
					} else {
						referenceText = `[${book} ${chapter}:${rangeStr}](${uri})`;
					}
					
					editor.replaceSelection(referenceText);
				} else if (verseMatch) {
					const context = this.getContextBibleReference(editor);
					if (!context) {
						new Notice("Could not find previous Bible reference for context.");
						return;
					}
					const startVerse = verseMatch[1];
					const endVerse = verseMatch[2];
					const rangeStr = endVerse ? startVerse + "-" + endVerse : startVerse;
					const uri = "obsidian://bible?book=" + encodeURIComponent(context.book) + "&chapter=" + context.chapter + "&verse=" + startVerse + (endVerse ? "&endVerse=" + endVerse : "");
					const displayVerse = selection.startsWith("V") ? "V" + rangeStr : "v" + rangeStr;
					const referenceText = "[" + displayVerse + "](" + uri + ")";
					editor.replaceSelection(referenceText);
				} else {
					new Notice("Please select a valid verse range (e.g., John 2:3, John 2:3-5, or Romans 1:2-2:2)");
				}
			}
		});

		this.addCommand({
			id: "bible-sidecar-focus-search",
			name: "Focus Scripture Search",
			callback: async () => {
				await this.toggleBibleSidecarView();
				setTimeout(() => {
					const searchTab = document.querySelector(".bible-tab-btn:nth-child(2)") as HTMLElement;
					if (searchTab) searchTab.click();
				}, 150);
			}
		});

		this.addCommand({
			id: "bible-sidecar-toggle-red-letters",
			name: "Toggle Gospel Words in Red",
			callback: async () => {
				this.settings.gospelQuotesRed = !this.settings.gospelQuotesRed;
				await this.saveSettings();
				new Notice(`Gospel red letters are now ${this.settings.gospelQuotesRed ? "enabled" : "disabled"}.`);
			}
		});

		this.addCommand({
			id: "bible-sidecar-copy-verse-context",
			name: "Copy Verse from Cursor Context",
			editorCallback: async (editor: Editor) => {
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				const regex = CONTEXT_REGEX;
				const match = lineText.match(regex);
				if (!match) {
					new Notice("Could not find any Bible reference on this line (e.g. John 3:16).");
					return;
				}
				const book = match[1].trim();
				const chapter = parseInt(match[2]);
				const startVerse = parseInt(match[3]);
				const endVerse = match[4] ? parseInt(match[4]) : startVerse;

				new Notice(`Fetching context scripture: ${book} ${chapter}:${startVerse}${endVerse !== startVerse ? "-" + endVerse : ""}...`);

				try {
					const localData = await this.readLocalTranslation(this.settings.bibleVersion);
					let versesList: string[] = [];
					let fetchSuccess = false;

					if (localData) {
						const targetBook = localData.books.find((b: any) => b.name.toLowerCase() === book.toLowerCase());
						if (targetBook) {
							const chapterVerses = localData.passages[targetBook.bookid]?.[chapter];
							if (chapterVerses) {
								for (const verse of chapterVerses) {
									const vNum = parseInt(verse.verse);
									if (vNum >= startVerse && vNum <= endVerse) {
										const cleanText = verse.text.replace(/<[^>]*>?/gm, '').replace(/^\d+:\d+\s*/, "").trim();
										const supText = convertToSuperscript(verse.verse);
										versesList.push(`${supText} ${cleanText}`);
									}
								}
								fetchSuccess = true;
							}
						}
					}

					if (!fetchSuccess) {
						const booksRes = await requestUrl(`https://bolls.life/get-books/${this.settings.bibleVersion}`);
						const targetBook = booksRes.json.find((b: any) => b.name.toLowerCase() === book.toLowerCase());
						if (targetBook) {
							const chapterRes = await requestUrl(`https://bolls.life/get-chapter/${this.settings.bibleVersion}/${targetBook.bookid}/${chapter}`);
							for (const verse of chapterRes.json) {
								const vNum = parseInt(verse.verse);
								if (vNum >= startVerse && vNum <= endVerse) {
									const cleanText = verse.text.replace(/<[^>]*>?/gm, '').replace(/^\d+:\d+\s*/, "").trim();
									const supText = convertToSuperscript(verse.verse);
									versesList.push(`${supText} ${cleanText}`);
								}
							}
							fetchSuccess = true;
						}
					}

					if (versesList.length > 0) {
						const scriptureText = versesList.join(" ");
						const rangeStr = startVerse === endVerse ? startVerse.toString() : `${startVerse}-${endVerse}`;
						const uri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${startVerse}${startVerse !== endVerse ? `&endVerse=${endVerse}` : ""}`;
						let referenceLink = "";
						if (this.settings.verseReferenceInternalLinking) {
							referenceLink = `[[${book}]] [${chapter}:${rangeStr}](${uri})`;
						} else {
							referenceLink = `[${book} ${chapter}:${rangeStr}](${uri})`;
						}

						let finalText = "";
						if (this.settings.copyFormat === "callout") {
							finalText = `> [!quote] ${referenceLink}\n> ${scriptureText}`;
						} else {
							if (this.settings.copyVerseReference) {
								finalText = `${scriptureText}\n${this.settings.verseReferenceStyle}${referenceLink}`;
							} else {
								finalText = scriptureText;
							}
						}

						await copyToClipboard(finalText.trim());
						new Notice(`Copied ${book} ${chapter}:${rangeStr} to clipboard!`);
					} else {
						new Notice(`No verses found for ${book} ${chapter}:${startVerse}.`);
					}
				} catch (err) {
					console.error(err);
					new Notice("Failed to copy verse from context.");
				}
			}
		});
		
		// Auto-replace text as you type
		// 1. Replace the entire "editor-change" registerEvent block in main.ts
		this.registerEvent(
			this.app.workspace.on("editor-change", (editor: Editor) => {
				if (!this.settings.autoExpandBibleReferences) return;
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				const textBeforeCursor = lineText.substring(0, cursor.ch);
				
				const regex = AUTO_EXPAND_REGEX;
				const verseRegex = AUTO_EXPAND_VERSE_REGEX;
				const match = textBeforeCursor.match(regex);
				const verseMatch = !match ? textBeforeCursor.match(verseRegex) : null;
				
				if (match) {
					const fullMatch = match[0];
					const book = match[1].trim();
					const startChapter = parseInt(match[2]);
					const startVerse = parseInt(match[3]);
					let endChapter = startChapter;
					let endVerse = startVerse;
					
					if (match[4]) {
						if (match[4].includes(":")) {
							const parts = match[4].split(":");
							endChapter = parseInt(parts[0]);
							endVerse = parseInt(parts[1]);
						} else {
							endVerse = parseInt(match[4]);
						}
					}
					
					const flag = match[5] ? match[5].toLowerCase() : null;
					
					const rangeStr = (startChapter === endChapter) 
						? (startVerse === endVerse ? startVerse.toString() : `${startVerse}-${endVerse}`)
						: `${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
					
					const uri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${startChapter}&verse=${startVerse}${startChapter === endChapter && startVerse !== endVerse ? `&endVerse=${endVerse}` : ""}`;
					
					let referenceText = "";
					if (this.settings.verseReferenceInternalLinking) {
						referenceText = `[[${book}]] [${startChapter === endChapter ? startChapter + ":" : ""}${rangeStr}](${uri})`;
					} else {
						referenceText = `[${book} ${startChapter === endChapter ? startChapter + ":" : ""}${rangeStr}](${uri})`;
					}
					
					const startCh = cursor.ch - fullMatch.length;
					const formattedReferenceText = formatAutoExpandText(
						referenceText,
						this.settings.autoExpandReferenceStyle
					);
					if (!flag) {
						editor.replaceRange(
							formattedReferenceText + " ",
							{ line: cursor.line, ch: startCh },
							{ line: cursor.line, ch: cursor.ch }
						);
					} else {
						// Removed unicode emoji to prevent offset calculation bugs
						const placeholder = `[Fetching ${book} ${rangeStr}...]`;
						editor.replaceRange(
							placeholder + " ",
							{ line: cursor.line, ch: startCh },
							{ line: cursor.line, ch: cursor.ch }
						);
						
						this.fetchAndReplaceBibleText(editor, placeholder, book, startChapter, startVerse, endChapter, endVerse, flag, referenceText);
					}
				}
					else if (verseMatch) {
					const context = this.getContextBibleReference(editor);
					if (!context) return;
					const fullMatch = verseMatch[0];
					const book = context.book;
					const startChapter = context.chapter;
					const startVerse = parseInt(verseMatch[1]);
					let endChapter = startChapter;
					let endVerse = verseMatch[2] ? parseInt(verseMatch[2]) : startVerse;
					const flag = verseMatch[3] ? verseMatch[3].toLowerCase() : null;
					const rangeStr = startVerse === endVerse ? startVerse.toString() : startVerse + "-" + endVerse;
					const uri = "obsidian://bible?book=" + encodeURIComponent(book) + "&chapter=" + startChapter + "&verse=" + startVerse + (startVerse !== endVerse ? "&endVerse=" + endVerse : "");
					const displayVerse = fullMatch.includes("--V") ? "V" + rangeStr : "v" + rangeStr;
					const referenceText = "[" + displayVerse + "](" + uri + ")";
					const startCh = cursor.ch - fullMatch.length;
					const formattedReferenceText = formatAutoExpandText(referenceText, this.settings.autoExpandReferenceStyle);
					if (!flag) {
						editor.replaceRange(formattedReferenceText + " ", { line: cursor.line, ch: startCh }, { line: cursor.line, ch: cursor.ch });
					} else {
						const placeholder = "[Fetching " + book + " " + startChapter + ":" + rangeStr + "...]";
						editor.replaceRange(placeholder + " ", { line: cursor.line, ch: startCh }, { line: cursor.line, ch: cursor.ch });
						this.fetchAndReplaceBibleText(editor, placeholder, book, startChapter, startVerse, endChapter, endVerse, flag, referenceText);
					}
				}
			})
		);

		// Custom Protocol handler for obsidian://bible
		this.registerObsidianProtocolHandler("bible", async (params) => {
			let leaf = this.app.workspace.getLeavesOfType(BibleViewType)[0];
			
			if (!leaf) {
				const rightLeaf = this.app.workspace.getRightLeaf(false);
				if (rightLeaf) {
					await rightLeaf.setViewState({ type: BibleViewType, active: true });
					leaf = this.app.workspace.getLeavesOfType(BibleViewType)[0];
				}
			}
			
			if (leaf) {
				this.app.workspace.revealLeaf(leaf);
				if (this.view && typeof (this.view as any).navigateToPassage === "function") {
					const endVerse = params.endVerse || params.endverse;
					await (this.view as any).navigateToPassage(
						params.book,
						parseInt(params.chapter),
						parseInt(params.verse),
						endVerse ? parseInt(endVerse) : undefined
					);
				}
			}
		});

		this.initLeaf();
	}

	onunload() {
		document.body.classList.remove("bible-hide-link-icons");
		console.log("Unloaded Bible Sidecar");
	}

	private readonly toggleBibleSidecarView = async (): Promise<void> => {
		const existing = this.app.workspace.getLeavesOfType(BibleViewType);
		if (existing.length) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			await rightLeaf.setViewState({
				type: BibleViewType,
				active: true,
			});
		}

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(BibleViewType)[0]
		);
	};

		private getContextBibleReference(editor: Editor): { book: string, chapter: number } | null {
		const docText = editor.getValue();
		const cursorOffset = editor.posToOffset(editor.getCursor());
		const textBefore = docText.substring(0, cursorOffset);
		const uriRegex = /obsidian:\/\/bible\?book=([^&]+)&chapter=(\d+)/gi;
		let lastMatch = null;
		let match;
		while ((match = uriRegex.exec(textBefore)) !== null) {
			lastMatch = match;
		}
		if (lastMatch) {
			return {
				book: decodeURIComponent(lastMatch[1]),
				chapter: parseInt(lastMatch[2])
			};
		}
		return null;
	}

	initLeaf(): void {
		if (this.app.workspace.getLeavesOfType(BibleViewType).length) {
			console.log("Bible view already open");
			return;
		}
	}

	updateBibleViewSettings = (newSettings: BibleSidecarSettings) => {
		if (this.view) {
			this.view.updateSettings(newSettings);
		}
	};

	async loadSettings() {
		await this.loadData().then((data) => {
			this.settings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				data,
				{
					bibleVersion:
						data?.bibleLanguage &&
						LANGUAGE_DEFAULT_VERSIONS[data.bibleLanguage]
							? LANGUAGE_DEFAULT_VERSIONS[data.bibleLanguage]
							: LANGUAGE_DEFAULT_VERSIONS["en"], 
				}
			);
		});
	}

	async fetchAndReplaceBibleText(
		editor: Editor,
		placeholder: string,
		bookName: string,
		startChapter: number,
		startVerse: number,
		endChapter: number,
		endVerse: number,
		flag: string,
		referenceText: string
	) {
		try {
			const versesArray: { verse: number; text: string; chapter?: number }[] = [];
			let fetchSuccess = false;

			const isEsvApiActive = this.settings.esvApiEnabled && 
			                       this.settings.esvApiKey.trim() && 
			                       this.settings.bibleVersion.toUpperCase() === "ESV";

			if (isEsvApiActive) {
				try {
					const query = startChapter === endChapter 
						? `${bookName} ${startChapter}:${startVerse}-${endVerse}`
						: `${bookName} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
					const response = await requestUrl({
						url: `https://api.esv.org/v3/passage/html/?q=${encodeURIComponent(query)}&include-verse-numbers=true&include-first-verse-numbers=true&include-headings=false&include-footnotes=false&include-audio-link=false&include-passage-references=false&include-copyright=false&include-short-copyright=false&wrapping-div=false`,
						headers: { "Authorization": `Token ${this.settings.esvApiKey.trim()}` }
					});

					if (response.status === 200 && response.json?.passages?.[0]) {
						const parser = new DOMParser();
						const doc = parser.parseFromString(response.json.passages[0], "text/html");
						
						// Clean up any extra elements returned by the API
						doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());

						const spans = doc.querySelectorAll("b.verse-num, b.chapter-num, span.chapter-num");
						
						let currentChapter = startChapter;
						spans.forEach((span) => {
							let textContent = span.textContent || "";
							let verseNum = 0;
							
							if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
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
								let text = "";
								let next = span.nextSibling;
								while (next && !(next instanceof Element && (next.classList.contains("verse-num") || next.classList.contains("chapter-num") || (next.tagName.toLowerCase() === "b" && next.classList.contains("verse-num"))))) {
									text += next.textContent || "";
									next = next.nextSibling;
								}
								let cleanText = text.trim().replace(/\n+/g, " ");
								cleanText = cleanText.replace(/^\d+:\d+\s*/, "");

								versesArray.push({ verse: verseNum, text: cleanText, chapter: currentChapter });
							}
						});
						if (versesArray.length > 0) {
							fetchSuccess = true;
							const bookid = this.getBookIdFromName(bookName);
							this.cachePassageLocally(this.settings.bibleVersion, bookid, startChapter, bookName, {
								isEsvApi: true,
								isFullyCached: true,
								html: response.json.passages[0]
							});
						}
					}
				} catch (err) {
					console.warn("ESV API fetch failed in auto-expand, falling back to bolls.life:", err);
				}
			}

			if (!fetchSuccess && this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim()) {
				try {
					const BIBLE_BOOK_MAP: Record<string, string> = {
						"genesis": "GEN", "exodus": "EXO", "leviticus": "LEV", "numbers": "NUM", "deuteronomy": "DEU",
						"joshua": "JOS", "judges": "JDG", "ruth": "RUT", "1 samuel": "1SA", "2 samuel": "2SA",
						"1 kings": "1KI", "2 kings": "2KI", "1 chronicles": "1CH", "2 chronicles": "2CH", "1 chapters": "1CH",
						"2 chapters": "2CH", "ezra": "EZR", "nehemiah": "NEH", "esther": "EST", "job": "JOB",
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
					const bookId = BIBLE_BOOK_MAP[bookName.toLowerCase()] || bookName.toUpperCase().substring(0, 3);

					for (let ch = startChapter; ch <= endChapter; ch++) {
						const response = await requestUrl({
							url: `https://api.scripture.api.bible/v1/bibles/${this.settings.apiBibleVersionId}/chapters/${bookId}.${ch}?include-verse-spans=true`,
							headers: { "api-key": this.settings.apiBibleKey.trim() }
						});

						if (response.status === 200 && response.json?.data?.content) {
							const bookid = this.getBookIdFromName(bookName);
							this.cachePassageLocally(this.settings.bibleVersion, bookid, ch, bookName, {
								isApiBible: true,
								isFullyCached: true,
								html: response.json.data.content
							});

							const parser = new DOMParser();
							const doc = parser.parseFromString(response.json.data.content, "text/html");
							const spans = doc.querySelectorAll("span.v");
							
							spans.forEach((span) => {
								const verseNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
								const isWithinRange = 
									(ch > startChapter || (ch === startChapter && verseNum >= startVerse)) &&
									(ch < endChapter || (ch === endChapter && verseNum <= endVerse));

								if (isWithinRange) {
									let text = "";
									let next = span.nextSibling;
									while (next && !(next instanceof Element && next.classList.contains("v"))) {
										text += next.textContent || "";
										next = next.nextSibling;
									}
									let cleanText = text.trim().replace(/\n+/g, " ");
									cleanText = cleanText.replace(/^\d+:\d+\s*/, "");

									versesArray.push({ verse: verseNum, text: cleanText, chapter: ch });
								}
							});
						}
					}
					if (versesArray.length > 0) {
						fetchSuccess = true;
					}
				} catch (err) {
					console.warn("API.Bible fetch failed in auto-expand, falling back to bolls.life:", err);
				}
			}

			if (!fetchSuccess) {
				const localData = await this.readLocalTranslation(this.settings.bibleVersion);
				if (localData) {
					try {
						const targetBook = localData.books.find((b: any) => b.name.toLowerCase() === bookName.toLowerCase());
						if (targetBook) {
							let localFetchSuccess = false;
							for (let ch = startChapter; ch <= endChapter; ch++) {
								const cachedChapter = localData.passages[targetBook.bookid]?.[ch];
								if (!cachedChapter) continue;

								// Skip premium API cache entries that were not fully fetched
								if ((cachedChapter.isEsvApi || cachedChapter.isApiBible) && !cachedChapter.isFullyCached) continue;

								if (cachedChapter.isEsvApi) {
									const parser = new DOMParser();
									const doc = parser.parseFromString(cachedChapter.html, "text/html");
									doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());
									
									const spans = doc.querySelectorAll("b.verse-num, b.chapter-num, span.chapter-num");
									let currentChapter = startChapter;
									
									spans.forEach((span) => {
										let textContent = span.textContent || "";
										let verseNum = 0;
										
										if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
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
											let text = "";
											let next = span.nextSibling;
											while (next && !(next instanceof Element && (next.classList.contains("verse-num") || next.classList.contains("chapter-num") || (next.tagName.toLowerCase() === "b" && next.classList.contains("verse-num"))))) {
												text += next.textContent || "";
												next = next.nextSibling;
											}
											let cleanText = text.trim().replace(/\n+/g, " ");
											cleanText = cleanText.replace(/^\d+:\d+\s*/, "");

											versesArray.push({ verse: verseNum, text: cleanText, chapter: currentChapter });
										}
									});
									localFetchSuccess = true;
								} else if (cachedChapter.isApiBible) {
									const parser = new DOMParser();
									const doc = parser.parseFromString(cachedChapter.html, "text/html");
									const spans = doc.querySelectorAll("span.v");
									
									spans.forEach((span) => {
										const verseNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
										const isWithinRange = 
											(ch > startChapter || (ch === startChapter && verseNum >= startVerse)) &&
											(ch < endChapter || (ch === endChapter && verseNum <= endVerse));

										if (isWithinRange) {
											let text = "";
											let next = span.nextSibling;
											while (next && !(next instanceof Element && next.classList.contains("v"))) {
												text += next.textContent || "";
												next = next.nextSibling;
											}
											let cleanText = text.trim().replace(/\n+/g, " ");
											cleanText = cleanText.replace(/^\d+:\d+\s*/, "");

											versesArray.push({ verse: verseNum, text: cleanText, chapter: ch });
										}
									});
									localFetchSuccess = true;
								} else {
									for (const verse of cachedChapter) {
										const vNum = parseInt(verse.verse);
										const isWithinRange = 
											(ch > startChapter || (ch === startChapter && vNum >= startVerse)) &&
											(ch < endChapter || (ch === endChapter && vNum <= endVerse));

										if (isWithinRange) {
											let cleanText = verse.text.replace(/<br\s*\/?>|<\/?i>|<\/?b>/gi, "\n").replace(/<[^>]*>?/gm, '');
											cleanText = cleanText.replace(/^\d+:\d+\s*/, "");
											
											versesArray.push({ verse: vNum, text: cleanText, chapter: ch });
										}
									}
									localFetchSuccess = true;
								}
							}
							if (versesArray.length > 0 && localFetchSuccess) {
								fetchSuccess = true;
							}
						}
					} catch (err) {
						console.warn("Failed reading offline bible data, falling back to online fetch:", err);
					}
				}
			}

			if (!fetchSuccess) {
				// Fallback to bolls.life
				const booksRes = await requestUrl(`https://bolls.life/get-books/${this.settings.bibleVersion}`);
				const targetBook = booksRes.json.find((b: any) => b.name.toLowerCase() === bookName.toLowerCase());

				if (!targetBook) throw new Error("Book not found");

				for (let ch = startChapter; ch <= endChapter; ch++) {
					const chapterRes = await requestUrl(`https://bolls.life/get-chapter/${this.settings.bibleVersion}/${targetBook.bookid}/${ch}`);
					
					for (const verse of chapterRes.json) {
						const vNum = parseInt(verse.verse);
						const isWithinRange = 
							(ch > startChapter || (ch === startChapter && vNum >= startVerse)) &&
							(ch < endChapter || (ch === endChapter && vNum <= endVerse));

						if (isWithinRange) {
							let cleanText = verse.text.replace(/<br\s*\/?>|<\/?i>|<\/?b>/gi, "\n").replace(/<[^>]*>?/gm, '');
							cleanText = cleanText.replace(/^\d+:\d+\s*/, "");
							
							versesArray.push({ verse: vNum, text: cleanText, chapter: ch });
						}
					}
				}
			}

			if (versesArray.length === 0) throw new Error("No verses found");

			const finalOutput = compileAutoExpandOutput(
				versesArray,
				bookName,
				startChapter,
				flag,
				referenceText,
				this.settings
			);

			const doc = editor.getValue();
			const offset = doc.indexOf(`${placeholder} `);
			
			if (offset !== -1) {
				const from = editor.offsetToPos(offset);
				const to = editor.offsetToPos(offset + placeholder.length + 1);
				editor.replaceRange(finalOutput, from, to);
			}
		} catch (error) {
			console.error("Bible Sidecar fetch error:", error);
			const doc = editor.getValue();
			const offset = doc.indexOf(`${placeholder} `);
			if (offset !== -1) {
				const from = editor.offsetToPos(offset);
				const to = editor.offsetToPos(offset + placeholder.length + 1);
				editor.replaceRange(`[Error fetching verses]`, from, to);
			}
		}
	}



	async saveSettings() {
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
		}
		this.saveDebounceTimer = setTimeout(async () => {
			await this.saveData(this.settings);
			document.body.classList.toggle("bible-hide-link-icons", this.settings.hideLinkIcon);
			console.log("Saved settings", this.settings);
			this.updateBibleViewSettings(this.settings);
			this.saveDebounceTimer = null;
		}, 400);
	}
}
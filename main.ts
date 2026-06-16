import { BibleView, BibleViewType } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";
import { Plugin, WorkspaceLeaf, Editor, Notice, requestUrl, SuggestModal, App, MarkdownView } from "obsidian";
import { ScriptureProvider, ObsidianScriptureProvider } from "./ScriptureProvider";
import { OfflineCacheStore } from "./OfflineCacheStore";
import {
	SELECTION_REGEX,
	SELECTION_VERSE_REGEX,
	CONTEXT_REGEX,
	AUTO_EXPAND_REGEX,
	AUTO_EXPAND_VERSE_REGEX,
	compileAutoExpandRegex,
	compileAutoExpandVerseRegex,
	convertToSuperscript,
	formatAutoExpandText,
	compileAutoExpandOutput,
	copyToClipboard,
	BIBLE_BOOK_IDS,
	getBookIdFromName,
	expandRange,
	parseProtocolParams,
	updateLocalCacheData,
	cleanHtmlKeepRedSpans,
	compileReferenceLink,
	compileFormattedPassage
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
	enableOfflineAccents: boolean;
	parallelEnabled: boolean;
	secondaryBibleVersion: string;
	showCrossReferences: boolean;
	showStrongsNumbers: boolean;
	autoExpandTriggerPrefix: string;
}

export const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "ESV",
	copyFormat: "plain",
	copyVerseReference: true,
	verseReferenceStyle: "> ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: true,
	autoExpandBibleReferences: true,
	autoExpandReferenceStyle: "plain",
	autoExpandScriptureStyle: "italic",
	bibleLanguage: "en",
	enableOfflineAccents: true,
	autoExpandCallout_p: false,
	autoExpandCalloutType_p: "quote",
	autoExpandCalloutTitle_p: "Scripture: {{reference}}",
	autoExpandCallout_l: true,
	autoExpandCalloutType_l: "note",
	autoExpandCalloutTitle_l: "{{reference}}",
	autoExpandCallout_q: false,
	autoExpandCalloutType_q: "quote",
	autoExpandCalloutTitle_q: "Scripture: {{reference}}",
	autoExpandReferenceStyle_p: "plain",
	autoExpandScriptureStyle_p: "plain",
	autoExpandReferenceStyle_l: "plain",
	autoExpandScriptureStyle_l: "plain",
	autoExpandReferenceStyle_q: "plain",
	autoExpandScriptureStyle_q: "italic",
	autoExpandTriggerPrefix: "--",
	gospelQuotesRed: true,
	hideLinkIcon: true,
	separateVersesSidecar: false,
	apiBibleEnabled: false,
	apiBibleKey: "",
	apiBibleVersionId: "78a9f6124f344018-01",
	esvApiEnabled: true,
	esvApiKey: "",
	enableLogging: false,
	abbreviateBookNames: false,
	parallelEnabled: false,
	secondaryBibleVersion: "KJV",
	showCrossReferences: false,
	showStrongsNumbers: false,
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
	scriptureProvider: ScriptureProvider;
	cacheStore: OfflineCacheStore;
	private view: BibleView | undefined;
	apiBiblesCache: { id: string; name: string }[] | null = null;
	private saveDebounceTimer: NodeJS.Timeout | null = null;

	get pluginDir(): string {
		return `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
	}

	async getDownloadedTranslations(): Promise<string[]> {
		return this.cacheStore.getDownloadedTranslations();
	}

	async isTranslationDownloaded(version: string): Promise<boolean> {
		return this.cacheStore.isTranslationDownloaded(version);
	}

	async readLocalTranslation(version: string): Promise<any | null> {
		return this.cacheStore.readLocalTranslation(version);
	}

	async downloadTranslation(version: string, onProgress: (progress: number) => void): Promise<void> {
		const dir = `${this.pluginDir}/translations`;
		const dirExists = await this.app.vault.adapter.exists(dir);
		if (!dirExists) {
			await this.app.vault.adapter.mkdir(dir);
		}

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

		const books = await this.scriptureProvider.fetchBooks(version);

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
							const res = await this.scriptureProvider.fetchChapter(version, task.bookid, task.chapter);
							if (!passages[task.bookid]) passages[task.bookid] = {};
							passages[task.bookid][task.chapter] = res;
							break;
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

		await this.cacheStore.writeLocalTranslation(version, fullData);
		onProgress(100);
	}

	async deleteTranslation(version: string): Promise<void> {
		await this.cacheStore.deleteTranslation(version);
	}

	getBookIdFromName(bookName: string): number {
		return getBookIdFromName(bookName);
	}

	async cachePassageLocally(version: string, bookid: number, chapter: number, bookName: string, content: any): Promise<void> {
		const apiType = this.settings.esvApiEnabled ? "esv" : (this.settings.apiBibleEnabled ? "apibible" : "bolls");
		await this.cacheStore.cachePassageLocally(version, bookid, chapter, bookName, content, apiType);
	}


	async writeLog(message: string) {
		if (!this.settings.enableLogging) return;
		try {
			const logPath = `${this.pluginDir}/bible-sidecar-plus-debug.log`;
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

		this.cacheStore = new OfflineCacheStore(this.app.vault.adapter, this.pluginDir);
		this.scriptureProvider = new ObsidianScriptureProvider(this.settings);

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

		this.addRibbonIcon(
			"search",
			"Search Bible Verse Reference",
			(evt: MouseEvent) => {
				new QuickReferenceModal(this.app, this).open();
			}
		);

		this.addCommand({
			id: "open-bible-sidecar",
			name: "Open Bible Sidecar",
			callback: this.toggleBibleSidecarView,
			icon: "book-open-text",
		});

		this.addCommand({
			id: "bible-sidecar-quick-reference",
			name: "Search and Reference Verse",
			editorCallback: (editor: Editor) => {
				new QuickReferenceModal(this.app, this, editor).open();
			},
			callback: () => {
				new QuickReferenceModal(this.app, this).open();
			}
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
					const verseVal = expandRange(startVerse, endVerse);
					const referenceText = compileReferenceLink(
						book,
						parseInt(chapter),
						rangeStr,
						verseVal,
						this.settings.verseReferenceInternalLinking,
						this.settings.verseReferenceFormat
					);
					
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
					const verseVal = expandRange(startVerse, endVerse);
					const uri = "obsidian://bible?book=" + encodeURIComponent(context.book) + "&chapter=" + context.chapter + "&verse=" + verseVal;
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
										const vUri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${vNum}`;
										versesList.push(`[${supText}](${vUri}) ${cleanText}`);
									}
								}
								fetchSuccess = true;
							}
						}
					}

					if (!fetchSuccess) {
						const books = await this.scriptureProvider.fetchBooks(this.settings.bibleVersion);
						const targetBook = books.find((b: any) => b.name.toLowerCase() === book.toLowerCase());
						if (targetBook) {
							const chapterContent = await this.scriptureProvider.fetchChapter(this.settings.bibleVersion, targetBook.bookid, chapter);
							
							// If it's a Bolls.life array
							if (Array.isArray(chapterContent)) {
								for (const verse of chapterContent) {
									const vNum = parseInt(verse.verse);
									if (vNum >= startVerse && vNum <= endVerse) {
										const cleanText = verse.text.replace(/<[^>]*>?/gm, '').replace(/^\d+:\d+\s*/, "").trim();
										const supText = convertToSuperscript(verse.verse);
										const vUri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${vNum}`;
										versesList.push(`[${supText}](${vUri}) ${cleanText}`);
									}
								}
								fetchSuccess = true;
							} else if (chapterContent && (chapterContent.isEsvApi || chapterContent.isApiBible)) {
								const parser = new DOMParser();
								const doc = parser.parseFromString(chapterContent.html, "text/html");
								doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());
								
								const isEsv = chapterContent.isEsvApi;
								const spans = doc.querySelectorAll(isEsv ? "b.verse-num, b.chapter-num, span.chapter-num" : "span.v");
								
								spans.forEach((span) => {
									let verseNumText = isEsv ? (span.textContent?.trim() || "") : (span.getAttribute("data-number") || span.textContent || "");
									if (isEsv) {
										if (verseNumText.includes(":")) {
											verseNumText = verseNumText.split(":")[1];
										} else if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
											verseNumText = "1";
										}
									}
									const vNum = parseInt(verseNumText.trim()) || 0;
									if (vNum >= startVerse && vNum <= endVerse) {
										let text = "";
										let next = span.nextSibling;
										const verseClass = isEsv ? "verse-num" : "v";
										if (!next && !isEsv && span.parentElement && span.parentElement.classList.contains("verse-span")) {
											next = span.parentElement.nextSibling;
										}
										while (next && !(next instanceof Element && (
											next.classList.contains(verseClass) || 
											(!isEsv && next.querySelector("." + verseClass)) ||
											next.classList.contains("chapter-num") || 
											(next.tagName.toLowerCase() === "b" && next.classList.contains("verse-num")) ||
											(next.tagName.toLowerCase() === "span" && next.classList.contains("chapter-num"))
										))) {
											text += next.textContent || "";
											next = next.nextSibling;
										}
										const cleanText = text.trim().replace(/\n+/g, " ").replace(/^\d+:\d+\s*/, "");
										const supText = convertToSuperscript(vNum.toString());
										const vUri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${vNum}`;
										versesList.push(`[${supText}](${vUri}) ${cleanText}`);
									}
								});
								fetchSuccess = true;
							}
						}
					}

					if (versesList.length > 0) {
						const scriptureText = versesList.join(" ");
						const rangeStr = startVerse === endVerse ? startVerse.toString() : `${startVerse}-${endVerse}`;
						const vList = [];
						for (let v = startVerse; v <= endVerse; v++) {
							vList.push(v);
						}
						const verseVal = vList.join(",");
						const referenceLink = compileReferenceLink(
							book,
							chapter,
							rangeStr,
							verseVal,
							this.settings.verseReferenceInternalLinking,
							this.settings.verseReferenceFormat
						);

						const finalText = compileFormattedPassage(scriptureText, referenceLink, this.settings);

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
				
				const prefix = this.settings.autoExpandTriggerPrefix || "--";
				const regex = compileAutoExpandRegex(prefix);
				const verseRegex = compileAutoExpandVerseRegex(prefix);
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
					
					let verseVal = startVerse.toString();
					if (startChapter === endChapter && startVerse !== endVerse) {
						const vList = [];
						for (let v = startVerse; v <= endVerse; v++) {
							vList.push(v);
						}
						verseVal = vList.join(",");
					}
					const uri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${startChapter}&verse=${verseVal}`;
					
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
					let verseVal = startVerse.toString();
					if (startVerse !== endVerse) {
						const vList = [];
						for (let v = startVerse; v <= endVerse; v++) {
							vList.push(v);
						}
						verseVal = vList.join(",");
					}
					const uri = "obsidian://bible?book=" + encodeURIComponent(book) + "&chapter=" + startChapter + "&verse=" + verseVal;
					const displayVerse = fullMatch.startsWith((this.settings.autoExpandTriggerPrefix || "--") + "V") ? "V" + rangeStr : "v" + rangeStr;
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
					const parsed = parseProtocolParams(params);
					await (this.view as any).navigateToPassage(
						parsed.book,
						parsed.chapter,
						parsed.verse,
						parsed.endVerse
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
			const bookid = this.getBookIdFromName(bookName);

			const isEsvApiActive = this.settings.esvApiEnabled && 
			                       this.settings.esvApiKey.trim() && 
			                       this.settings.bibleVersion.toUpperCase() === "ESV";

			if (isEsvApiActive) {
				try {
					for (let ch = startChapter; ch <= endChapter; ch++) {
						const chapterContent = await this.scriptureProvider.fetchChapter(this.settings.bibleVersion, bookid, ch);
						if (chapterContent && chapterContent.html) {
							const parser = new DOMParser();
							const doc = parser.parseFromString(chapterContent.html, "text/html");
							
							doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());

							const spans = doc.querySelectorAll("b.verse-num, b.chapter-num, span.chapter-num");
							
							let currentChapter = ch;
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
						}
					}
					if (versesArray.length > 0) {
						fetchSuccess = true;
					}
				} catch (err) {
					console.warn("ESV API fetch failed in auto-expand, falling back to bolls.life:", err);
				}
			}

			if (!fetchSuccess && this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim()) {
				try {
					for (let ch = startChapter; ch <= endChapter; ch++) {
						const chapterContent = await this.scriptureProvider.fetchChapter(this.settings.bibleVersion, bookid, ch);
						if (chapterContent && chapterContent.html) {
							this.cachePassageLocally(this.settings.bibleVersion, bookid, ch, bookName, {
								isApiBible: true,
								isFullyCached: true,
								html: chapterContent.html
							});

							const parser = new DOMParser();
							const doc = parser.parseFromString(chapterContent.html, "text/html");
							const spans = doc.querySelectorAll("span.v");
							
							spans.forEach((span) => {
								const verseNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
								const isWithinRange = 
									(ch > startChapter || (ch === startChapter && verseNum >= startVerse)) &&
									(ch < endChapter || (ch === endChapter && verseNum <= endVerse));

								if (isWithinRange) {
									let text = "";
									let next = span.nextSibling;
									if (!next && span.parentElement && span.parentElement.classList.contains("verse-span")) {
										next = span.parentElement.nextSibling;
									}
									while (next && !(next instanceof Element && (next.classList.contains("v") || next.querySelector(".v")))) {
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
												text += cleanHtmlKeepRedSpans(next);
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
											if (!next && span.parentElement && span.parentElement.classList.contains("verse-span")) {
												next = span.parentElement.nextSibling;
											}
											while (next && !(next instanceof Element && (next.classList.contains("v") || next.querySelector(".v")))) {
												text += cleanHtmlKeepRedSpans(next);
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
				const books = await this.scriptureProvider.fetchBooks(this.settings.bibleVersion);
				const targetBook = books.find((b: any) => b.name.toLowerCase() === bookName.toLowerCase());

				if (!targetBook) throw new Error("Book not found");

				for (let ch = startChapter; ch <= endChapter; ch++) {
					const chapterContent = await this.scriptureProvider.fetchChapter(this.settings.bibleVersion, targetBook.bookid, ch);
					
					if (Array.isArray(chapterContent)) {
						for (const verse of chapterContent) {
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
					} else if (chapterContent && (chapterContent.isEsvApi || chapterContent.isApiBible)) {
						const parser = new DOMParser();
						const doc = parser.parseFromString(chapterContent.html, "text/html");
						doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());
						
						const isEsv = chapterContent.isEsvApi;
						const spans = doc.querySelectorAll(isEsv ? "b.verse-num, b.chapter-num, span.chapter-num" : "span.v");
						spans.forEach((span) => {
							let textContent = span.textContent || "";
							let verseNum = 0;
							
							if (isEsv) {
								if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
									const trimmed = textContent.trim();
									if (trimmed.includes(":")) {
										const parts = trimmed.split(":");
										verseNum = parseInt(parts[1]) || 1;
									} else {
										verseNum = 1;
									}
								} else {
									verseNum = parseInt(textContent.trim()) || 0;
								}
							} else {
								verseNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
							}

							const isWithinRange = 
								(ch > startChapter || (ch === startChapter && verseNum >= startVerse)) &&
								(ch < endChapter || (ch === endChapter && verseNum <= endVerse));

							if (isWithinRange) {
								let text = "";
								let next = span.nextSibling;
								if (!next && !isEsv && span.parentElement && span.parentElement.classList.contains("verse-span")) {
									next = span.parentElement.nextSibling;
								}
								while (next && !(next instanceof Element && (
									next.classList.contains(isEsv ? "verse-num" : "v") || 
									(!isEsv && next.querySelector(".v")) ||
									next.classList.contains("chapter-num") || 
									(isEsv && next.tagName.toLowerCase() === "b" && next.classList.contains("verse-num")) ||
									(isEsv && next.tagName.toLowerCase() === "span" && next.classList.contains("chapter-num"))
								))) {
									text += cleanHtmlKeepRedSpans(next);
									next = next.nextSibling;
								}
								let cleanText = text.trim().replace(/\n+/g, " ");
								cleanText = cleanText.replace(/^\d+:\d+\s*/, "");

								versesArray.push({ verse: verseNum, text: cleanText, chapter: ch });
							}
						});
					}
				}
			}

			if (versesArray.length === 0) throw new Error("No verses found");

			const isEsvApi = this.settings.esvApiEnabled && this.settings.esvApiKey.trim() && this.settings.bibleVersion.toUpperCase() === "ESV";
			const isApiBible = this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim() && this.settings.bibleVersion === this.settings.apiBibleVersionId;
			const isPremium = isEsvApi || isApiBible;

			const compileSettings = isPremium 
				? { ...this.settings, gospelQuotesRed: false } 
				: this.settings;

			const finalOutput = compileAutoExpandOutput(
				versesArray,
				bookName,
				startChapter,
				flag,
				referenceText,
				compileSettings
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

	async fetchScriptureRange(
		book: string,
		chapter: number,
		startVerse: number,
		endVerse?: number
	): Promise<{ versesList: { verse: number; text: string }[] } | null> {
		const lastVerse = endVerse !== undefined ? endVerse : startVerse;
		const localData = await this.readLocalTranslation(this.settings.bibleVersion);
		let versesList: { verse: number; text: string }[] = [];
		let fetchSuccess = false;

		if (localData) {
			const targetBook = localData.books.find((b: any) => b.name.toLowerCase() === book.toLowerCase() || b.name.toLowerCase().startsWith(book.toLowerCase()));
			if (targetBook) {
				const cachedChapter = localData.passages[targetBook.bookid]?.[chapter];
				if (cachedChapter) {
					if (cachedChapter.isEsvApi) {
						const parser = new DOMParser();
						const doc = parser.parseFromString(cachedChapter.html, "text/html");
						doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());
						const spans = doc.querySelectorAll("b.verse-num, b.chapter-num, span.chapter-num");
						let currentChapter = chapter;
						spans.forEach((span) => {
							let textContent = span.textContent || "";
							let vNum = 0;
							if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
								const trimmed = textContent.trim();
								if (trimmed.includes(":")) {
									const parts = trimmed.split(":");
									currentChapter = parseInt(parts[0]) || currentChapter;
									vNum = parseInt(parts[1]) || 1;
								} else {
									currentChapter = parseInt(trimmed) || currentChapter;
									vNum = 1;
								}
							} else {
								vNum = parseInt(textContent.trim()) || 0;
							}
							if (currentChapter === chapter && vNum >= startVerse && vNum <= lastVerse) {
								let text = "";
								let next = span.nextSibling;
								while (next && !(next instanceof Element && (next.classList.contains("verse-num") || next.classList.contains("chapter-num") || (next.tagName.toLowerCase() === "b" && next.classList.contains("verse-num"))))) {
									text += next.textContent || "";
									next = next.nextSibling;
								}
								let cleanText = text.trim().replace(/\n+/g, " ").replace(/^\d+:\d+\s*/, "");
								versesList.push({ verse: vNum, text: cleanText });
							}
						});
						fetchSuccess = versesList.length > 0;
					} else if (cachedChapter.isApiBible) {
						const parser = new DOMParser();
						const doc = parser.parseFromString(cachedChapter.html, "text/html");
						const spans = doc.querySelectorAll("span.v");
						spans.forEach((span) => {
							const vNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
							if (vNum >= startVerse && vNum <= lastVerse) {
								let text = "";
								let next = span.nextSibling;
								if (!next && span.parentElement && span.parentElement.classList.contains("verse-span")) {
									next = span.parentElement.nextSibling;
								}
								while (next && !(next instanceof Element && (next.classList.contains("v") || next.querySelector(".v")))) {
									text += next.textContent || "";
									next = next.nextSibling;
								}
								let cleanText = text.trim().replace(/\n+/g, " ").replace(/^\d+:\d+\s*/, "");
								versesList.push({ verse: vNum, text: cleanText });
							}
						});
						fetchSuccess = versesList.length > 0;
					} else {
						for (const verse of cachedChapter) {
							const vNum = parseInt(verse.verse);
							if (vNum >= startVerse && vNum <= lastVerse) {
								const cleanText = verse.text.replace(/<[^>]*>?/gm, '').replace(/^\d+:\d+\s*/, "").trim();
								versesList.push({ verse: vNum, text: cleanText });
							}
						}
						fetchSuccess = true;
					}
				}
			}
		}

		if (!fetchSuccess) {
			try {
				const booksRes = await requestUrl(`https://bolls.life/get-books/${this.settings.bibleVersion}`);
				const targetBook = booksRes.json.find((b: any) => b.name.toLowerCase() === book.toLowerCase() || b.name.toLowerCase().startsWith(book.toLowerCase()));
				if (targetBook) {
					const chapterRes = await requestUrl(`https://bolls.life/get-chapter/${this.settings.bibleVersion}/${targetBook.bookid}/${chapter}`);
					for (const verse of chapterRes.json) {
						const vNum = parseInt(verse.verse);
						if (vNum >= startVerse && vNum <= lastVerse) {
							const cleanText = verse.text.replace(/<[^>]*>?/gm, '').replace(/^\d+:\d+\s*/, "").trim();
							versesList.push({ verse: vNum, text: cleanText });
						}
					}
					fetchSuccess = true;
				}
			} catch (err) {
				console.error("Online fetch failed:", err);
			}
		}

		return fetchSuccess ? { versesList } : null;
	}

	compileReferenceOutput(
		bookName: string,
		chapter: number,
		verses: { verse: number; text: string }[],
		settings: any
	): string {
		const versesList = verses.map(v => {
			const supText = convertToSuperscript(v.verse);
			const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${v.verse}`;
			return `[${supText}](${uri}) ${v.text}`;
		});

		const scriptureText = versesList.join(" ");
		const startVerse = verses[0].verse;
		const endVerse = verses[verses.length - 1].verse;
		const rangeStr = startVerse === endVerse ? startVerse.toString() : `${startVerse}-${endVerse}`;
		
		const vList = verses.map(v => v.verse).join(",");
		const uri = `obsidian://bible?book=${encodeURIComponent(bookName)}&chapter=${chapter}&verse=${vList}`;
		
		let referenceLink = "";
		if (settings.verseReferenceInternalLinking) {
			referenceLink = `[[${bookName}]] [${chapter}:${rangeStr}](${uri})`;
		} else {
			referenceLink = `[${bookName} ${chapter}:${rangeStr}](${uri})`;
		}

		let finalText = "";
		if (settings.copyFormat === "callout") {
			finalText = `> [!quote] ${referenceLink}\n> ${scriptureText}`;
		} else {
			if (settings.copyVerseReference) {
				finalText = `${scriptureText}\n${settings.verseReferenceStyle}${referenceLink}`;
			} else {
				finalText = scriptureText;
			}
		}
		return finalText;
	}
}

interface ParsedReference {
	book: string;
	chapter: number;
	startVerse: number;
	endVerse: number;
	isValid: boolean;
}

function parseQuickReference(query: string): ParsedReference | null {
	const trimmed = query.trim();
	if (!trimmed) return null;

	const verseMatch = trimmed.match(/^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+))?$/i);
	if (verseMatch) {
		const book = verseMatch[1].trim();
		const chapter = parseInt(verseMatch[2]);
		const startVerse = parseInt(verseMatch[3]);
		const endVerse = verseMatch[4] ? parseInt(verseMatch[4]) : startVerse;
		return { book, chapter, startVerse, endVerse, isValid: true };
	}

	const chapterMatch = trimmed.match(/^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+)$/i);
	if (chapterMatch) {
		const book = chapterMatch[1].trim();
		const chapter = parseInt(chapterMatch[2]);
		return { book, chapter, startVerse: 1, endVerse: 150, isValid: true };
	}

	return null;
}

interface ReferenceActionSuggestion {
	action: "open" | "copy" | "insert_link" | "insert_text";
	book: string;
	chapter: number;
	startVerse: number;
	endVerse?: number;
	displayText: string;
	referenceLabel: string;
}

class QuickReferenceModal extends SuggestModal<ReferenceActionSuggestion> {
	plugin: BibleSidecarPlugin;
	editor?: Editor;

	constructor(app: App, plugin: BibleSidecarPlugin, editor?: Editor) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
		this.setPlaceholder("Search for a verse (e.g., John 3:16 or John 3)...");
	}

	getSuggestions(query: string): ReferenceActionSuggestion[] {
		const parsed = parseQuickReference(query);
		if (!parsed) {
			return [];
		}

		const refLabel = parsed.startVerse === 1 && parsed.endVerse === 150
			? `${parsed.book} ${parsed.chapter}`
			: `${parsed.book} ${parsed.chapter}:${parsed.startVerse}${parsed.endVerse !== parsed.startVerse ? "-" + parsed.endVerse : ""}`;

		const suggestions: ReferenceActionSuggestion[] = [
			{
				action: "open",
				book: parsed.book,
				chapter: parsed.chapter,
				startVerse: parsed.startVerse,
				endVerse: parsed.endVerse,
				displayText: `👉 Open "${refLabel}" in Sidecar`,
				referenceLabel: refLabel
			},
			{
				action: "copy",
				book: parsed.book,
				chapter: parsed.chapter,
				startVerse: parsed.startVerse,
				endVerse: parsed.endVerse,
				displayText: `📋 Copy "${refLabel}" Text`,
				referenceLabel: refLabel
			}
		];

		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		const currentEditor = this.editor || (activeLeaf ? activeLeaf.editor : undefined);

		if (currentEditor) {
			suggestions.push(
				{
					action: "insert_link",
					book: parsed.book,
					chapter: parsed.chapter,
					startVerse: parsed.startVerse,
					endVerse: parsed.endVerse,
					displayText: `🔗 Insert Link to "${refLabel}"`,
					referenceLabel: refLabel
				},
				{
					action: "insert_text",
					book: parsed.book,
					chapter: parsed.chapter,
					startVerse: parsed.startVerse,
					endVerse: parsed.endVerse,
					displayText: `✍️ Insert Scripture text for "${refLabel}"`,
					referenceLabel: refLabel
				}
			);
		}

		return suggestions;
	}

	renderSuggestion(suggestion: ReferenceActionSuggestion, el: HTMLElement): void {
		el.createEl("div", { text: suggestion.displayText });
	}

	async onChooseSuggestion(suggestion: ReferenceActionSuggestion, evt: MouseEvent | KeyboardEvent): Promise<void> {
		const { action, book, chapter, startVerse, endVerse, referenceLabel } = suggestion;

		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		const currentEditor = this.editor || (activeLeaf ? activeLeaf.editor : undefined);

		if (action === "open") {
			await (this.plugin as any).toggleBibleSidecarView();
			setTimeout(async () => {
				const view = (this.plugin as any).view;
				if (view && typeof view.navigateToPassage === "function") {
					const endV = (startVerse === 1 && endVerse === 150) ? undefined : endVerse;
					const startV = (startVerse === 1 && endVerse === 150) ? 1 : startVerse;
					await view.navigateToPassage(book, chapter, startV, endV);
				}
			}, 200);
		} else if (action === "copy") {
			new Notice(`Fetching "${referenceLabel}"...`);
			const res = await this.plugin.fetchScriptureRange(book, chapter, startVerse, endVerse);
			if (res && res.versesList.length > 0) {
				const output = this.plugin.compileReferenceOutput(book, chapter, res.versesList, this.plugin.settings);
				await copyToClipboard(output);
				new Notice(`Copied "${referenceLabel}" to clipboard!`);
			} else {
				new Notice(`Failed to fetch scripture for "${referenceLabel}".`);
			}
		} else if (action === "insert_link") {
			if (currentEditor) {
				const rangeStr = (startVerse === 1 && endVerse === 150)
					? ""
					: (startVerse === endVerse ? `:${startVerse}` : `:${startVerse}-${endVerse}`);
				const verseVal = (startVerse === 1 && endVerse === 150)
					? "1"
					: expandRange(startVerse.toString(), endVerse?.toString());
				const uri = `obsidian://bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verseVal}`;
				
				let referenceText = "";
				if (this.plugin.settings.verseReferenceInternalLinking) {
					referenceText = `[[${book}]] [${chapter}${rangeStr}](${uri})`;
				} else {
					referenceText = `[${book} ${chapter}${rangeStr}](${uri})`;
				}
				currentEditor.replaceSelection(referenceText);
			}
		} else if (action === "insert_text") {
			if (currentEditor) {
				new Notice(`Fetching "${referenceLabel}"...`);
				const res = await this.plugin.fetchScriptureRange(book, chapter, startVerse, endVerse);
				if (res && res.versesList.length > 0) {
					const output = this.plugin.compileReferenceOutput(book, chapter, res.versesList, this.plugin.settings);
					currentEditor.replaceSelection(output);
				} else {
					new Notice(`Failed to fetch scripture for "${referenceLabel}".`);
				}
			}
		}
	}
}
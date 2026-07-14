import { BibleView, BibleViewType } from "./BibleView";
import { BibleSidecarSettingsTab } from "./settings";
import { Plugin, WorkspaceLeaf, Editor, Notice, requestUrl, SuggestModal, App, MarkdownView } from "obsidian";
import { ScriptureProvider, ObsidianScriptureProvider } from "./ScriptureProvider";
import { OfflineCacheStore } from "./OfflineCacheStore";
import { BibleEditorSuggest } from "./BibleEditorSuggest";
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
	compileFormattedPassage,
	formatScripturePassage,
	parseHtmlToVerses,
	stripLeadingPlainNumbers
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
	suggestIconLink: string;
	suggestDescLink: string;
	suggestIconPassage: string;
	suggestDescPassage: string;
	suggestIconList: string;
	suggestDescList: string;
	suggestIconQuote: string;
	suggestDescQuote: string;
	suggestIconBook: string;
	suggestDescBook: string;
	showSuggestDescriptor: boolean;
	showVersionIndicator: boolean;
}

export const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	showSuggestDescriptor: true,
	suggestIconLink: "🔗",
	suggestDescLink: "Link",
	suggestIconPassage: "📖",
	suggestDescPassage: "Passage",
	suggestIconList: "📜",
	suggestDescList: "List",
	suggestIconQuote: "📝",
	suggestDescQuote: "Quote",
	suggestIconBook: "📚",
	suggestDescBook: "Book",
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
	showVersionIndicator: true,
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

		this.registerEditorSuggest(new BibleEditorSuggest(this));

		this.addCommand({
			id: "open-bible-sidecar",
			name: "Open Bible Sidecar",
			callback: this.toggleBibleSidecarView,
			icon: "book-open-text",
		});

		this.addCommand({
			id: "bible-sidecar-autocomplete",
			name: "Autocomplete Bible Scripture (IntelliSense)",
			editorCallback: (editor: Editor) => {
				const cursor = editor.getCursor();
				const prefix = this.settings.autoExpandTriggerPrefix || "--";
				editor.replaceRange(prefix, cursor);
				editor.setCursor({ line: cursor.line, ch: cursor.ch + prefix.length });
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
					const rangeStr = endVerse ? `${startVerse}-${endVerse}` : startVerse;
					const verseVal = expandRange(startVerse, endVerse);
					const referenceText = compileReferenceLink(
						context.book,
						context.chapter,
						rangeStr,
						verseVal,
						this.settings.verseReferenceInternalLinking,
						this.settings.verseReferenceFormat
					);
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
		const leaves = this.app.workspace.getLeavesOfType(BibleViewType);
		if (leaves.length > 0) {
			const view = leaves[0].view as any;
			if (view && view.activeBook && view.activeChapterNumber !== null) {
				return {
					book: view.activeBook.name,
					chapter: view.activeChapterNumber
				};
			}
		}

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
					if (cachedChapter.isEsvApi || cachedChapter.isApiBible) {
						const parsedVerses = parseHtmlToVerses(cachedChapter.html, cachedChapter.isEsvApi, false);
						parsedVerses.forEach((v) => {
							if (v.verse >= startVerse && v.verse <= lastVerse) {
								const cleanText = stripLeadingPlainNumbers(v.text.trim().replace(/\n+/g, " "), v.verse);
								versesList.push({ verse: v.verse, text: cleanText });
							}
						});
						fetchSuccess = versesList.length > 0;
					} else {
						for (const verse of cachedChapter) {
							const vNum = parseInt(verse.verse);
							if (vNum >= startVerse && vNum <= lastVerse) {
								const cleanText = stripLeadingPlainNumbers(verse.text.replace(/<[^>]*>?/gm, ''), vNum).trim();
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
							const cleanText = stripLeadingPlainNumbers(verse.text.replace(/<[^>]*>?/gm, ''), vNum).trim();
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
		return { book, chapter, startVerse: 1, endVerse: 300, isValid: true };
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
	formatOverride?: "p" | "l" | "q";
	private isChoosing = false;

	constructor(app: App, plugin: BibleSidecarPlugin, editor?: Editor, formatOverride?: "p" | "l" | "q") {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
		this.formatOverride = formatOverride;
		this.setPlaceholder("Search for a verse (e.g., John 3:16 or John 3)...");
	}

	getSuggestions(query: string): ReferenceActionSuggestion[] {
		const parsed = parseQuickReference(query);
		if (!parsed) {
			return [];
		}

		const refLabel = parsed.startVerse === 1 && parsed.endVerse === 300
			? `${parsed.book} ${parsed.chapter}`
			: `${parsed.book} ${parsed.chapter}:${parsed.startVerse}${parsed.endVerse !== parsed.startVerse ? "-" + parsed.endVerse : ""}`;

		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		const currentEditor = this.editor || (activeLeaf ? activeLeaf.editor : undefined);

		const suggestions: ReferenceActionSuggestion[] = [];

		if (this.formatOverride && currentEditor) {
			const labelOverride = this.formatOverride === "p" ? "as Paragraph (+p)" :
			                      this.formatOverride === "l" ? "as List (+l)" :
			                      "as Quote Only (+q)";
			suggestions.push({
				action: "insert_text",
				book: parsed.book,
				chapter: parsed.chapter,
				startVerse: parsed.startVerse,
				endVerse: parsed.endVerse,
				displayText: `✍️ Insert Scripture text ${labelOverride} for "${refLabel}"`,
				referenceLabel: refLabel
			});
		}

		suggestions.push(
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
		);

		if (currentEditor) {
			suggestions.push({
				action: "insert_link",
				book: parsed.book,
				chapter: parsed.chapter,
				startVerse: parsed.startVerse,
				endVerse: parsed.endVerse,
				displayText: `🔗 Insert Link to "${refLabel}"`,
				referenceLabel: refLabel
			});

			if (!this.formatOverride) {
				suggestions.push({
					action: "insert_text",
					book: parsed.book,
					chapter: parsed.chapter,
					startVerse: parsed.startVerse,
					endVerse: parsed.endVerse,
					displayText: `✍️ Insert Scripture text for "${refLabel}"`,
					referenceLabel: refLabel
				});
			}
		}

		return suggestions;
	}

	renderSuggestion(suggestion: ReferenceActionSuggestion, el: HTMLElement): void {
		el.createEl("div", { text: suggestion.displayText });
	}

	async onChooseSuggestion(suggestion: ReferenceActionSuggestion, evt: MouseEvent | KeyboardEvent): Promise<void> {
		if (this.isChoosing) return;
		this.isChoosing = true;

		const { action, book, chapter, startVerse, endVerse, referenceLabel } = suggestion;

		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		const currentEditor = this.editor || (activeLeaf ? activeLeaf.editor : undefined);

		if (action === "open") {
			await (this.plugin as any).toggleBibleSidecarView();
			setTimeout(async () => {
				const view = (this.plugin as any).view;
				if (view && typeof view.navigateToPassage === "function") {
					const endV = (startVerse === 1 && endVerse === 300) ? undefined : endVerse;
					const startV = (startVerse === 1 && endVerse === 300) ? 1 : startVerse;
					await view.navigateToPassage(book, chapter, startV, endV);
				}
			}, 200);
		} else if (action === "copy") {
			new Notice(`Fetching "${referenceLabel}"...`);
			const res = await this.plugin.fetchScriptureRange(book, chapter, startVerse, endVerse);
			if (res && res.versesList.length > 0) {
				const output = formatScripturePassage(book, chapter, res.versesList, this.plugin.settings);
				await copyToClipboard(output);
				new Notice(`Copied "${referenceLabel}" to clipboard!`);
			} else {
				new Notice(`Failed to fetch scripture for "${referenceLabel}".`);
			}
		} else if (action === "insert_link") {
			if (currentEditor) {
				const rangeStr = (startVerse === 1 && endVerse === 300)
					? ""
					: (startVerse === endVerse ? startVerse.toString() : `${startVerse}-${endVerse}`);
				const verseVal = (startVerse === 1 && endVerse === 300)
					? "1"
					: expandRange(startVerse.toString(), endVerse?.toString());
				
				const referenceText = compileReferenceLink(
					book,
					chapter,
					rangeStr,
					verseVal,
					this.plugin.settings.verseReferenceInternalLinking,
					this.plugin.settings.verseReferenceFormat
				);
				currentEditor.replaceSelection(referenceText);
			}
		} else if (action === "insert_text") {
			if (currentEditor) {
				new Notice(`Fetching "${referenceLabel}"...`);
				const res = await this.plugin.fetchScriptureRange(book, chapter, startVerse, endVerse);
				if (res && res.versesList.length > 0) {
					let output = "";
					if (this.formatOverride) {
						const isEsvApi = this.plugin.settings.esvApiEnabled && this.plugin.settings.esvApiKey.trim() && this.plugin.settings.bibleVersion.toUpperCase() === "ESV";
						const isApiBible = this.plugin.settings.apiBibleEnabled && this.plugin.settings.apiBibleKey.trim() && this.plugin.settings.bibleVersion === this.plugin.settings.apiBibleVersionId;
						const isPremium = isEsvApi || isApiBible;
						const compileSettings = isPremium ? { ...this.plugin.settings, gospelQuotesRed: false } : this.plugin.settings;
						
						const rangeStr = (startVerse === 1 && endVerse === 300)
							? ""
							: (startVerse === endVerse ? startVerse.toString() : `${startVerse}-${endVerse}`);
						const vList = res.versesList.map(v => v.verse).join(",");
						
						const referenceText = compileReferenceLink(
							book,
							chapter,
							rangeStr,
							vList,
							this.plugin.settings.verseReferenceInternalLinking,
							this.plugin.settings.verseReferenceFormat
						);
						
						output = compileAutoExpandOutput(
							res.versesList,
							book,
							chapter,
							this.formatOverride,
							referenceText,
							compileSettings
						);
					} else {
						output = formatScripturePassage(book, chapter, res.versesList, this.plugin.settings);
					}
					currentEditor.replaceSelection(output);
				} else {
					new Notice(`Failed to fetch scripture for "${referenceLabel}".`);
				}
			}
		}
	}
}
import { ItemView, WorkspaceLeaf, requestUrl, Notice, Platform, setIcon, Modal, Setting, App } from "obsidian";
import { convertToSuperscript, convertToNumber, compileCopyMessage, compileDragText, copyToClipboard, BIBLE_BOOK_IDS, isNavigationAllowedOffline, calculateDownloadProportion, isOldTestament, getBookDisplayName, searchBibleLocalData, highlightSearchTerms, parseAdvancedSearchQuery, renderStrongsHtml, extractCrossReferences, parseHtmlToVerses } from "./utils";
import { SidecarRenderer } from "./SidecarRenderer";
export const BibleViewType = "bible-view-plus";

interface BibleSidecarSettings {
	bibleVersion: string;
	copyFormat: string;
	copyVerseReference: boolean;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
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
	showVersionIndicator: boolean;
}

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "ESV",
	copyFormat: "plain",
	copyVerseReference: true,
	verseReferenceStyle: "> ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: true,
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
	autoExpandTriggerPrefix: "--",
	showVersionIndicator: true,
};

export class BibleView extends ItemView {
	settings: BibleSidecarSettings;
	plugin: any;
	backButton: HTMLElement;
	previousButton: HTMLElement;
	nextButton: HTMLElement;

	currentView: "books" | "chapters" | "verses" = "books";
	activeBook: { bookid: number; name: string; chapters: number } | null = null;
	activeChapterNumber: number | null = null;
	private onlineListener: () => void;
	private offlineListener: () => void;
	isOfflineState: boolean = !navigator.onLine;
	private currentWindow: Window | null = null;
	private isLoadingBooks: boolean = false;
	savedScrollPositions: Record<string, number> = {};
	activeSelectionChangeHandler: (() => void) | null = null;
	activeSelectionDoc: Document | null = null;
	otCollapsed: boolean = false;
	ntCollapsed: boolean = false;
	strongsDefinitionCache: Map<string, any> = new Map();

	resizeObserver: ResizeObserver | null = null;

	cleanupResizeObserver() {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	saveCurrentScrollPosition() {
		const container = this.containerEl.querySelector(".chapter-container");
		if (container) {
			this.savedScrollPositions[this.currentView] = container.scrollTop;
			this.logDebug(`Saved scroll position for view '${this.currentView}': ${container.scrollTop}`);
		}
	}

	restoreScrollPosition(view: string) {
		const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
		if (container && this.savedScrollPositions[view] !== undefined) {
			const scrollTop = this.savedScrollPositions[view];
			container.classList.add("is-scroll-restoring");
			container.scrollTop = scrollTop;
			
			// Force layout reflow
			void container.offsetHeight;

			setTimeout(() => {
				container.classList.remove("is-scroll-restoring");
				this.logDebug(`Restored and snapped scroll position for view '${view}': ${scrollTop}`);
			}, 30);
		}
	}

	renderer: SidecarRenderer;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.renderer = new SidecarRenderer(this);
	}

	async logDebug(msg: string) {
		const formatted = `[Bible Sidecar Debug] ${msg}`;
		console.log(formatted);
		if (this.plugin?.writeLog) {
			try {
				await this.plugin.writeLog(formatted);
			} catch (e) {
				// Ignore log writing errors
			}
		}
	}

	getViewType() {
		return BibleViewType;
	}

	getDisplayText() {
		return "Bible Sidecar";
	}

	getIcon() {
		return "book-open-text";
	}

	safeSetIcon(el: HTMLElement, iconId: string) {
		this.renderer.safeSetIcon(el, iconId);
	}

	public load(): void {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings);
		super.load();
	}
	public async updateSettings(newSettings: BibleSidecarSettings): Promise<void> {
		this.logDebug(`updateSettings called. currentView=${this.currentView}, activeBook=${this.activeBook ? this.activeBook.name : "null"}`);
		
		const needsReRender = !this.settings ||
			this.settings.bibleVersion !== newSettings.bibleVersion ||
			this.settings.secondaryBibleVersion !== newSettings.secondaryBibleVersion ||
			this.settings.separateVersesSidecar !== newSettings.separateVersesSidecar ||
			this.settings.gospelQuotesRed !== newSettings.gospelQuotesRed ||
			this.settings.showCrossReferences !== newSettings.showCrossReferences ||
			this.settings.showStrongsNumbers !== newSettings.showStrongsNumbers ||
			this.settings.abbreviateBookNames !== newSettings.abbreviateBookNames ||
			this.settings.enableOfflineAccents !== newSettings.enableOfflineAccents;

		this.settings = newSettings;

		if (!needsReRender) {
			this.logDebug("updateSettings: No structural settings changed. Skipping full view reload (flashing prevented).");
			return;
		}

		if (this.currentView === "verses" && this.activeBook && this.activeChapterNumber !== null) {
			const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
			if (container) {
				const scrollPosBefore = container.scrollTop;
				this.logDebug(`updateSettings: Saving scroll position for verses before reload: ${scrollPosBefore}`);
				this.savedScrollPositions["verses"] = scrollPosBefore;

				const books = await this.generateBibleBooks(this.settings.bibleVersion);
				const mappedBook = books.find((b: any) => b.bookid === this.activeBook!.bookid) || this.activeBook;
				const chapterContentArray = await this.getChapterContent(
					this.settings.bibleVersion,
					mappedBook.bookid,
					this.activeChapterNumber
				);
				container.empty();
				await this.processChapterContent(
					chapterContentArray,
					container,
					mappedBook,
					this.activeChapterNumber,
					books
				);
				
				this.restoreScrollPosition("verses");
				return;
			}
		} else if (this.currentView === "chapters" && this.activeBook) {
			const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
			if (container) {
				const scrollPosBefore = container.scrollTop;
				this.logDebug(`updateSettings: Saving scroll position for chapters before reload: ${scrollPosBefore}`);
				this.savedScrollPositions["chapters"] = scrollPosBefore;

				const books = await this.generateBibleBooks(this.settings.bibleVersion);
				const mappedBook = books.find((b: any) => b.bookid === this.activeBook!.bookid) || this.activeBook;
				await this.renderChapters(mappedBook, container, books);
				
				this.restoreScrollPosition("chapters");
				return;
			}
		}
		this.loadBible();
	}
	
	public async navigateToPassage(bookName: string, chapterNumber: number, verseNumber: number | string, endVerseNumber?: number) {
		const logMsg = `[Bible Sidecar Debug] navigateToPassage called: bookName=${bookName}, chapterNumber=${chapterNumber}, verseNumber=${verseNumber}, endVerseNumber=${endVerseNumber}`;
		console.log(logMsg);
		if (this.plugin?.writeLog) {
			await this.plugin.writeLog(logMsg);
		}
		const books = await this.generateBibleBooks(this.settings.bibleVersion);
		const targetBook = books.find((b: any) => b.name.toLowerCase() === bookName.toLowerCase());
		if (!targetBook) {
			const errMsg = `[Bible Sidecar Debug] Book not found: ${bookName}`;
			console.log(errMsg);
			if (this.plugin?.writeLog) await this.plugin.writeLog(errMsg);
			return;
		}

		const foundMsg = `[Bible Sidecar Debug] Found target book: ${targetBook.name}`;
		console.log(foundMsg);
		if (this.plugin?.writeLog) await this.plugin.writeLog(foundMsg);

		// Block navigation to uncached chapters when offline
		const localData = await this.plugin.cacheStore.readLocalTranslation(this.settings.bibleVersion);
		if (!isNavigationAllowedOffline(this.isOfflineState, localData, targetBook.bookid, chapterNumber)) {
			new Notice(`🔌 Chapter offline: ${targetBook.name} ${chapterNumber} is not cached for offline use.`);
			this.logDebug(`Navigation blocked: ${targetBook.name} ${chapterNumber} is not cached and view is offline.`);
			return;
		}
		
		const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
		if (container) {
			container.empty();
			container.createDiv({ cls: "bible-loading-indicator", text: `Loading ${targetBook.name} Chapter ${chapterNumber}...` });
		}

		let chapterContentArray;
		try {
			chapterContentArray = await this.getChapterContent(this.settings.bibleVersion, targetBook.bookid, chapterNumber);
		} catch (err) {
			if (container) {
				container.empty();
				container.createDiv({ cls: "bible-loading-indicator", text: `Failed to load ${targetBook.name} Chapter ${chapterNumber}: ${err.message || err}` });
			}
			return;
		}

		if (!container) {
			const errMsg = `[Bible Sidecar Debug] Error: .chapter-container not found in DOM`;
			console.log(errMsg);
			if (this.plugin?.writeLog) await this.plugin.writeLog(errMsg);
			return;
		}

		container.empty();
		this.processChapterContent(chapterContentArray, container, targetBook, chapterNumber, books);

		// Scroll to the specific verse and highlight range
		setTimeout(async () => {
			const timeMsg = `[Bible Sidecar Debug] Scroll/highlight timeout executing. verseNumber: ${verseNumber}, endVerseNumber: ${endVerseNumber}`;
			console.log(timeMsg);
			if (this.plugin?.writeLog) await this.plugin.writeLog(timeMsg);
			
			const highlightVerses = new Set<number>();
			if (typeof verseNumber === "number") {
				const start = verseNumber;
				const end = endVerseNumber || start;
				for (let v = start; v <= end; v++) {
					highlightVerses.add(v);
				}
			} else if (typeof verseNumber === "string") {
				const parts = verseNumber.split(",");
				parts.forEach(part => {
					if (part.includes("-")) {
						const [sStr, eStr] = part.split("-");
						const s = parseInt(sStr);
						const e = parseInt(eStr);
						if (!isNaN(s) && !isNaN(e)) {
							for (let v = s; v <= e; v++) {
								highlightVerses.add(v);
							}
						}
					} else {
						const v = parseInt(part);
						if (!isNaN(v)) {
							highlightVerses.add(v);
						}
					}
				});
			}
			
			let firstScrollEl: HTMLElement | null = null;
			let minVerse = Infinity;

			// Clear any existing active verse highlighting
			container.querySelectorAll(".active-verse").forEach(el => el.classList.remove("active-verse"));

			const elements = container.querySelectorAll(".verse-num");
			const countMsg = `[Bible Sidecar Debug] Found ${elements.length} elements with '.verse-num' class`;
			console.log(countMsg);
			if (this.plugin?.writeLog) await this.plugin.writeLog(countMsg);

			const bookid = this.plugin.getBookIdFromName(bookName);
			const bookPrefix = String(bookid).padStart(2, "0") + String(chapterNumber).padStart(3, "0");

			const matchedElements: HTMLElement[] = [];

			highlightVerses.forEach((v) => {
				let matchedForV = false;

				// 1. Try querying by data-verse attribute (most precise way)
				const query = `[data-verse="${v}"]`;
				const queryEls = Array.from(container.querySelectorAll(query)) as HTMLElement[];
				if (queryEls.length > 0) {
					matchedForV = true;
					queryEls.forEach((el) => {
						if (v < minVerse) {
							minVerse = v;
							firstScrollEl = el;
						}
						matchedElements.push(el);
					});
				}

				// 2. Fallback to superscript text matching on .verse-num elements
				if (!matchedForV) {
					const targetSuperscript = convertToSuperscript(v.toString());
					const checkingMsg = `[Bible Sidecar Debug] Matching verse ${v} using superscript '${targetSuperscript}'`;
					console.log(checkingMsg);
					if (this.plugin?.writeLog) this.plugin.writeLog(checkingMsg).catch(() => {});
					
					elements.forEach((el: HTMLElement) => {
						const textVal = (el.textContent || "").trim();
						if (textVal === targetSuperscript) {
							matchedForV = true;
							const matchMsg = `[Bible Sidecar Debug] Success: Match found for verse ${v} on element text: '${textVal}'`;
							console.log(matchMsg);
							if (this.plugin?.writeLog) this.plugin.writeLog(matchMsg).catch(() => {});
							
							const parentVerse = el.closest(".verse") || el.closest(".verse-inline");
							const highlightEl = (parentVerse || el) as HTMLElement;
							if (v < minVerse) {
								minVerse = v;
								firstScrollEl = highlightEl;
							}
							matchedElements.push(highlightEl);
						}
					});
				}

				if (!matchedForV) {
					const targetSuperscript = convertToSuperscript(v.toString());
					const warnMsg = `[Bible Sidecar Debug] Warning: Failed to find element matching '${targetSuperscript}' for verse ${v}`;
					console.log(warnMsg);
					if (this.plugin?.writeLog) this.plugin.writeLog(warnMsg).catch(() => {});
				}
			});

			// Highlight matched elements, ensuring we don't double highlight nested matches
			matchedElements.forEach((el) => {
				let ancestorIsMatched = false;
				let p = el.parentElement;
				while (p && p !== container) {
					if (matchedElements.includes(p as HTMLElement)) {
						ancestorIsMatched = true;
						break;
					}
					p = p.parentElement;
				}
				if (!ancestorIsMatched) {
					el.classList.add("active-verse");
				}
			});

			if (firstScrollEl) {
				const scrollMsg = `[Bible Sidecar Debug] Scrolling to first element in range`;
				console.log(scrollMsg);
				if (this.plugin?.writeLog) await this.plugin.writeLog(scrollMsg);
				(firstScrollEl as any).scrollIntoView({ behavior: "auto", block: "center" });
			} else {
				const warnMsg = `[Bible Sidecar Debug] Warning: No scroll element identified for verses: ${Array.from(highlightVerses).join(",")}`;
				console.log(warnMsg);
				if (this.plugin?.writeLog) await this.plugin.writeLog(warnMsg);
			}
		}, 150);
	}
	
	updateOfflineStatus(forceOffline?: boolean) {
		const isOffline = forceOffline !== undefined ? forceOffline : !navigator.onLine;
		this.logDebug(`updateOfflineStatus called: forceOffline=${forceOffline}, navigator.onLine=${navigator.onLine}, resulting isOfflineState=${isOffline}, currentView=${this.currentView}`);
		this.isOfflineState = isOffline;
		
		const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
		if (container) {
			container.classList.toggle("is-offline", isOffline);
		}

		const wrapper = this.containerEl.querySelector(".bible-wrapper") as HTMLElement;
		if (wrapper) {
			wrapper.classList.toggle("is-offline-view", isOffline);
		}

		// Target the reserved right-side slot in the active header/tabs container
		const rightSlot = this.containerEl.querySelector(".bible-header-right-slot, .bible-tabs-right-slot") as HTMLElement;
		if (rightSlot) {
			rightSlot.empty();

			if (isOffline && this.currentView !== "verses") {
				// Inline outage indicator button inside the header right slot
				const offlineBtn = rightSlot.createEl("button", {
					cls: "bible-offline-indicator-btn",
					attr: { "aria-label": "Offline (Click to retry connection)", "title": "Offline (Click to retry connection)" }
				});
				this.safeSetIcon(offlineBtn, "wifi-off");
				
				offlineBtn.addEventListener("click", async (e) => {
					e.stopPropagation();
					this.logDebug("Offline indicator button clicked. Checking connection...");
					offlineBtn.classList.add("is-checking");
					offlineBtn.empty();
					this.safeSetIcon(offlineBtn, "loader");
					
					const online = await this.probeConnection();
					if (online) {
						new Notice("Connection restored! Reconnecting online.");
						this.updateOfflineStatus(false);
						// Refresh the current view
						if (this.currentView === "books") {
							await this.loadBible();
						} else if (this.currentView === "chapters" && this.activeBook) {
							const chapterContainer = this.containerEl.querySelector(".chapter-container") as HTMLElement;
							if (chapterContainer) {
								const books = await this.generateBibleBooks(this.settings.bibleVersion);
								await this.renderChapters(this.activeBook, chapterContainer, books);
							}
						}
					} else {
						new Notice("Still offline. Please check your internet connection.");
						offlineBtn.classList.remove("is-checking");
						offlineBtn.empty();
						this.safeSetIcon(offlineBtn, "wifi-off");
					}
				});
			} else {
				// Restore default empty spacing layout when online
				if (rightSlot.classList.contains("bible-header-right-slot")) {
					rightSlot.style.width = "32px";
				}
			}
		}
	}

	async probeConnection(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: "https://1.1.1.1",
				method: "HEAD",
				contentType: "text/plain",
				throw: false
			});
			return response.status === 200 || response.status === 301 || response.status === 302;
		} catch (e) {
			return false;
		}
	}
	
	async onOpen() {
		this.logDebug("onOpen called.");
		this.currentWindow = this.containerEl.win || window;
		this.logDebug(`Captured currentWindow: ${this.currentWindow === window ? "main window" : "popout window"}`);
		this.isOfflineState = !navigator.onLine;
		this.logDebug(`Initial isOfflineState: ${this.isOfflineState}`);
		
		this.onlineListener = () => {
			this.logDebug("Window fired 'online' event.");
			this.updateOfflineStatus(false);
		};
		this.offlineListener = () => {
			this.logDebug("Window fired 'offline' event.");
			this.updateOfflineStatus(true);
		};
		
		this.currentWindow.addEventListener("online", this.onlineListener);
		this.currentWindow.addEventListener("offline", this.offlineListener);
		await this.loadBible();
	}

	async onClose() {
		this.logDebug("onClose called. Cleaning up listeners.");
		this.cleanupResizeObserver();
		const win = this.currentWindow || this.containerEl.win || window;
		if (this.onlineListener && win) {
			win.removeEventListener("online", this.onlineListener);
			this.logDebug("Removed online listener.");
		}
		if (this.offlineListener && win) {
			win.removeEventListener("offline", this.offlineListener);
			this.logDebug("Removed offline listener.");
		}
		if (this.activeSelectionChangeHandler && this.activeSelectionDoc) {
			this.activeSelectionDoc.removeEventListener("selectionchange", this.activeSelectionChangeHandler);
			this.activeSelectionChangeHandler = null;
			this.activeSelectionDoc = null;
		}
	}

	async loadBible() {
		if (this.isLoadingBooks) {
			this.logDebug("loadBible ignored: books list is already loading.");
			return;
		}
		this.cleanupResizeObserver();
		this.logDebug(`loadBible called. currentView=${this.currentView}`);
		this.isLoadingBooks = true;
		this.currentView = "books";
		this.activeBook = null;
		this.activeChapterNumber = null;
		
		this.containerEl.empty();
		this.containerEl.createDiv({ cls: "bible-loading-indicator", text: "Loading Books..." });
		
		try {
			const books = await this.generateBibleBooks(this.settings.bibleVersion);
			await this.renderBooks(books);
			this.restoreScrollPosition("books");
		} finally {
			this.isLoadingBooks = false;
		}
	}


	async generateBibleBooks(language: string) {
		this.logDebug(`generateBibleBooks called with language: ${language}`);
		const localData = await this.plugin.cacheStore.readLocalTranslation(this.settings.bibleVersion);
		if (localData && localData.books && localData.books.length > 50) {
			this.logDebug(`Found local cached books list for version ${this.settings.bibleVersion} (count: ${localData.books.length})`);
			return localData.books;
		}
		const STANDARD_BOOK_CHAPTERS: Record<string, number> = {
			"GEN": 50, "EXO": 40, "LEV": 27, "NUM": 36, "DEU": 34, "JOS": 24, "JDG": 21, "RUT": 4, "1SA": 31, "2SA": 24,
			"1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, "EZR": 10, "NEH": 13, "EST": 10, "JOB": 42, "PSA": 150, "PRO": 31,
			"ECC": 12, "SNG": 8, "ISA": 66, "JER": 52, "LAM": 5, "EZK": 48, "DAN": 12, "HOS": 14, "JOL": 3, "AMO": 9,
			"OBD": 1, "JON": 4, "MIC": 7, "NAM": 3, "HAB": 3, "ZEP": 3, "HAG": 2, "ZEC": 14, "MAL": 4,
			"MAT": 28, "MRK": 16, "LUK": 24, "JHN": 21, "ACT": 28, "ROM": 16, "1CO": 16, "2CO": 13, "GAL": 6, "EPH": 6,
			"PHP": 4, "COL": 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4, "TIT": 3, "PHM": 1, "HEB": 13, "JAS": 5,
			"1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1, "3JN": 1, "JUD": 1, "REV": 22
		};

		if (!this.isOfflineState) {
			this.logDebug(`Local books list not found or incomplete for ${this.settings.bibleVersion}. Attempting online fetches...`);

			try {
				const books = await this.plugin.scriptureProvider.fetchBooks(language);
				this.updateOfflineStatus(false);
				return books;
			} catch (err) {
				this.logDebug(`ScriptureProvider books request failed: ${err.message || err}`);
				console.error("ScriptureProvider books request failed, using local offline fallback:", err);
				this.updateOfflineStatus(true);
			}
		} else {
			this.logDebug(`Offline state active (isOfflineState=${this.isOfflineState}). Skipping online books fetch entirely.`);
		}

		this.logDebug("Falling back to standard Protestant book listing (offline fallback).");
		// Fallback to standard Protestant book listing (fully offline-safe)
		const BIBLE_BOOK_NAMES = [
			"Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
			"1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
			"Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
			"Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
			"Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
			"Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
			"1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
		];

		return BIBLE_BOOK_NAMES.map((name, i) => {
			const id = BIBLE_BOOK_IDS[i];
			return {
				bookid: i + 1,
				name,
				chapters: STANDARD_BOOK_CHAPTERS[id] || 1
			};
		});
	}

	async getChapterContent(version: string, bookid: number, chapter: number) {
		this.logDebug(`getChapterContent called for version=${version}, bookid=${bookid}, chapter=${chapter}`);
		const localData = await this.plugin.cacheStore.readLocalTranslation(version);
		if (localData) {
			const chapterVerses = localData.passages[bookid]?.[chapter];
			if (chapterVerses) {
				const isPremiumApi = chapterVerses.isEsvApi || chapterVerses.isApiBible;
				if (!isPremiumApi || chapterVerses.isFullyCached) {
					this.logDebug(`Found chapter content in local translation database/cache. isPremiumApi=${isPremiumApi}, isFullyCached=${chapterVerses.isFullyCached}`);
					return chapterVerses;
				} else {
					this.logDebug("Found premium API chapter skeleton in local database, but it is not fully cached. Proceeding to online fetch.");
				}
			} else {
				this.logDebug("Chapter verses not found in local database.");
			}
		} else {
			this.logDebug("No local database found for version.");
		}

		if (!this.isOfflineState) {
			try {
				const content = await this.plugin.scriptureProvider.fetchChapter(version, bookid, chapter);
				this.updateOfflineStatus(false);
				
				const bookIdStr = BIBLE_BOOK_IDS[bookid - 1] || "GEN";
				
				if (this.plugin?.writeLog) {
					if (content.isEsvApi) {
						await this.plugin.writeLog(`ESV API raw HTML for ${bookIdStr} ${chapter}:\n${content.html}`);
					} else if (content.isApiBible) {
						await this.plugin.writeLog(`API.Bible raw HTML for ${bookIdStr} ${chapter}:\n${content.html}`);
					}
				}
				
				const cacheLabel = content.isEsvApi || content.isApiBible ? bookIdStr : "Book";
				this.plugin.cachePassageLocally(version, bookid, chapter, cacheLabel, content);
				return content;
			} catch (err) {
				this.logDebug(`ScriptureProvider chapter fetch failed: ${err.message || err}`);
				console.error("ScriptureProvider chapter fetch failed, using local offline fallback:", err);
				this.updateOfflineStatus(true);
				throw err;
			}
		} else {
			this.logDebug(`Offline state active (isOfflineState=${this.isOfflineState}). Skipping online chapter fetches.`);
			throw new Error("Offline: Online fetches bypassed.");
		}
	}


	async renderBooks(books: { bookid: number; name: string; chapters: number }[]) {
		await this.renderer.renderBooks(books);
	}

	async renderChapters(
		book: { bookid: number; name: string; chapters: number },
		chapterContainer: HTMLElement,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		await this.renderer.renderChapters(book, chapterContainer, books);
	}

	async processChapterContent(
		chapter: { verse: string; text: string }[],
		chapterContainer: HTMLElement,
		book: { bookid: number; name: string; chapters: number },
		i: number,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		await this.renderer.processChapterContent(chapter, chapterContainer, book, i, books);
	}

	renderCrossRefDrawer(refs: string[], bookName: string, chapter: number) {
		this.renderer.renderCrossRefDrawer(refs, bookName, chapter);
	}

	async renderStrongsPanel(strongsId: string) {
		await this.renderer.renderStrongsPanel(strongsId);
	}

	normalizeChapterToVerses(chapterData: any): { verse: string; text: string }[] {
		return this.renderer.normalizeChapterToVerses(chapterData);
	}

	async renderParallelColumns(
		primaryChapter: any,
		chapterContainer: HTMLElement,
		chapterContent: HTMLElement,
		book: { bookid: number; name: string; chapters: number },
		chapterNum: number,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		await this.renderer.renderParallelColumns(primaryChapter, chapterContainer, chapterContent, book, chapterNum, books);
	}

	fillColumn(
		col: HTMLElement,
		verses: { verse: string; text: string }[],
		book: { bookid: number; name: string; chapters: number },
		chapterNum: number,
		isPrimary: boolean
	) {
		this.renderer.fillColumn(col, verses, book, chapterNum, isPrimary);
	}

	renderParallelVerseEl(
		parent: HTMLElement,
		verse: { verse: string; text: string },
		book: { bookid: number; name: string; chapters: number },
		chapterNum: number,
		isPrimary: boolean
	) {
		this.renderer.renderParallelVerseEl(parent, verse, book, chapterNum, isPrimary);
	}

	renderCopyMessage(
		book: { bookid: number; name: string; chapters: number },
		chapter: number,
		accumulatedVerseText: string
	) {
		this.renderer.renderCopyMessage(book, chapter, accumulatedVerseText);
	}

	renderSearchHelpGuide(el: HTMLElement) {
		this.renderer.renderSearchHelpGuide(el);
	}

	async performFullTextSearch(query: string, searchResultsEl: HTMLElement) {
		if (!query || query.trim().length < 2) {
			this.renderSearchHelpGuide(searchResultsEl);
			return;
		}

		searchResultsEl.createDiv({ cls: "no-results-message", text: "Searching local database..." });

		const localData = await this.plugin.cacheStore.readLocalTranslation(this.settings.bibleVersion);
		if (!localData) {
			searchResultsEl.empty();
			const errCard = searchResultsEl.createDiv({ cls: "bible-search-error-card" });
			errCard.createDiv({ text: "⚠️ Search requires downloaded data.", cls: "bible-search-error-title" });
			errCard.createEl("p", { 
				text: `Offline search is only available for downloaded translations. Please open the plugin settings and download "${this.settings.bibleVersion}" to enable offline searching.`,
				cls: "bible-search-error-desc"
			});
			return;
		}

		const esvHtmlParser = (html: string): { verse: number; text: string }[] => {
			return parseHtmlToVerses(html, true, false);
		};

		const apiBibleHtmlParser = (html: string): { verse: number; text: string }[] => {
			return parseHtmlToVerses(html, false, false);
		};

		const results = searchBibleLocalData(query, localData, esvHtmlParser, apiBibleHtmlParser);

		searchResultsEl.empty();

		if (results.length === 0) {
			searchResultsEl.createDiv({ cls: "no-results-message", text: "No matching verses found." });
			return;
		}

		const listEl = searchResultsEl.createDiv({ cls: "bible-search-results-list" });
		
		results.forEach((res) => {
			const card = listEl.createDiv({ cls: "bible-search-result-card" });
			
			const header = card.createDiv({ cls: "bible-search-result-header" });
			const bookDisplayName = this.settings.abbreviateBookNames
				? (BIBLE_BOOK_IDS[res.bookid - 1] || res.bookName)
				: res.bookName;
			header.createSpan({ text: `${bookDisplayName} ${res.chapter}:${res.verse}`, cls: "bible-search-result-ref" });
			
			const body = card.createDiv({ cls: "bible-search-result-body" });
			// Highlight matched search terms in result snippet
			const parsed = parseAdvancedSearchQuery(query);
			const highlightedHtml = highlightSearchTerms(res.text, parsed);
			if (highlightedHtml.includes("<mark")) {
				body.innerHTML = highlightedHtml;
			} else {
				body.setText(res.text);
			}

			card.addEventListener("click", async () => {
				await this.navigateToPassage(res.bookName, res.chapter, parseInt(res.verse));
			});
		});
		const { contentEl } = this;
		contentEl.empty();
	}
}

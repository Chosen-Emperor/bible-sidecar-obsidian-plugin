import { ItemView, WorkspaceLeaf, requestUrl, Notice, Platform, setIcon } from "obsidian";
import { convertToSuperscript, convertToNumber, compileCopyMessage, copyToClipboard } from "./utils";

function colorGospelQuotesRedInDOM(node: Node, state = { inQuote: false }) {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent || "";
		let resultHtml = "";
		let lastIdx = 0;
		
		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			if (char === "“" || char === "\u201c" || (char === '"' && !state.inQuote)) {
				resultHtml += text.substring(lastIdx, i);
				resultHtml += char + '<span style="color: red;">';
				state.inQuote = true;
				lastIdx = i + 1;
			} else if (char === "”" || char === "\u201d" || (char === '"' && state.inQuote)) {
				resultHtml += text.substring(lastIdx, i);
				if (state.inQuote) {
					resultHtml += '</span>';
					state.inQuote = false;
				}
				resultHtml += char;
				lastIdx = i + 1;
			}
		}
		
		if (lastIdx > 0) {
			resultHtml += text.substring(lastIdx);
			if (state.inQuote && !resultHtml.endsWith('</span>')) {
				resultHtml += '</span>';
			}
			
			const temp = document.createElement("span");
			temp.innerHTML = resultHtml;
			
			const parent = node.parentNode;
			if (parent) {
				while (temp.firstChild) {
					parent.insertBefore(temp.firstChild, node);
				}
				parent.removeChild(node);
			}
		} else if (state.inQuote) {
			const span = document.createElement("span");
			span.style.color = "red";
			span.textContent = text;
			node.parentNode?.replaceChild(span, node);
		}
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		const tagName = (node as Element).tagName.toLowerCase();
		if (tagName !== "script" && tagName !== "style") {
			const children = Array.from(node.childNodes);
			children.forEach(child => {
				colorGospelQuotesRedInDOM(child, state);
			});
		}
	}
}

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
};

export const BIBLE_BOOK_IDS = [
	"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
	"1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
	"ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
	"OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
	"MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
	"PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
	"1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
];

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
	private isOfflineState: boolean = !navigator.onLine;
	private currentWindow: Window | null = null;
	private isLoadingBooks: boolean = false;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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
		// If we are on mobile (iPadOS/iOS/Android), bypass Obsidian's native SVG icon system completely.
		// Obsidian Mobile often uses lazy-loaded sprite sheets or different Lucide registrations that fail silently on WebKit.
		// Applying clean, touch-friendly Unicode symbols guarantees 100% crisp visual controls on mobile.
		if (Platform.isMobile) {
			if (this.plugin?.writeLog) {
				this.plugin.writeLog(`[safeSetIcon] Mobile environment detected (Platform.isMobile = true). Bypassing native icon for "${iconId}" and applying solid Unicode fallback.`).catch(() => {});
			}
			el.empty();
			if (iconId === "search") el.setText("🔍");
			else if (iconId === "x") el.setText("✖");
			else if (iconId === "arrow-left") el.setText("◀");
			else if (iconId === "book-open") el.setText("📖");
			else if (iconId === "chevron-left") el.setText("◀");
			else if (iconId === "chevron-right") el.setText("▶");
			else if (iconId === "copy") el.setText("📋");
			return;
		}

		try {
			setIcon(el, iconId);
			
			// Verify if the SVG was actually populated with paths/shapes.
			// Under some configurations, setIcon executes without throwing an error but injects an empty SVG element.
			const svg = el.querySelector("svg");
			if (!svg || svg.children.length === 0) {
				throw new Error("SVG icon injected but has no child elements (silent failure).");
			}

			if (this.plugin?.writeLog) {
				this.plugin.writeLog(`[safeSetIcon] Successfully set native icon "${iconId}" on element ${el.tagName} | HTML: ${el.innerHTML}`).catch(() => {});
			}
		} catch (error: any) {
			if (this.plugin?.writeLog) {
				this.plugin.writeLog(`[safeSetIcon] ERROR/SILENT FAILURE setting icon "${iconId}" on element ${el.tagName}: ${error?.message || error}`).catch(() => {});
			}
			el.empty(); // Clear out the empty SVG shell to make room for clean text fallback
			// Fallback text/emoji if setIcon fails to render
			if (iconId === "search") el.setText("🔍");
			else if (iconId === "x") el.setText("✖");
			else if (iconId === "arrow-left") el.setText("◀");
			else if (iconId === "book-open") el.setText("📖");
			else if (iconId === "chevron-left") el.setText("◀");
			else if (iconId === "chevron-right") el.setText("▶");
			else if (iconId === "copy") el.setText("📋");
		}
	}

	public load(): void {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings);
		super.load();
	}
	public async updateSettings(newSettings: BibleSidecarSettings): Promise<void> {
		this.logDebug(`updateSettings called. currentView=${this.currentView}, activeBook=${this.activeBook ? this.activeBook.name : "null"}`);
		this.settings = newSettings;
		if (this.currentView === "verses" && this.activeBook && this.activeChapterNumber !== null) {
			const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
			if (container) {
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
				return;
			}
		} else if (this.currentView === "chapters" && this.activeBook) {
			const container = this.containerEl.querySelector(".chapter-container") as HTMLElement;
			if (container) {
				const books = await this.generateBibleBooks(this.settings.bibleVersion);
				const mappedBook = books.find((b: any) => b.bookid === this.activeBook!.bookid) || this.activeBook;
				await this.renderChapters(mappedBook, container, books);
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
		if (this.isOfflineState) {
			const localData = await this.plugin.readLocalTranslation(this.settings.bibleVersion);
			const isChapterCached = localData && (
				localData.apiType === "bolls" ||
				(localData.passages && localData.passages[targetBook.bookid] && localData.passages[targetBook.bookid][chapterNumber])
			);
			if (!isChapterCached) {
				new Notice(`🔌 Chapter offline: ${targetBook.name} ${chapterNumber} is not cached for offline use.`);
				this.logDebug(`Navigation blocked: ${targetBook.name} ${chapterNumber} is not cached and view is offline.`);
				return;
			}
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
		const win = this.currentWindow || this.containerEl.win || window;
		if (this.onlineListener && win) {
			win.removeEventListener("online", this.onlineListener);
			this.logDebug("Removed online listener.");
		}
		if (this.offlineListener && win) {
			win.removeEventListener("offline", this.offlineListener);
			this.logDebug("Removed offline listener.");
		}
	}

	async loadBible() {
		if (this.isLoadingBooks) {
			this.logDebug("loadBible ignored: books list is already loading.");
			return;
		}
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
		} finally {
			this.isLoadingBooks = false;
		}
	}


	async generateBibleBooks(language: string) {
		this.logDebug(`generateBibleBooks called with language: ${language}`);
		const localData = await this.plugin.readLocalTranslation(this.settings.bibleVersion);
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

			if (this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim()) {
				try {
					this.logDebug(`Attempting API.Bible books fetch for version ID: ${this.settings.apiBibleVersionId}`);
					const response = await requestUrl({
						url: `https://api.scripture.api.bible/v1/bibles/${this.settings.apiBibleVersionId}/books`,
						headers: { "api-key": this.settings.apiBibleKey.trim() }
					});
					if (response.status === 200 && response.json?.data) {
						this.logDebug("API.Bible books fetch succeeded!");
						this.updateOfflineStatus(false);
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
						return mappedBooks.sort((a: any, b: any) => a.bookid - b.bookid);
					}
				} catch (err) {
					this.logDebug(`API.Bible books request failed: ${err.message || err}`);
					console.error("API.Bible books request failed, falling back to bolls.life:", err);
				}
			}

			try {
				const url = `https://bolls.life/get-books/${language}`;
				this.logDebug(`Attempting Bolls.life books fetch for version: ${language}`);
				const response = await requestUrl(url);
				if (response.status === 200 && response.json) {
					this.logDebug("Bolls.life books fetch succeeded!");
					this.updateOfflineStatus(false);
					return response.json;
				}
			} catch (err) {
				this.logDebug(`Bolls.life books request failed: ${err.message || err}`);
				console.error("Bolls.life books request failed, using local offline fallback:", err);
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
		const localData = await this.plugin.readLocalTranslation(version);
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
			if (this.settings.esvApiEnabled && this.settings.esvApiKey.trim() && version.toUpperCase() === "ESV") {
				const bookId = BIBLE_BOOK_IDS[bookid - 1] || "GEN";
				try {
					const query = `${bookId} ${chapter}`;
					this.logDebug(`Attempting ESV API query: ${query}`);
					const response = await requestUrl({
						url: `https://api.esv.org/v3/passage/html/?q=${encodeURIComponent(query)}&include-verse-numbers=true&include-first-verse-numbers=true&include-headings=false&include-footnotes=false&include-audio-link=false&include-passage-references=false&include-copyright=false&include-short-copyright=false&wrapping-div=false`,
						headers: { "Authorization": `Token ${this.settings.esvApiKey.trim()}` }
					});
					if (response.status === 200 && response.json?.passages?.[0]) {
						this.logDebug("ESV API fetch succeeded!");
						this.updateOfflineStatus(false);
						if (this.plugin?.writeLog) {
							await this.plugin.writeLog(`ESV API raw HTML for ${bookId} ${chapter}:\n${response.json.passages[0]}`);
						}
						const content = { isEsvApi: true, html: response.json.passages[0], isFullyCached: true };
						this.plugin.cachePassageLocally(version, bookid, chapter, bookId, content);
						return content;
					}
				} catch (err) {
					this.logDebug(`ESV API chapter request failed: ${err.message || err}`);
					console.error("ESV API chapter request failed, falling back:", err);
				}
			}

			if (this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim()) {
				const bookId = BIBLE_BOOK_IDS[bookid - 1] || "GEN";
				try {
					this.logDebug(`Attempting API.Bible fetch for version: ${this.settings.apiBibleVersionId}, passage: ${bookId} ${chapter}`);
					const response = await requestUrl({
						url: `https://api.scripture.api.bible/v1/bibles/${this.settings.apiBibleVersionId}/chapters/${bookId}.${chapter}?include-verse-spans=true`,
						headers: { "api-key": this.settings.apiBibleKey.trim() }
					});
					if (response.status === 200 && response.json?.data?.content) {
						this.logDebug("API.Bible fetch succeeded!");
						this.updateOfflineStatus(false);
						if (this.plugin?.writeLog) {
							await this.plugin.writeLog(`API.Bible raw HTML for ${bookId} ${chapter}:\n${response.json.data.content}`);
						}
						const content = { isApiBible: true, html: response.json.data.content, isFullyCached: true };
						this.plugin.cachePassageLocally(version, bookid, chapter, bookId, content);
						return content;
					}
				} catch (err) {
					this.logDebug(`API.Bible chapter request failed: ${err.message || err}`);
					console.error("API.Bible chapter request failed, falling back to bolls.life:", err);
				}
			}

			try {
				const url = `https://bolls.life/get-chapter/${version}/${bookid}/${chapter}`;
				this.logDebug(`Attempting Bolls.life fetch: ${url}`);
				const response = await requestUrl(url);
				if (response.status === 200) {
					this.logDebug("Bolls.life fetch succeeded!");
					this.updateOfflineStatus(false);
					this.plugin.cachePassageLocally(version, bookid, chapter, "Book", response.json);
					return response.json;
				}
				throw new Error(`Request failed with status ${response.status}`);
			} catch (err) {
				this.logDebug(`Bolls.life chapter request failed: ${err.message || err}`);
				console.error("Bolls.life chapter request failed, using local offline fallback:", err);
				this.updateOfflineStatus(true);
				throw err;
			}
		} else {
			this.logDebug(`Offline state active (isOfflineState=${this.isOfflineState}). Skipping online chapter fetches.`);
			throw new Error("Offline: Online fetches bypassed.");
		}
	}


	async renderBooks(books: { bookid: number; name: string; chapters: number }[]) {
		this.logDebug(`renderBooks called with ${books?.length} books. isOfflineState=${this.isOfflineState}`);
		const { containerEl } = this;
		containerEl.empty();

		const localData = await this.plugin.readLocalTranslation(this.settings.bibleVersion);
		const isOffline = this.isOfflineState;

		const ChapterWrapper = containerEl.createEl("div", {
			cls: "bible-wrapper",
		});
		if (this.settings.enableOfflineAccents) {
			ChapterWrapper.classList.add("enable-offline-accents");
		}

		// 1. Search bar (fixed at top of wrapper)
		const searchContainer = ChapterWrapper.createDiv({ cls: "bible-search-container" });
		const searchInputWrapper = searchContainer.createDiv({ cls: "bible-search-input-wrapper" });

		const searchIcon = searchInputWrapper.createDiv({ cls: "bible-search-icon" });
		this.safeSetIcon(searchIcon, "search");

		const searchInput = searchInputWrapper.createEl("input", {
			cls: "bible-search-input",
			attr: {
				type: "text",
				placeholder: "Search books...",
			}
		});

		const clearBtn = searchInputWrapper.createEl("button", {
			cls: "bible-search-clear",
			attr: { "aria-label": "Clear search", "title": "Clear search" }
		});
		clearBtn.style.display = "none";
		this.safeSetIcon(clearBtn, "x");

		// Add Browse/Search view tabs
		const tabsContainer = searchContainer.createDiv({ cls: "bible-tabs-container" });
		const tabsWrapper = tabsContainer.createDiv({ cls: "bible-tabs-inner" });
		const browseTab = tabsWrapper.createEl("button", { cls: "bible-tab-btn active", text: "Browse" });
		const searchTab = tabsWrapper.createEl("button", { cls: "bible-tab-btn", text: "Search Scripture" });
		tabsContainer.createDiv({ cls: "bible-tabs-right-slot" });

		const chapterContainer = ChapterWrapper.createEl("div", {
			cls: "chapter-container",
		});

		const browseViewEl = chapterContainer.createDiv({ cls: "bible-browse-view" });
		const searchViewEl = chapterContainer.createDiv({ cls: "bible-search-view" });
		searchViewEl.style.display = "none";

		// Old Testament section
		const oldHeader = browseViewEl.createDiv({ cls: "bible-testament-header" });
		oldHeader.createSpan({ text: "OLD TESTAMENT", cls: "bible-testament-label" });
		const oldChevron = oldHeader.createDiv({ cls: "bible-testament-chevron" });
		this.safeSetIcon(oldChevron, "chevron-down");
		const oldGrid = browseViewEl.createDiv({ cls: "bible-books-grid" });
		oldHeader.addEventListener("click", () => {
			const isCollapsed = oldGrid.style.display === "none";
			oldGrid.style.display = isCollapsed ? "grid" : "none";
			oldHeader.classList.toggle("is-collapsed", !isCollapsed);
		});

		// New Testament section
		const newHeader = browseViewEl.createDiv({ cls: "bible-testament-header" });
		newHeader.createSpan({ text: "NEW TESTAMENT", cls: "bible-testament-label" });
		const newChevron = newHeader.createDiv({ cls: "bible-testament-chevron" });
		this.safeSetIcon(newChevron, "chevron-down");
		const newGrid = browseViewEl.createDiv({ cls: "bible-books-grid" });
		newHeader.addEventListener("click", () => {
			const isCollapsed = newGrid.style.display === "none";
			newGrid.style.display = isCollapsed ? "grid" : "none";
			newHeader.classList.toggle("is-collapsed", !isCollapsed);
		});

		const noResults = browseViewEl.createDiv({
			cls: "no-results-message",
			text: "No matching books found"
		});
		noResults.style.display = "none";

		// 3. Render book cards into the correct section
		const bookElements: { book: typeof books[0]; el: HTMLElement }[] = [];

		const oldTestament = books.filter(b => b.bookid < 40);
		const newTestament = books.filter(b => b.bookid >= 40);

		const addCards = (list: typeof books, grid: HTMLElement) => {
			for (const book of list) {
				const isBookCached = localData && (
					localData.apiType === "bolls" || 
					(localData.passages && localData.passages[book.bookid] && Object.keys(localData.passages[book.bookid]).length > 0)
				);

				let downloadProportion = 0;
				if (localData) {
					if (localData.apiType === "bolls") {
						downloadProportion = 1.0;
					} else if (localData.passages && localData.passages[book.bookid]) {
						const cachedChaptersCount = Object.keys(localData.passages[book.bookid]).length;
						const totalChapters = book.chapters || 1;
						downloadProportion = Math.min(cachedChaptersCount / totalChapters, 1.0);
					}
				}

				const card = grid.createEl("button", {
					cls: isBookCached ? "bible-book-card is-cached" : "bible-book-card",
					attr: { id: book.bookid.toString() }
				});
				card.style.setProperty("--download-proportion", downloadProportion.toString());
				
				const bookDisplayName = this.settings.abbreviateBookNames
					? (BIBLE_BOOK_IDS[book.bookid - 1] || book.name)
					: book.name;
				card.createSpan({ text: bookDisplayName });
				card.addEventListener("click", async () => {
					await this.renderChapters(book, chapterContainer, books);
				});
				bookElements.push({ book, el: card });
			}
		};

		addCards(oldTestament, oldGrid);
		addCards(newTestament, newGrid);

		// 4. Live search — filters both grids, shows/hides section headers
		const filterBooks = () => {
			let oldVisible = 0;
			let newVisible = 0;

			bookElements.forEach(({ book, el }) => {
				const abbr = BIBLE_BOOK_IDS[book.bookid - 1] || "";
				const matches = book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				                abbr.toLowerCase().includes(searchQuery.toLowerCase());
				el.style.display = matches ? "flex" : "none";
				if (matches) {
					if (book.bookid < 40) oldVisible++;
					else newVisible++;
				}
			});

			// Show/hide section headers based on visibility
			oldHeader.style.display = oldVisible > 0 ? "flex" : "none";
			newHeader.style.display = newVisible > 0 ? "flex" : "none";
			noResults.style.display = oldVisible === 0 && newVisible === 0 ? "block" : "none";

			// Auto-expand sections during search so matching books are actually shown
			if (searchQuery.trim().length > 0) {
				if (oldVisible > 0) {
					oldGrid.style.display = "grid";
					oldHeader.classList.remove("is-collapsed");
				}
				if (newVisible > 0) {
					newGrid.style.display = "grid";
					newHeader.classList.remove("is-collapsed");
				}
			}
		};

		let searchQuery = "";
		let activeTab: "browse" | "search" = "browse";

		browseTab.addEventListener("click", () => {
			if (activeTab === "browse") return;
			activeTab = "browse";
			browseTab.classList.add("active");
			searchTab.classList.remove("active");
			browseViewEl.style.display = "block";
			searchViewEl.style.display = "none";
			searchInput.value = "";
			searchQuery = "";
			clearBtn.style.display = "none";
			searchInput.placeholder = "Search books...";
			filterBooks();
			searchInput.focus();
		});

		searchTab.addEventListener("click", () => {
			if (activeTab === "search") return;
			activeTab = "search";
			searchTab.classList.add("active");
			browseTab.classList.remove("active");
			browseViewEl.style.display = "none";
			searchViewEl.style.display = "block";
			searchInput.value = "";
			searchQuery = "";
			clearBtn.style.display = "none";
			searchInput.placeholder = "Search verses (e.g. faith)...";
			searchViewEl.empty();
			searchViewEl.createDiv({ cls: "no-results-message", text: "Type at least 2 characters to search scripture offline..." });
			searchInput.focus();
		});

		searchInput.addEventListener("input", (e) => {
			searchQuery = (e.target as HTMLInputElement).value;
			clearBtn.style.display = searchQuery ? "flex" : "none";
			if (activeTab === "browse") {
				filterBooks();
			} else {
				this.performFullTextSearch(searchQuery, searchViewEl);
			}
		});

		clearBtn.addEventListener("click", () => {
			searchInput.value = "";
			searchQuery = "";
			clearBtn.style.display = "none";
			if (activeTab === "browse") {
				filterBooks();
			} else {
				searchViewEl.empty();
				searchViewEl.createDiv({ cls: "no-results-message", text: "Type at least 2 characters to search scripture offline..." });
			}
			searchInput.focus();
		});
		this.updateOfflineStatus(this.isOfflineState);
	}

	async renderChapters(
		book: { bookid: number; name: string; chapters: number },
		chapterContainer: HTMLElement,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		this.logDebug(`renderChapters called for book: ${book.name} (id: ${book.bookid}, chapters: ${book.chapters}). isOfflineState=${this.isOfflineState}`);
		this.currentView = "chapters";
		this.activeBook = book;
		this.activeChapterNumber = null;
		chapterContainer.empty();

		const localData = await this.plugin.readLocalTranslation(this.settings.bibleVersion);
		const isOffline = this.isOfflineState;
		chapterContainer.classList.toggle("is-offline", isOffline);

		const wrapper = chapterContainer.parentElement;
		if (wrapper) {
			if (this.settings.enableOfflineAccents) {
				wrapper.classList.add("enable-offline-accents");
			} else {
				wrapper.classList.remove("enable-offline-accents");
			}
			// Remove searchContainer if it exists
			const search = wrapper.querySelector(".bible-search-container");
			if (search) search.remove();

			// Remove any previous header
			const oldHeader = wrapper.querySelector(".bible-header-nav");
			if (oldHeader) oldHeader.remove();
			
			// Ensure we have a clean header navigation
			const header = wrapper.createDiv({ cls: "bible-header-nav" });
			wrapper.insertBefore(header, chapterContainer);
			
			// Render the navigation inside header
			const backBtn = header.createEl("button", {
				cls: "bible-icon-btn",
				attr: { "aria-label": "Back to Books", "title": "Back to Books" }
			});
			this.safeSetIcon(backBtn, "arrow-left");
			backBtn.addEventListener("click", () => {
				this.loadBible();
			});
			
			const titleEl = header.createEl("div", { cls: "bible-header-title" });
			titleEl.createEl("span", { text: "SELECT CHAPTER", cls: "bible-header-subtitle" });
			const bookDisplayName = this.settings.abbreviateBookNames
				? (BIBLE_BOOK_IDS[book.bookid - 1] || book.name)
				: book.name;
			titleEl.createEl("div", { text: bookDisplayName, cls: "bible-header-book-name" });
			
			// Just a spacer on the right so title stays centered
			const spacer = header.createDiv();
			spacer.style.width = "32px";
		}

		// Glassmorphic circular chapter grid
		const chaptersGrid = chapterContainer.createDiv({ cls: "bible-chapters-grid" });

		for (let i = 1; i <= book.chapters; i++) {
			const isChapterCached = localData && (
				localData.apiType === "bolls" ||
				(localData.passages && localData.passages[book.bookid] && localData.passages[book.bookid][i])
			);

			const btn = chaptersGrid.createEl("button", {
				text: i.toString(),
				cls: isChapterCached ? "chapter-button is-cached" : "chapter-button",
			});
			btn.style.setProperty("--download-proportion", isChapterCached ? "1" : "0");
			
			btn.addEventListener("click", async () => {
				this.logDebug(`Chapter button clicked: ${book.name} Chapter ${i}`);
				chapterContainer.empty();
				chapterContainer.createDiv({ cls: "bible-loading-indicator", text: `Loading ${book.name} Chapter ${i}...` });

					try {
						const chapterContentArray = await this.getChapterContent(this.settings.bibleVersion,
							book.bookid,
							i
						);
						chapterContainer.empty();
						await this.processChapterContent(
							chapterContentArray,
							chapterContainer,
							book,
							i,
							books
						);
					} catch (err) {
						this.logDebug(`Failed to load ${book.name} Chapter ${i}: ${err.message || err}`);
						chapterContainer.empty();
						await this.renderChapters(book, chapterContainer, books);
					}
				});
		}
		this.updateOfflineStatus(this.isOfflineState);
	}

	async processChapterContent(
		chapter: { verse: string; text: string }[],
		chapterContainer: HTMLElement,
		book: { bookid: number; name: string; chapters: number },
		i: number,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		this.logDebug(`processChapterContent called for ${book.name} Chapter ${i}. separateVersesSidecar=${this.settings.separateVersesSidecar}`);
		this.currentView = "verses";
		this.activeBook = book;
		this.activeChapterNumber = i;
		const wrapper = chapterContainer.parentElement;
		if (wrapper) {
			// Remove searchContainer if it exists
			const search = wrapper.querySelector(".bible-search-container");
			if (search) search.remove();
			
			// Remove any previous header
			const oldHeader = wrapper.querySelector(".bible-header-nav");
			if (oldHeader) oldHeader.remove();

			// Ensure we have a clean header navigation
			const header = wrapper.createDiv({ cls: "bible-header-nav" });
			wrapper.insertBefore(header, chapterContainer);
			
			// Render the navigation inside header
			const backBtn = header.createEl("button", {
				cls: "bible-icon-btn",
				attr: { "aria-label": "Back to Chapters", "title": "Back to Chapters" }
			});
			this.safeSetIcon(backBtn, "arrow-left");
			backBtn.addEventListener("click", async () => {
				this.logDebug(`Back to Chapters clicked. Going back to chapter selection for book: ${book.name}`);
				chapterContainer.empty();
				await this.renderChapters(book, chapterContainer, books);
			});
			
			const titleEl = header.createEl("div", { cls: "bible-header-title" });
			const bookDisplayName = this.settings.abbreviateBookNames
				? (BIBLE_BOOK_IDS[book.bookid - 1] || book.name)
				: book.name;
			titleEl.createEl("span", { text: bookDisplayName.toUpperCase(), cls: "bible-header-subtitle" });
			titleEl.createEl("div", { text: `Chapter ${i}`, cls: "bible-header-book-chapter" });
			
			// Right side controls: Prev & Next Chapter!
			const rightControls = header.createDiv({ cls: "bible-header-right-controls" });
			
			const prevBtn = rightControls.createEl("button", {
				cls: "bible-icon-btn",
				attr: { "aria-label": "Previous Chapter", "title": "Previous Chapter" }
			});
			this.safeSetIcon(prevBtn, "chevron-left");

			const localData = await this.plugin.readLocalTranslation(this.settings.bibleVersion);
			const isChapterAvailable = (bId: number, cNum: number) => {
				if (!this.isOfflineState) return true;
				if (!localData) return false;
				if (localData.apiType === "bolls") return true;
				const available = !!(localData.passages?.[bId]?.[cNum]?.isFullyCached);
				this.logDebug(`Checking offline availability for Book ${bId} Chapter ${cNum}: ${available}`);
				return available;
			};
			
			if (book.bookid === 1 && i === 1) {
				this.logDebug("Disabling prevBtn: reached start of Bible (Genesis 1).");
				prevBtn.setAttribute("disabled", "true");
				prevBtn.style.opacity = "0.3";
				prevBtn.style.pointerEvents = "none";
			} else {
				let prevBookId = book.bookid;
				let prevChapterNum = i - 1;
				if (prevChapterNum < 1) {
					prevBookId = book.bookid - 1;
					const prevBook = books[prevBookId - 1];
					prevChapterNum = prevBook ? prevBook.chapters : 1;
				}
				const prevAvailable = isChapterAvailable(prevBookId, prevChapterNum);
				this.logDebug(`Prev chapter details: Book ID ${prevBookId}, Chapter ${prevChapterNum}. Available: ${prevAvailable}`);
				if (!prevAvailable) {
					this.logDebug("Disabling prevBtn: previous chapter is not cached/downloaded offline.");
					prevBtn.setAttribute("disabled", "true");
					prevBtn.style.opacity = "0.3";
					prevBtn.style.pointerEvents = "none";
				}
			}
			
			prevBtn.addEventListener("click", async () => {
				let newChapter = i - 1;
				this.logDebug(`prevBtn clicked. currentChapter=${i}, newChapter=${newChapter}`);
				
				// Empty container and show loading state immediately to prevent double-clicks
				chapterContainer.empty();

				try {
					if (newChapter < 1) {
						if (book.bookid > 1) {
							const prevBook = books[book.bookid - 2];
							chapterContainer.createDiv({ cls: "bible-loading-indicator", text: `Loading ${prevBook.name} Chapter ${prevBook.chapters}...` });
							this.logDebug(`Moving back to previous book: ${prevBook.name} Chapter ${prevBook.chapters}`);
							const prevChapterContent = await this.getChapterContent(this.settings.bibleVersion,
								prevBook.bookid,
								prevBook.chapters
							);
							chapterContainer.empty();
							await this.processChapterContent(
								prevChapterContent,
								chapterContainer,
								prevBook,
								prevBook.chapters,
								books
							);
						}
					} else {
						chapterContainer.createDiv({ cls: "bible-loading-indicator", text: `Loading ${book.name} Chapter ${newChapter}...` });
						this.logDebug(`Moving back to previous chapter of current book: Chapter ${newChapter}`);
						const previousChapterContent = await this.getChapterContent(this.settings.bibleVersion,
							book.bookid,
							newChapter
						);
						chapterContainer.empty();
						await this.processChapterContent(
							previousChapterContent,
							chapterContainer,
							book,
							newChapter,
							books
						);
					}
				} catch (err) {
					this.logDebug(`Failed to navigate to previous chapter: ${err.message || err}`);
					chapterContainer.empty();
					await this.processChapterContent(chapter, chapterContainer, book, i, books);
				}
			});
			
			const nextBtn = rightControls.createEl("button", {
				cls: "bible-icon-btn",
				attr: { "aria-label": "Next Chapter", "title": "Next Chapter" }
			});
			this.safeSetIcon(nextBtn, "chevron-right");
			
			if (book.bookid === books.length && i === book.chapters) {
				this.logDebug("Disabling nextBtn: reached end of Bible (Revelation 22).");
				nextBtn.setAttribute("disabled", "true");
				nextBtn.style.opacity = "0.3";
				nextBtn.style.pointerEvents = "none";
			} else {
				let nextBookId = book.bookid;
				let nextChapterNum = i + 1;
				if (nextChapterNum > book.chapters) {
					nextBookId = book.bookid + 1;
					nextChapterNum = 1;
				}
				const nextAvailable = isChapterAvailable(nextBookId, nextChapterNum);
				this.logDebug(`Next chapter details: Book ID ${nextBookId}, Chapter ${nextChapterNum}. Available: ${nextAvailable}`);
				if (!nextAvailable) {
					this.logDebug("Disabling nextBtn: next chapter is not cached/downloaded offline.");
					nextBtn.setAttribute("disabled", "true");
					nextBtn.style.opacity = "0.3";
					nextBtn.style.pointerEvents = "none";
				}
			}
			
			nextBtn.addEventListener("click", async () => {
				let newChapter = i + 1;
				this.logDebug(`nextBtn clicked. currentChapter=${i}, newChapter=${newChapter}`);
				
				// Empty container and show loading state immediately to prevent double-clicks
				chapterContainer.empty();

				try {
					if (newChapter > book.chapters) {
						if (book.bookid < books.length) {
							const newBookId = book.bookid + 1;
							const newBook = books[newBookId - 1];
							chapterContainer.createDiv({ cls: "bible-loading-indicator", text: `Loading ${newBook.name} Chapter 1...` });
							this.logDebug(`Moving forward to next book: ${newBook.name} Chapter 1`);
							newChapter = 1;
							const nextChapterContent = await this.getChapterContent(this.settings.bibleVersion,
								newBookId,
								newChapter
							);
							chapterContainer.empty();
							await this.processChapterContent(
								nextChapterContent,
								chapterContainer,
								newBook,
								newChapter,
								books
							);
						}
					} else {
						chapterContainer.createDiv({ cls: "bible-loading-indicator", text: `Loading ${book.name} Chapter ${newChapter}...` });
						this.logDebug(`Moving forward to next chapter of current book: Chapter ${newChapter}`);
						const nextChapterContent = await this.getChapterContent(this.settings.bibleVersion,
							book.bookid,
							newChapter
						);
						chapterContainer.empty();
						await this.processChapterContent(
							nextChapterContent,
							chapterContainer,
							book,
							newChapter,
							books
						);
					}
				} catch (err) {
					this.logDebug(`Failed to navigate to next chapter: ${err.message || err}`);
					chapterContainer.empty();
					await this.processChapterContent(chapter, chapterContainer, book, i, books);
				}
			});
		}

		const separate = this.settings.separateVersesSidecar !== false;

		const chapterContent = chapterContainer.createEl("div", {
			cls: separate ? "chapter-content" : "chapter-content inline-layout",
		});
		chapterContent.empty();

		if (chapter && ((chapter as any).isApiBible || (chapter as any).isEsvApi)) {
			const rawHtml = (chapter as any).html;
			const isEsv = (chapter as any).isEsvApi;
			const parser = new DOMParser();
			const doc = parser.parseFromString(rawHtml, "text/html");

			// Clean up any extra/copyright elements returned by the API
			doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());

			if (separate) {
				const spans = doc.querySelectorAll(isEsv ? "b.verse-num, b.chapter-num, span.chapter-num" : "span.v");
				spans.forEach((span) => {
					let verseNumText = isEsv ? (span.textContent?.trim() || "") : (span.getAttribute("data-number") || span.textContent || "");
					if (isEsv) {
						if (verseNumText.includes(":")) {
							verseNumText = verseNumText.split(":")[1]; // Handle "1:1" -> "1"
						} else if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
							verseNumText = "1"; // Handle "3" -> "1"
						}
					}
					const verseNum = verseNumText.trim();
					const formattedVerseNumber = convertToSuperscript(verseNum);

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

					let cleanText = text.trim().replace(/\n+/g, " ");
					cleanText = cleanText.replace(/^\d+:\d+\s*/, "");
					let displayHtml = cleanText;

					if (this.settings.gospelQuotesRed && ["matthew", "mark", "luke", "john"].includes(book.name.toLowerCase())) {
						displayHtml = displayHtml
							.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"')
							.replace(/\u201c([^\u201d]+)\u201d/g, '\u201c<span style="color: red;">$1</span>\u201d');
					}

					const formattedVerse = chapterContent.createEl("div", { 
						cls: "verse",
						attr: { 
							draggable: "true",
							"data-verse": verseNum
						}
					});
					formattedVerse.innerHTML = `<span class="verse-num">${formattedVerseNumber}</span> ${displayHtml}`;

					formattedVerse.addEventListener("dragstart", (e) => {
						const uri = `obsidian://bible?book=${encodeURIComponent(book.name)}&chapter=${i}&verse=${verseNum}`;
						const linkedVerseNum = `[${formattedVerseNumber}](${uri})`;
						let referenceLink = "";
						if (this.settings.verseReferenceInternalLinking) {
							referenceLink = `[[${book.name}]] [${i}:${verseNum}](${uri})`;
						} else {
							const label = this.settings.verseReferenceFormat === "short"
								? `${i}:${verseNum}`
								: `${book.name} ${i}:${verseNum}`;
							referenceLink = `[${label}](${uri})`;
						}

						let dragText = "";
						if (this.settings.copyFormat === "callout") {
							dragText = `> [!quote] ${referenceLink}\n> ${linkedVerseNum} ${cleanText}`;
						} else {
							if (this.settings.copyVerseReference) {
								dragText = `${linkedVerseNum} ${cleanText}\n${this.settings.verseReferenceStyle}${referenceLink}`;
							} else {
								dragText = `${linkedVerseNum} ${cleanText}`;
							}
						}
						if (e.dataTransfer) {
							e.dataTransfer.setData("text/plain", dragText);
						}
					});

					const copyBtn = formattedVerse.createEl("button", {
						cls: "bible-verse-copy-btn",
						attr: { "aria-label": "Copy Verse", "title": "Copy Verse" }
					});
					this.safeSetIcon(copyBtn, "copy");
					copyBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						this.renderCopyMessage(book, i, `${formattedVerseNumber} ${cleanText}`);
					});
				});
			} else {
				// Clean the inline raw HTML of wrapper headings/copyright
				const tempDiv = document.createElement("div");
				tempDiv.innerHTML = rawHtml;
				tempDiv.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());

				let cleanHtml = tempDiv.innerHTML;
				
				// Strip redundant chapter:verse numeric prefix (e.g. "1:1 " or "2:1 ") at paragraph/span starts
				cleanHtml = cleanHtml.replace(/(<p[^>]*>|<div[^>]*>|>\u00A0|>\s*)\s*(\d+):1\s+/g, '$1<span class="verse-num">¹</span>\u00A0');
				cleanHtml = cleanHtml.replace(/(<span[^>]*class="[^"]*(chapter|v)[^"]*"[^>]*>)\s*(\d+):1\s*(<\/span>)/g, '$1¹$4');
				
				const inlineDiv = document.createElement("div");
				inlineDiv.innerHTML = cleanHtml;
				const spans = inlineDiv.querySelectorAll(isEsv ? "b.verse-num, b.chapter-num, span.chapter-num" : "span.v");
				spans.forEach((span) => {
					let verseNumText = isEsv ? (span.textContent?.trim() || "") : (span.getAttribute("data-number") || span.textContent || "");
					if (isEsv) {
						if (verseNumText.includes(":")) {
							verseNumText = verseNumText.split(":")[1]; // Handle "1:1" -> "1"
						} else if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
							verseNumText = "1"; // Handle "3" -> "1"
						}
					}
					const verseNum = verseNumText.trim();
					const formattedVerseNumber = convertToSuperscript(verseNum);
					
					// Collect all siblings up to the next verse or chapter span
					const siblingsToWrap: Node[] = [];
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
						siblingsToWrap.push(next);
						next = next.nextSibling;
					}

					// Create the wrapper span
					const verseWrapper = document.createElement("span");
					verseWrapper.className = "verse-inline";
					verseWrapper.setAttribute("data-verse", verseNum);
					
					// Insert wrapper before current span
					span.parentNode?.insertBefore(verseWrapper, span);
					
					// Append new verse-num element inside wrapper
					const verseNumSpan = document.createElement("span");
					verseNumSpan.className = "verse-num";
					verseNumSpan.textContent = formattedVerseNumber;
					verseWrapper.appendChild(verseNumSpan);
					verseWrapper.appendChild(document.createTextNode("\u00A0"));
					
					// Strip redundant 1:1 prefix on first sibling text if present
					if (siblingsToWrap.length > 0) {
						const firstSib = siblingsToWrap[0];
						if (firstSib.nodeType === Node.TEXT_NODE && firstSib.textContent) {
							firstSib.textContent = firstSib.textContent.replace(/^\s*\d+:\d+\s*/, "");
						}
					}

					// Move sibling nodes inside wrapper
					siblingsToWrap.forEach(sibling => {
						verseWrapper.appendChild(sibling);
					});

					// Remove original span
					span.remove();
				});

				// Apply Gospel quotes red formatting safely using DOM traversal to prevent HTML tag corruption
				if (this.settings.gospelQuotesRed && ["matthew", "mark", "luke", "john"].includes(book.name.toLowerCase())) {
					colorGospelQuotesRedInDOM(inlineDiv);
				}

				// Second-pass scanner for ESV API elements to tag elements with data-verse
				const allEls = inlineDiv.querySelectorAll('*');
				allEls.forEach((el: HTMLElement) => {
					const id = el.id || "";
					const match = id.match(/^[pv](\d{2})(\d{3})(\d{3})/);
					if (match) {
						const vNum = parseInt(match[3]).toString();
						// Check if this element contains any descendant element that belongs to a different verse
						const descendants = el.querySelectorAll('*');
						let hasDifferentVerse = false;
						for (let j = 0; j < descendants.length; j++) {
							const desc = descendants[j] as HTMLElement;
							const descId = desc.id || "";
							const descMatch = descId.match(/^[pv](\d{2})(\d{3})(\d{3})/);
							if (descMatch) {
								const descVNum = parseInt(descMatch[3]).toString();
								if (descVNum !== vNum) {
									hasDifferentVerse = true;
									break;
								}
							}
							const descDataVerse = desc.getAttribute("data-verse");
							if (descDataVerse && descDataVerse !== vNum) {
								hasDifferentVerse = true;
								break;
							}
						}
						if (!hasDifferentVerse) {
							el.setAttribute("data-verse", vNum);
							el.classList.add("verse-inline");
						}
					}
				});
				
				chapterContent.innerHTML = inlineDiv.innerHTML;
			}
		} else {
			if (separate) {
				for (const verse of chapter) {
					const formattedVerseNumber = convertToSuperscript(verse.verse);
					let displayHtml = verse.text.replace(/^\d+:\d+\s*/, "");
					const cleanText = displayHtml.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>?/gm, "");

					if (this.settings.gospelQuotesRed && ["matthew", "mark", "luke", "john"].includes(book.name.toLowerCase())) {
						displayHtml = displayHtml
							.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"')
							.replace(/\u201c([^\u201d]+)\u201d/g, '\u201c<span style="color: red;">$1</span>\u201d');
					}

					const formattedVerse = chapterContent.createEl("div", { 
						cls: "verse",
						attr: { 
							draggable: "true",
							"data-verse": verse.verse
						}
					});
					formattedVerse.innerHTML = `<span class="verse-num">${formattedVerseNumber}</span> ${displayHtml}`;

					formattedVerse.addEventListener("dragstart", (e) => {
						const uri = `obsidian://bible?book=${encodeURIComponent(book.name)}&chapter=${i}&verse=${verse.verse}`;
						const linkedVerseNum = `[${formattedVerseNumber}](${uri})`;
						let referenceLink = "";
						if (this.settings.verseReferenceInternalLinking) {
							referenceLink = `[[${book.name}]] [${i}:${verse.verse}](${uri})`;
						} else {
							const label = this.settings.verseReferenceFormat === "short"
								? `${i}:${verse.verse}`
								: `${book.name} ${i}:${verse.verse}`;
							referenceLink = `[${label}](${uri})`;
						}

						let dragText = "";
						if (this.settings.copyFormat === "callout") {
							dragText = `> [!quote] ${referenceLink}\n> ${linkedVerseNum} ${cleanText}`;
						} else {
							if (this.settings.copyVerseReference) {
								dragText = `${linkedVerseNum} ${cleanText}\n${this.settings.verseReferenceStyle}${referenceLink}`;
							} else {
								dragText = `${linkedVerseNum} ${cleanText}`;
							}
						}
						if (e.dataTransfer) {
							e.dataTransfer.setData("text/plain", dragText);
						}
					});

					const copyBtn = formattedVerse.createEl("button", {
						cls: "bible-verse-copy-btn",
						attr: { "aria-label": "Copy Verse", "title": "Copy Verse" }
					});
					this.safeSetIcon(copyBtn, "copy");
					copyBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						this.renderCopyMessage(book, i, `${formattedVerseNumber} ${cleanText}`);
					});
				}
			} else {
				// Inline / paragraph mode — inject all verse HTML as one continuous stream
				// so translation formatting (br, i, b, paragraphs) flows naturally
				let inlineHTML = "";
				for (const verse of chapter) {
					const formattedVerseNumber = convertToSuperscript(verse.verse);

					let displayHtml = verse.text.replace(/^\d+:\d+\s*/, "");
					if (this.settings.gospelQuotesRed && ["matthew", "mark", "luke", "john"].includes(book.name.toLowerCase())) {
						displayHtml = displayHtml
							.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"')
							.replace(/\u201c([^\u201d]+)\u201d/g, '\u201c<span style="color: red;">$1</span>\u201d');
					}

					inlineHTML += `<span class="verse-inline" data-verse="${verse.verse}"><span class="verse-num">${formattedVerseNumber}</span>\u00A0${displayHtml}</span> `;
				}
				chapterContent.innerHTML = inlineHTML;
			}
		}
		
		chapterContent.addEventListener("copy", (e: ClipboardEvent) => {
			const selection = document.getSelection();
			if (selection && !selection.isCollapsed) {
				e.preventDefault(); 
				this.renderCopyMessage(book, i, selection.toString()); 
			}
		});

		// Bottom navigation controls row so user can change chapter when reaching the end of verses
		const bottomControls = chapterContainer.createDiv({ cls: "bible-view-controls-bottom" });
		
		const bottomPrevBtn = bottomControls.createEl("button", {
			cls: "bible-icon-btn",
			attr: { "aria-label": "Previous Chapter", "title": "Previous Chapter" }
		});
		this.safeSetIcon(bottomPrevBtn, "chevron-left");
		if (book.bookid === 1 && i === 1) {
			bottomPrevBtn.setAttribute("disabled", "true");
			bottomPrevBtn.style.opacity = "0.3";
			bottomPrevBtn.style.pointerEvents = "none";
		}
		bottomPrevBtn.addEventListener("click", async () => {
			let newChapter = i - 1;
			if (newChapter < 1) {
				if (book.bookid > 1) {
					const prevBook = books[book.bookid - 2];
					const prevChapterContent = await this.getChapterContent(this.settings.bibleVersion,
						prevBook.bookid,
						prevBook.chapters
					);
					chapterContainer.empty();
					this.processChapterContent(
						prevChapterContent,
						chapterContainer,
						prevBook,
						prevBook.chapters,
						books
					);
				}
			} else {
				const previousChapterContent = await this.getChapterContent(this.settings.bibleVersion,
					book.bookid,
					newChapter
				);
				chapterContainer.empty();
				this.processChapterContent(
					previousChapterContent,
					chapterContainer,
					book,
					newChapter,
					books
				);
			}
		});
		
		const bottomBackBtn = bottomControls.createEl("button", {
			cls: "bible-icon-btn",
			attr: { "aria-label": "Back to Books", "title": "Back to Books" }
		});
		this.safeSetIcon(bottomBackBtn, "book-open");
		bottomBackBtn.addEventListener("click", () => {
			this.onOpen();
		});
		
		const bottomNextBtn = bottomControls.createEl("button", {
			cls: "bible-icon-btn",
			attr: { "aria-label": "Next Chapter", "title": "Next Chapter" }
		});
		this.safeSetIcon(bottomNextBtn, "chevron-right");
		if (book.bookid === books.length && i === book.chapters) {
			bottomNextBtn.setAttribute("disabled", "true");
			bottomNextBtn.style.opacity = "0.3";
			bottomNextBtn.style.pointerEvents = "none";
		}
		bottomNextBtn.addEventListener("click", async () => {
			let newChapter = i + 1;
			if (newChapter > book.chapters) {
				if (book.bookid < books.length) {
					const newBookId = book.bookid + 1;
					const newBook = books[newBookId - 1];
					newChapter = 1;
					const nextChapterContent = await this.getChapterContent(this.settings.bibleVersion,
						newBookId,
						newChapter
					);
					chapterContainer.empty();
					this.processChapterContent(
						nextChapterContent,
						chapterContainer,
						newBook,
						newChapter,
						books
					);
				}
			} else {
				const nextChapterContent = await this.getChapterContent(this.settings.bibleVersion,
					book.bookid,
					newChapter
				);
				chapterContainer.empty();
				this.processChapterContent(
					nextChapterContent,
					chapterContainer,
					book,
					newChapter,
					books
				);
			}
		});
	}
	renderCopyMessage(
		book: { bookid: number; name: string; chapters: number },
		chapter: number,
		accumulatedVerseText: string
	) {
		const result = compileCopyMessage(book.name, chapter, accumulatedVerseText, this.settings);
		if (!result.finalText) return;

		copyToClipboard(result.finalText);

		// Show a single consolidated Notice
		new Notice(
			`Copied ${book.name} ${chapter}:${result.rangeStr} to clipboard`
		);
	}

	async performFullTextSearch(query: string, searchResultsEl: HTMLElement) {
		searchResultsEl.empty();
		if (!query || query.trim().length < 2) {
			searchResultsEl.createDiv({ cls: "no-results-message", text: "Type at least 2 characters to search scripture offline..." });
			return;
		}

		searchResultsEl.createDiv({ cls: "no-results-message", text: "Searching local database..." });

		const localData = await this.plugin.readLocalTranslation(this.settings.bibleVersion);
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
					const parser = new DOMParser();
					const doc = parser.parseFromString(cachedChapter.html, "text/html");
					
					if (cachedChapter.isEsvApi) {
						doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());
						const spans = doc.querySelectorAll("b.verse-num, b.chapter-num, span.chapter-num");
						spans.forEach((span) => {
							let verseNum = parseInt(span.textContent || "0");
							if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
								verseNum = 1;
							}
							if (verseNum === 0) return;
							
							let text = "";
							let next = span.nextSibling;
							while (next && !(next instanceof Element && (next.classList.contains("verse-num") || next.classList.contains("chapter-num") || (next.tagName.toLowerCase() === "b" && next.classList.contains("verse-num"))))) {
								text += next.textContent || "";
								next = next.nextSibling;
							}
							const cleanText = text.replace(/<[^>]*>?/gm, '').trim();
							const cleanLower = cleanText.toLowerCase();
							
							if (searchTerms.every(term => cleanLower.includes(term))) {
								results.push({
									bookName: book.name,
									bookid: book.bookid,
									chapter: chapterNum,
									verse: verseNum.toString(),
									text: cleanText
								});
							}
						});
					} else {
						// API.Bible
						const spans = doc.querySelectorAll("span.v");
						spans.forEach((span) => {
							const verseNum = parseInt(span.getAttribute("data-number") || span.textContent || "0");
							if (verseNum === 0) return;
							
							let text = "";
							let next = span.nextSibling;
							if (!next && span.parentElement && span.parentElement.classList.contains("verse-span")) {
								next = span.parentElement.nextSibling;
							}
							while (next && !(next instanceof Element && (next.classList.contains("v") || next.querySelector(".v")))) {
								text += next.textContent || "";
								next = next.nextSibling;
							}
							const cleanText = text.replace(/<[^>]*>?/gm, '').trim();
							const cleanLower = cleanText.toLowerCase();
							
							if (searchTerms.every(term => cleanLower.includes(term))) {
								results.push({
									bookName: book.name,
									bookid: book.bookid,
									chapter: chapterNum,
									verse: verseNum.toString(),
									text: cleanText
								});
							}
						});
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
			body.setText(res.text);

			card.addEventListener("click", async () => {
				await this.navigateToPassage(res.bookName, res.chapter, parseInt(res.verse));
			});
		});
	}
}

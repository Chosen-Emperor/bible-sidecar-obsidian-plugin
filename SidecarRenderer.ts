import { Platform, setIcon, Notice } from "obsidian";
import { 
	convertToSuperscript, 
	convertToNumber, 
	compileCopyMessage, 
	compileDragText,
	compileFormattedPassage,
	copyToClipboard, 
	BIBLE_BOOK_IDS, 
	isNavigationAllowedOffline, 
	calculateDownloadProportion, 
	isOldTestament, 
	getBookDisplayName, 
	searchBibleLocalData, 
	highlightSearchTerms, 
	parseAdvancedSearchQuery, 
	renderStrongsHtml, 
	extractCrossReferences,
	parseHtmlToVerses,
	stripLeadingVerseNumbers,
	getSelectionHtmlPreservingRedSpans,
	cleanHtmlKeepRedSpans,
	isNodeInsideRedSpan,
	compileReferenceLink
} from "./utils";

export class SidecarRenderer {
	public view: any;

	constructor(view: any) {
		this.view = view;
	}

	get settings() { return this.view.settings; }
	get plugin() { return this.view.plugin; }
	get isOfflineState() { return this.view.isOfflineState; }
	get containerEl() { return this.view.containerEl; }
	get app() { return this.view.app; }
	
	get currentView() { return this.view.currentView; }
	set currentView(v) { this.view.currentView = v; }
	
	get activeBook() { return this.view.activeBook; }
	set activeBook(b) { this.view.activeBook = b; }
	
	get activeChapterNumber() { return this.view.activeChapterNumber; }
	set activeChapterNumber(n) { this.view.activeChapterNumber = n; }
	
	get savedScrollPositions() { return this.view.savedScrollPositions; }
	get strongsDefinitionCache() { return this.view.strongsDefinitionCache; }
	
	get activeSelectionDoc() { return this.view.activeSelectionDoc; }
	set activeSelectionDoc(d) { this.view.activeSelectionDoc = d; }
	
	get activeSelectionChangeHandler() { return this.view.activeSelectionChangeHandler; }
	set activeSelectionChangeHandler(h) { this.view.activeSelectionChangeHandler = h; }
	
	get otCollapsed() { return this.view.otCollapsed; }
	set otCollapsed(c) { this.view.otCollapsed = c; }
	
	get ntCollapsed() { return this.view.ntCollapsed; }
	set ntCollapsed(c) { this.view.ntCollapsed = c; }

	get resizeObserver() { return this.view.resizeObserver; }
	set resizeObserver(ro) { this.view.resizeObserver = ro; }

	// View coordination delegate calls
	logDebug(msg: string) { this.view.logDebug(msg); }
	cleanupResizeObserver() { this.view.cleanupResizeObserver(); }
	saveCurrentScrollPosition() { this.view.saveCurrentScrollPosition(); }
	restoreScrollPosition(view: string) { this.view.restoreScrollPosition(view); }
	loadBible() { this.view.loadBible(); }
	getChapterContent(version: string, bookid: number, chapter: number) { return this.view.getChapterContent(version, bookid, chapter); }
	updateOfflineStatus(forceOffline?: boolean) { this.view.updateOfflineStatus(forceOffline); }
	navigateToPassage(bookName: string, chapter: number, verse: number) { return this.view.navigateToPassage(bookName, chapter, verse); }
	onOpen() { return this.view.onOpen(); }

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
			else if (iconId === "chevron-down") el.setText("▼");
			else if (iconId === "chevron-up") el.setText("▲");
			else if (iconId === "copy") el.setText("📋");
			else if (iconId === "wifi-off") el.setText("🔌");
			else if (iconId === "loader") el.setText("⏳");
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
			else if (iconId === "chevron-down") el.setText("▼");
			else if (iconId === "chevron-up") el.setText("▲");
			else if (iconId === "copy") el.setText("📋");
			else if (iconId === "wifi-off") el.setText("🔌");
			else if (iconId === "loader") el.setText("⏳");
		}
	}

	async renderBooks(books: { bookid: number; name: string; chapters: number }[]) {
		this.logDebug(`renderBooks called with ${books?.length} books. isOfflineState=${this.isOfflineState}`);
		const { containerEl } = this;
		containerEl.empty();

		const localData = await this.plugin.cacheStore.readLocalTranslation(this.settings.bibleVersion);
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

		// Initial Old Testament Collapse State
		oldGrid.style.display = this.otCollapsed ? "none" : "grid";
		oldHeader.classList.toggle("is-collapsed", this.otCollapsed);

		oldHeader.addEventListener("click", () => {
			const isCollapsed = oldGrid.style.display === "none";
			oldGrid.style.display = isCollapsed ? "grid" : "none";
			oldHeader.classList.toggle("is-collapsed", !isCollapsed);
			this.otCollapsed = !isCollapsed;
		});

		// New Testament section
		const newHeader = browseViewEl.createDiv({ cls: "bible-testament-header" });
		newHeader.createSpan({ text: "NEW TESTAMENT", cls: "bible-testament-label" });
		const newChevron = newHeader.createDiv({ cls: "bible-testament-chevron" });
		this.safeSetIcon(newChevron, "chevron-down");
		const newGrid = browseViewEl.createDiv({ cls: "bible-books-grid" });

		// Initial New Testament Collapse State
		newGrid.style.display = this.ntCollapsed ? "none" : "grid";
		newHeader.classList.toggle("is-collapsed", this.ntCollapsed);

		newHeader.addEventListener("click", () => {
			const isCollapsed = newGrid.style.display === "none";
			newGrid.style.display = isCollapsed ? "grid" : "none";
			newHeader.classList.toggle("is-collapsed", !isCollapsed);
			this.ntCollapsed = !isCollapsed;
		});

		const noResults = browseViewEl.createDiv({
			cls: "no-results-message",
			text: "No matching books found"
		});
		noResults.style.display = "none";

		// 3. Render book cards into the correct section
		const bookElements: { book: typeof books[0]; el: HTMLElement }[] = [];

		const oldTestament = books.filter(b => isOldTestament(b.bookid));
		const newTestament = books.filter(b => !isOldTestament(b.bookid));

		const addCards = (list: typeof books, grid: HTMLElement) => {
			for (const book of list) {
				const isBookCached = localData && (
					localData.apiType === "bolls" || 
					(localData.passages && localData.passages[book.bookid] && Object.keys(localData.passages[book.bookid]).length > 0)
				);

				let downloadProportion = calculateDownloadProportion(localData, book);

				const card = grid.createEl("button", {
					cls: isBookCached ? "bible-book-card is-cached" : "bible-book-card",
					attr: { id: book.bookid.toString() }
				});
				card.style.setProperty("--download-proportion", downloadProportion.toString());
				
				const bookDisplayName = getBookDisplayName(book, this.settings.abbreviateBookNames);
				card.createSpan({ text: bookDisplayName });
				card.addEventListener("click", async () => {
					this.saveCurrentScrollPosition();
					delete this.savedScrollPositions["chapters"];
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
					if (isOldTestament(book.bookid)) oldVisible++;
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
			} else {
				// Revert to saved collapse state when search is empty
				oldGrid.style.display = this.otCollapsed ? "none" : "grid";
				oldHeader.classList.toggle("is-collapsed", this.otCollapsed);
				newGrid.style.display = this.ntCollapsed ? "none" : "grid";
				newHeader.classList.toggle("is-collapsed", this.ntCollapsed);
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
			this.renderSearchHelpGuide(searchViewEl);
			searchInput.focus();
		});

		searchInput.addEventListener("input", (e: any) => {
			searchQuery = (e.target as HTMLInputElement).value;
			clearBtn.style.display = searchQuery ? "flex" : "none";
			if (activeTab === "browse") {
				filterBooks();
			} else {
				this.view.performFullTextSearch(searchQuery, searchViewEl);
			}
		});

		clearBtn.addEventListener("click", () => {
			searchInput.value = "";
			searchQuery = "";
			clearBtn.style.display = "none";
			if (activeTab === "browse") {
				filterBooks();
			} else {
				this.renderSearchHelpGuide(searchViewEl);
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
		this.cleanupResizeObserver();
		this.currentView = "chapters";
		this.activeBook = book;
		this.activeChapterNumber = null;
		chapterContainer.empty();

		const localData = await this.plugin.cacheStore.readLocalTranslation(this.settings.bibleVersion);
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
				this.saveCurrentScrollPosition();
				this.loadBible();
			});
			
			const titleEl = header.createEl("div", { cls: "bible-header-title" });
			titleEl.createEl("span", { text: "SELECT CHAPTER", cls: "bible-header-subtitle" });
			const bookDisplayName = this.settings.abbreviateBookNames
				? (BIBLE_BOOK_IDS[book.bookid - 1] || book.name)
				: book.name;
			const bookNameEl = titleEl.createEl("div", { text: bookDisplayName, cls: "bible-header-book-name is-clickable", attr: { "title": "Click to switch Book" } });
			bookNameEl.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleBookQuickJump(bookNameEl, books);
			});
			
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
				this.saveCurrentScrollPosition();
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
				} catch (err: any) {
					this.logDebug(`Failed to load ${book.name} Chapter ${i}: ${err.message || err}`);
					chapterContainer.empty();
					await this.renderChapters(book, chapterContainer, books);
				}
			});
		}
		this.updateOfflineStatus(this.isOfflineState);
		this.restoreScrollPosition("chapters");
	}

	async processChapterContent(
		chapter: { verse: string; text: string }[],
		chapterContainer: HTMLElement,
		book: { bookid: number; name: string; chapters: number },
		i: number,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		this.logDebug(`processChapterContent called for ${book.name} Chapter ${i}. separateVersesSidecar=${this.settings.separateVersesSidecar}`);
		this.cleanupResizeObserver();
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
				this.saveCurrentScrollPosition();
				chapterContainer.empty();
				await this.renderChapters(book, chapterContainer, books);
			});
			
			const titleEl = header.createEl("div", { cls: "bible-header-title" });
			const bookDisplayName = this.settings.abbreviateBookNames
				? (BIBLE_BOOK_IDS[book.bookid - 1] || book.name)
				: book.name;
			const bookNameEl = titleEl.createEl("span", { text: bookDisplayName.toUpperCase(), cls: "bible-header-subtitle is-clickable", attr: { "title": "Click to switch Book" } });
			bookNameEl.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleBookQuickJump(bookNameEl, books);
			});

			const chapterNumEl = titleEl.createEl("div", { text: `Chapter ${i}`, cls: "bible-header-book-chapter is-clickable", attr: { "title": "Click to switch Chapter" } });
			chapterNumEl.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleChapterQuickJump(chapterNumEl, book, books);
			});
			
			// Right side controls: Prev & Next Chapter!
			const rightControls = header.createDiv({ cls: "bible-header-right-controls" });

			const searchToggleBtn = rightControls.createEl("button", {
				cls: "bible-icon-btn",
				attr: { "aria-label": "Toggle Inline Search", "title": "Toggle Inline Search" }
			});
			this.safeSetIcon(searchToggleBtn, "search");
			searchToggleBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleInlineSearch(chapterContainer, searchToggleBtn);
			});

			const settingsPanel = rightControls.createDiv({
				cls: "bible-settings-2x2-panel"
			});

			const layoutBtn = settingsPanel.createEl("button", {
				cls: this.settings.separateVersesSidecar ? "bible-settings-sub-btn is-active" : "bible-settings-sub-btn",
				text: "¶",
				attr: { "title": "Toggle Line/Paragraph Layout" }
			});
			layoutBtn.addEventListener("click", async (e) => {
				e.stopPropagation();
				this.settings.separateVersesSidecar = !this.settings.separateVersesSidecar;
				await this.plugin.saveSettings();
				layoutBtn.classList.toggle("is-active", this.settings.separateVersesSidecar);
				await this.refreshActiveView(chapterContainer, book, i, books, chapter);
			});

			const parallelBtn = settingsPanel.createEl("button", {
				cls: this.settings.parallelEnabled ? "bible-settings-sub-btn is-active" : "bible-settings-sub-btn",
				text: "||",
				attr: { "title": "Toggle Parallel View" }
			});
			parallelBtn.addEventListener("click", async (e) => {
				e.stopPropagation();
				this.settings.parallelEnabled = !this.settings.parallelEnabled;
				await this.plugin.saveSettings();
				parallelBtn.classList.toggle("is-active", this.settings.parallelEnabled);
				await this.refreshActiveView(chapterContainer, book, i, books, chapter);
			});

			const strongsBtn = settingsPanel.createEl("button", {
				cls: this.settings.showStrongsNumbers ? "bible-settings-sub-btn is-active" : "bible-settings-sub-btn",
				text: "S",
				attr: { "title": "Toggle Strong's Numbers" }
			});
			strongsBtn.addEventListener("click", async (e) => {
				e.stopPropagation();
				this.settings.showStrongsNumbers = !this.settings.showStrongsNumbers;
				await this.plugin.saveSettings();
				strongsBtn.classList.toggle("is-active", this.settings.showStrongsNumbers);
				await this.refreshActiveView(chapterContainer, book, i, books, chapter);
			});

			const redBtn = settingsPanel.createEl("button", {
				cls: this.settings.gospelQuotesRed ? "bible-settings-sub-btn is-active" : "bible-settings-sub-btn",
				text: "R",
				attr: { "title": "Toggle Red Letters for Jesus' Words" }
			});
			redBtn.addEventListener("click", async (e) => {
				e.stopPropagation();
				this.settings.gospelQuotesRed = !this.settings.gospelQuotesRed;
				await this.plugin.saveSettings();
				redBtn.classList.toggle("is-active", this.settings.gospelQuotesRed);
				await this.refreshActiveView(chapterContainer, book, i, books, chapter);
			});
			
			const prevBtn = rightControls.createEl("button", {
				cls: "bible-icon-btn",
				attr: { "aria-label": "Previous Chapter", "title": "Previous Chapter" }
			});
			this.safeSetIcon(prevBtn, "chevron-left");

			const localData = await this.plugin.cacheStore.readLocalTranslation(this.settings.bibleVersion);
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
				} catch (err: any) {
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
				} catch (err: any) {
					this.logDebug(`Failed to navigate to next chapter: ${err.message || err}`);
					chapterContainer.empty();
					await this.processChapterContent(chapter, chapterContainer, book, i, books);
				}
			});
		}

		// Swipe Gestures for Chapter Navigation
		let touchStartX = 0;
		let touchStartY = 0;
		chapterContainer.addEventListener("touchstart", (e) => {
			touchStartX = e.changedTouches[0].screenX;
			touchStartY = e.changedTouches[0].screenY;
		}, { passive: true });

		chapterContainer.addEventListener("touchend", (e) => {
			const touchEndX = e.changedTouches[0].screenX;
			const touchEndY = e.changedTouches[0].screenY;
			const diffX = touchEndX - touchStartX;
			const diffY = touchEndY - touchStartY;

			if (Math.abs(diffX) > 80 && Math.abs(diffY) < 40) {
				if (diffX > 0) {
					const prevBtnEl = wrapper?.querySelector('[aria-label="Previous Chapter"]') as HTMLElement;
					if (prevBtnEl && !prevBtnEl.hasAttribute("disabled")) {
						prevBtnEl.click();
					}
				} else {
					const nextBtnEl = wrapper?.querySelector('[aria-label="Next Chapter"]') as HTMLElement;
					if (nextBtnEl && !nextBtnEl.hasAttribute("disabled")) {
						nextBtnEl.click();
					}
				}
			}
		}, { passive: true });

		const separate = this.settings.separateVersesSidecar !== false;

		const classList = [separate ? "chapter-content" : "chapter-content inline-layout"];
		if (this.settings.gospelQuotesRed) {
			classList.push("gospel-red-enabled");
		}

		const chapterContent = chapterContainer.createEl("div", {
			cls: classList.join(" "),
		});
		chapterContent.empty();

		if (this.settings.parallelEnabled && this.settings.secondaryBibleVersion) {
			// Set up ResizeObserver to dynamically switch layout when width crosses 480px (ADR-007)
			let lastIsNarrow = (chapterContainer.clientWidth || 480) < 480;
			this.resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const width = entry.contentRect.width || chapterContainer.clientWidth || 480;
					const isNarrowNow = width < 480;
					if (isNarrowNow !== lastIsNarrow) {
						lastIsNarrow = isNarrowNow;
						this.logDebug(`Parallel view resize detected: width=${width}px, isNarrow=${isNarrowNow}. Re-rendering columns.`);
						chapterContent.empty();
						this.renderParallelColumns(chapter, chapterContainer, chapterContent, book, i, books);
					} else if (!isNarrowNow) {
						// Align heights on resize
						const wrapper = chapterContent.querySelector(".parallel-container-wrapper") as HTMLElement;
						if (wrapper) {
							this.alignParallelVerseHeights(wrapper);
						}
					}
				}
			});
			this.resizeObserver.observe(chapterContainer);

			// ── PARALLEL VIEW (Supports both Bolls.life and Premium APIs) ────────
			await this.renderParallelColumns(chapter, chapterContainer, chapterContent, book, i, books);
		} else {

		if (chapter && ((chapter as any).isApiBible || (chapter as any).isEsvApi)) {
			const rawHtml = (chapter as any).html;
			const isEsv = (chapter as any).isEsvApi;
			const parser = new DOMParser();
			const doc = parser.parseFromString(rawHtml, "text/html");

			// Clean up any extra/copyright elements returned by the API
			doc.querySelectorAll(".extra_text, .audio, .copyright, .mp3link").forEach(el => el.remove());

			if (separate) {
				const parsed = parseHtmlToVerses(rawHtml, isEsv, true);
				parsed.forEach((verse) => {
					const formattedVerseNumber = convertToSuperscript(verse.verse);
					let displayHtml = verse.text.replace(/^\d+:\d+\s*/, "");
					const cleanText = displayHtml.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>?/gm, "");

					if (this.settings.gospelQuotesRed && ["matthew", "mark", "luke", "john"].includes(book.name.toLowerCase())) {
						displayHtml = displayHtml
							.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"')
							.replace(/\u201c([^\u201d]+)\u201d/g, '\u201c<span style="color: red;">$1</span>\u201d');
					}

					// Strong's concordance — KJV/Bolls.life only
					if (this.settings.showStrongsNumbers && (displayHtml.includes("<H") || displayHtml.includes("<S") || displayHtml.includes("<G"))) {
						displayHtml = renderStrongsHtml(displayHtml, book.bookid >= 40);
					}

					const formattedVerse = chapterContent.createEl("div", { 
						cls: "verse",
						attr: { 
							"data-verse": verse.verse
						}
					});
					formattedVerse.innerHTML = `<span class="verse-num" draggable="true">${formattedVerseNumber}</span> ${displayHtml}`;

					const copyBtn = formattedVerse.createEl("button", {
						cls: "bible-verse-copy-btn",
						attr: { "aria-label": "Copy Verse", "title": "Copy Verse" }
					});
					this.safeSetIcon(copyBtn, "copy");
					copyBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						this.renderCopyMessage(book, i, `${formattedVerseNumber} ${cleanText}`);
					});

					// Cross-references (ESV + API.Bible) — inject <sup> markers
					if (this.settings.showCrossReferences) {
						const rawHtmlForCrossRef = (chapter as any).html || "";
						const crossRefs = extractCrossReferences(rawHtmlForCrossRef);
						if (crossRefs.length > 0) {
							for (const cr of crossRefs) {
								if (cr.refs.length === 0) continue;
								const sup = formattedVerse.createEl("sup", {
									cls: "cross-ref-marker",
									text: cr.letter,
									attr: { "data-refs-display": cr.refs.join(" · ") }
								});
								sup.addEventListener("click", (e) => {
									e.stopPropagation();
									if (Platform.isMobile) {
										this.renderCrossRefDrawer(cr.refs, book.name, i);
									}
								});
							}
						}
					}
				});
				// Strong's word click handler — after all verse elements are rendered
				if (this.settings.showStrongsNumbers) {
					chapterContent.querySelectorAll(".strongs-word").forEach((el: HTMLElement) => {
						el.addEventListener("click", (e) => {
							e.stopPropagation();
							const id = el.getAttribute("data-strongs");
							if (id) this.renderStrongsPanel(id);
						});
					});
				}
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
				wrapInlineVerses(inlineDiv, isEsv);

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

					// Strong's concordance — KJV/Bolls.life only
					if (this.settings.showStrongsNumbers && (displayHtml.includes("<H") || displayHtml.includes("<S") || displayHtml.includes("<G"))) {
						displayHtml = renderStrongsHtml(displayHtml, book.bookid >= 40);
					}

					const formattedVerse = chapterContent.createEl("div", { 
						cls: "verse",
						attr: { 
							"data-verse": verse.verse
						}
					});
					formattedVerse.innerHTML = `<span class="verse-num" draggable="true">${formattedVerseNumber}</span> ${displayHtml}`;

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
					if (this.settings.showStrongsNumbers && (displayHtml.includes("<H") || displayHtml.includes("<S") || displayHtml.includes("<G"))) {
						displayHtml = renderStrongsHtml(displayHtml, book.bookid >= 40);
					}

					inlineHTML += `<span class="verse-inline" data-verse="${verse.verse}"><span class="verse-num" draggable="true">${formattedVerseNumber}</span>\u00A0${displayHtml}</span> `;
				}
				chapterContent.innerHTML = inlineHTML;
			}
		}
		}

		// Strong's word click handler (Bolls separate and inline paths)
		if (this.settings.showStrongsNumbers) {
			chapterContent.querySelectorAll(".strongs-word").forEach((el: HTMLElement) => {
				el.addEventListener("click", (e) => {
					e.stopPropagation();
					const id = el.getAttribute("data-strongs");
					if (id) this.renderStrongsPanel(id);
				});
			});
		}
		
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
					await this.processChapterContent(
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
				await this.processChapterContent(
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
					await this.processChapterContent(
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
				await this.processChapterContent(
					nextChapterContent,
					chapterContainer,
					book,
					newChapter,
					books
				);
			}
		});

		// Keep text selection active when clicking on a .verse-num to drag it
		chapterContent.addEventListener("mousedown", (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target && target.closest(".verse-num")) {
				const selection = document.getSelection();
				if (selection && !selection.isCollapsed) {
					try {
						const range = selection.getRangeAt(0);
						if (chapterContent.contains(range.commonAncestorContainer)) {
							e.preventDefault();
						}
					} catch (err: any) {}
				}
			}
		});

		// Selection drag and drop handler
		chapterContent.addEventListener("dragstart", (e: DragEvent) => {
			const selection = document.getSelection();
			const target = e.target as HTMLElement;

			if (selection && !selection.isCollapsed) {
				const range = selection.getRangeAt(0);
				const startNode = range.startContainer;
				const endNode = range.endContainer;

				const startVerseEl = (startNode instanceof Element ? startNode : startNode.parentElement)?.closest(".verse, .verse-inline") as HTMLElement;
				const endVerseEl = (endNode instanceof Element ? endNode : endNode.parentElement)?.closest(".verse, .verse-inline") as HTMLElement;

				if (!startVerseEl || !endVerseEl) return;

				const isPrimary = startVerseEl.getAttribute("data-primary") !== "false";
				const resolvedBookName = book.name;
				const fragment = range.cloneContents();
				const tempDiv = document.createElement("div");
				tempDiv.appendChild(fragment);

				const hasParallelAttr = startVerseEl.hasAttribute("data-primary");
				const selector = isPrimary ? '.verse[data-primary="true"], .verse-inline[data-primary="true"]' : '.verse[data-primary="false"], .verse-inline[data-primary="false"]';
				const querySelector = hasParallelAttr ? selector : '.verse, .verse-inline';
				let selectedVerseEls = Array.from(tempDiv.querySelectorAll(querySelector)) as HTMLElement[];

				// Filter out nested elements to avoid duplicating text
				selectedVerseEls = selectedVerseEls.filter(el => {
					let parent = el.parentElement;
					while (parent) {
						if (selectedVerseEls.includes(parent)) {
							return false;
						}
						parent = parent.parentElement;
					}
					return true;
				});

				if (selectedVerseEls.length === 0) {
					const vNum = parseInt(startVerseEl.getAttribute("data-verse") || "0");
					if (vNum > 0) {
						const startsInRed = isNodeInsideRedSpan(range.startContainer, startVerseEl);
						const endsInRed = isNodeInsideRedSpan(range.endContainer, startVerseEl);
						let cleanText = cleanHtmlKeepRedSpans(tempDiv);
						if (startsInRed && endsInRed && !cleanText.startsWith('<span style="color: red;">') && !cleanText.endsWith('</span>')) {
							cleanText = `<span style="color: red;">${cleanText}</span>`;
						}
						cleanText = stripLeadingVerseNumbers(cleanText);

						const superscript = convertToSuperscript(vNum.toString());
						const vUri = `obsidian://bible?book=${encodeURIComponent(resolvedBookName)}&chapter=${i}&verse=${vNum}`;
						const dragPayload = `[${superscript}](${vUri}) ${cleanText.trim()}`;
						
						const referenceLink = compileReferenceLink(
							resolvedBookName,
							i,
							vNum.toString(),
							vNum.toString(),
							this.settings.verseReferenceInternalLinking,
							this.settings.verseReferenceFormat
						);
						const dragText = compileFormattedPassage(dragPayload, referenceLink, this.settings);
						if (e.dataTransfer) {
							e.dataTransfer.setData("text/plain", dragText);
							e.dataTransfer.effectAllowed = "copyMove";
						}
					}
					return;
				}

				const verseMap = new Map<number, string[]>();
				const verseNums: number[] = [];

				for (let idx = 0; idx < selectedVerseEls.length; idx++) {
					const el = selectedVerseEls[idx];
					const vNum = parseInt(el.getAttribute("data-verse") || "0");
					if (vNum <= 0) continue;

					let verseText = cleanHtmlKeepRedSpans(el);
					verseText = stripLeadingVerseNumbers(verseText).trim();
					if (!verseText) continue;

					if (!verseMap.has(vNum)) {
						verseMap.set(vNum, []);
						verseNums.push(vNum);
					}
					verseMap.get(vNum)!.push(verseText);
				}

				let dragPayload = "";
				for (let idx = 0; idx < verseNums.length; idx++) {
					const vNum = verseNums[idx];
					const segments = verseMap.get(vNum) || [];
					const mergedText = segments.join(" ");

					const superscript = convertToSuperscript(vNum.toString());
					const vUri = `obsidian://bible?book=${encodeURIComponent(resolvedBookName)}&chapter=${i}&verse=${vNum}`;
					const linkedSup = `[${superscript}](${vUri})`;

					if (idx > 0) {
						dragPayload += ` ${linkedSup} ${mergedText}`;
					} else {
						dragPayload += `${linkedSup} ${mergedText}`;
					}
				}

				if (verseNums.length === 0) return;

				const firstVerse = verseNums[0];
				const lastVerse = verseNums[verseNums.length - 1];
				const rangeStr = firstVerse === lastVerse ? firstVerse.toString() : `${firstVerse}-${lastVerse}`;
				const allVersesStr = verseNums.join(",");

				const referenceLink = compileReferenceLink(
					resolvedBookName,
					i,
					rangeStr,
					allVersesStr,
					this.settings.verseReferenceInternalLinking,
					this.settings.verseReferenceFormat
				);

				const dragText = compileFormattedPassage(dragPayload, referenceLink, this.settings);

				if (e.dataTransfer) {
					e.dataTransfer.setData("text/plain", dragText);
					e.dataTransfer.effectAllowed = "copyMove";
				}
			} else if (target && target.closest(".verse-num")) {
				const verseEl = target.closest(".verse, .verse-inline") as HTMLElement;
				if (!verseEl) return;

				const vNum = parseInt(verseEl.getAttribute("data-verse") || "0");
				if (vNum <= 0) return;

				const resolvedBookName = book.name;
				const isPrimary = verseEl.getAttribute("data-primary") !== "false";
				
				const hasParallelAttr = verseEl.hasAttribute("data-primary");
				const selector = isPrimary ? `.verse[data-verse="${vNum}"][data-primary="true"], .verse-inline[data-verse="${vNum}"][data-primary="true"]` : `.verse[data-verse="${vNum}"][data-primary="false"], .verse-inline[data-verse="${vNum}"][data-primary="false"]`;
				const querySelector = hasParallelAttr ? selector : `.verse[data-verse="${vNum}"], .verse-inline[data-verse="${vNum}"]`;
				let verseEls = Array.from(chapterContent.querySelectorAll(querySelector)) as HTMLElement[];

				// Filter out nested elements to avoid duplicating text
				verseEls = verseEls.filter(el => {
					let parent = el.parentElement;
					while (parent) {
						if (verseEls.includes(parent)) {
							return false;
						}
						parent = parent.parentElement;
					}
					return true;
				});

				const segments: string[] = [];
				verseEls.forEach(el => {
					let text = cleanHtmlKeepRedSpans(el);
					text = stripLeadingVerseNumbers(text).trim();
					if (text) {
						segments.push(text);
					}
				});

				const verseText = segments.join(" ");

				const superscript = convertToSuperscript(vNum.toString());
				const vUri = `obsidian://bible?book=${encodeURIComponent(resolvedBookName)}&chapter=${i}&verse=${vNum}`;
				const dragPayload = `[${superscript}](${vUri}) ${verseText}`;

				const referenceLink = compileReferenceLink(
					resolvedBookName,
					i,
					vNum.toString(),
					vNum.toString(),
					this.settings.verseReferenceInternalLinking,
					this.settings.verseReferenceFormat
				);

				const dragText = compileFormattedPassage(dragPayload, referenceLink, this.settings);

				if (e.dataTransfer) {
					e.dataTransfer.setData("text/plain", dragText);
					e.dataTransfer.effectAllowed = "copyMove";
				}
			}
		});

		// Selection copy handler
		chapterContent.addEventListener("copy", (e: ClipboardEvent) => {
			const selection = document.getSelection();
			if (!selection || selection.isCollapsed) return;

			const range = selection.getRangeAt(0);
			const startNode = range.startContainer;
			const endNode = range.endContainer;

			const startVerseEl = (startNode instanceof Element ? startNode : startNode.parentElement)?.closest(".verse, .verse-inline") as HTMLElement;
			const endVerseEl = (endNode instanceof Element ? endNode : endNode.parentElement)?.closest(".verse, .verse-inline") as HTMLElement;

			if (!startVerseEl || !endVerseEl) return;

			const isPrimary = startVerseEl.getAttribute("data-primary") !== "false";
			const resolvedBookName = book.name;
			const fragment = range.cloneContents();
			const tempDiv = document.createElement("div");
			tempDiv.appendChild(fragment);

			const hasParallelAttr = startVerseEl.hasAttribute("data-primary");
			const selector = isPrimary ? '.verse[data-primary="true"], .verse-inline[data-primary="true"]' : '.verse[data-primary="false"], .verse-inline[data-primary="false"]';
			const querySelector = hasParallelAttr ? selector : '.verse, .verse-inline';
			let selectedVerseEls = Array.from(tempDiv.querySelectorAll(querySelector)) as HTMLElement[];

			// Filter out nested elements to avoid duplicating text
			selectedVerseEls = selectedVerseEls.filter(el => {
				let parent = el.parentElement;
				while (parent) {
					if (selectedVerseEls.includes(parent)) {
						return false;
					}
					parent = parent.parentElement;
				}
				return true;
			});

			if (selectedVerseEls.length === 0) {
				const vNum = parseInt(startVerseEl.getAttribute("data-verse") || "0");
				if (vNum > 0) {
					const startsInRed = isNodeInsideRedSpan(range.startContainer, startVerseEl);
					const endsInRed = isNodeInsideRedSpan(range.endContainer, startVerseEl);
					let cleanText = cleanHtmlKeepRedSpans(tempDiv);
					if (startsInRed && endsInRed && !cleanText.startsWith('<span style="color: red;">') && !cleanText.endsWith('</span>')) {
						cleanText = `<span style="color: red;">${cleanText}</span>`;
					}
					cleanText = stripLeadingVerseNumbers(cleanText);

					const superscript = convertToSuperscript(vNum.toString());
					const vUri = `obsidian://bible?book=${encodeURIComponent(resolvedBookName)}&chapter=${i}&verse=${vNum}`;
					const copyPayload = `[${superscript}](${vUri}) ${cleanText.trim()}`;
					
					const referenceLink = compileReferenceLink(
						resolvedBookName,
						i,
						vNum.toString(),
						vNum.toString(),
						this.settings.verseReferenceInternalLinking,
						this.settings.verseReferenceFormat
					);
					const formattedText = compileFormattedPassage(copyPayload, referenceLink, this.settings);
					e.clipboardData?.setData("text/plain", formattedText);
					e.preventDefault();
				}
				return;
			}

			const verseMap = new Map<number, string[]>();
			const verseNums: number[] = [];

			for (let idx = 0; idx < selectedVerseEls.length; idx++) {
				const el = selectedVerseEls[idx];
				const vNum = parseInt(el.getAttribute("data-verse") || "0");
				if (vNum <= 0) continue;

				let verseText = cleanHtmlKeepRedSpans(el);
				verseText = stripLeadingVerseNumbers(verseText).trim();
				if (!verseText) continue;

				if (!verseMap.has(vNum)) {
					verseMap.set(vNum, []);
					verseNums.push(vNum);
				}
				verseMap.get(vNum)!.push(verseText);
			}

			let copyPayload = "";
			for (let idx = 0; idx < verseNums.length; idx++) {
				const vNum = verseNums[idx];
				const segments = verseMap.get(vNum) || [];
				const mergedText = segments.join(" ");

				const superscript = convertToSuperscript(vNum.toString());
				const vUri = `obsidian://bible?book=${encodeURIComponent(resolvedBookName)}&chapter=${i}&verse=${vNum}`;
				const linkedSup = `[${superscript}](${vUri})`;

				if (idx > 0) {
					copyPayload += ` ${linkedSup} ${mergedText}`;
				} else {
					copyPayload += `${linkedSup} ${mergedText}`;
				}
			}

			if (verseNums.length === 0) return;

			const firstVerse = verseNums[0];
			const lastVerse = verseNums[verseNums.length - 1];
			const rangeStr = firstVerse === lastVerse ? firstVerse.toString() : `${firstVerse}-${lastVerse}`;
			const allVersesStr = verseNums.join(",");

			const referenceLink = compileReferenceLink(
				resolvedBookName,
				i,
				rangeStr,
				allVersesStr,
				this.settings.verseReferenceInternalLinking,
				this.settings.verseReferenceFormat
			);

			const formattedText = compileFormattedPassage(copyPayload, referenceLink, this.settings);
			e.clipboardData?.setData("text/plain", formattedText);
			e.preventDefault();
		});

	}

	renderCrossRefDrawer(refs: string[], bookName: string, chapter: number) {
		const existing = document.querySelector(".cross-ref-drawer");
		if (existing) existing.remove();

		const drawer = document.createElement("div");
		drawer.className = "cross-ref-drawer";

		drawer.createDiv({ cls: "cross-ref-drawer-handle" });
		drawer.createDiv({ cls: "cross-ref-drawer-title", text: "Cross References" });
		const list = drawer.createDiv({ cls: "cross-ref-drawer-list" });

		for (const ref of refs) {
			const item = list.createDiv({ cls: "cross-ref-drawer-item", text: ref });
			item.addEventListener("click", async () => {
				drawer.remove();
				const m = ref.match(/^(.+?)\s+(\d+):(\d+)/);
				if (m) {
					await this.navigateToPassage(m[1], parseInt(m[2]), parseInt(m[3]));
				}
			});
		}

		document.body.appendChild(drawer);
		requestAnimationFrame(() => drawer.classList.add("is-open"));

		const clickAway = (e: MouseEvent) => {
			if (!drawer.contains(e.target as Node)) {
				drawer.classList.remove("is-open");
				setTimeout(() => drawer.remove(), 300);
				document.removeEventListener("mousedown", clickAway);
			}
		};
		document.addEventListener("mousedown", clickAway);
	}

	async renderStrongsPanel(strongsId: string) {
		const existing = document.querySelector(".strongs-panel");
		if (existing) existing.remove();

		const panel = document.createElement("div");
		panel.className = "strongs-panel";

		const header = panel.createDiv({ cls: "strongs-panel-header" });
		header.createSpan({ cls: "strongs-panel-id", text: strongsId });

		const closeBtn = header.createEl("button", { cls: "strongs-panel-close", text: "✕" });
		closeBtn.addEventListener("click", () => {
			panel.classList.remove("is-open");
			setTimeout(() => panel.remove(), 300);
		});

		const body = panel.createDiv({ cls: "strongs-definition-card" });
		body.createDiv({ cls: "strongs-loading", text: "Loading definition…" });

		document.body.appendChild(panel);
		requestAnimationFrame(() => panel.classList.add("is-open"));

		try {
			let data: any;
			if (this.strongsDefinitionCache.has(strongsId)) {
				data = this.strongsDefinitionCache.get(strongsId);
			} else {
				data = await this.plugin.scriptureProvider.fetchStrongsDefinition(strongsId);
				this.strongsDefinitionCache.set(strongsId, data);
			}

			body.empty();
			const word = data?.word || data?.translit || strongsId;
			body.createDiv({ cls: "strongs-word-heading", text: word });
			if (data?.translit && data.translit !== word) {
				body.createDiv({ cls: "strongs-transliteration", text: data.translit });
			}
			if (data?.pos) {
				body.createDiv({ cls: "strongs-part-of-speech", text: data.pos });
			}
			const defText = data?.definition || data?.meaning || data?.kjv_def || "No definition found.";
			const defEl = body.createDiv({ cls: "strongs-definition" });
			defEl.innerHTML = defText;

			defEl.querySelectorAll("a").forEach((link: HTMLAnchorElement) => {
				const href = link.getAttribute("href") || "";
				if (href.startsWith("S:")) {
					const targetId = href.substring(2);
					link.addEventListener("click", (e) => {
						e.preventDefault();
						this.renderStrongsPanel(targetId);
					});
				}
			});
		} catch (err: any) {
			body.empty();
			body.createDiv({ cls: "strongs-error", text: `Unable to load definition for ${strongsId}. Please check your internet connection.` });
			this.logDebug(`Strong's fetch failed for ${strongsId}: ${err.message || err}`);
		}
	}

	normalizeChapterToVerses(chapterData: any): { verse: string; text: string }[] {
		if (!chapterData) return [];
		if (Array.isArray(chapterData)) {
			return chapterData.map(v => ({ verse: v.verse.toString(), text: v.text }));
		}
		
		if (chapterData.isEsvApi || chapterData.isApiBible) {
			const parsed = parseHtmlToVerses(chapterData.html, chapterData.isEsvApi, true);
			return parsed.map(v => ({ verse: v.verse.toString(), text: v.text.trim().replace(/\n+/g, " ") }));
		}
		
		return [];
	}

	async renderParallelColumns(
		primaryChapter: any,
		chapterContainer: HTMLElement,
		chapterContent: HTMLElement,
		book: { bookid: number; name: string; chapters: number },
		chapterNum: number,
		books: { bookid: number; name: string; chapters: number }[]
	) {
		const secondary = this.settings.secondaryBibleVersion;
		let secondaryChapterRaw: any = null;
		try {
			secondaryChapterRaw = await this.getChapterContent(secondary, book.bookid, chapterNum);
		} catch (err: any) {
			this.logDebug(`Parallel secondary fetch failed: ${err.message || err}`);
		}

		const containerWidth = chapterContainer.clientWidth || 480;
		const isNarrow = containerWidth < 480;

		const primaryVerses = this.normalizeChapterToVerses(primaryChapter);
		const secondaryVerses = this.normalizeChapterToVerses(secondaryChapterRaw);

		if (isNarrow) {
			const tabBar = chapterContent.createDiv({ cls: "parallel-tab-bar" });
			const primaryTab = tabBar.createEl("button", {
				cls: "parallel-tab-btn active",
				text: this.settings.bibleVersion
			});
			const secondaryTab = tabBar.createEl("button", {
				cls: "parallel-tab-btn",
				text: secondary
			});

			const primaryCol = chapterContent.createDiv({ cls: "chapter-column" });
			const secondaryCol = chapterContent.createDiv({ cls: "chapter-column" });
			secondaryCol.style.display = "none";

			this.fillColumn(primaryCol, primaryVerses, book, chapterNum, true);
			this.fillColumn(secondaryCol, secondaryVerses, book, chapterNum, false);

			primaryTab.addEventListener("click", () => {
				const containerRect = chapterContainer.getBoundingClientRect();
				const secondaryVersesList = Array.from(secondaryCol.querySelectorAll(".verse"));
				let topmostVerse = "1";
				for (const el of secondaryVersesList) {
					const rect = el.getBoundingClientRect();
					if (rect.bottom > containerRect.top) {
						const v = el.getAttribute("data-verse");
						if (v) {
							topmostVerse = v;
							break;
						}
					}
				}

				primaryTab.classList.add("active");
				secondaryTab.classList.remove("active");
				primaryCol.style.display = "";
				secondaryCol.style.display = "none";

				const targetEl = primaryCol.querySelector(`[data-verse="${topmostVerse}"]`) as HTMLElement;
				if (targetEl) {
					const targetScrollTop = chapterContainer.scrollTop + (targetEl.getBoundingClientRect().top - containerRect.top);
					chapterContainer.scrollTo({ top: targetScrollTop, behavior: "auto" });
				}
			});
			secondaryTab.addEventListener("click", () => {
				const containerRect = chapterContainer.getBoundingClientRect();
				const primaryVersesList = Array.from(primaryCol.querySelectorAll(".verse"));
				let topmostVerse = "1";
				for (const el of primaryVersesList) {
					const rect = el.getBoundingClientRect();
					if (rect.bottom > containerRect.top) {
						const v = el.getAttribute("data-verse");
						if (v) {
							topmostVerse = v;
							break;
						}
					}
				}

				primaryTab.classList.remove("active");
				secondaryTab.classList.add("active");
				primaryCol.style.display = "none";
				secondaryCol.style.display = "";

				const targetEl = secondaryCol.querySelector(`[data-verse="${topmostVerse}"]`) as HTMLElement;
				if (targetEl) {
					const targetScrollTop = chapterContainer.scrollTop + (targetEl.getBoundingClientRect().top - containerRect.top);
					chapterContainer.scrollTo({ top: targetScrollTop, behavior: "auto" });
				}
			});
		} else {
			const wrapper = chapterContent.createDiv({ cls: "parallel-container-wrapper" });
			const primaryCol = wrapper.createDiv({ cls: "chapter-column primary-column" });
			const secondaryCol = wrapper.createDiv({ cls: "chapter-column secondary-column" });

			primaryCol.createDiv({ cls: "chapter-column-header", text: this.settings.bibleVersion });
			secondaryCol.createDiv({ cls: "chapter-column-header", text: secondary });

			const allVerses = new Set<string>();
			primaryVerses.forEach(v => allVerses.add(v.verse));
			secondaryVerses.forEach(v => allVerses.add(v.verse));

			const sortedVerses = Array.from(allVerses).sort((a, b) => {
				const aNum = parseInt(a);
				const bNum = parseInt(b);
				if (isNaN(aNum) || isNaN(bNum)) return a.localeCompare(b);
				return aNum - bNum;
			});

			for (const vNum of sortedVerses) {
				const primaryVerse = primaryVerses.find(v => v.verse === vNum);
				const secondaryVerse = secondaryVerses.find(v => v.verse === vNum);

				if (primaryVerse) {
					this.renderParallelVerseEl(primaryCol, primaryVerse, book, chapterNum, true);
				} else {
					primaryCol.createDiv({ cls: "verse parallel-empty-verse", attr: { "data-verse": vNum } });
				}

				if (secondaryVerse) {
					this.renderParallelVerseEl(secondaryCol, secondaryVerse, book, chapterNum, false);
				} else {
					secondaryCol.createDiv({ cls: "verse parallel-empty-verse", attr: { "data-verse": vNum } });
				}
			}

			// Align the heights of corresponding verses row-by-row
			this.alignParallelVerseHeights(wrapper);
		}
	}

	fillColumn(
		col: HTMLElement,
		verses: { verse: string; text: string }[],
		book: { bookid: number; name: string; chapters: number },
		chapterNum: number,
		isPrimary: boolean
	) {
		for (const verse of verses) {
			this.renderParallelVerseEl(col, verse, book, chapterNum, isPrimary);
		}
	}

	renderParallelVerseEl(
		parent: HTMLElement,
		verse: { verse: string; text: string },
		book: { bookid: number; name: string; chapters: number },
		chapterNum: number,
		isPrimary: boolean
	) {
		const formattedVerseNumber = convertToSuperscript(verse.verse);
		let displayHtml = verse.text.replace(/^\d+:\d+\s*/, "");
		const version = isPrimary ? this.settings.bibleVersion : this.settings.secondaryBibleVersion;
		const isEsvApi = this.settings.esvApiEnabled && this.settings.esvApiKey.trim() && version.toUpperCase() === "ESV";
		const isApiBible = this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim() && version === this.settings.apiBibleVersionId;
		const isPremium = isEsvApi || isApiBible;

		if (!isPremium && this.settings.gospelQuotesRed && ["matthew", "mark", "luke", "john"].includes(book.name.toLowerCase())) {
			displayHtml = displayHtml
				.replace(/"([^"]+)"/g, '"<span style="color: red;">$1</span>"')
				.replace(/\u201c([^\u201d]+)\u201d/g, '\u201c<span style="color: red;">$1</span>\u201d');
		}
		if (this.settings.showStrongsNumbers && (displayHtml.includes("<H") || displayHtml.includes("<S") || displayHtml.includes("<G"))) {
			displayHtml = renderStrongsHtml(displayHtml, book.bookid >= 40);
		}
		const verseEl = parent.createEl("div", {
			cls: "verse",
			attr: { 
				"data-verse": verse.verse,
				"data-primary": isPrimary ? "true" : "false"
			}
		});
		verseEl.innerHTML = `<span class="verse-num" draggable="true">${formattedVerseNumber}</span> ${displayHtml}`;
		
		if (this.settings.showStrongsNumbers) {
			verseEl.querySelectorAll(".strongs-word").forEach((el: HTMLElement) => {
				el.addEventListener("click", (e) => {
					e.stopPropagation();
					const id = el.getAttribute("data-strongs");
					if (id) this.renderStrongsPanel(id);
				});
			});
		}
	}

	renderCopyMessage(
		book: { bookid: number; name: string; chapters: number },
		chapter: number,
		accumulatedVerseText: string
	) {
		const result = compileCopyMessage(book.name, chapter, accumulatedVerseText, this.settings);
		if (!result.finalText) return;

		copyToClipboard(result.finalText);

		new Notice(
			`Copied ${book.name} ${chapter}:${result.rangeStr} to clipboard`
		);
	}

	renderSearchHelpGuide(el: HTMLElement) {
		el.empty();
		const helpContainer = el.createDiv({ cls: "bible-search-help" });
		helpContainer.createEl("h3", { text: "Advanced Search Operators", cls: "bible-search-help-title" });
		
		const list = helpContainer.createEl("ul", { cls: "bible-search-help-list" });
		
		const li1 = list.createEl("li");
		li1.innerHTML = '<strong>"phrase"</strong>: Search exact phrase (e.g. <code>"eternal life"</code>)';
		
		const li2 = list.createEl("li");
		li2.innerHTML = '<strong>-word</strong>: Exclude term (e.g. <code>light -darkness</code>)';
		
		const li3 = list.createEl("li");
		li3.innerHTML = '<strong>nt / ot</strong>: Limit to New/Old Testament (e.g. <code>nt:faith</code>)';
		
		const li4 = list.createEl("li");
		li4.innerHTML = '<strong>BOOK:word</strong>: Filter by book name/code (e.g. <code>ROM:grace</code>)';
		
		helpContainer.createEl("p", { text: "Type at least 2 characters to search scripture offline.", cls: "bible-search-help-footer" });
	}

	toggleBookQuickJump(anchorEl: HTMLElement, books: any[]) {
		const existing = document.querySelector(".bible-quick-jump-overlay");
		const isSame = existing && existing.getAttribute("data-anchor-type") === "book";
		if (existing) existing.remove();
		if (isSame) return;

		const overlay = document.createElement("div");
		overlay.className = "bible-quick-jump-overlay";
		overlay.setAttribute("data-anchor-type", "book");

		const grid = overlay.createDiv({ cls: "bible-quick-jump-grid" });

		books.forEach((b) => {
			const bookAbbr = BIBLE_BOOK_IDS[b.bookid - 1] || b.name;
			const btn = grid.createEl("button", {
				cls: "bible-quick-jump-btn",
				text: bookAbbr,
				attr: { "title": b.name }
			});
			btn.addEventListener("click", async () => {
				overlay.remove();
				const chapterContainer = this.containerEl.querySelector(".chapter-container") as HTMLElement;
				if (chapterContainer) {
					this.saveCurrentScrollPosition();
					delete this.savedScrollPositions["chapters"];
					await this.renderChapters(b, chapterContainer, books);
				}
			});
		});

		const viewContainer = this.containerEl.querySelector(".bible-wrapper") as HTMLElement;
		if (viewContainer) {
			viewContainer.appendChild(overlay);
			const rect = anchorEl.getBoundingClientRect();
			overlay.style.top = `${rect.bottom - viewContainer.getBoundingClientRect().top + 6}px`;
			overlay.style.left = "16px";
			overlay.style.right = "16px";
			overlay.style.width = "auto";
		}

		requestAnimationFrame(() => overlay.classList.add("is-open"));

		const clickAway = (e: MouseEvent) => {
			if (!overlay.contains(e.target as Node) && !anchorEl.contains(e.target as Node)) {
				overlay.classList.remove("is-open");
				setTimeout(() => overlay.remove(), 150);
				document.removeEventListener("mousedown", clickAway);
			}
		};
		document.addEventListener("mousedown", clickAway);
	}

	toggleChapterQuickJump(anchorEl: HTMLElement, book: any, books: any[]) {
		const existing = document.querySelector(".bible-quick-jump-overlay");
		const isSame = existing && existing.getAttribute("data-anchor-type") === "chapter";
		if (existing) existing.remove();
		if (isSame) return;

		const overlay = document.createElement("div");
		overlay.className = "bible-quick-jump-overlay";
		overlay.setAttribute("data-anchor-type", "chapter");

		const grid = overlay.createDiv({ cls: "bible-quick-jump-grid" });

		for (let i = 1; i <= book.chapters; i++) {
			const btn = grid.createEl("button", {
				cls: "bible-quick-jump-btn",
				text: i.toString()
			});
			btn.addEventListener("click", async () => {
				overlay.remove();
				const chapterContainer = this.containerEl.querySelector(".chapter-container") as HTMLElement;
				if (chapterContainer) {
					this.saveCurrentScrollPosition();
					chapterContainer.empty();
					chapterContainer.createDiv({ cls: "bible-loading-indicator", text: `Loading ${book.name} Chapter ${i}...` });
					try {
						const chapterContentArray = await this.getChapterContent(this.settings.bibleVersion, book.bookid, i);
						chapterContainer.empty();
						await this.processChapterContent(chapterContentArray, chapterContainer, book, i, books);
					} catch (err) {
						chapterContainer.empty();
						await this.renderChapters(book, chapterContainer, books);
					}
				}
			});
		}

		const viewContainer = this.containerEl.querySelector(".bible-wrapper") as HTMLElement;
		if (viewContainer) {
			viewContainer.appendChild(overlay);
			const rect = anchorEl.getBoundingClientRect();
			overlay.style.top = `${rect.bottom - viewContainer.getBoundingClientRect().top + 6}px`;
			overlay.style.left = "16px";
			overlay.style.right = "16px";
			overlay.style.width = "auto";
		}

		requestAnimationFrame(() => overlay.classList.add("is-open"));

		const clickAway = (e: MouseEvent) => {
			if (!overlay.contains(e.target as Node) && !anchorEl.contains(e.target as Node)) {
				overlay.classList.remove("is-open");
				setTimeout(() => overlay.remove(), 150);
				document.removeEventListener("mousedown", clickAway);
			}
		};
		document.addEventListener("mousedown", clickAway);
	}

	toggleInlineSearch(chapterContainer: HTMLElement, btn: HTMLButtonElement) {
		const existing = chapterContainer.parentElement?.querySelector(".bible-inline-search-wrapper");
		if (existing) {
			existing.remove();
			btn.classList.remove("is-active");
			
			const verses = chapterContainer.querySelectorAll(".verse, .verse-inline");
			verses.forEach((el: HTMLElement) => {
				el.style.display = "";
			});
			return;
		}

		btn.classList.add("is-active");

		const wrapper = document.createElement("div");
		wrapper.className = "bible-inline-search-wrapper";

		const input = wrapper.createEl("input", {
			cls: "bible-inline-search-input",
			attr: {
				type: "text",
				placeholder: "Filter verses in this chapter...",
				autofocus: "true"
			}
		});

		const clearBtn = wrapper.createEl("button", {
			cls: "bible-search-clear",
			attr: { "aria-label": "Clear filter", "title": "Clear filter" }
		});
		clearBtn.style.position = "relative";
		clearBtn.style.right = "auto";
		clearBtn.style.top = "auto";
		clearBtn.style.transform = "none";
		this.safeSetIcon(clearBtn, "x");

		const header = chapterContainer.parentElement?.querySelector(".bible-header-nav");
		if (header) {
			header.insertAdjacentElement("afterend", wrapper);
		}

		input.focus();

		const runFilter = () => {
			const query = input.value.toLowerCase().trim();
			const verses = chapterContainer.querySelectorAll(".verse, .verse-inline");
			verses.forEach((el: HTMLElement) => {
				const text = el.textContent || "";
				if (!query || text.toLowerCase().includes(query)) {
					el.style.display = "";
				} else {
					el.style.display = "none";
				}
			});
		};

		input.addEventListener("input", runFilter);

		clearBtn.addEventListener("click", () => {
			input.value = "";
			runFilter();
			input.focus();
		});
	}

	async refreshActiveView(
		chapterContainer: HTMLElement,
		book: { bookid: number; name: string; chapters: number },
		i: number,
		books: { bookid: number; name: string; chapters: number }[],
		originalChapter: { verse: string; text: string }[]
	) {
		this.saveCurrentScrollPosition();
		chapterContainer.empty();
		chapterContainer.createDiv({ cls: "bible-loading-indicator", text: "Updating view..." });
		try {
			const chapterContentArray = await this.getChapterContent(this.settings.bibleVersion, book.bookid, i);
			chapterContainer.empty();
			await this.processChapterContent(chapterContentArray, chapterContainer, book, i, books);
		} catch (err) {
			chapterContainer.empty();
			await this.processChapterContent(originalChapter, chapterContainer, book, i, books);
		}
	}

	alignParallelVerseHeights(container: HTMLElement) {
		const primaryCol = container.querySelector(".primary-column");
		const secondaryCol = container.querySelector(".secondary-column");
		if (!primaryCol || !secondaryCol) return;

		const primaryVerses = Array.from(primaryCol.querySelectorAll(".verse")) as HTMLElement[];
		const secondaryVerses = Array.from(secondaryCol.querySelectorAll(".verse")) as HTMLElement[];

		const pMap = new Map<string, HTMLElement>();
		primaryVerses.forEach(el => {
			const v = el.getAttribute("data-verse");
			if (v) pMap.set(v, el);
		});

		secondaryVerses.forEach(sEl => {
			const v = sEl.getAttribute("data-verse");
			if (v) {
				const pEl = pMap.get(v);
				if (pEl) {
					pEl.style.height = "auto";
					sEl.style.height = "auto";
				}
			}
		});

		secondaryVerses.forEach(sEl => {
			const v = sEl.getAttribute("data-verse");
			if (v) {
				const pEl = pMap.get(v);
				if (pEl) {
					const pHeight = pEl.offsetHeight;
					const sHeight = sEl.offsetHeight;
					const maxHeight = Math.max(pHeight, sHeight);
					if (maxHeight > 0) {
						pEl.style.height = `${maxHeight}px`;
						sEl.style.height = `${maxHeight}px`;
					}
				}
			}
		});
	}
}

function wrapInlineVerses(container: HTMLElement, isEsv: boolean) {
	const markers = Array.from(container.querySelectorAll(isEsv ? "b.verse-num, b.chapter-num, span.chapter-num" : "span.v"));
	const markerVerses = new Map<Element, number>();
	markers.forEach(span => {
		let verseNumText = isEsv ? (span.textContent?.trim() || "") : (span.getAttribute("data-number") || span.textContent || "");
		if (isEsv) {
			if (verseNumText.includes(":")) {
				verseNumText = verseNumText.split(":")[1];
			} else if (span.classList.contains("chapter-num") || (span.tagName.toLowerCase() === "span" && span.classList.contains("chapter-num"))) {
				verseNumText = "1";
			}
		}
		const vNum = parseInt(verseNumText.trim()) || 1;
		markerVerses.set(span, vNum);
	});

	let currentVerse = 0;
	let currentRun: Node[] = [];
	let currentParent: Node | null = null;

	const flushRun = () => {
		if (currentRun.length === 0 || currentVerse === 0) {
			currentRun = [];
			return;
		}
		const parent = currentParent;
		if (!parent) return;

		const wrapper = container.ownerDocument.createElement("span");
		wrapper.className = "verse-inline";
		wrapper.setAttribute("data-verse", currentVerse.toString());
		
		parent.insertBefore(wrapper, currentRun[0]);
		currentRun.forEach(node => wrapper.appendChild(node));
		currentRun = [];
	};

	const walk = (node: Node) => {
		if (node.nodeType === 1) {
			const el = node as Element;
			if (markerVerses.has(el)) {
				flushRun();
				currentVerse = markerVerses.get(el)!;

				const nextSib = el.nextSibling;
				if (nextSib && nextSib.nodeType === 3 && nextSib.textContent) {
					nextSib.textContent = nextSib.textContent.replace(/^\s*\d+:\d+\s*/, "");
				}
				
				const formattedNum = convertToSuperscript(currentVerse.toString());
				const verseNumSpan = container.ownerDocument.createElement("span");
				verseNumSpan.className = "verse-num";
				verseNumSpan.setAttribute("draggable", "true");
				verseNumSpan.textContent = formattedNum;

				el.parentNode?.insertBefore(verseNumSpan, el);
				const nbsp = container.ownerDocument.createTextNode("\u00A0");
				el.parentNode?.insertBefore(nbsp, el);
				
				currentParent = el.parentNode;
				currentRun.push(verseNumSpan, nbsp);

				el.remove();
				return;
			}

			const tagName = el.tagName.toLowerCase();
			const isBlock = ["p", "div", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol"].includes(tagName);
			
			if (isBlock) {
				flushRun();
				const children = Array.from(el.childNodes);
				children.forEach(child => walk(child));
				flushRun();
				return;
			}
		}

		if (node.parentNode) {
			if (currentParent !== node.parentNode) {
				flushRun();
				currentParent = node.parentNode;
			}
			currentRun.push(node);
		}
	};

	const topChildren = Array.from(container.childNodes);
	topChildren.forEach(child => walk(child));
	flushRun();
}

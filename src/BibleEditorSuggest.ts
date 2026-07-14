import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile, Notice } from "obsidian";
import BibleSidecarPlugin from "./main";
import { BibleViewType } from "./BibleView";
import {
	BIBLE_BOOK_MAP,
	convertToSuperscript,
	expandRange,
	compileReferenceLink,
	compileAutoExpandOutput,
	formatScripturePassage
} from "./utils";

export interface BibleEditorSuggestItem {
	book: string;
	chapter: number;
	startVerse: number;
	endVerse: number;
	displayText: string;
	suffix: "link" | "passage" | "l" | "q" | "book_autocomplete";
	shorthandLabel?: string;
}

export class BibleEditorSuggest extends EditorSuggest<BibleEditorSuggestItem> {
	plugin: BibleSidecarPlugin;
	private isSelecting = false;

	constructor(plugin: BibleSidecarPlugin) {
		super(plugin.app);
		this.plugin = plugin;

		// Intercept Tab key to trigger autocomplete selection
		this.scope.register([], "Tab", (evt: KeyboardEvent) => {
			const self = (this as any);
			if (self.suggestions && typeof self.suggestions.useSelectedSuggestion === "function") {
				self.suggestions.useSelectedSuggestion(evt);
				return false; // prevent default tab key behavior
			}
			return true;
		});
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
		this.isSelecting = false;
		if (!this.plugin.settings.autoExpandBibleReferences) return null;

		const prefix = this.plugin.settings.autoExpandTriggerPrefix || "--";
		const constEscapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		
		const line = editor.getLine(cursor.line);
		const sub = line.substring(0, cursor.ch);
		
		const regex = new RegExp(`${constEscapedPrefix}([\\w\\u00C0-\\u024F\\s\\d:-]*)$`, "i");
		const match = sub.match(regex);
		if (!match) return null;

		const query = match[1];

		if (query.endsWith(" ")) {
			return null;
		}

		return {
			start: { line: cursor.line, ch: match.index! },
			end: cursor,
			query: query,
		};
	}

	getSuggestions(context: EditorSuggestContext): BibleEditorSuggestItem[] {
		const query = context.query.trim();
		
		let activeBook = "";
		let activeChapter = 0;
		const leaves = this.plugin.app.workspace.getLeavesOfType(BibleViewType);
		if (leaves.length > 0) {
			const view = leaves[0].view as any;
			if (view && view.activeBook && view.activeChapterNumber !== null) {
				activeBook = view.activeBook.name;
				activeChapter = view.activeChapterNumber;
			}
		}

		const suggestions: BibleEditorSuggestItem[] = [];
		const bookSuggestions: BibleEditorSuggestItem[] = [];

		const isBookQuery = !/\d/.test(query) || 
		                    /^[1-3]$/.test(query) || 
		                    /^[1-3]\s*[a-zA-Z\u00C0-\u024F\s]*$/.test(query);

		if (isBookQuery) {
			const bookSearch = query.toLowerCase();
			const matchedBooks = new Set<string>();

			for (const bookKey of Object.keys(BIBLE_BOOK_MAP)) {
				if (bookKey.includes(bookSearch) || BIBLE_BOOK_MAP[bookKey].toLowerCase().includes(bookSearch)) {
					const displayName = bookKey.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
					matchedBooks.add(displayName);
				}
			}

			matchedBooks.forEach(bookName => {
				bookSuggestions.push({
					book: bookName,
					chapter: 1,
					startVerse: 1,
					endVerse: 1,
					displayText: bookName,
					suffix: "book_autocomplete"
				});
			});

			if (!activeBook || queryIsBookPrefixOnly(query)) {
				return bookSuggestions.slice(0, 10);
			}
		}

		function queryIsBookPrefixOnly(q: string): boolean {
			// If it has letters, we don't treat it as a pure number chapter lookup
			return /[a-zA-Z]/.test(q);
		}

		const parseRef = (q: string) => {
			const verseMatch = q.match(/^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):(\d+)(?:\s*-\s*(\d+))?(?:\s*\+?([a-z]+))?$/i);
			if (verseMatch) {
				return {
					book: verseMatch[1].trim(),
					chapter: parseInt(verseMatch[2]),
					startVerse: parseInt(verseMatch[3]),
					endVerse: verseMatch[4] ? parseInt(verseMatch[4]) : parseInt(verseMatch[3]),
					formatFlag: verseMatch[5]?.toLowerCase() || null
				};
			}
			const trailingColonMatch = q.match(/^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):$/i);
			if (trailingColonMatch) {
				return {
					book: trailingColonMatch[1].trim(),
					chapter: parseInt(trailingColonMatch[2]),
					startVerse: 0,
					endVerse: 0,
					formatFlag: null
				};
			}
			const trailingDashMatch = q.match(/^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+):(\d+)-$/i);
			if (trailingDashMatch) {
				return {
					book: trailingDashMatch[1].trim(),
					chapter: parseInt(trailingDashMatch[2]),
					startVerse: parseInt(trailingDashMatch[3]),
					endVerse: -1,
					formatFlag: null
				};
			}
			const chapterMatch = q.match(/^([1-3]?\s*[a-zA-Z\u00C0-\u024F\s]+?)\s*(\d+)(?:\s*\+?([a-z]+))?$/i);
			if (chapterMatch) {
				return {
					book: chapterMatch[1].trim(),
					chapter: parseInt(chapterMatch[2]),
					startVerse: 1,
					endVerse: 300,
					formatFlag: chapterMatch[3]?.toLowerCase() || null
				};
			}
			return null;
		};

		let parsed = parseRef(query);
		let shorthandLabel: string | undefined = undefined;
		
		if (!parsed) {
			if (activeBook) {
				const cvMatch = query.match(/^(\d+):(\d+)(?:\s*-\s*(\d+))?(?:\s*\+?([a-z]+))?$/);
				if (cvMatch) {
					const sv = parseInt(cvMatch[2]);
					const ev = cvMatch[3] ? parseInt(cvMatch[3]) : sv;
					parsed = {
						book: activeBook,
						chapter: parseInt(cvMatch[1]),
						startVerse: sv,
						endVerse: ev,
						formatFlag: cvMatch[4]?.toLowerCase() || null
					};
					shorthandLabel = `${parsed.chapter}:${sv === ev ? sv : sv + "-" + ev}`;
				} else {
					const cvTrailingColonMatch = query.match(/^(\d+):$/);
					if (cvTrailingColonMatch) {
						parsed = {
							book: activeBook,
							chapter: parseInt(cvTrailingColonMatch[1]),
							startVerse: 0,
							endVerse: 0,
							formatFlag: null
						};
					} else {
						const cvTrailingDashMatch = query.match(/^(\d+):(\d+)-$/);
						if (cvTrailingDashMatch) {
							parsed = {
								book: activeBook,
								chapter: parseInt(cvTrailingDashMatch[1]),
								startVerse: parseInt(cvTrailingDashMatch[2]),
								endVerse: -1,
								formatFlag: null
							};
						} else {
							const cleanQuery = query.replace(/^v/i, "");
							const vTrailingDashMatch = cleanQuery.match(/^(\d+)-$/);
							if (vTrailingDashMatch && activeChapter > 0) {
								parsed = {
									book: activeBook,
									chapter: activeChapter,
									startVerse: parseInt(vTrailingDashMatch[1]),
									endVerse: -1,
									formatFlag: null
								};
							} else {
								const vMatch = cleanQuery.match(/^(\d+)(?:\s*-\s*(\d+))?(?:\s*\+?([a-z]+))?$/);
								if (vMatch && activeChapter > 0) {
									const sv = parseInt(vMatch[1]);
									const ev = vMatch[2] ? parseInt(vMatch[2]) : sv;
									parsed = {
										book: activeBook,
										chapter: activeChapter,
										startVerse: sv,
										endVerse: ev,
										formatFlag: vMatch[3]?.toLowerCase() || null
									};
									shorthandLabel = `v${sv === ev ? sv : sv + "-" + ev}`;
								} else {
									const chMatch = query.match(/^(\d+)(?:\s*\+?([a-z]+))?$/);
									if (chMatch) {
										parsed = {
											book: activeBook,
											chapter: parseInt(chMatch[1]),
											startVerse: 1,
											endVerse: 300,
											formatFlag: chMatch[2]?.toLowerCase() || null
										};
									}
								}
							}
						}
					}
				}
			}
		}

		if (parsed) {
			let resolvedBook = parsed.book;
			for (const bookKey of Object.keys(BIBLE_BOOK_MAP)) {
				if (bookKey.toLowerCase().startsWith(parsed.book.toLowerCase())) {
					resolvedBook = bookKey.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
					break;
				}
			}
			const book = resolvedBook;
			const { chapter, startVerse, endVerse, formatFlag } = parsed;

			if (startVerse === 0) {
				// Trailing colon mode: suggest first few verses
				for (let v = 1; v <= 5; v++) {
					const label = `${book} ${chapter}:${v}`;
					let sh: string | undefined = undefined;
					if (parsed.book === activeBook) {
						sh = `${chapter}:${v}`;
					}
					suggestions.push({
						book,
						chapter,
						startVerse: v,
						endVerse: v,
						displayText: label,
						suffix: "link",
						shorthandLabel: sh
					});
				}
				return [...suggestions, ...bookSuggestions].slice(0, 15);
			}

			if (endVerse === -1) {
				// Trailing dash mode: suggest ranges starting from startVerse
				for (let v = startVerse + 1; v <= startVerse + 5; v++) {
					const label = `${book} ${chapter}:${startVerse}-${v}`;
					let sh: string | undefined = undefined;
					if (parsed.book === activeBook) {
						if (query.includes(":")) {
							sh = `${chapter}:${startVerse}-${v}`;
						} else {
							sh = `v${startVerse}-${v}`;
						}
					}
					suggestions.push({
						book,
						chapter,
						startVerse,
						endVerse: v,
						displayText: label,
						suffix: "link",
						shorthandLabel: sh
					});
				}
				return [...suggestions, ...bookSuggestions].slice(0, 15);
			}

			const isWholeChapter = startVerse === 1 && endVerse === 300;
			const rangeStr = isWholeChapter ? "" : (startVerse === endVerse ? `:${startVerse}` : `:${startVerse}-${endVerse}`);
			const label = `${book} ${chapter}${rangeStr}`;

			const formats: Array<"link" | "passage" | "l" | "q"> = ["link", "passage", "l", "q"];

			let filteredFormats = formats;
			if (formatFlag) {
				if (formatFlag === "p" || formatFlag === "passage" || formatFlag === "text") {
					filteredFormats = ["passage"];
				} else if (formatFlag === "l" || formatFlag === "list") {
					filteredFormats = ["l"];
				} else if (formatFlag === "q" || formatFlag === "quote") {
					filteredFormats = ["q"];
				} else if (formatFlag === "k" || formatFlag === "link" || formatFlag === "lnk") {
					filteredFormats = ["link"];
				} else {
					filteredFormats = formats.filter(f => f.startsWith(formatFlag));
				}
			}

			for (const fmt of filteredFormats) {
				let disp = label;
				if (fmt === "link" && shorthandLabel) {
					disp = shorthandLabel;
				}
				suggestions.push({
					book,
					chapter,
					startVerse,
					endVerse,
					displayText: disp,
					suffix: fmt,
					shorthandLabel: fmt === "link" ? shorthandLabel : undefined
				});
			}
		}

		return [...suggestions, ...bookSuggestions].slice(0, 15);
	}

	renderSuggestion(value: BibleEditorSuggestItem, el: HTMLElement): void {
		const container = el.createDiv({ cls: "bible-suggest-item" });
		const s = this.plugin.settings;
		
		let emoji = "🔗";
		let descriptor = "Link";
		if (value.suffix === "passage") {
			emoji = s.suggestIconPassage !== undefined ? s.suggestIconPassage : "📖";
			descriptor = s.suggestDescPassage !== undefined ? s.suggestDescPassage : "Passage";
		} else if (value.suffix === "l") {
			emoji = s.suggestIconList !== undefined ? s.suggestIconList : "📜";
			descriptor = s.suggestDescList !== undefined ? s.suggestDescList : "List";
		} else if (value.suffix === "q") {
			emoji = s.suggestIconQuote !== undefined ? s.suggestIconQuote : "📝";
			descriptor = s.suggestDescQuote !== undefined ? s.suggestDescQuote : "Quote";
		} else if (value.suffix === "book_autocomplete") {
			emoji = s.suggestIconBook !== undefined ? s.suggestIconBook : "📚";
			descriptor = s.suggestDescBook !== undefined ? s.suggestDescBook : "Book";
		} else if (value.suffix === "link") {
			emoji = s.suggestIconLink !== undefined ? s.suggestIconLink : "🔗";
			descriptor = s.suggestDescLink !== undefined ? s.suggestDescLink : "Link";
		}

		const showDesc = s.showSuggestDescriptor !== false && descriptor.trim() !== "";
		const labelText = showDesc ? `${emoji} ${descriptor}` : emoji;

		container.createEl("span", { cls: "bible-suggest-icon-label", text: labelText });
		container.createEl("span", { cls: "bible-suggest-ref-label", text: value.displayText });
	}

	selectSuggestion(value: BibleEditorSuggestItem, evt: MouseEvent | KeyboardEvent): void {
		if (this.isSelecting) return;
		this.isSelecting = true;

		const { editor, start, end } = this.context!;
		
		if (value.suffix === "book_autocomplete") {
			const prefix = this.plugin.settings.autoExpandTriggerPrefix || "--";
			editor.replaceRange(`${prefix}${value.book} `, start, end);
			this.isSelecting = false;
			return;
		}

		this.plugin.fetchScriptureRange(value.book, value.chapter, value.startVerse, value.endVerse).then(res => {
			if (res && res.versesList.length > 0) {
				const settings = this.plugin.settings;
				const rangeStr = (value.startVerse === 1 && value.endVerse === 300)
					? ""
					: (value.startVerse === value.endVerse ? value.startVerse.toString() : `${value.startVerse}-${value.endVerse}`);
				const vList = res.versesList.map(v => v.verse).join(",");
				
				const referenceLink = compileReferenceLink(
					value.book,
					value.chapter,
					rangeStr,
					vList,
					settings.verseReferenceInternalLinking,
					settings.verseReferenceFormat
				);

				let output = "";
				if (value.suffix === "link") {
					if (value.shorthandLabel) {
						const uri = `obsidian://bible?book=${encodeURIComponent(value.book)}&chapter=${value.chapter}&verse=${rangeStr}`;
						output = `[${value.shorthandLabel}](${uri})`;
					} else {
						output = referenceLink;
					}
				} else if (value.suffix === "passage") {
					output = formatScripturePassage(value.book, value.chapter, res.versesList, settings);
				} else {
					const isEsvApi = settings.esvApiEnabled && settings.esvApiKey.trim() && settings.bibleVersion.toUpperCase() === "ESV";
					const isApiBible = settings.apiBibleEnabled && settings.apiBibleKey.trim() && settings.bibleVersion === settings.apiBibleVersionId;
					const isPremium = isEsvApi || isApiBible;
					const compileSettings = isPremium ? { ...settings, gospelQuotesRed: false } : settings;

					output = compileAutoExpandOutput(
						res.versesList,
						value.book,
						value.chapter,
						value.suffix,
						referenceLink,
						compileSettings
					);
				}

				editor.replaceRange(output, start, end);
				const endPos = editor.offsetToPos(editor.posToOffset(start) + output.length);
				editor.setCursor(endPos);
			} else {
				new Notice(`Failed to fetch scripture for "${value.book} ${value.chapter}"`);
			}
		}).catch(err => {
			console.error(err);
			new Notice(`Error inserting scripture: ${err.message || err}`);
		});
	}
}

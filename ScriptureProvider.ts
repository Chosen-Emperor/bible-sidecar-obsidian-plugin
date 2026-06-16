import { requestUrl } from "obsidian";

export interface BookInfo {
	bookid: number;
	name: string;
	chapters: number;
}

export interface ScriptureProvider {
	fetchBooks(version: string): Promise<BookInfo[]>;
	fetchChapter(version: string, bookId: number, chapter: number): Promise<any>;
	testConnection(apiType: "esv" | "apibible", apiKey: string, apiBibleVersionId?: string): Promise<boolean>;
	fetchBibles(apiKey: string): Promise<any[]>;
	fetchStrongsDefinition(strongsId: string): Promise<any>;
}

export class ObsidianScriptureProvider implements ScriptureProvider {
	private settings: any;

	constructor(settings: any) {
		this.settings = settings;
	}

	async fetchBooks(version: string): Promise<BookInfo[]> {
		const isApiBible = this.settings.apiBibleEnabled && 
		                   this.settings.apiBibleKey.trim() && 
		                   this.settings.apiBibleVersionId;

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

		if (isApiBible) {
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
				return mappedBooks.sort((a: any, b: any) => a.bookid - b.bookid);
			} else {
				throw new Error("Failed to fetch books from API.Bible");
			}
		} else {
			try {
				const booksRes = await requestUrl({
					url: `https://bolls.life/get-books/${version}`,
					headers: { "Accept": "application/json" }
				});
				if (booksRes.status === 200) {
					return booksRes.json;
				}
				throw new Error(`Bolls.life returned status ${booksRes.status}`);
			} catch (err) {
				// Fallback to ESV list format
				const booksResFallback = await requestUrl({
					url: `https://bolls.life/get-books/ESV`,
					headers: { "Accept": "application/json" }
				});
				if (booksResFallback.status === 200) {
					return booksResFallback.json;
				}
				throw new Error("Failed to fetch book names directory from online sources.");
			}
		}
	}

	async fetchChapter(version: string, bookId: number, chapter: number): Promise<any> {
		const BIBLE_BOOK_IDS = [
			"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
			"1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
			"ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
			"OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
			"MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
			"PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
			"1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
		];
		const bookCode = BIBLE_BOOK_IDS[bookId - 1] || "GEN";

		// Try ESV API
		if (this.settings.esvApiEnabled && this.settings.esvApiKey.trim() && version.toUpperCase() === "ESV") {
			try {
				const query = `${bookCode} ${chapter}`;
				const response = await requestUrl({
					url: `https://api.esv.org/v3/passage/html/?q=${encodeURIComponent(query)}&include-verse-numbers=true&include-first-verse-numbers=true&include-headings=false&include-footnotes=false&include-audio-link=false&include-passage-references=false&include-copyright=false&include-short-copyright=false&wrapping-div=false`,
					headers: { "Authorization": `Token ${this.settings.esvApiKey.trim()}` }
				});
				if (response.status === 200 && response.json?.passages?.[0]) {
					return { isEsvApi: true, html: response.json.passages[0], isFullyCached: true };
				}
			} catch (err) {
				console.warn("ESV API fetch failed in provider, falling back:", err);
			}
		}

		// Try API.Bible
		if (this.settings.apiBibleEnabled && this.settings.apiBibleKey.trim()) {
			try {
				const response = await requestUrl({
					url: `https://api.scripture.api.bible/v1/bibles/${this.settings.apiBibleVersionId}/chapters/${bookCode}.${chapter}?include-verse-spans=true`,
					headers: { "api-key": this.settings.apiBibleKey.trim() }
				});
				if (response.status === 200 && response.json?.data?.content) {
					return { isApiBible: true, html: response.json.data.content, isFullyCached: true };
				}
			} catch (err) {
				console.warn("API.Bible fetch failed in provider, falling back:", err);
			}
		}

		// Default Bolls.life fallback
		const url = `https://bolls.life/get-chapter/${version}/${bookId}/${chapter}`;
		const response = await requestUrl(url);
		if (response.status === 200) {
			return response.json;
		}
		throw new Error(`Failed to fetch chapter from Bolls.life: status ${response.status}`);
	}

	async testConnection(apiType: "esv" | "apibible", apiKey: string, apiBibleVersionId?: string): Promise<boolean> {
		if (apiType === "esv") {
			try {
				const res = await requestUrl({
					url: "https://api.esv.org/v3/passage/html/?q=John+3:16",
					headers: { "Authorization": `Token ${apiKey.trim()}` }
				});
				return res.status === 200;
			} catch (e) {
				return false;
			}
		} else {
			try {
				const res = await requestUrl({
					url: "https://api.scripture.api.bible/v1/bibles",
					headers: { "api-key": apiKey.trim() }
				});
				return res.status === 200;
			} catch (e) {
				return false;
			}
		}
	}

	async fetchBibles(apiKey: string): Promise<any[]> {
		const res = await requestUrl({
			url: "https://api.scripture.api.bible/v1/bibles",
			headers: { "api-key": apiKey.trim() }
		});
		if (res.status === 200 && res.json?.data) {
			return res.json.data;
		}
		throw new Error(`Status code ${res.status}`);
	}

	async fetchStrongsDefinition(strongsId: string): Promise<any> {
		const query = strongsId.toUpperCase();
		const response = await requestUrl({
			url: `https://bolls.life/dictionary-definition/BDBT/${query}/`,
			headers: { "Accept": "application/json" }
		});
		if (response.status !== 200) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = response.json;
		if (Array.isArray(data) && data.length > 0) {
			const item = data[0];
			return {
				word: item.lexeme || query,
				translit: item.transliteration || "",
				definition: item.definition || item.short_definition || "",
				pos: ""
			};
		}
		throw new Error("Definition not found");
	}
}

// For unit testing environments where requestUrl is not available
export class MockScriptureProvider implements ScriptureProvider {
	private mockBooks: BookInfo[] = [];
	private mockChapters: Record<string, any> = {};

	setMockBooks(books: BookInfo[]) {
		this.mockBooks = books;
	}

	setMockChapter(version: string, bookId: number, chapter: number, data: any) {
		this.mockChapters[`${version}_${bookId}_${chapter}`] = data;
	}

	async fetchBooks(version: string): Promise<BookInfo[]> {
		return this.mockBooks;
	}

	async fetchChapter(version: string, bookId: number, chapter: number): Promise<any> {
		const key = `${version}_${bookId}_${chapter}`;
		if (this.mockChapters[key]) {
			return this.mockChapters[key];
		}
		return [];
	}

	async testConnection(apiType: "esv" | "apibible", apiKey: string, apiBibleVersionId?: string): Promise<boolean> {
		return apiKey === "valid-key";
	}

	async fetchBibles(apiKey: string): Promise<any[]> {
		if (apiKey === "valid-key") {
			return [{ id: "mock-bible-id", name: "Mock Bible (MB)" }];
		}
		throw new Error("Invalid key");
	}

	async fetchStrongsDefinition(strongsId: string): Promise<any> {
		return {
			word: "mockWord",
			translit: "mockTranslit",
			pos: "noun",
			definition: "mockDefinition"
		};
	}
}

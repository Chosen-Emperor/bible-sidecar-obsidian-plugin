import { updateLocalCacheData } from "./utils";

export interface FileAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	mkdir(path: string): Promise<void>;
	remove(path: string): Promise<void>;
	list(path: string): Promise<{ files: string[] }>;
}

export class OfflineCacheStore {
	private adapter: FileAdapter;
	private pluginDir: string;
	private memoryCache: Map<string, any> = new Map();

	constructor(adapter: FileAdapter, pluginDir: string) {
		this.adapter = adapter;
		this.pluginDir = pluginDir;
	}

	private getFilePath(version: string): string {
		return `${this.pluginDir}/translations/${version.toUpperCase()}.json`;
	}

	private getTranslationsDir(): string {
		return `${this.pluginDir}/translations`;
	}

	async isTranslationDownloaded(version: string): Promise<boolean> {
		const filePath = this.getFilePath(version);
		try {
			return await this.adapter.exists(filePath);
		} catch (e) {
			return false;
		}
	}

	async readLocalTranslation(version: string): Promise<any | null> {
		const key = version.toUpperCase();
		if (this.memoryCache.has(key)) {
			return this.memoryCache.get(key);
		}

		const filePath = this.getFilePath(version);
		try {
			const exists = await this.adapter.exists(filePath);
			if (!exists) return null;
			const content = await this.adapter.read(filePath);
			const data = JSON.parse(content);
			
			// Limit memory cache size to 2 entries to keep memory footprint low
			if (this.memoryCache.size >= 2) {
				const firstKey = this.memoryCache.keys().next().value;
				if (firstKey) this.memoryCache.delete(firstKey);
			}
			this.memoryCache.set(key, data);
			return data;
		} catch (e) {
			console.error(`Failed to read local translation ${version}:`, e);
			return null;
		}
	}

	async writeLocalTranslation(version: string, data: any): Promise<void> {
		const key = version.toUpperCase();
		const filePath = this.getFilePath(version);
		const dir = this.getTranslationsDir();
		
		const dirExists = await this.adapter.exists(dir);
		if (!dirExists) {
			await this.adapter.mkdir(dir);
		}

		await this.adapter.write(filePath, JSON.stringify(data));
		this.memoryCache.set(key, data);
	}

	async deleteTranslation(version: string): Promise<void> {
		const key = version.toUpperCase();
		const filePath = this.getFilePath(version);
		this.memoryCache.delete(key);
		
		const exists = await this.adapter.exists(filePath);
		if (exists) {
			await this.adapter.remove(filePath);
		}
	}

	async getDownloadedTranslations(): Promise<string[]> {
		const dir = this.getTranslationsDir();
		try {
			const exists = await this.adapter.exists(dir);
			if (!exists) return [];
			const list = await this.adapter.list(dir);
			return list.files
				.filter(f => f.endsWith(".json"))
				.map(f => {
					const parts = f.replace(/\\/g, "/").split("/");
					const filename = parts[parts.length - 1];
					return filename.replace(".json", "");
				});
		} catch (e) {
			console.error("Failed to list downloaded translations:", e);
			return [];
		}
	}

	async cachePassageLocally(
		version: string,
		bookid: number,
		chapter: number,
		bookName: string,
		content: any,
		apiType: string
	): Promise<void> {
		try {
			let localData = await this.readLocalTranslation(version);
			localData = updateLocalCacheData(localData, version, bookid, chapter, bookName, content, apiType);
			await this.writeLocalTranslation(version, localData);
		} catch (e) {
			console.error("Failed to auto-cache chapter locally:", e);
		}
	}

	clearCache(): void {
		this.memoryCache.clear();
	}
}

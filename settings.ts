import BibleSidecarPlugin, { DEFAULT_SETTINGS } from "main";
import { App, PluginSettingTab, Setting, requestUrl, Notice } from "obsidian";


export class BibleSidecarSettingsTab extends PluginSettingTab {
	plugin: BibleSidecarPlugin;
	containerEl: HTMLElement; // Add containerEl property
	esvStatus: "none" | "validating" | "success" | "error" = "none";
	esvError: string = "";
	apiBibleStatus: "none" | "validating" | "success" | "error" = "none";
	apiBibleError: string = "";
	premiumDetailsOpen: boolean = false;
	autoExpandDetailsOpen: boolean = false;

	constructor(app: App, plugin: BibleSidecarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	

	display() {
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
		const { containerEl } = this;
		containerEl.empty(); // Clear the container if it's not empty

		if (this.plugin.apiBiblesCache && this.plugin.apiBiblesCache.length > 0) {
			if (this.plugin.apiBiblesCache[0].id === "error") {
				this.apiBibleStatus = "error";
				this.apiBibleError = "Failed to load versions from API.Bible";
			} else if (this.apiBibleStatus === "none") {
				this.apiBibleStatus = "success";
			}
		}

		new Setting(containerEl)
			.setName("Bible language")
			.setDesc("Choose your preferred Bible language")
			.addDropdown((dropdown: any) => {
				dropdown.addOption("en", "English | English");
				dropdown.addOption("af", "Afrikaans | Afrikaans");
				dropdown.addOption("es", "Spanish | Español");
				dropdown.addOption("fr", "French | Français");
				dropdown.addOption("de", "German | Deutsch");
				dropdown.addOption("pt", "Portuguese | Português");
				dropdown.addOption("it", "Italian | Italiano");
				dropdown.addOption("nl", "Dutch | Nederlands");
				dropdown.addOption("ar", "Arabic | العربية");
				dropdown.addOption("ru", "Russian | Русский");
				dropdown.addOption("in", "Indonesian | Bahasa Indonesia");
			dropdown
				.setValue(this.plugin.settings.bibleLanguage)
				.onChange((value: any) => {
					this.plugin.settings.bibleLanguage = value;
					const languageAvailableVersions: Record<string, string[]> = {
						en: ["YLT", "KJV", "NKJV", "WEB", "RSV", "CJB", "TS2009", "LXXE", "TLV", "LSB", "NASB", "ESV", "GNV", "DRB", "NIV2011", "NIV", "NLT", "NRSVCE", "NET", "NJB1985", "SPE", "LBP", "AMP", "MSG", "LSV", "BSB"],
						de: ["MB", "ELB", "SCH", "LUT"],
						fr: ["NBS"],
						es: ["BTX3", "RV2004", "PDT", "NVI", "NTV", "LBLA"],
						pt: ["ARA", "NTJud", "NVIPT", "OL", "NVT", "KJA", "VFL", "NAA", "CNBB", "NBV07", "ALM21", "ARC09"],
						it: ["NR06", "VULG"],
						nl: ["NLD", "DSV", "SVRJ", "HSV17"],
						ru: ["JNT", "NRT", "SYNOD", "TNHR", "RBS2", "BTI"],
						ar: ["SVD"],
						in: ["TB"],
						af: ["AFR53"],
					};
					const available = languageAvailableVersions[value] || [];
					if (!available.includes(this.plugin.settings.bibleVersion)) {
						this.plugin.settings.bibleVersion =
							LANGUAGE_DEFAULT_VERSIONS[value] ||
							LANGUAGE_DEFAULT_VERSIONS["en"]; // Fallback to English if not found
					}
					// Update the dropdown for the default version
					const defaultVersionDropdown =
						containerEl.querySelector(
							"select[data-setting='default-bible-version']"
						) as HTMLSelectElement;
					if (defaultVersionDropdown) {
						defaultVersionDropdown.value =
							this.plugin.settings.bibleVersion;
					}
					this.plugin.saveSettings();
					this.display();
				});
			}
			);
		new Setting(containerEl)
			.setName("Default bible version")
			.setDesc("Choose your preferred Bible version")
			.addDropdown((dropdown: any) => {
				if(this.plugin.settings.bibleLanguage === "en"){
				// add translations
				dropdown.addOption("YLT", "Young's Literal Translation (1898)");
				dropdown.addOption(
					"KJV",
					"King James Version 1769 with Apocrypha"
				);
				dropdown.addOption("NKJV", "New King James Version, 1982");
				dropdown.addOption("WEB", "World English Bible");
				dropdown.addOption("RSV", "Revised Standard Version (1952)");
				dropdown.addOption("CJB", "The Complete Jewish Bible (1998)");
				dropdown.addOption("TS2009", "The Scriptures 2009");
				dropdown.addOption(
					"LXXE",
					"English version of the Septuagint Bible, 1851"
				);
				dropdown.addOption("TLV", "Tree of Life Version");
				dropdown.addOption("LSB", "The Legacy Standard Bible");
				dropdown.addOption(
					"NASB",
					"New American Standard Bible (1995)"
				);
				dropdown.addOption(
					"ESV",
					"English Standard Version 2001, 2016"
				);
				dropdown.addOption("GNV", "Geneva Bible (1599)");
				dropdown.addOption("DRB", "Douay Rheims Bible");
				dropdown.addOption(
					"NIV2011",
					"New International Version, 2011"
				);
				dropdown.addOption("NIV", "New International Version, 1984");
				dropdown.addOption("NLT", "New Living Translation, 2015");
				dropdown.addOption(
					"NRSVCE",
					"New Revised Standard Version Catholic Edition, 1993"
				);
				dropdown.addOption("NET", "New English Translation, 2007");
				dropdown.addOption("NJB1985", "New Jerusalem Bible, 1985");
				dropdown.addOption(
					"SPE",
					"Samaritan Pentateuch in English, 2013"
				);
				dropdown.addOption(
					"LBP",
					"Aramaic Of The Peshitta: Lamsa, 1933"
				);
				dropdown.addOption("AMP", "Amplified Bible, 2015");
				dropdown.addOption("MSG", "The Message, 2002");
				dropdown.addOption("LSV", "Literal Standard Version");
				dropdown.addOption(
					"BSB",
					"The Holy Bible, Berean Standard Bible"
				);
			}
			if(this.plugin.settings.bibleLanguage === "de"){
				dropdown.addOption("MB", "Menge Bibel");
				dropdown.addOption("ELB", "Elberfelder Bibel 1871");
				dropdown.addOption("SCH", "Schlachter 1951");
				dropdown.addOption("LUT", "Lutherbibel 1912");
			}
			if(this.plugin.settings.bibleLanguage === "fr"){
				dropdown.addOption("NBS", "Nouvelle Bible Segond 2002");
			}
			if(this.plugin.settings.bibleLanguage === "es"){
				dropdown.addOption("BTX3", "Biblia Textual 3ra Edicion");
				//dropdown.addOption("RVR1960", "Reina-Valera 1960");
				dropdown.addOption("RV2004", "Reina-Valera 2004");
				dropdown.addOption("PDT", "Palabra de Dios para Todos");
				dropdown.addOption("NVI", "Nueva Versión Internacional");
				dropdown.addOption("NTV", "Nueva Traducción Viviente 2009");
				dropdown.addOption("LBLA", "La Biblia de las Américas 1997");
			}
			if(this.plugin.settings.bibleLanguage === "pt"){
				dropdown.addOption("ARA", "Almeida Revista e Atualizada 1993");
				dropdown.addOption("NTJud", "Novo Testamento Judaico");
				dropdown.addOption("NVIPT", "Nova Versão Internacional");
				dropdown.addOption("OL", "O Livro");
				dropdown.addOption("NVT", "Nova Versão Transformadora 2016");
				dropdown.addOption("KJA", "King James Atualizada");
				dropdown.addOption("VFL", "Bíblia Sagrada Versão Fácil de Ler");
				dropdown.addOption("NAA", "Nova Almeida Atualizada 2017");
				dropdown.addOption("CNBB", "Bíblia CNBB (Nova Capa) 2002");
				dropdown.addOption("NBV07", "Nova Bíblia Viva 2007");
				dropdown.addOption("ALM21", "Bíblia Almeida Século 21");
				dropdown.addOption("ARC09", "Almeida Revista e Corrigida 2009");
				//dropdown.addOption("AFC11", "Almeida Fiel Corrigida 2011");
			}
			if(this.plugin.settings.bibleLanguage === "it"){
				dropdown.addOption("NR06", "Nuova Riveduta 2006");
				dropdown.addOption("VULG", "Biblia Sacra Vulgatam Clementinam");
			}
			if(this.plugin.settings.bibleLanguage === "nl"){
			dropdown.addOption("NLD", "De Heilige Schrift, Canisiusvertaling 1939");
			dropdown.addOption("DSV", "Statenvertaling met Stong's 1619");
			dropdown.addOption("SVRJ", "Statenvertaling Jongbloed-editie 1995");
			dropdown.addOption("HSV17", "Herziene Statenvertaling 2017");
			}
			if(this.plugin.settings.bibleLanguage === "ru"){
			dropdown.addOption("JNT", "Иудейская Новый Завет");
			dropdown.addOption("NRT", "Новый Русский Перевод");
			dropdown.addOption("SYNOD", "Синодальный перевод");
			dropdown.addOption("TNHR", "Невиим и Ктувим");
			dropdown.addOption("RBS2", "Русский Синодальный перевод 2015");
			dropdown.addOption("BTI", "Библия Тихого Океана 2015");
			}
			if(this.plugin.settings.bibleLanguage === "ar"){
			dropdown.addOption("SVD", "Smith & Van Dyke");
			}
			if(this.plugin.settings.bibleLanguage === "in"){
				dropdown.addOption("TB", "Terjemahan Baru");
				}
			if(this.plugin.settings.bibleLanguage === "af"){
				dropdown.addOption("AFR53", "Afrikaanse Bybel 1933/1953");
			}


				dropdown
					.setValue(this.plugin.settings.bibleVersion)
					.onChange((value: any) => {
						this.plugin.settings.bibleVersion = value;
						
						this.plugin.saveSettings();
					});
			});

		// Offline Translation Downloader Section
		const currentVersion = this.plugin.settings.bibleVersion;
		const downloaderSetting = new Setting(containerEl)
			.setName(`Offline Manager: ${currentVersion}`)
			.setDesc("Checking download status...");

		const isEsvApi = this.plugin.settings.esvApiEnabled && 
		                 this.plugin.settings.esvApiKey.trim() && 
		                 currentVersion.toUpperCase() === "ESV";
		const isApiBible = this.plugin.settings.apiBibleEnabled && 
		                   this.plugin.settings.apiBibleKey.trim() && 
		                   this.plugin.settings.apiBibleVersionId;
		const isPremiumApi = isEsvApi || isApiBible;

		this.plugin.isTranslationDownloaded(currentVersion).then((isDownloaded) => {
			downloaderSetting.setDesc(""); // Clear description
			if (isDownloaded) {
				downloaderSetting.setName(`Offline Manager: ${currentVersion} (${isPremiumApi ? "Cached" : "Downloaded"})`);
				downloaderSetting.setDesc(isPremiumApi 
					? "✅ Premium cached chapters are ready for offline reading and full-text search."
					: "✅ Ready for offline reading and full-text search.");
				downloaderSetting.addButton((btn) => {
					btn.setButtonText(isPremiumApi ? "Clear Premium Cache" : "Delete Download")
						.setWarning()
						.onClick(async () => {
							btn.setDisabled(true);
							await this.plugin.deleteTranslation(currentVersion);
							new Notice(isPremiumApi ? `Cleared local premium cache: ${currentVersion}` : `Deleted local translation: ${currentVersion}`);
							this.display();
						});
				});
			} else {
				if (isPremiumApi) {
					downloaderSetting.setName(`Offline Manager: ${currentVersion} (Auto-Caching)`);
					downloaderSetting.setDesc("⚡ On-Demand Premium Auto-Caching is Active. To comply with copyright guidelines and strict rate limits (60 requests/min), bulk downloading is disabled. Instead, chapters are automatically saved locally as you browse them online, so they become available offline!");
				} else {
					downloaderSetting.setName(`Offline Manager: ${currentVersion} (Online)`);
					downloaderSetting.setDesc("⚠️ Not downloaded. Click download below to enable offline access and search.");
					downloaderSetting.addButton((btn) => {
						btn.setButtonText(`Download ${currentVersion}`)
							.setCta()
							.onClick(async () => {
								btn.setDisabled(true);
								btn.setButtonText("Starting download...");
								try {
									await this.plugin.downloadTranslation(currentVersion, (progress) => {
										btn.setButtonText(`Downloading ${progress}%...`);
									});
									new Notice(`Successfully downloaded ${currentVersion} for offline use!`);
								} catch (err) {
									console.error(err);
									new Notice(`Failed to download ${currentVersion}: ${err.message || err}`);
								}
								this.display();
							});
					});
				}
			}
		});

		new Setting(containerEl)
			.setName("Copy format").setHeading()
			.setDesc("Choose how you want the Bible text to be copied")
			.addDropdown((dropdown: any) => {
				dropdown.addOption("plain", "Plain text");
				dropdown.addOption("callout", "Callout");
				dropdown
					.setValue(this.plugin.settings.copyFormat)
					.onChange((value: string) => {
						this.plugin.settings.copyFormat = value;
						this.plugin.saveSettings();
					});
			})
		new Setting(containerEl)
			.setName("Reference format").setHeading()
			.setDesc("Include the verse reference when copying (recommended)")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.copyVerseReference)
					.onChange((value) => {
						this.plugin.settings.copyVerseReference = value;
						this.plugin.saveSettings();

						verseReferencePrefixSetting.settingEl.style.display =
							value ? "block" : "none";
						verseReferenceFormatSetting.settingEl.style.display =
							value ? "block" : "none";
						verseReferenceInternalLinkingSetting.settingEl.style.display =
							value ? "block" : "none";
					});
			});

		new Setting(containerEl)
			.setName("Auto-expand Bible references")
			.setDesc(
				"Enable typed Bible reference shortcuts such as `--John 3:16 +p` or `--John 3:16 +q` to expand references automatically."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoExpandBibleReferences)
					.onChange((value) => {
						this.plugin.settings.autoExpandBibleReferences = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Color Jesus's words in red (Gospels only)")
			.setDesc("Highlights all quoted text in the Gospels (Matthew, Mark, Luke, John) in red. Works for modern translations that use quotation marks (e.g. ESV, NIV, NLT, NASB).")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.gospelQuotesRed)
					.onChange((value) => {
						this.plugin.settings.gospelQuotesRed = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Hide link icon on Bible references")
			.setDesc("Hides the default Obsidian external link arrow icon next to Bible reference links to keep notes clean.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.hideLinkIcon)
					.onChange((value) => {
						this.plugin.settings.hideLinkIcon = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Separate verses in sidecar view")
			.setDesc("When enabled, each verse in the sidecar view is rendered on its own line. When disabled, verses flow as a continuous paragraph.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.separateVersesSidecar)
					.onChange((value) => {
						this.plugin.settings.separateVersesSidecar = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Abbreviate book names in sidecar")
			.setDesc("When enabled, book cards and sidebar headers will display standard 3-letter abbreviations (e.g. GEN, EXO) instead of full names.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.abbreviateBookNames)
					.onChange((value) => {
						this.plugin.settings.abbreviateBookNames = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Enable developer logging")
			.setDesc("Creates a bible-sidecar-plus-debug.log file inside the plugin folder to help diagnose HTML parsing issues.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableLogging)
					.onChange((value) => {
						this.plugin.settings.enableLogging = value;
						this.plugin.saveSettings();
					});
			});

		const premiumDetails = containerEl.createEl("details", { 
			cls: "bible-settings-details" 
		});
		if (this.premiumDetailsOpen) {
			premiumDetails.setAttribute("open", "true");
		}
		premiumDetails.addEventListener("toggle", () => {
			this.premiumDetailsOpen = premiumDetails.open;
		});
		premiumDetails.createEl("summary", { text: "Premium API Providers (ESV API & API.Bible)", cls: "bible-settings-summary" });
		const premiumContent = premiumDetails.createDiv({ cls: "bible-settings-content" });

		// ESV API Section
		premiumContent.createEl("h4", { text: "ESV API Configuration (Crossway)", cls: "bible-settings-subheading" });
		let esvApiKeySetting: Setting;

		new Setting(premiumContent)
			.setName("Use ESV API")
			.setDesc("Enable the ESV API service to fetch the ESV translation directly from Crossway with premium stanzas and red stanzas.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.esvApiEnabled)
					.onChange((value) => {
						this.plugin.settings.esvApiEnabled = value;
						this.plugin.saveSettings();
						
						esvApiKeySetting.settingEl.style.display = value ? "flex" : "none";
					});
			});

		let esvStatusText = "";
		if (this.esvStatus === "validating") {
			esvStatusText = "⏳ Connecting and validating key...";
		} else if (this.esvStatus === "success") {
			esvStatusText = "✅ Connected successfully!";
		} else if (this.esvStatus === "error") {
			esvStatusText = `❌ Connection failed: ${this.esvError || "Invalid API key"}`;
		} else {
			esvStatusText = "Your non-commercial API key from api.esv.org";
		}

		esvApiKeySetting = new Setting(premiumContent)
			.setName("ESV API Key")
			.setDesc(esvStatusText)
			.addText((text) => {
				text
					.setPlaceholder("Enter your ESV API key")
					.setValue(this.plugin.settings.esvApiKey)
					.onChange((value) => {
						this.plugin.settings.esvApiKey = value;
						this.esvStatus = "none";
						this.plugin.saveSettings();
					});
			})
			.addButton((btn) => {
				btn.setButtonText("Connect")
					.setCta()
					.onClick(async () => {
						if (!this.plugin.settings.esvApiKey.trim()) {
							this.esvStatus = "error";
							this.esvError = "API key cannot be empty";
							this.display();
							return;
						}
						this.esvStatus = "validating";
						this.display();
						try {
							const res = await requestUrl({
								url: "https://api.esv.org/v3/passage/html/?q=John+3:16",
								headers: { "Authorization": `Token ${this.plugin.settings.esvApiKey.trim()}` }
							});
							if (res.status === 200) {
								this.esvStatus = "success";
								new Notice("ESV API Connected successfully!");
							} else {
								this.esvStatus = "error";
								this.esvError = `Status code ${res.status}`;
							}
						} catch (err) {
							this.esvStatus = "error";
							this.esvError = err.message || String(err);
						}
						this.display();
					});
			});

		// Initial visibility
		const isEsvApiEnabled = this.plugin.settings.esvApiEnabled;
		esvApiKeySetting.settingEl.style.display = isEsvApiEnabled ? "flex" : "none";

		premiumContent.createEl("hr", { cls: "bible-settings-inner-divider" });

		// API.Bible Section
		premiumContent.createEl("h4", { text: "API.Bible Configuration (Premium Formatting)", cls: "bible-settings-subheading" });
		let apiKeySetting: Setting;
		let apiVersionSetting: Setting;

		new Setting(premiumContent)
			.setName("Use API.Bible")
			.setDesc("Enable the API.Bible service to unlock premium formatting (poetry, paragraphs, etc.). Falls back to bolls.life if the key is invalid or missing.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.apiBibleEnabled)
					.onChange((value) => {
						this.plugin.settings.apiBibleEnabled = value;
						this.plugin.saveSettings();
						
						apiKeySetting.settingEl.style.display = value ? "flex" : "none";
						apiVersionSetting.settingEl.style.display = value ? "flex" : "none";
					});
			});

		let apiBibleStatusText = "";
		if (this.apiBibleStatus === "validating") {
			apiBibleStatusText = "⏳ Connecting and validating key...";
		} else if (this.apiBibleStatus === "success") {
			apiBibleStatusText = "✅ Connected successfully!";
		} else if (this.apiBibleStatus === "error") {
			apiBibleStatusText = `❌ Connection failed: ${this.apiBibleError || "Invalid API key"}`;
		} else {
			apiBibleStatusText = "Your non-commercial API key from scripture.api.bible";
		}

		apiKeySetting = new Setting(premiumContent)
			.setName("API.Bible Key")
			.setDesc(apiBibleStatusText)
			.addText((text) => {
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.apiBibleKey)
					.onChange((value) => {
						this.plugin.settings.apiBibleKey = value;
						this.plugin.apiBiblesCache = null; // Clear cache on key change
						this.apiBibleStatus = "none";
						this.plugin.saveSettings();
					});
			})
			.addButton((btn) => {
				btn.setButtonText("Connect")
					.setCta()
					.onClick(async () => {
						if (!this.plugin.settings.apiBibleKey.trim()) {
							this.apiBibleStatus = "error";
							this.apiBibleError = "API key cannot be empty";
							this.display();
							return;
						}
						this.apiBibleStatus = "validating";
						this.plugin.apiBiblesCache = null; // Clear cache to force reload
						this.display(); // Re-render to trigger fetch
						try {
							const res = await requestUrl({
								url: "https://api.scripture.api.bible/v1/bibles",
								headers: { "api-key": this.plugin.settings.apiBibleKey.trim() }
							});
							if (res.status === 200 && res.json?.data) {
								this.apiBibleStatus = "success";
								this.plugin.apiBiblesCache = res.json.data.map((b: any) => ({
									id: b.id,
									name: `${b.name} (${b.abbreviation})`
								}));
								new Notice("API.Bible Connected successfully!");
							} else {
								this.apiBibleStatus = "error";
								this.apiBibleError = `Status code ${res.status}`;
								this.plugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
							}
						} catch (err) {
							this.apiBibleStatus = "error";
							this.apiBibleError = err.message || String(err);
							this.plugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
						}
						this.display();
					});
			});

		// Trigger background fetch if enabled, has key, and cache is null
		const hasKey = this.plugin.settings.apiBibleKey.trim().length > 0;
		if (this.plugin.settings.apiBibleEnabled && hasKey && !this.plugin.apiBiblesCache) {
			this.plugin.apiBiblesCache = []; // Set to empty to avoid duplicate concurrent fetches
			this.apiBibleStatus = "validating";
			requestUrl({
				url: "https://api.scripture.api.bible/v1/bibles",
				headers: { "api-key": this.plugin.settings.apiBibleKey.trim() }
			}).then((res: any) => {
				if (res.status === 200 && res.json?.data) {
					this.apiBibleStatus = "success";
					this.plugin.apiBiblesCache = res.json.data.map((b: any) => ({
						id: b.id,
						name: `${b.name} (${b.abbreviation})`
					}));
					this.display(); // Re-render to populate dropdown!
				} else {
					this.apiBibleStatus = "error";
					this.apiBibleError = "Invalid API response";
					this.plugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
					this.display();
				}
			}).catch((err: any) => {
				console.error("Error fetching API.Bible list:", err);
				this.apiBibleStatus = "error";
				this.apiBibleError = err.message || String(err);
				this.plugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
				this.display();
			});
		}

		apiVersionSetting = new Setting(premiumContent)
			.setName("API.Bible Version")
			.setDesc("Choose your preferred Bible version");

		if (this.plugin.settings.apiBibleEnabled && hasKey) {
			if (this.plugin.apiBiblesCache && this.plugin.apiBiblesCache.length > 0) {
				const isError = this.plugin.apiBiblesCache[0].id === "error";
				if (isError) {
					apiVersionSetting.setDesc("Failed to load versions. Please check your API key.");
				} else {
					apiVersionSetting.addDropdown((dropdown) => {
						this.plugin.apiBiblesCache?.forEach((bible) => {
							dropdown.addOption(bible.id, bible.name);
						});
						dropdown
							.setValue(this.plugin.settings.apiBibleVersionId)
							.onChange((value) => {
								this.plugin.settings.apiBibleVersionId = value;
								this.plugin.saveSettings();
							});
					});
				}
			} else if (this.plugin.apiBiblesCache && this.plugin.apiBiblesCache.length === 0) {
				apiVersionSetting.setDesc("Fetching available Bible versions...");
			} else {
				apiVersionSetting.setDesc("Failed to load versions. Please check your API key.");
			}
		} else {
			apiVersionSetting.setDesc("Enter a valid API.Bible Key to choose a version.");
		}

		// Initial visibility
		const isApiEnabled = this.plugin.settings.apiBibleEnabled;
		apiKeySetting.settingEl.style.display = isApiEnabled ? "flex" : "none";
		apiVersionSetting.settingEl.style.display = isApiEnabled ? "flex" : "none";


		new Setting(containerEl)
			.setName("Auto-expand reference style (no flag)")
			.setDesc("Choose the formatting applied to reference links when expanded without a flag (e.g. --John 3:16 ).")
			.addDropdown((dropdown: any) => {
				dropdown.addOption("plain", "Plain");
				dropdown.addOption("italic", "Italic");
				dropdown.addOption("bold", "Bold");
				dropdown.addOption("boldItalic", "Bold + Italic");
				dropdown
					.setValue(this.plugin.settings.autoExpandReferenceStyle)
					.onChange((value: string) => {
						this.plugin.settings.autoExpandReferenceStyle = value;
						this.plugin.saveSettings();
					});
			});

		const verseReferencePrefixSetting = new Setting(containerEl)
			.setName("Reference prefix style")
			.setDesc("Choose the prefix used before copied verse references")
			.addDropdown((dropdown) => {
				dropdown.addOption("- ", "List (-)");
				dropdown.addOption("> ", "Callout (>)");
				dropdown.addOption("-- ", "Double Dash (--)");
				dropdown.addOption("~", "Tilde (~)");
				dropdown
					.setValue(this.plugin.settings.verseReferenceStyle)
					.onChange((value) => {
						this.plugin.settings.verseReferenceStyle = value;
						this.plugin.saveSettings();
					});
			});
		const verseReferenceFormatSetting = new Setting(containerEl)
			.setName("Verse reference format")
			.setDesc("Choose the format of the verse reference")
			.addDropdown((dropdown) => {
				dropdown.addOption("full", "Full (e.g. John 3:16)");
				dropdown.addOption("short", "Short (e.g. 1:1)");
				dropdown
					.setValue(this.plugin.settings.verseReferenceFormat)
					.onChange((value) => {
						this.plugin.settings.verseReferenceFormat = value;
						this.plugin.saveSettings();
					});
			});
		const verseReferenceInternalLinkingSetting = new Setting(containerEl)
			.setName("Enable internal linking eg. [[John]]")
			.setDesc("Use Obsidian wiki-links when copying or converting verse references")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.verseReferenceInternalLinking)
					.onChange((value) => {
						this.plugin.settings.verseReferenceInternalLinking = value;
						this.plugin.saveSettings();
					});
			});
		// Hide the "Verse Reference Format" setting initially
		if (!this.plugin.settings.copyVerseReference) {
			verseReferencePrefixSetting.settingEl.style.display = "none";
			verseReferenceFormatSetting.settingEl.style.display = "none";
			verseReferenceInternalLinkingSetting.settingEl.style.display = "none";
		}

		// --- Auto-Expand Options (+p, +l, +q) ---
		const expandDetails = containerEl.createEl("details", { 
			cls: "bible-settings-details" 
		});
		if (this.autoExpandDetailsOpen) {
			expandDetails.setAttribute("open", "true");
		}
		expandDetails.addEventListener("toggle", () => {
			this.autoExpandDetailsOpen = expandDetails.open;
		});
		expandDetails.createEl("summary", { text: "Auto-Expand Options (+p, +l, +q)", cls: "bible-settings-summary" });
		const expandContent = expandDetails.createDiv({ cls: "bible-settings-content" });

		const addModeSettings = (
			modeLabel: string, 
			refStyleKey: "autoExpandReferenceStyle_p" | "autoExpandReferenceStyle_l" | "autoExpandReferenceStyle_q",
			scriptStyleKey: "autoExpandScriptureStyle_p" | "autoExpandScriptureStyle_l" | "autoExpandScriptureStyle_q",
			toggleKey: "autoExpandCallout_p" | "autoExpandCallout_l" | "autoExpandCallout_q",
			typeKey: "autoExpandCalloutType_p" | "autoExpandCalloutType_l" | "autoExpandCalloutType_q",
			titleKey: "autoExpandCalloutTitle_p" | "autoExpandCalloutTitle_l" | "autoExpandCalloutTitle_q"
		) => {
			let typeSetting: Setting;
			let titleSetting: Setting;

			// 1. Scripture Style Dropdown
			new Setting(expandContent)
				.setName(`${modeLabel} Scripture Style`)
				.setDesc(`Choose the style applied to the scripture text in ${modeLabel} mode`)
				.addDropdown((dropdown) => {
					dropdown.addOption("plain", "Plain");
					dropdown.addOption("italic", "Italic");
					dropdown.addOption("bold", "Bold");
					dropdown.addOption("boldItalic", "Bold + Italic");
					dropdown
						.setValue(this.plugin.settings[scriptStyleKey])
						.onChange((value) => {
							this.plugin.settings[scriptStyleKey] = value;
							this.plugin.saveSettings();
						});
				});

			// 2. Reference Link Style Dropdown
			new Setting(expandContent)
				.setName(`${modeLabel} Reference Style`)
				.setDesc(`Choose the style applied to the reference link in ${modeLabel} mode`)
				.addDropdown((dropdown) => {
					dropdown.addOption("plain", "Plain");
					dropdown.addOption("italic", "Italic");
					dropdown.addOption("bold", "Bold");
					dropdown.addOption("boldItalic", "Bold + Italic");
					dropdown
						.setValue(this.plugin.settings[refStyleKey])
						.onChange((value) => {
							this.plugin.settings[refStyleKey] = value;
							this.plugin.saveSettings();
						});
				});

			// 3. Callout Toggle
			new Setting(expandContent)
				.setName(`Wrap ${modeLabel} expansions in Callout`)
				.setDesc(`Turn on to wrap ${modeLabel} scripture outputs in a colored Obsidian Callout block`)
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings[toggleKey])
						.onChange((value) => {
							this.plugin.settings[toggleKey] = value;
							this.plugin.saveSettings();
							
							typeSetting.settingEl.style.display = value ? "flex" : "none";
							titleSetting.settingEl.style.display = value ? "flex" : "none";
						});
				});

			// 4. Callout Type Dropdown
			typeSetting = new Setting(expandContent)
				.setName(`${modeLabel} Callout Color / Type`)
				.setDesc("Choose the style and color of the callout box")
				.addDropdown((dropdown) => {
					dropdown.addOption("quote", "Quote (Muted Green/Grey)");
					dropdown.addOption("note", "Note (Blue)");
					dropdown.addOption("info", "Info (Teal)");
					dropdown.addOption("todo", "Todo (Bright Blue)");
					dropdown.addOption("tip", "Tip / Hint (Green)");
					dropdown.addOption("success", "Success (Green)");
					dropdown.addOption("question", "Question / Help (Yellow/Orange)");
					dropdown.addOption("warning", "Warning (Orange)");
					dropdown.addOption("danger", "Danger / Failure (Red)");
					dropdown.addOption("bug", "Bug (Red)");
					dropdown
						.setValue(this.plugin.settings[typeKey])
						.onChange((value) => {
							this.plugin.settings[typeKey] = value;
							this.plugin.saveSettings();
						});
				});

			// 5. Callout Title Template Input
			titleSetting = new Setting(expandContent)
				.setName(`${modeLabel} Callout Title Template`)
				.setDesc("Use {{reference}} to insert the passage name dynamically (e.g. John 3:16)")
				.addText((text) => {
					text
						.setPlaceholder("e.g. Scripture: {{reference}}")
						.setValue(this.plugin.settings[titleKey])
						.onChange((value) => {
							this.plugin.settings[titleKey] = value;
							this.plugin.saveSettings();
						});
				});

			// Initial visibility
			const isEnabled = this.plugin.settings[toggleKey];
			typeSetting.settingEl.style.display = isEnabled ? "flex" : "none";
			titleSetting.settingEl.style.display = isEnabled ? "flex" : "none";
		};

		addModeSettings("+p (Inline Style)", "autoExpandReferenceStyle_p", "autoExpandScriptureStyle_p", "autoExpandCallout_p", "autoExpandCalloutType_p", "autoExpandCalloutTitle_p");
		addModeSettings("+l (Newline Style)", "autoExpandReferenceStyle_l", "autoExpandScriptureStyle_l", "autoExpandCallout_l", "autoExpandCalloutType_l", "autoExpandCalloutTitle_l");
		addModeSettings("+q (Scripture Only)", "autoExpandReferenceStyle_q", "autoExpandScriptureStyle_q", "autoExpandCallout_q", "autoExpandCalloutType_q", "autoExpandCalloutTitle_q");

		containerEl.createEl("hr", { cls: "bible-settings-divider" });

		new Setting(containerEl)
			.setName("Reset to default settings")
			.setDesc("Warning: This will clear all custom templates, API keys, and configurations, restoring the plugin to its original out-of-the-box state.")
			.addButton((btn) => {
				btn.setButtonText("Reset to Defaults")
					.setWarning()
					.onClick(async () => {
						const confirmReset = confirm("Are you sure you want to reset all settings to defaults?");
						if (confirmReset) {
							this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS) as any;
							await this.plugin.saveSettings();
							new Notice("Bible Sidecar settings have been successfully reset to defaults.");
							this.display();
						}
					});
			});
	}
}

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import BibleSidecarPlugin from "./main";
import { DEFAULT_SETTINGS } from "./main";
import {
	compileReferenceLink,
	compileAutoExpandOutput
} from "./utils";

interface FileAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	remove(path: string): Promise<void>;
}

export class BibleSidecarSettingsTab extends PluginSettingTab {
	plugin: BibleSidecarPlugin;
	activeTab: string = "reader";
	esvStatus: "none" | "validating" | "success" | "error" = "none";
	esvError: string = "";
	apiBibleStatus: "none" | "validating" | "success" | "error" = "none";
	apiBibleError: string = "";
	autoExpandDetailsOpen: boolean = false;

	constructor(app: App, plugin: BibleSidecarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		// Title
		containerEl.createEl("h2", { text: "Bible Sidecar Plus Settings" });

		// Render Tab Navigation Header
		const tabHeader = containerEl.createDiv({ cls: "bible-settings-tab-container" });

		const tabs = [
			{ id: "reader", label: "📖 Reader & Sidecar View" },
			{ id: "data", label: "🌐 Translations & APIs" },
			{ id: "copying", label: "📋 Copy & Formatting" },
			{ id: "autocomplete", label: "🧠 Autocomplete (IntelliSense)" }
		];

		if (!tabs.some(t => t.id === this.activeTab)) {
			this.activeTab = "reader";
		}

		tabs.forEach(t => {
			const btn = tabHeader.createEl("button", {
				cls: this.activeTab === t.id ? "bible-settings-tab-btn active" : "bible-settings-tab-btn",
				text: t.label
			});
			btn.addEventListener("click", () => {
				this.activeTab = t.id;
				this.display();
			});
		});

		// Render Active Tab content
		if (this.activeTab === "reader") {
			this.renderReaderSidecarTab(containerEl);
		} else if (this.activeTab === "data") {
			this.renderTranslationsApiTab(containerEl);
		} else if (this.activeTab === "copying") {
			this.renderCopyTab(containerEl);
		} else if (this.activeTab === "autocomplete") {
			this.renderAutocompleteTab(containerEl);
		}
	}

	renderReaderSidecarTab(container: HTMLElement) {
		container.createEl("h3", { text: "Language & Version Preferences", cls: "bible-settings-subheading" });

		const LANGUAGE_DEFAULT_VERSIONS: Record<string, string> = {
			en: "ESV", de: "ELB", fr: "NBS", es: "BTX3", pt: "ARA",
			it: "NR06", nl: "NLD", ru: "SYNOD", ar: "SVD", in: "TB", af: "AFR53"
		};

		new Setting(container)
			.setName("Bible language")
			.setDesc("Choose your preferred Bible language")
			.addDropdown((dropdown) => {
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
					.onChange((value) => {
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
							af: ["AFR53"]
						};
						const available = languageAvailableVersions[value] || [];
						if (!available.includes(this.plugin.settings.bibleVersion)) {
							this.plugin.settings.bibleVersion =
								LANGUAGE_DEFAULT_VERSIONS[value] || LANGUAGE_DEFAULT_VERSIONS["en"];
						}
						
						// Auto update secondary bible version too
						if (this.plugin.settings.secondaryBibleVersion) {
							if (!available.includes(this.plugin.settings.secondaryBibleVersion)) {
								this.plugin.settings.secondaryBibleVersion = available[0] || "KJV";
							}
						}

						this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(container)
			.setName("Default bible version")
			.setDesc("Choose your preferred Bible version")
			.addDropdown((dropdown) => {
				const currentLang = this.plugin.settings.bibleLanguage;
				if (currentLang === "en") {
					dropdown.addOption("YLT", "Young's Literal Translation (1898)");
					dropdown.addOption("KJV", "King James Version 1769 with Apocrypha");
					dropdown.addOption("NKJV", "New King James Version, 1982");
					dropdown.addOption("WEB", "World English Bible");
					dropdown.addOption("RSV", "Revised Standard Version (1952)");
					dropdown.addOption("CJB", "The Complete Jewish Bible (1998)");
					dropdown.addOption("TS2009", "The Scriptures 2009");
					dropdown.addOption("LXXE", "English version of the Septuagint Bible, 1851");
					dropdown.addOption("TLV", "Tree of Life Version");
					dropdown.addOption("LSB", "The Legacy Standard Bible");
					dropdown.addOption("NASB", "New American Standard Bible (1995)");
					dropdown.addOption("ESV", "English Standard Version 2001, 2016");
					dropdown.addOption("GNV", "Geneva Bible (1599)");
					dropdown.addOption("DRB", "Douay Rheims Bible");
					dropdown.addOption("NIV2011", "New International Version, 2011");
					dropdown.addOption("NIV", "New International Version, 1984");
					dropdown.addOption("NLT", "New Living Translation, 2015");
					dropdown.addOption("NRSVCE", "New Revised Standard Version Catholic Edition, 1993");
					dropdown.addOption("NET", "New English Translation, 2007");
					dropdown.addOption("NJB1985", "New Jerusalem Bible, 1985");
					dropdown.addOption("SPE", "Samaritan Pentateuch in English, 2013");
					dropdown.addOption("LBP", "Aramaic Of The Peshitta: Lamsa, 1933");
					dropdown.addOption("AMP", "Amplified Bible, 2015");
					dropdown.addOption("MSG", "The Message, 2002");
					dropdown.addOption("LSV", "Literal Standard Version");
					dropdown.addOption("BSB", "The Holy Bible, Berean Standard Bible");
				} else if (currentLang === "de") {
					dropdown.addOption("MB", "Menge Bibel");
					dropdown.addOption("ELB", "Elberfelder Bibel 1871");
					dropdown.addOption("SCH", "Schlachter 1951");
					dropdown.addOption("LUT", "Lutherbibel 1912");
				} else if (currentLang === "fr") {
					dropdown.addOption("NBS", "Nouvelle Bible Segond 2002");
				} else if (currentLang === "es") {
					dropdown.addOption("BTX3", "Biblia Textual 3ra Edicion");
					dropdown.addOption("RV2004", "Reina-Valera 2004");
					dropdown.addOption("PDT", "Palabra de Dios para Todos");
					dropdown.addOption("NVI", "Nueva Versión Internacional");
					dropdown.addOption("NTV", "Nueva Traducción Viviente 2009");
					dropdown.addOption("LBLA", "La Biblia de las Américas 1997");
				} else if (currentLang === "pt") {
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
				} else if (currentLang === "it") {
					dropdown.addOption("NR06", "Nuova Riveduta 2006");
					dropdown.addOption("VULG", "Biblia Sacra Vulgatam Clementinam");
				} else if (currentLang === "nl") {
					dropdown.addOption("NLD", "De Heilige Schrift, Canisiusvertaling 1939");
					dropdown.addOption("DSV", "Statenvertaling met Stong's 1619");
					dropdown.addOption("SVRJ", "Statenvertaling Jongbloed-editie 1995");
					dropdown.addOption("HSV17", "Herziene Statenvertaling 2017");
				} else if (currentLang === "ru") {
					dropdown.addOption("JNT", "Иудейская Новый Завет");
					dropdown.addOption("NRT", "Новый Русский Перевод");
					dropdown.addOption("SYNOD", "Синодальный перевод");
					dropdown.addOption("TNHR", "Невиим и Ктувим");
					dropdown.addOption("RBS2", "Русский Синодальный перевод 2015");
					dropdown.addOption("BTI", "Библия Тихого Океана 2015");
				} else if (currentLang === "ar") {
					dropdown.addOption("SVD", "Smith & Van Dyke");
				} else if (currentLang === "in") {
					dropdown.addOption("TB", "Terjemahan Baru");
				} else if (currentLang === "af") {
					dropdown.addOption("AFR53", "Afrikaanse Bybel 1933/1953");
				}

				dropdown
					.setValue(this.plugin.settings.bibleVersion)
					.onChange((value) => {
						this.plugin.settings.bibleVersion = value;
						this.plugin.saveSettings();
						this.display(); // refresh default downloader label
					});
			});

		let secondaryVersionSetting: Setting;

		new Setting(container)
			.setName("Parallel translation view")
			.setDesc("Show a second Bible translation alongside the primary one. When the panel is narrow (< 480px), tabs replace the side-by-side layout.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.parallelEnabled)
					.onChange((value) => {
						this.plugin.settings.parallelEnabled = value;
						this.plugin.saveSettings();
						secondaryVersionSetting.settingEl.style.display = value ? "flex" : "none";
					});
			});

		secondaryVersionSetting = new Setting(container)
			.setName("Secondary Bible version")
			.setDesc("Choose secondary Bible translation displayed in parallel view (Bolls.life only).")
			.addDropdown((dropdown) => {
				const currentLang = this.plugin.settings.bibleLanguage;
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
					af: ["AFR53"]
				};
				const list = languageAvailableVersions[currentLang] || ["KJV"];
				list.forEach((v) => {
					dropdown.addOption(v, v);
				});
				dropdown
					.setValue(this.plugin.settings.secondaryBibleVersion || "KJV")
					.onChange((value) => {
						this.plugin.settings.secondaryBibleVersion = value;
						this.plugin.saveSettings();
					});
			});

		secondaryVersionSetting.settingEl.style.display =
			this.plugin.settings.parallelEnabled ? "flex" : "none";

		container.createEl("hr", { cls: "bible-settings-inner-divider" });
		container.createEl("h3", { text: "Sidecar View Display Options", cls: "bible-settings-subheading" });

		new Setting(container)
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

		new Setting(container)
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

		new Setting(container)
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

		new Setting(container)
			.setName("Offline download indicator accents")
			.setDesc("Highlight cached books and chapters with visual accents (progress bars and glowing borders)")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableOfflineAccents)
					.onChange(async (value) => {
						this.plugin.settings.enableOfflineAccents = value;
						await this.plugin.saveSettings();
						this.updateActiveViews();
					});
			});

		new Setting(container)
			.setName("Show translation version indicator")
			.setDesc("Display the active Bible translation version (e.g. ESV) in the Sidecar view headers and callout expansions.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showVersionIndicator)
					.onChange(async (value) => {
						this.plugin.settings.showVersionIndicator = value;
						await this.plugin.saveSettings();
						this.updateActiveViews();
					});
			});

		container.createEl("hr", { cls: "bible-settings-inner-divider" });
		container.createEl("h3", { text: "Study Tools & Concordance", cls: "bible-settings-subheading" });

		new Setting(container)
			.setName("Show cross-references")
			.setDesc("Display superscript letter markers next to words in ESV and API.Bible chapters. Hover (desktop) or tap (mobile) to see related passages.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showCrossReferences)
					.onChange((value) => {
						this.plugin.settings.showCrossReferences = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(container)
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

		const isKjvCompatible = ["KJV", "YLT", "NKJV"].includes(
			(this.plugin.settings.bibleVersion || "").toUpperCase()
		);

		const strongsSetting = new Setting(container)
			.setName("Show Strong's concordance numbers");

		const descFrag = document.createDocumentFragment();
		if (isKjvCompatible) {
			descFrag.appendChild(document.createTextNode("Underline words with Strong's IDs in KJV and other Bolls.life translations. Click any underlined word to look up its Hebrew or Greek definition."));
		} else {
			const warnText = descFrag.appendChild(document.createElement("strong"));
			warnText.style.color = "var(--text-warning)";
			warnText.setText("⚠️ Strong's numbers are only available for KJV and compatible Bolls.life translations. Switch your primary version to KJV to enable this feature.");
		}
		strongsSetting.setDesc(descFrag);

		strongsSetting.addToggle((toggle) => {
			toggle
				.setValue(this.plugin.settings.showStrongsNumbers && isKjvCompatible)
				.setDisabled(!isKjvCompatible)
				.onChange((value) => {
					if (!isKjvCompatible) return;
					this.plugin.settings.showStrongsNumbers = value;
					this.plugin.saveSettings();
				});
		});

		if (!isKjvCompatible) {
			strongsSetting.settingEl.style.opacity = "0.55";
		}

		container.createEl("hr", { cls: "bible-settings-inner-divider" });
		container.createEl("h3", { text: "Developer & Diagnostics", cls: "bible-settings-subheading" });

		new Setting(container)
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

		new Setting(container)
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

	renderTranslationsApiTab(container: HTMLElement) {
		container.createEl("h3", { text: "Offline Database Manager", cls: "bible-settings-subheading" });

		const currentVersion = this.plugin.settings.bibleVersion;
		const downloaderSetting = new Setting(container)
			.setName(`Offline Manager: ${currentVersion}`)
			.setDesc("Checking download status...");

		const isEsvApi = this.plugin.settings.esvApiEnabled && 
		                 this.plugin.settings.esvApiKey.trim() && 
		                 currentVersion.toUpperCase() === "ESV";
		const isApiBible = this.plugin.settings.apiBibleEnabled && 
		                   this.plugin.settings.apiBibleKey.trim() && 
		                   this.plugin.settings.apiBibleVersionId;
		const isPremiumApi = isEsvApi || isApiBible;

		const progressContainer = container.createDiv({ cls: "bible-settings-progress-container" });
		progressContainer.style.display = "none";

		const progressBar = progressContainer.createEl("progress", {
			cls: "bible-settings-progress-bar",
			attr: { value: "0", max: "100" }
		});
		const progressText = progressContainer.createDiv({ cls: "bible-settings-progress-text" });

		this.plugin.isTranslationDownloaded(currentVersion).then((isDownloaded) => {
			downloaderSetting.setDesc(""); // Clear description
			if (isDownloaded) {
				downloaderSetting.setName(`Offline Manager: ${currentVersion} (${isPremiumApi ? "Cached" : "Downloaded"})`);
				
				const descFrag = document.createDocumentFragment();
				descFrag.appendChild(document.createTextNode(isPremiumApi 
					? "✅ Premium cached chapters are ready for offline reading and full-text search."
					: "✅ Ready for offline reading and full-text search."));
				downloaderSetting.setDesc(descFrag);

				downloaderSetting.addButton((btn) => {
					btn.setButtonText(isPremiumApi ? "Clear Premium Cache" : "Delete Download")
						.setWarning()
						.setTooltip("Click to clean up local files for this version")
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
					const descFrag = document.createDocumentFragment();
					descFrag.appendChild(document.createTextNode("⚡ On-Demand Premium Auto-Caching is Active. To comply with copyright guidelines and strict rate limits (60 requests/min), bulk downloading is disabled. Instead, chapters are automatically saved locally as you browse them online, so they become available offline!"));
					downloaderSetting.setDesc(descFrag);
				} else {
					downloaderSetting.setName(`Offline Manager: ${currentVersion} (Online)`);
					const descFrag = document.createDocumentFragment();
					const warnSpan = descFrag.appendChild(document.createElement("span"));
					warnSpan.style.color = "var(--text-warning)";
					warnSpan.setText("⚠️ Not downloaded. Click download below to enable offline access and search.");
					downloaderSetting.setDesc(descFrag);

					downloaderSetting.addButton((btn) => {
						btn.setButtonText(`Download ${currentVersion}`)
							.setCta()
							.setTooltip("Download full text to enable offline searches and faster reads")
							.onClick(async () => {
								btn.setDisabled(true);
								progressContainer.style.display = "flex";
								progressText.setText("Starting download...");
								try {
									await this.plugin.downloadTranslation(currentVersion, (progress) => {
										progressBar.value = progress;
										progressText.setText(`Downloading ${progress}%...`);
									});
									new Notice(`Successfully downloaded ${currentVersion} for offline use!`);
								} catch (err: any) {
									console.error(err);
									new Notice(`Failed to download ${currentVersion}: ${err.message || err}`);
								}
								this.display();
							});
					});
				}
			}
		});

		// List all downloaded translations
		this.plugin.cacheStore.getDownloadedTranslations().then((list) => {
			if (list && list.length > 0) {
				container.createEl("h4", { text: "Downloaded Translations:", cls: "bible-settings-subheading" });
				const downloadedList = container.createEl("ul");
				list.forEach((t) => {
					const li = downloadedList.createEl("li");
					li.setText(t);
				});
			}
		});

		container.createEl("hr", { cls: "bible-settings-inner-divider" });
		container.createEl("h3", { text: "Online APIs Configuration (Premium Formatting)", cls: "bible-settings-subheading" });

		container.createEl("h4", { text: "ESV API Configuration (Crossway)", cls: "bible-settings-subheading" });
		let esvApiKeySetting: Setting;

		new Setting(container)
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

		const esvDescFrag = document.createDocumentFragment();
		esvDescFrag.appendChild(document.createTextNode("Your non-commercial API key from "));
		const esvLink = esvDescFrag.appendChild(document.createElement("a"));
		esvLink.href = "https://api.esv.org/";
		esvLink.setText("api.esv.org");
		esvLink.target = "_blank";

		esvApiKeySetting = new Setting(container)
			.setName("ESV API Key")
			.setDesc(esvDescFrag)
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
				btn.setButtonText("Test Connection")
					.setCta()
					.setTooltip("Verify key credentials with Crossway server")
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
							const success = await this.plugin.scriptureProvider.testConnection(
								"esv",
								this.plugin.settings.esvApiKey
							);
							if (success) {
								this.esvStatus = "success";
								new Notice("ESV API Connected successfully!");
							} else {
								this.esvStatus = "error";
								this.esvError = "Invalid API key or network error";
							}
						} catch (err: any) {
							this.esvStatus = "error";
							this.esvError = err.message || String(err);
						}
						this.display();
					});
			});

		if (this.esvStatus !== "none") {
			const badge = document.createElement("span");
			badge.className = `bible-settings-badge ${this.esvStatus}`;
			badge.setText(this.esvStatus === "validating" ? "Validating" : this.esvStatus === "success" ? "Connected" : "Error");
			esvApiKeySetting.nameEl.appendChild(document.createTextNode(" "));
			esvApiKeySetting.nameEl.appendChild(badge);

			if (this.esvStatus === "error" && this.esvError) {
				const errorEl = container.createDiv({ cls: "strongs-error", text: `Error: ${this.esvError}` });
				errorEl.style.marginTop = "4px";
			}
		}

		esvApiKeySetting.settingEl.style.display = this.plugin.settings.esvApiEnabled ? "flex" : "none";

		container.createEl("hr", { cls: "bible-settings-inner-divider" });

		container.createEl("h4", { text: "API.Bible Configuration (Premium Formatting)", cls: "bible-settings-subheading" });
		let apiKeySetting: Setting;
		let apiVersionSetting: Setting;

		new Setting(container)
			.setName("Use API.Bible")
			.setDesc("Enable the API.Bible service to unlock premium formatting (poetry, paragraphs, etc.). Falls back to bolls.life if the key is invalid or missing.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.apiBibleEnabled)
					.onChange((value) => {
						this.plugin.settings.apiBibleEnabled = value;
						this.plugin.saveSettings();
						
						const show = value ? "flex" : "none";
						apiKeySetting.settingEl.style.display = show;
						apiVersionSetting.settingEl.style.display = show;
					});
			});

		const apiBibleDescFrag = document.createDocumentFragment();
		apiBibleDescFrag.appendChild(document.createTextNode("Your non-commercial API key from "));
		const apiBibleLink = apiBibleDescFrag.appendChild(document.createElement("a"));
		apiBibleLink.href = "https://scripture.api.bible/";
		apiBibleLink.setText("scripture.api.bible");
		apiBibleLink.target = "_blank";

		apiKeySetting = new Setting(container)
			.setName("API.Bible Key")
			.setDesc(apiBibleDescFrag)
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
				btn.setButtonText("Test Connection")
					.setCta()
					.setTooltip("Verify key credentials and fetch translations list")
					.onClick(async () => {
						if (!this.plugin.settings.apiBibleKey.trim()) {
							this.apiBibleStatus = "error";
							this.apiBibleError = "API key cannot be empty";
							this.display();
							return;
						}
						this.apiBibleStatus = "validating";
						this.plugin.apiBiblesCache = null;
						this.display();
						try {
							const data = await this.plugin.scriptureProvider.fetchBibles(
								this.plugin.settings.apiBibleKey
							);
							this.apiBibleStatus = "success";
							this.plugin.apiBiblesCache = data.map((b: any) => ({
								id: b.id,
								name: `${b.name} (${b.abbreviation})`
							}));
							new Notice("API.Bible Connected successfully!");
						} catch (err: any) {
							this.apiBibleStatus = "error";
							this.apiBibleError = err.message || String(err);
							this.plugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
						}
						this.display();
					});
			});

		if (this.apiBibleStatus !== "none") {
			const badge = document.createElement("span");
			badge.className = `bible-settings-badge ${this.apiBibleStatus}`;
			badge.setText(this.apiBibleStatus === "validating" ? "Validating" : this.apiBibleStatus === "success" ? "Connected" : "Error");
			apiKeySetting.nameEl.appendChild(document.createTextNode(" "));
			apiKeySetting.nameEl.appendChild(badge);

			if (this.apiBibleStatus === "error" && this.apiBibleError) {
				const errorEl = container.createDiv({ cls: "strongs-error", text: `Error: ${this.apiBibleError}` });
				errorEl.style.marginTop = "4px";
			}
		}

		const hasKey = this.plugin.settings.apiBibleKey.trim().length > 0;
		if (this.plugin.settings.apiBibleEnabled && hasKey && !this.plugin.apiBiblesCache) {
			this.plugin.apiBiblesCache = []; 
			this.apiBibleStatus = "validating";
			this.plugin.scriptureProvider.fetchBibles(this.plugin.settings.apiBibleKey.trim())
				.then((data: any) => {
					this.apiBibleStatus = "success";
					this.plugin.apiBiblesCache = data.map((b: any) => ({
						id: b.id,
						name: `${b.name} (${b.abbreviation})`
					}));
					this.display();
				})
				.catch((err: any) => {
					console.error("Error fetching API.Bible list:", err);
					this.apiBibleStatus = "error";
					this.apiBibleError = err.message || String(err);
					this.plugin.apiBiblesCache = [{ id: "error", name: "Error loading translations" }];
					this.display();
				});
		}

		apiVersionSetting = new Setting(container)
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

		const isApiEnabled = this.plugin.settings.apiBibleEnabled;
		apiKeySetting.settingEl.style.display = isApiEnabled ? "flex" : "none";
		apiVersionSetting.settingEl.style.display = isApiEnabled ? "flex" : "none";
	}

	renderCopyTab(container: HTMLElement) {
		new Setting(container)
			.setName("Copy format")
			.setDesc("Choose how you want the Bible text to be copied")
			.addDropdown((dropdown) => {
				dropdown.addOption("plain", "Plain text");
				dropdown.addOption("callout", "Callout");
				dropdown
					.setValue(this.plugin.settings.copyFormat)
					.onChange((value: string) => {
						this.plugin.settings.copyFormat = value;
						this.plugin.saveSettings();
					});
			});

		let verseReferencePrefixSetting: Setting;
		let verseReferenceFormatSetting: Setting;
		let verseReferenceInternalLinkingSetting: Setting;

		new Setting(container)
			.setName("Reference format")
			.setDesc("Include the verse reference when copying (recommended)")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.copyVerseReference)
					.onChange((value) => {
						this.plugin.settings.copyVerseReference = value;
						this.plugin.saveSettings();

						const show = value ? "flex" : "none";
						verseReferencePrefixSetting.settingEl.style.display = show;
						verseReferenceFormatSetting.settingEl.style.display = show;
						verseReferenceInternalLinkingSetting.settingEl.style.display = show;
					});
			});

		verseReferencePrefixSetting = new Setting(container)
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

		verseReferenceFormatSetting = new Setting(container)
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

		verseReferenceInternalLinkingSetting = new Setting(container)
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

		const initialShow = this.plugin.settings.copyVerseReference ? "flex" : "none";
		verseReferencePrefixSetting.settingEl.style.display = initialShow;
		verseReferenceFormatSetting.settingEl.style.display = initialShow;
		verseReferenceInternalLinkingSetting.settingEl.style.display = initialShow;
	}

	renderAutocompleteTab(container: HTMLElement) {
		container.createEl("h3", { text: "Autocomplete Settings", cls: "bible-settings-subheading" });

		const prefix = this.plugin.settings.autoExpandTriggerPrefix || "--";

		new Setting(container)
			.setName("Auto-expand Bible references")
			.setDesc(`Enable typed Bible reference shortcuts such as \`${prefix}John 3:16\` to trigger autocomplete search and format options.`)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoExpandBibleReferences)
					.onChange((value) => {
						this.plugin.settings.autoExpandBibleReferences = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName("Auto-expand trigger prefix")
			.setDesc("Choose the character prefix that triggers auto-expansion. Options like '..' or '//' bypass iPad/iOS Smart Punctuation issues.")
			.addDropdown((dropdown) => {
				dropdown.addOption("--", "-- (Default)");
				dropdown.addOption("..", ".. (iPad/iOS Recommended)");
				dropdown.addOption("//", "// (iPad/iOS Alternative)");
				dropdown.addOption(";;", ";;");
				dropdown.addOption(",,", ",,");
				dropdown.addOption("@@", "@@");
				dropdown
					.setValue(this.plugin.settings.autoExpandTriggerPrefix || "--")
					.onChange(async (value) => {
						this.plugin.settings.autoExpandTriggerPrefix = value;
						await this.plugin.saveSettings();
						this.display(); // reload preview card & texts
					});
			});

		new Setting(container)
			.setName("Auto-expand reference style (no flag)")
			.setDesc(`Choose the formatting applied to reference links when expanded without a flag (e.g. \`${prefix}John 3:16 \`).`)
			.addDropdown((dropdown) => {
				dropdown.addOption("plain", "Plain");
				dropdown.addOption("italic", "Italic");
				dropdown.addOption("bold", "Bold");
				dropdown.addOption("boldItalic", "Bold + Italic");
				dropdown
					.setValue(this.plugin.settings.autoExpandReferenceStyle)
					.onChange((value: string) => {
						this.plugin.settings.autoExpandReferenceStyle = value;
						this.plugin.saveSettings();
						this.display(); // reload preview card!
					});
			});

		container.createEl("hr", { cls: "bible-settings-inner-divider" });
		container.createEl("h3", { text: "IntelliSense UI Customization", cls: "bible-settings-subheading" });

		new Setting(container)
			.setName("Show Word Descriptor")
			.setDesc("When enabled, the 1-word style descriptor (e.g. 'Link', 'Passage') is displayed next to the icon in the suggestions list.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showSuggestDescriptor !== false)
					.onChange(async (value) => {
						this.plugin.settings.showSuggestDescriptor = value;
						await this.plugin.saveSettings();
					});
			});

		const types = [
			{ id: "Link", label: "Link style (default style)", keyIcon: "suggestIconLink", keyDesc: "suggestDescLink" },
			{ id: "Passage", label: "Passage style (+p)", keyIcon: "suggestIconPassage", keyDesc: "suggestDescPassage" },
			{ id: "List", label: "List style (+l)", keyIcon: "suggestIconList", keyDesc: "suggestDescList" },
			{ id: "Quote", label: "Quote style (+q)", keyIcon: "suggestIconQuote", keyDesc: "suggestDescQuote" },
			{ id: "Book", label: "Book suggestion", keyIcon: "suggestIconBook", keyDesc: "suggestDescBook" }
		];

		types.forEach(t => {
			const sEl = new Setting(container)
				.setName(`${t.id} Suggestion Item`)
				.setDesc(`Configure icon and text descriptor label for the ${t.label} option`);

			sEl.addText(text => {
				text.setPlaceholder("Icon Emoji")
					.setValue((this.plugin.settings as any)[t.keyIcon] || "")
					.onChange(async (val) => {
						(this.plugin.settings as any)[t.keyIcon] = val.trim();
						await this.plugin.saveSettings();
					});
			});

			sEl.addText(text => {
				text.setPlaceholder("1-word Descriptor")
					.setValue((this.plugin.settings as any)[t.keyDesc] || "")
					.onChange(async (val) => {
						(this.plugin.settings as any)[t.keyDesc] = val.trim();
						await this.plugin.saveSettings();
					});
			});
		});

		container.createEl("hr", { cls: "bible-settings-inner-divider" });
		container.createEl("h3", { text: "Expansion Formatting Templates", cls: "bible-settings-subheading" });

		const flagsDetails = container.createEl("details", { 
			cls: "bible-settings-details" 
		});
		if (this.autoExpandDetailsOpen) {
			flagsDetails.setAttribute("open", "true");
		}
		flagsDetails.addEventListener("toggle", () => {
			this.autoExpandDetailsOpen = flagsDetails.open;
		});
		flagsDetails.createEl("summary", { text: "Custom Suffix Flags (+p, +l, +q)", cls: "bible-settings-summary" });
		const flagsContent = flagsDetails.createDiv({ cls: "bible-settings-content" });

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

			new Setting(flagsContent)
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
							this.display(); // reload preview card
						});
				});

			new Setting(flagsContent)
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
							this.display(); // reload preview card
						});
				});

			new Setting(flagsContent)
				.setName(`Wrap ${modeLabel} expansions in Callout`)
				.setDesc(`Turn on to wrap ${modeLabel} scripture outputs in a colored Obsidian Callout block`)
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings[toggleKey])
						.onChange((value) => {
							this.plugin.settings[toggleKey] = value;
							this.plugin.saveSettings();
							
							const show = value ? "flex" : "none";
							typeSetting.settingEl.style.display = show;
							titleSetting.settingEl.style.display = show;
							this.display(); // reload preview card
						});
				});

			typeSetting = new Setting(flagsContent)
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
							this.display(); // reload preview card
						});
				});

			titleSetting = new Setting(flagsContent)
				.setName(`${modeLabel} Callout Title Template`)
				.setDesc("Use {{reference}} to insert the passage name dynamically (e.g. John 3:16)")
				.addText((text) => {
					text
						.setPlaceholder("e.g. Scripture: {{reference}}")
						.setValue(this.plugin.settings[titleKey])
						.onChange((value) => {
							this.plugin.settings[titleKey] = value;
							this.plugin.saveSettings();
							this.display(); // reload preview card
						});
				});

			const isEnabled = this.plugin.settings[toggleKey];
			typeSetting.settingEl.style.display = isEnabled ? "flex" : "none";
			titleSetting.settingEl.style.display = isEnabled ? "flex" : "none";
		};

		addModeSettings("+p (Inline Style)", "autoExpandReferenceStyle_p", "autoExpandScriptureStyle_p", "autoExpandCallout_p", "autoExpandCalloutType_p", "autoExpandCalloutTitle_p");
		addModeSettings("+l (Newline Style)", "autoExpandReferenceStyle_l", "autoExpandScriptureStyle_l", "autoExpandCallout_l", "autoExpandCalloutType_l", "autoExpandCalloutTitle_l");
		addModeSettings("+q (Scripture Only)", "autoExpandReferenceStyle_q", "autoExpandScriptureStyle_q", "autoExpandCallout_q", "autoExpandCalloutType_q", "autoExpandCalloutTitle_q");

		// Live Formatting Preview Card
		this.renderAutoExpandPreview(container);

		container.createEl("hr", { cls: "bible-settings-inner-divider" });

		// Cheatsheet Section
		const featuresSection = container.createDiv({ cls: "bible-settings-features-box" });
		featuresSection.createEl("h4", { text: "Autocomplete Features & Shortcuts Cheatsheet" });
		
		const ul = featuresSection.createEl("ul");
		const li1 = ul.createEl("li");
		li1.innerHTML = "<b>Tab & Enter Autocomplete:</b> Hitting either <code>Tab</code> or <code>Enter</code> will select the highlighted dropdown item and insert it atomically into the editor.";
		const li2 = ul.createEl("li");
		li2.innerHTML = "<b>Format Suffix Filtering:</b> Directly append <code>p</code>, <code>l</code>, or <code>q</code> at the end of the query (e.g., <code>--John 3:16p</code>) to instantly isolate that format choice. Typing <code>+</code> prefix is optional!";
		const li3 = ul.createEl("li");
		li3.innerHTML = "<b>Shorthand Context Links:</b> If the Sidecar panel is open, typing a relative verse or range (like <code>--v2</code> or <code>--2</code>) will output a clean shorthand hyperlink (e.g. <code>[v2](obsidian://...)</code>) to keep notes tidy.";
		const li4 = ul.createEl("li");
		li4.innerHTML = "<b>Trailing Colon (:) Helper:</b> Keeps suggestions active when you type a colon (e.g., <code>--Job 1:</code>) and displays the first few verses of the chapter.";
		const li5 = ul.createEl("li");
		li5.innerHTML = "<b>Trailing Dash (-) Range Helper:</b> Keeps suggestions active when you type a dash at the end of a verse (e.g., <code>--Job 1:2-</code>) and lists range recommendations starting from that verse.";
	}

	renderAutoExpandPreview(parentEl: HTMLElement) {
		const previewCard = parentEl.createDiv({ cls: "bible-settings-preview-card" });
		previewCard.createDiv({ cls: "bible-settings-preview-card-title", text: "Live Expand Preview (John 3:16-17)" });
		const previewContent = previewCard.createDiv({ cls: "bible-settings-preview-card-content" });

		const mockVerses = [
			{ verse: 16, text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life." },
			{ verse: 17, text: "For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him." }
		];

		const refLink = compileReferenceLink("John", 3, "16-17", "16,17", this.plugin.settings.verseReferenceInternalLinking, this.plugin.settings.verseReferenceFormat);
		const prefix = this.plugin.settings.autoExpandTriggerPrefix || "--";

		let previewText = "";
		
		previewText += `--- Shortcut: ${prefix}John 3:16 +p ---\n`;
		previewText += compileAutoExpandOutput(mockVerses, "John", 3, "p", refLink, this.plugin.settings);
		previewText += "\n\n";

		previewText += `--- Shortcut: ${prefix}John 3:16 +l ---\n`;
		previewText += compileAutoExpandOutput(mockVerses, "John", 3, "l", refLink, this.plugin.settings);
		previewText += "\n\n";

		previewText += `--- Shortcut: ${prefix}John 3:16 +q ---\n`;
		previewText += compileAutoExpandOutput(mockVerses, "John", 3, "q", refLink, this.plugin.settings);

		previewContent.setText(previewText);
	}

	updateActiveViews() {
		const activeViews = this.app.workspace.getLeavesOfType("bible-view-plus");
		for (const leaf of activeViews) {
			if (leaf.view && (leaf.view as any).updateSettings) {
				(leaf.view as any).updateSettings(this.plugin.settings);
			}
		}
	}
}

class EditorSuggest {
	constructor(app) {
		this.app = app;
		this.scope = {
			register: () => {}
		};
	}
}
class Notice {
	constructor(message) {
		this.message = message;
		console.log("Obsidian Notice:", message);
	}
}
module.exports = {
	EditorSuggest,
	Notice
};

import { execSync } from "child_process";
import fs from "fs";

console.log("🚀 Starting local release publication workflow...\n");

try {
	// 1. Run tests
	console.log("🧪 Step 1: Running unit tests...");
	execSync("npm run test", { stdio: "inherit" });
	console.log("✓ Tests passed successfully!\n");

	// 1.5 Run API compliance tests (release-only check since it is slow)
	console.log("🧪 Step 1.5: Running API compliance tests...");
	execSync("npm run test:api", { stdio: "inherit" });
	console.log("✓ API compliance tests passed successfully!\n");

	// 2. Build project
	console.log("📦 Step 2: Building production plugin...");
	execSync("npm run build", { stdio: "inherit" });
	console.log("✓ Plugin compiled and copied successfully!\n");

	// 3. Read package.json version
	const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
	const version = packageJson.version;

	console.log(`🏷️ Current version: ${version}\n`);

	// 4. Create GitHub release
	console.log(`📤 Step 3: Creating GitHub release for tag ${version}...`);
	execSync(`gh release create ${version} --title="${version}" --notes-file release-notes.md main.js manifest.json styles.css`, { stdio: "inherit" });
	console.log(`\n🎉 Release ${version} published successfully to GitHub!`);
} catch (error) {
	console.error("\n❌ Release workflow failed:", error.message || error);
	process.exit(1);
}

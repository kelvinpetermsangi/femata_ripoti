import { readFileSync, readdirSync } from "node:fs";
import { reportTranslations } from "../src/locales/reportTranslations.js";
import { reportFlowOverrides } from "../src/locales/reportFlowOverrides.js";

const frontendRoot = new URL("../", import.meta.url);
const localesDir = new URL("../src/locales/", import.meta.url);
const sharedLocalesDir = new URL("../src/locales/shared/", import.meta.url);
const sharedLocaleCodes = readdirSync(sharedLocalesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const localeCodes = [...new Set([
  ...sharedLocaleCodes,
  ...readdirSync(localesDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""))
  .sort(),
])].sort();

const reportPage = readFileSync(new URL("../src/pages/ReportPage.tsx", import.meta.url), "utf8");
const landingPage = readFileSync(new URL("../src/pages/LandingPage.tsx", import.meta.url), "utf8");

const usedKeys = new Set();
for (const fileText of [reportPage, landingPage]) {
  for (const match of fileText.matchAll(/t\("([^"]+)"/g)) {
    usedKeys.add(match[1]);
  }
}

const dynamicKeys = Object.keys(reportTranslations.en);
const reportKeys = [...new Set([...dynamicKeys, ...usedKeys])]
  .filter((key) => key.startsWith("report") || key.startsWith("secureHandoff"))
  .sort();

const localeData = Object.fromEntries(
  localeCodes.map((code) => [
    code,
    JSON.parse(
      readFileSync(
        sharedLocaleCodes.includes(code)
          ? new URL(`../src/locales/shared/${code}/common.json`, import.meta.url)
          : new URL(`../src/locales/${code}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);

const mergeLocale = (code) => ({
  ...localeData[code],
  ...(reportTranslations[code] ?? {}),
  ...(reportFlowOverrides[code] ?? {}),
});

const english = mergeLocale("en");
let hasBlockingIssue = false;
let hasWarnings = false;

console.log("Report i18n audit");
console.log(`Workspace: ${frontendRoot.pathname}`);
console.log(`Checked keys: ${reportKeys.length}`);

for (const code of localeCodes) {
  const merged = mergeLocale(code);
  const missing = reportKeys.filter((key) => !(key in merged));
  const suspicious = reportKeys.filter((key) => typeof merged[key] === "string" && /\?{2,}/.test(merged[key]));
  const sameAsEnglish = reportKeys.filter((key) => code !== "en" && merged[key] === english[key]);

  if (missing.length > 0 || suspicious.length > 0) {
    hasBlockingIssue = true;
  }
  if (sameAsEnglish.length > 0) {
    hasWarnings = true;
  }

  console.log(`\n[${code}] missing=${missing.length} suspicious=${suspicious.length} sameAsEnglish=${sameAsEnglish.length}`);

  if (missing.length > 0) {
    console.log(`missing keys: ${missing.join(", ")}`);
  }
  if (suspicious.length > 0) {
    console.log(`suspicious values: ${suspicious.join(", ")}`);
  }
  if (sameAsEnglish.length > 0) {
    console.log(`warning keys: ${sameAsEnglish.slice(0, 20).join(", ")}${sameAsEnglish.length > 20 ? " ..." : ""}`);
  }
}

if (hasBlockingIssue) {
  console.error("\nReport i18n audit failed: missing keys or suspicious placeholder values were found.");
  process.exit(1);
}

if (hasWarnings) {
  console.warn("\nReport i18n audit passed with warnings: some keys still match English exactly.");
} else {
  console.log("\nReport i18n audit passed with no warnings.");
}

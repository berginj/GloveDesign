import { crawlSite } from "../crawl";
import { selectBestLogo } from "../logo/scoring";
import { extractPalette } from "../colors/extract";
import { generateDesign } from "../design";
import { LocalStore } from "../common/localStore";
import { ensureHttpScheme, validateUrlWithDns } from "../common/validation";
import { buildProposal } from "../common/proposal";

async function main() {
  const [teamUrl] = process.argv.slice(2);
  if (!teamUrl) {
    console.error("Usage: npm run start:cli -- <teamUrl>");
    process.exit(1);
  }

  const normalizedUrl = ensureHttpScheme(teamUrl);
  const validation = await validateUrlWithDns(normalizedUrl);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const report = await crawlSite(normalizedUrl, "local");
  const logo = selectBestLogo(report.imageCandidates);
  if (!logo) {
    throw new Error("No logo found.");
  }
  const palette = await extractPalette(logo.url, report.cssUrls, report.inlineStyles);
  const design = generateDesign("local", normalizedUrl, logo.url, `jobs/local/logo`, palette);

  const store = new LocalStore("./local-output");
  await store.write("palette.json", JSON.stringify(palette, null, 2));
  await store.write("glove_design.json", JSON.stringify(design, null, 2));
  await store.write("crawl_report.json", JSON.stringify(report, null, 2));
  await store.write("proposal.md", buildProposal(design, logo, palette, report));

  console.log("Artifacts written to local-output");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

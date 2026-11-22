import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import puppeteer, { Page } from "puppeteer";
import type {
  Data,
  FileInfo,
  FileVersion,
  ILOFile,
  ILOVerion,
  ReleaseInfo,
  UpgradeRequirement,
} from "../src/types";

const HPE_ORIGIN = "https://support.hpe.com";
const dataFilePath = resolve("./src/lib/assets/data.json");

const dataFile: Data = JSON.parse(readFileSync(dataFilePath, "utf-8"));

/** A version as listed on a collection page, plus the item it links to. */
interface ListedVersion extends FileVersion {
  itemUrl: string;
}

/** The subset of HPE's `softwareResponse` payload that the scraper reads. */
interface SoftwareResponse {
  swItem: {
    versionId: string;
    customerAvailableDate: string;
    softwareFileList?: Array<{
      name: string;
      size: string;
      downloadDestination: string;
      checkSumAlg?: string;
      checkSumValue?: string;
    }>;
    problemSeverityLevel?: { problemSeverityLevelName?: string };
    properties?: { reboot_guidance?: { value?: string } };
  };
}

/**
 * HPE retired the Salesforce `/connect/s/softwaredetails?collectionId=...`
 * pages in favour of `/km/software/<collectionId>`. Old URLs still redirect,
 * but normalise them so the stored source URLs point at the live page.
 */
function canonicalCollectionUrl(url: string): string {
  if (url.includes("/km/software/")) return url;
  const collectionId = new URL(url).searchParams.get("collectionId");
  if (!collectionId) throw new Error(`Cannot find collectionId in ${url}`);
  return `${HPE_ORIGIN}/km/software/${collectionId}`;
}

function versionKey(version: Pick<FileVersion, "versionCode" | "releaseType">) {
  return `${version.versionCode}|${version.releaseType}`;
}

function parseFileVersion(version: string): {
  versionCode: FileVersion["versionCode"];
  releaseType: FileVersion["releaseType"];
} {
  if (version.endsWith("(b)")) {
    return { versionCode: version.replace("(b)", ""), releaseType: "Beta" };
  }
  if (version.endsWith("(a)")) {
    return { versionCode: version.replace("(a)", ""), releaseType: "Alpha" };
  }
  return { versionCode: version, releaseType: "Production" };
}

/** "5 Oct 2026" -> "Oct 5, 2026", the format already stored in data.json. */
function formatReleaseDate(date: string): string {
  const match = date.trim().match(/^(\d{1,2}) ([A-Za-z]{3})[A-Za-z]* (\d{4})$/);
  if (!match) return date.trim();
  const [, day, month, year] = match;
  return `${month} ${Number(day)}, ${year}`;
}

async function getAllVersions(page: Page): Promise<ListedVersion[]> {
  console.log("Waiting for list of versions...");
  const linkSelector = "a.version-item-link";
  await page.waitForSelector(linkSelector, { timeout: 60000 });

  const hrefs = await page.$$eval(linkSelector, (links) =>
    links.map((link) => link.getAttribute("href") || ""),
  );

  const versions: ListedVersion[] = [];
  for (const href of hrefs) {
    const itemUrl = new URL(href, HPE_ORIGIN);
    const rawVersion = itemUrl.searchParams.get("version");
    const versionId = itemUrl.pathname.split("/item/")[1];
    if (!rawVersion || !versionId) {
      console.warn(`⚠️ Skipping unrecognised version link: ${href}`);
      continue;
    }
    versions.push({
      versionId,
      ...parseFileVersion(rawVersion),
      itemUrl: itemUrl.toString(),
    });
  }

  if (versions.length === 0) {
    throw new Error("Version list rendered but no versions could be parsed");
  }
  return versions;
}

/**
 * Item pages are server-rendered by Next.js. The full item record, including
 * file names, sizes, SHA-256 checksums and direct download URLs, is embedded
 * in the React Server Components payload as `"softwareResponse": {...}`.
 *
 * The payload is read from the inline `self.__next_f.push([1, "..."])`
 * scripts rather than the `self.__next_f` global, because Next.js empties
 * that array once the page hydrates.
 */
async function getSoftwareResponse(page: Page): Promise<SoftwareResponse> {
  await page.waitForFunction(
    () =>
      Array.from(document.scripts).some((script) =>
        script.textContent?.includes("softwareResponse"),
      ),
    { timeout: 60000 },
  );

  const scripts = await page.$$eval("script", (elements) =>
    elements.map((element) => element.textContent || ""),
  );

  const payload = scripts
    .map((script) => script.match(/^\s*self\.__next_f\.push\((\[.*\])\)\s*;?\s*$/s))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => JSON.parse(match[1]!) as unknown[])
    .filter((entry) => entry[0] === 1 && typeof entry[1] === "string")
    .map((entry) => entry[1] as string)
    .join("");

  const marker = '"softwareResponse":';
  const start = payload.indexOf(marker);
  if (start === -1) throw new Error("softwareResponse not found in page");

  return JSON.parse(extractJsonObject(payload, start + marker.length));
}

/** Returns the balanced JSON object that begins at `from`. */
function extractJsonObject(text: string, from: number): string {
  const begin = text.indexOf("{", from);
  let depth = 0;
  let inString = false;
  for (let i = begin; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && --depth === 0) {
      return text.slice(begin, i + 1);
    }
  }
  throw new Error("Unterminated softwareResponse object");
}

function buildIloFile(response: SoftwareResponse): ILOFile {
  const item = response.swItem;
  const extensions = dataFile.whitelistedFileExtensions.map((ext) =>
    ext.toLowerCase(),
  );

  const file = item.softwareFileList?.find((candidate) =>
    extensions.some((ext) => candidate.name.toLowerCase().endsWith("." + ext)),
  );
  if (!file) {
    throw new Error(
      `No ${extensions.join("/")} file listed for version ${item.versionId}`,
    );
  }

  const nameParts = file.name.split(".");
  const filetype = nameParts.pop() || "";
  const checksum = file.checkSumValue?.toLowerCase() ?? "";

  const fileInfo: FileInfo = {
    filename: nameParts.join("."),
    filetype,
    filesize: file.size || "Unknown",
    checksum: /^[a-f0-9]{64}$/.test(checksum) ? checksum : "Not Found",
  };

  const releaseInfo = {
    version: parseFileVersion(item.versionId),
    releaseDate: formatReleaseDate(item.customerAvailableDate),
    upgradeRequirement: item.problemSeverityLevel
      ?.problemSeverityLevelName as UpgradeRequirement,
    rebootRequirement: item.properties?.reboot_guidance?.value === "Yes",
  } as ReleaseInfo;

  return { fileInfo, releaseInfo, downloadUrl: file.downloadDestination };
}

/**
 * Versions that are listed on HPE but not stored, or stored without a valid
 * checksum (so incomplete records are retried and repaired).
 */
function findMissingVersions(
  fetchedVersions: ListedVersion[],
  iloVersion: ILOVerion,
): ListedVersion[] {
  const iloEntry = dataFile.ilos.find((ilo) => ilo.version === iloVersion);
  if (!iloEntry) {
    console.log(`⚠️ ILO entry not found for ${iloVersion}`);
    return fetchedVersions;
  }

  // Key on code + release type: e.g. iLO 5 has both 2.78(a) and 2.78(b).
  const existingFiles = new Map(
    iloEntry.files.map((file) => [versionKey(file.releaseInfo.version), file]),
  );

  return fetchedVersions.filter((version) => {
    const existingFile = existingFiles.get(versionKey(version));
    return (
      !existingFile || !/^[a-fA-F0-9]{64}$/.test(existingFile.fileInfo.checksum)
    );
  });
}

function upsertFile(iloVersion: ILOVerion, iloFile: ILOFile) {
  const ilo = dataFile.ilos.find((val) => val.version === iloVersion);
  if (!ilo) throw new Error(`Unable to find ${iloVersion} in data.json`);

  const key = versionKey(iloFile.releaseInfo.version);
  const existingIndex = ilo.files.findIndex(
    (file) => versionKey(file.releaseInfo.version) === key,
  );

  if (existingIndex === -1) {
    ilo.files.push(iloFile);
  } else {
    // Replace incomplete records that were deliberately retried instead of
    // creating a second entry for the same firmware version.
    ilo.files[existingIndex] = iloFile;
  }
}

async function fetchMissingFirmware(page: Page, url: string, iloVersion: ILOVerion) {
  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const versions = await getAllVersions(page);
  console.log(`Found ${versions.length} versions for ${iloVersion}`);

  const missingVersions = findMissingVersions(versions, iloVersion);
  console.log(
    "Missing Versions:",
    missingVersions.map((v) => `${v.versionCode} (${v.releaseType})`),
  );

  let failures = 0;
  for (const version of missingVersions) {
    try {
      console.log("Opening:", version.itemUrl);
      await page.goto(version.itemUrl, { waitUntil: "domcontentloaded" });

      const iloFile = buildIloFile(await getSoftwareResponse(page));
      console.log("✅ Extracted:", JSON.stringify(iloFile));
      upsertFile(iloVersion, iloFile);
    } catch (error) {
      failures++;
      console.error(`❌ Failed to fetch ${version.itemUrl}:`, error);
    }
  }
  return failures;
}

/**
 * Sorts the ILO versions (descending) and their internal files
 * (descending by versionCode).
 */
function sortData() {
  dataFile.ilos.sort((a, b) =>
    b.version.localeCompare(a.version, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  for (const ilo of dataFile.ilos) {
    ilo.files.sort((a, b) =>
      b.releaseInfo.version.versionCode.localeCompare(
        a.releaseInfo.version.versionCode,
        undefined,
        { numeric: true, sensitivity: "base" },
      ),
    );
  }
}

function saveData() {
  sortData();
  writeFileSync(dataFilePath, JSON.stringify(dataFile, null, 2));
}

console.log("🚀 Launching browser...");
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

let failures = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  for (const ilo of dataFile.ilos) {
    ilo.url = canonicalCollectionUrl(ilo.url);
    try {
      failures += await fetchMissingFirmware(page, ilo.url, ilo.version);
    } catch (error) {
      failures++;
      console.error(`❌ Failed to process ${ilo.version}:`, error);
    }
  }
} finally {
  console.log("🏁 Closing browser...");
  await browser.close();
}

// Keep whatever was fetched successfully, but still fail the job so a broken
// scrape is visible in CI instead of silently going stale.
saveData();

if (failures > 0) {
  console.error(`❌ ${failures} scrape step(s) failed`);
  process.exit(1);
}

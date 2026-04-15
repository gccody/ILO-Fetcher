import fs, { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import path, { resolve } from "path";
import puppeteer, { Page } from "puppeteer";
import type {
  Data,
  FileInfo,
  FileVersion,
  ILOFile,
  ILOVerion,
  ReleaseInfo,
} from "../src/types";

const downloadPath = resolve("./downloads");
const dataFilePath = resolve("./src/lib/assets/data.json");

if (!existsSync(downloadPath)) {
  mkdirSync(downloadPath, { recursive: true });
}

// Read data file using Node.js fs
const dataFile: Data = JSON.parse(readFileSync(dataFilePath, "utf-8"));

async function fetchMissingFirmware(url: string, iloVersion: ILOVerion) {
  console.log("🚀 Launching browser...");
  // 1. Set headless: false so you can see what is happening
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--enable-features=NetworkService,NetworkServiceInProcess",
    ],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // 2. Correct CDP Session target
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadPath,
  });

  console.log(`🌐 Navigating to: ${url}`);
  // 3. Wait for network to be somewhat idle
  await page.goto(url);

  const versions = await getAllVersions(page);
  console.log("Extracted Versions:", versions);

  // Check for missing versions
  const missingVersions = findMissingVersions(versions, iloVersion);
  console.log("Missing Versions:", missingVersions);

  // Iterate through all missing versions and download
  for (const version of missingVersions) {
    const newUrl = `${url}&softwareId=${version.versionId}`;
    console.log("Redirecting: ", newUrl);
    await page.goto(newUrl);

    // Extract specific release data
    const releaseInfo = await extractReleaseData(page);

    if (!releaseInfo) {
      console.error("Unable to find release info, Skipping...");
      continue;
    }

    console.log("Release Data:", releaseInfo);

    const downloadSoftwareModalButtonSelector =
      '[data-id="openDownloadModalButton"]';
    await page.waitForSelector(downloadSoftwareModalButtonSelector, {
      timeout: 30000,
    });

    await page.click(downloadSoftwareModalButtonSelector);

    const fileInfo = await getFileInfo(page);

    const filePath = await downloadFirmwareCurlFile(page, version);

    if (!filePath) {
      console.warn("Skipping since Curl file was not downloaded");
      continue;
    }

    const fileDownloadUrl = extractUrlFromCurlFile(filePath);

    if (!fileDownloadUrl) {
      console.error("Unable to extract URL from Curl File");
      continue;
    }

    // Delete the temporary curl file
    unlinkSync(filePath);

    const iloFile: ILOFile = {
      fileInfo,
      releaseInfo,
      downloadUrl: fileDownloadUrl,
    };

    const iloIndex = dataFile.ilos.findIndex(
      (val) => val.version === iloVersion,
    );

    if (iloIndex === -1) {
      console.log("Unable to find ILO Version in data.json");
      return;
    }

    dataFile.ilos[iloIndex]!.files.push(iloFile);
  }

  console.log("🏁 Script finished. Closing browser...");
  // 4. If you don't close the browser, the Bun process never exits
  await browser.close();

  return missingVersions;
}

async function getFileInfo(page: Page): Promise<FileInfo> {
  await page.waitForFunction(
    (extensions) => {
      const getSpans = (root: Node | ShadowRoot): HTMLSpanElement[] => {
        let spans = Array.from((root as HTMLElement).querySelectorAll("span"));
        const children = Array.from(
          (root as HTMLElement).querySelectorAll("*"),
        );
        for (const child of children) {
          if (child.shadowRoot) {
            spans = spans.concat(getSpans(child.shadowRoot));
          }
        }
        return spans;
      };

      const allSpans = getSpans(document);
      return allSpans.some((s) => {
        const text = s.textContent?.trim().toLowerCase() || "";
        return extensions.some((ext) => text.endsWith("." + ext.toLowerCase()));
      });
    },
    { timeout: 30000 },
    dataFile.whitelistedFileExtensions,
  );

  // 2. Extract the FileInfo
  return await page.evaluate((extensions) => {
    const getSpans = (root: Node | ShadowRoot): HTMLSpanElement[] => {
      let spans = Array.from((root as HTMLElement).querySelectorAll("span"));
      const children = Array.from((root as HTMLElement).querySelectorAll("*"));
      for (const child of children) {
        if (child.shadowRoot) {
          spans = spans.concat(getSpans(child.shadowRoot));
        }
      }
      return spans;
    };

    const allSpans = getSpans(document);
    const allTexts = allSpans.map((s) => s.textContent?.trim() || "");

    // 1. Find Filename
    const fullFilename = allTexts.find((text) =>
      extensions.some((ext) =>
        text.toLowerCase().endsWith("." + ext.toLowerCase()),
      ),
    );

    // 2. Find Filesize and strip parentheses
    const sizeMatch = allTexts.find((text) =>
      /\d+(\.\d+)?\s*(KB|MB|GB|Bytes)/i.test(text),
    );
    // .replace(/[()]/g, "") removes both '(' and ')'
    const filesize = sizeMatch
      ? sizeMatch.replace(/[()]/g, "").trim()
      : "Unknown";

    // 3. Find Checksum
    // We look for a span containing 'SHA256' or a 64-character hex string
    const checksumRow = allTexts.find(
      (text) => text.includes("SHA256") || /[a-fA-F0-9]{64}/.test(text),
    );

    let checksum = "Not Found";
    if (checksumRow) {
      // This regex looks for exactly 64 hexadecimal characters
      const hashMatch = checksumRow.match(/[a-fA-F0-9]{64}/);
      checksum = hashMatch ? hashMatch[0] : "Not Found";
    }

    if (!fullFilename) {
      throw new Error("Could not locate filename in modal");
    }

    const nameParts = fullFilename.split(".");
    const filetype = nameParts.pop() || "";
    const filename = nameParts.join(".");

    return {
      filename,
      filetype,
      filesize,
      checksum,
    };
  }, dataFile.whitelistedFileExtensions);
}

function extractUrlFromCurlFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/); // Split by new line

    for (const line of lines) {
      if (!line.trim()) continue;

      // Find the URL in the line (starts with http/https and ends before any space or end of line)
      const urlMatch = line.match(/https?:\/\/[^\s"]+/);
      if (!urlMatch) continue;

      const url = urlMatch[0];

      // Check if this specific URL ends with one of our whitelisted extensions
      const isWhitelisted = dataFile.whitelistedFileExtensions.some((ext) =>
        url.toLowerCase().endsWith("." + ext.toLowerCase()),
      );

      if (isWhitelisted) {
        return url;
      }
    }
  } catch (error) {
    console.error("❌ Error reading curl file:", error);
  }
  return null;
}

async function downloadFirmwareCurlFile(page: Page, versionInfo: FileVersion) {
  console.log(
    `💾 Attempting to find download button for: ${versionInfo.versionId}`,
  );

  // 1. Wait for the button to actually exist in the Shadow DOM
  try {
    await page.waitForFunction(
      () => {
        const getButtons = (root: Node | ShadowRoot): HTMLButtonElement[] => {
          let buttons = Array.from(
            (root as HTMLElement).querySelectorAll("button"),
          );
          const children = Array.from(
            (root as HTMLElement).querySelectorAll("*"),
          );
          for (const child of children) {
            if (child.shadowRoot)
              buttons = buttons.concat(getButtons(child.shadowRoot));
          }
          return buttons;
        };
        // Note: use all lowercase for comparison
        return getButtons(document).some(
          (b) =>
            b.textContent?.toLowerCase().includes("curl copy") ||
            b.title?.toLowerCase().includes("curl copy"),
        );
      },
      { timeout: 20000 },
    );
  } catch (e) {
    console.error("❌ Download button never appeared in the UI.");
    return;
  }

  // 2. Start watching the folder before clicking
  const downloadPromise = waitForDownload(downloadPath, 60000);

  // 3. Click the button
  const clickSuccessful = await page.evaluate(() => {
    const getButtons = (root: Node | ShadowRoot): HTMLButtonElement[] => {
      let buttons = Array.from(
        (root as HTMLElement).querySelectorAll("button"),
      );
      const children = Array.from((root as HTMLElement).querySelectorAll("*"));
      for (const child of children) {
        if (child.shadowRoot)
          buttons = buttons.concat(getButtons(child.shadowRoot));
      }
      return buttons;
    };

    const downloadBtn = getButtons(document).find(
      (b) =>
        b.textContent?.toLowerCase().includes("curl copy") ||
        b.title?.toLowerCase().includes("curl copy"),
    );

    if (downloadBtn) {
      downloadBtn.scrollIntoView();
      downloadBtn.click();
      return true;
    }
    return false;
  });

  if (!clickSuccessful) {
    console.error(
      "❌ Failed to click the button (not found during evaluation)",
    );
    return;
  }

  console.log("🖱️ Button clicked. Waiting for file to save...");

  try {
    const filePath = await downloadPromise;
    console.log(`✅ Download complete: ${filePath}`);
    return filePath as string;
  } catch (err) {
    console.error(
      "❌ Download failed or timed out. Check if the browser shows a 'Save As' dialog.",
    );
  }
}

async function waitForDownload(downloadPath: string, timeout = 60000): Promise<string> {
  const startTime = Date.now();
  // Get initial files in download directory
  const initialFiles = new Set(
    readdirSync(downloadPath).map((f) => path.join(downloadPath, f)),
  );

  while (Date.now() - startTime < timeout) {
    try {
      const files = readdirSync(downloadPath);

      for (const file of files) {
        if (
          file.endsWith(".crdownload") ||
          file.endsWith(".tmp") ||
          file.endsWith(".part")
        ) {
          continue; // Skip incomplete downloads
        }

        const fullPath = path.join(downloadPath, file);
        if (!initialFiles.has(fullPath)) {
          // Wait a bit to ensure the OS has finished flushing the file
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return fullPath;
        }
      }
    } catch (error) {
      // Directory might not exist yet, ignore and retry
    }

    // Poll every 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Download timed out");
}

/**
 * Helper function on the Bun/Node side
 */
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

async function getAllVersions(page: Page): Promise<Array<FileVersion>> {
  console.log("Waiting for list of versions...");
  const versionListSelector = ".version_div.version-list";

  await page.waitForSelector(versionListSelector, { timeout: 30000 });

  // 1. Extract raw attributes from the browser
  const rawData = await page.$$eval(versionListSelector, (elements) => {
    return elements.map((el) => ({
      id: el.getAttribute("id") || "",
      name: el.getAttribute("data-name") || "",
    }));
  });

  // 2. Map raw data to the FileVersion interface on the Bun side
  return rawData.map((item) => {
    const parsed = parseFileVersion(item.name);

    return {
      versionId: item.id.split("-")[0]!, // From the 'id' attribute
      versionCode: parsed.versionCode, // From data-name (cleaned)
      releaseType: parsed.releaseType, // From data-name suffix
    };
  });
}
async function extractReleaseData(
  page: Page,
): Promise<ReleaseInfo | undefined> {
  console.log("🔍 Extracting release data (aggressive shadow piercing)...");

  try {
    await page.waitForSelector("pierce/.slds-col.slds-large-size_2-of-8", {
      timeout: 15000,
    });
  } catch (e) {
    console.log("⚠️ Warning: Data labels did not appear.");
    return;
  }

  const releaseData = await page.evaluate(() => {
    /**
     * Finds ALL elements matching a selector, piercing every shadow root it encounters.
     */
    const findAllDeep = (
      selector: string,
      root: Document | ShadowRoot = document,
    ): Element[] => {
      let results = Array.from(root.querySelectorAll(selector));
      const allElements = Array.from(root.querySelectorAll("*"));

      for (const el of allElements) {
        if (el.shadowRoot) {
          results = [...results, ...findAllDeep(selector, el.shadowRoot)];
        }
      }
      return results;
    };

    /**
     * Finds the FIRST element matching a selector inside a specific root,
     * piercing nested shadow roots recursively.
     */
    const findInElementDeep = (
      selector: string,
      root: Element | ShadowRoot,
    ): Element | null => {
      const found = root.querySelector(selector);
      if (found) return found;

      const children = Array.from(root.querySelectorAll("*"));
      for (const child of children) {
        if (child.shadowRoot) {
          const result = findInElementDeep(selector, child.shadowRoot);
          if (result) return result;
        }
      }
      return null;
    };

    const containers = findAllDeep(".slds-col.slds-large-size_2-of-8");

    return containers.map((col) => {
      const labelEl = findInElementDeep(".slds-form-element__label", col);
      const label = labelEl?.textContent?.trim() || "";

      let value = "";

      if (label === "Version") {
        // Version is usually inside an H2 which is nested inside the
        // lightning-formatted-rich-text shadow DOM
        const h2El = findInElementDeep("h2", col);
        value = h2El?.textContent?.trim() || "";
      } else {
        // Other fields are usually in .dce-font-medium
        const fontMediumEl = findInElementDeep(".dce-font-medium", col);

        if (label === "Upgrade Requirement" && fontMediumEl) {
          // Use firstChild to get "Recommended" and avoid the tooltip popup text
          value =
            fontMediumEl.firstChild?.textContent?.trim() ||
            fontMediumEl.textContent?.trim() ||
            "";
        } else {
          value = fontMediumEl?.textContent?.trim() || "";
        }
      }

      return { label, value };
    });
  });

  // Log everything found
  console.log("✅ Extracted Data");

  // Helper to extract by label
  const getVal = (lbl: string) =>
    releaseData.find((d) => d.label === lbl)?.value;

  const versionString = getVal("Version");
  const releaseDate = getVal("Release Date");
  const upgradeRequirement = getVal("Upgrade Requirement");
  const rebootRequirement = getVal("Reboot Requirement");

  if (!versionString || !releaseDate || !upgradeRequirement) return;

  return {
    version: parseFileVersion(versionString),
    releaseDate,
    upgradeRequirement,
    rebootRequirement: rebootRequirement === "Yes",
  } as ReleaseInfo;
}

/**
 * Finds versions that are in the fetched list but not in the dataFile
 */
function findMissingVersions(
  fetchedVersions: Array<FileVersion>,
  iloVersion: ILOVerion,
): Array<FileVersion> {
  // Find the ILO entry in dataFile
  const iloEntry = dataFile.ilos.find((ilo) => ilo.version === iloVersion);

  if (!iloEntry) {
    console.log(`⚠️ ILO entry not found for ${iloVersion}`);
    return fetchedVersions;
  }

  // Get existing version codes from the dataFile
  const existingVersionCodes = new Set(
    iloEntry.files.map((file) => file.releaseInfo.version.versionCode),
  );

  // Find versions that are not in the dataFile
  const missingVersions = fetchedVersions.filter(
    (version) => !existingVersionCodes.has(version.versionCode),
  );

  return missingVersions;
}

/**
 * Sorts the ILO versions (descending) and their internal files
 * (descending by versionCode).
 */
function sortData() {
  // 1. Sort the top-level ILO versions (High number to Low number)
  dataFile.ilos.sort((a, b) => {
    return b.version.localeCompare(a.version, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // 2. Sort the files within each ILO version
  for (const ilo of dataFile.ilos) {
    ilo.files.sort((a, b) => {
      return b.releaseInfo.version.versionCode.localeCompare(
        a.releaseInfo.version.versionCode,
        undefined,
        { numeric: true, sensitivity: "base" },
      );
    });
  }
}

async function saveData() {
  sortData(); // Ensure data is sorted before writing
  writeFileSync(dataFilePath, JSON.stringify(dataFile, null, 2));
}

for (const ilo of dataFile.ilos) {
  await fetchMissingFirmware(ilo.url, ilo.version);
}

await saveData();

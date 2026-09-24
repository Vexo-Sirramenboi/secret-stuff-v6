const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const GAME_URL = process.env.GAME_URL;
const OUTPUT = path.resolve("game");

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

function getFilePath(urlString) {
  const url = new URL(urlString);

  let pathname = decodeURIComponent(url.pathname);

  if (!pathname || pathname.endsWith("/")) {
    pathname += "index.html";
  }

  pathname = pathname.replace(/^\/+/, "");

  // Prevent anything from escaping the game directory.
  pathname = pathname.replace(/\.\./g, "");

  return path.join(OUTPUT, pathname);
}

async function saveResponse(response) {
  try {
    const request = response.request();
    const resourceType = request.resourceType();

    if (![
      "document",
      "script",
      "stylesheet",
      "image",
      "font",
      "media",
      "manifest",
      "xhr",
      "fetch",
      "other"
    ].includes(resourceType)) {
      return;
    }

    const url = response.url();

    if (
      url.startsWith("data:") ||
      url.startsWith("blob:") ||
      url.startsWith("ws:") ||
      url.startsWith("wss:")
    ) {
      return;
    }

    const filePath = getFilePath(url);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const body = await response.body();

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, body);
      console.log(
        "Downloaded:",
        url,
        "->",
        path.relative(OUTPUT, filePath)
      );
    }
  } catch (error) {
    console.log("Could not save:", response.url(), error.message);
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  page.on("response", async response => {
    await saveResponse(response);
  });

  page.on("requestfailed", request => {
    console.log(
      "Request failed:",
      request.url(),
      request.failure()?.errorText || ""
    );
  });

  console.log("Opening:");
  console.log(GAME_URL);

  await page.goto(GAME_URL, {
    waitUntil: "networkidle",
    timeout: 120000
  });

  console.log("Launcher loaded.");

  // Give Eaglercraft additional time to request
  // assets, language files, and other resources.
  await page.waitForTimeout(30000);

  console.log("Finished waiting for resources.");

  await browser.close();
})();

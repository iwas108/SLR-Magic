const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const filePath = `file://${path.resolve('ollama-middleman/middleman/templates/index.html')}`;

    await page.goto(filePath);

    // Check main tabs
    await page.waitForSelector('#mainTabs');

    // Screenshot of Realtime tab
    await page.screenshot({ path: 'realtime_tab.png' });

    // Click History tab
    await page.click('#history-tab');
    await page.waitForSelector('#history-table-body');

    // Screenshot of History tab
    await page.screenshot({ path: 'history_tab.png' });

    await browser.close();
    console.log("Screenshots captured.");
})();

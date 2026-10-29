import { chromium } from 'playwright';

async function testUI() {
  console.log('Starting Playwright UI tests...');
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.goto('http://localhost:3000/#finances', { waitUntil: 'networkidle' });

    // Check horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`ScrollWidth: ${scrollWidth}, ClientWidth: ${clientWidth}`);
    if (scrollWidth > clientWidth) {
      throw new Error(`Horizontal scroll detected at ${vp.name}: scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`);
    } else {
      console.log(`✅ No horizontal scrolling at ${vp.width}px`);
    }

    // Verify Tab buttons exist
    const expTab = await page.waitForSelector('#tab-expense-register');
    const incTab = await page.waitForSelector('#tab-income-register');
    if (expTab && incTab) {
      console.log('✅ Both register tabs found');
    }

    // Click Expense Tab
    await expTab.click();
    await page.waitForTimeout(500);

    // Click Income Tab
    await incTab.click();
    await page.waitForTimeout(500);

    // Switch back to Expense Tab
    await expTab.click();
    await page.waitForTimeout(500);

    // Verify Add Expense button
    const addExpBtn = await page.$('#btn-add-expense');
    if (addExpBtn) {
      console.log('✅ Add Expense button exists');
      await addExpBtn.click();
      await page.waitForSelector('#input-finance-amount');
      console.log('✅ Add Expense modal opened');
      // Close modal
      const closeBtn = await page.$('form button:has-text("Cancel")');
      if (closeBtn) await closeBtn.click();
    }

    if (errors.length > 0) {
      console.error(`Browser console errors at ${vp.name}:`, errors);
      throw new Error(`Console errors found: ${errors.join(', ')}`);
    } else {
      console.log(`✅ No browser console errors at ${vp.name}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\n====================================================');
  console.log('ALL PLAYWRIGHT UI TESTS PASSED!');
  console.log('====================================================');
}

testUI().catch(err => {
  console.error('UI Test failed:', err);
  process.exit(1);
});

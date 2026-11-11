const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_URL = 'http://localhost:45678/wadiz1/thumbnail';
const EXPORT_DIR = path.join(__dirname, 'export_final');
const TMP_DIR = path.join(EXPORT_DIR, 'tmp');
const THUMBS_DIR = path.join(EXPORT_DIR, 'thumbnails');

// Create directories
[EXPORT_DIR, TMP_DIR, THUMBS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

(async () => {
    console.log(`🚀 Thumbnail Exporter Started: Target -> ${TARGET_URL}`);

    const browser = await chromium.launch({ headless: true });
    
    // We have 6 thumbnails to process
    const totalThumbs = 6;

    for (let i = 0; i < totalThumbs; i++) {
        console.log(`\n📸 Capturing Thumbnail ${i + 1} / ${totalThumbs}...`);

        // We use a specific viewport size to capture just the thumbnail container nicely
        const context = await browser.newContext({
            recordVideo: { 
                dir: TMP_DIR,
                size: { width: 1200, height: 900 }
            },
            viewport: { width: 1200, height: 900 },
            deviceScaleFactor: 2
        });
        const page = await context.newPage();
        
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000); // Wait for load

        // Hide Next.js dev indicator ('N' logo)
        await page.addStyleTag({ content: 'nextjs-portal, #nextjs-build-indicator, .__next-build-indicator, [data-nextjs-toast], [class^="nextjs-toast"] { display: none !important; }' });

        // Click the corresponding thumbnail to open the detail view
        // The thumbnails are rendered inside a grid container
        const gridItems = await page.$$('.grid > div');
        if(gridItems[i]) {
            await gridItems[i].click();
            await page.waitForTimeout(1000); // Wait for transition
            
            // Wait for 5 seconds to capture the 2-second interval blink at least twice
            await page.waitForTimeout(5000); 
        }

        // Close context to finish recording
        await context.close();

        // Process the recorded webm video into GIF
        const files = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.webm'));
        if (files.length > 0) {
            const webmPath = path.join(TMP_DIR, files[0]);
            const gifPath = path.join(THUMBS_DIR, `thumbnail_${i + 1}.gif`);

            try {
                // Convert to High Quality GIF (skip first 1 second of loading)
                execSync(`ffmpeg -y -ss 00:00:01 -i "${webmPath}" -vf "fps=15,scale=860:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifPath}"`, { stdio: 'ignore' });
                console.log(`  -> Saved animated GIF: thumbnails/thumbnail_${i + 1}.gif`);
            } catch (err) {
                console.log(`  -> ⚠️ FFmpeg conversion failed for thumbnail ${i + 1}:`, err.message);
            }

            // Cleanup the temp webm
            fs.unlinkSync(webmPath);
        }
    }

    await browser.close();
    console.log(`\n🎉 All thumbnails exported! Check the 'export_final/thumbnails' folder!`);
})();

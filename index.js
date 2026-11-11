const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_URL = 'http://localhost:45678/wadiz1';
const EXPORT_DIR = path.join(__dirname, 'export_final');
const TMP_DIR = path.join(EXPORT_DIR, 'tmp');
const IMAGES_DIR = path.join(EXPORT_DIR, 'images');
const VIDEOS_DIR = path.join(EXPORT_DIR, 'videos');
const GIFS_DIR = path.join(EXPORT_DIR, 'gifs');

// Create directories
[EXPORT_DIR, TMP_DIR, IMAGES_DIR, VIDEOS_DIR, GIFS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

(async () => {
    console.log(`🚀 Webpage Exporter Started: Target -> ${TARGET_URL}`);

    const browser = await chromium.launch({ headless: true });
    
    // 1. Get total number of sections
    console.log(`📊 Counting sections on the page...`);
    const countContext = await browser.newContext({
        viewport: { width: 800, height: 1200 },
        deviceScaleFactor: 2
    });
    const countPage = await countContext.newPage();
    await countPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await countPage.waitForTimeout(5000); // Wait for Next.js hydration
    
    const sections = await countPage.$$('section');
    const totalSections = sections.length;
    console.log(`✅ Found ${totalSections} sections.`);
    await countContext.close();

    // 2. Iterate and capture each section with fresh recording context
    for (let i = 0; i < totalSections; i++) {
        const indexStr = String(i + 1).padStart(2, '0');
        console.log(`\n📸 Capturing Section ${indexStr} / ${totalSections}...`);

        // Create new context with Retina display settings
        const context = await browser.newContext({
            recordVideo: { 
                dir: TMP_DIR,
                size: { width: 800, height: 1200 }
            },
            viewport: { width: 800, height: 1200 },
            deviceScaleFactor: 2
        });
        const page = await context.newPage();

        // Hide scrollbar, Next.js dev indicator ('N' logo), and force sections to exactly 800px width
        await page.addStyleTag({ content: `
            ::-webkit-scrollbar { display: none !important; }
            nextjs-portal, #nextjs-build-indicator, .__next-build-indicator, [data-nextjs-toast], [class^="nextjs-toast"] { display: none !important; }
            section { 
                width: 800px !important; 
                min-width: 800px !important; 
                max-width: 800px !important; 
                margin: 0 auto !important; 
                display: block !important;
                box-sizing: border-box !important;
            }
        ` });
        
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000); // Wait for Next.js hydration

        const pageSections = await page.$$('section');
        const currentSection = pageSections[i];

        // Scroll logic to trigger animations
        if (i > 0) {
            // Jump to previous section instantly to prepare
            const prevSection = pageSections[i - 1];
            await prevSection.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500); // Short pause before moving into view
        }

        // Smooth scroll to current section
        await currentSection.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        
        // Wait 3.5 seconds for all animations (fade-in, slide, etc.) to fully play and settle
        await page.waitForTimeout(3500);

        // Take a clean static screenshot of the exactly 800px wide section element
        const screenshotPath = path.join(IMAGES_DIR, `section_${indexStr}.png`);
        await currentSection.screenshot({ path: screenshotPath });
        console.log(`  -> Saved static image: images/section_${indexStr}.png`);

        // Close context to finish video recording
        await context.close();

        // 3. Process the recorded webm video into MP4 and GIF using ffmpeg
        const files = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.webm'));
        if (files.length > 0) {
            const webmPath = path.join(TMP_DIR, files[0]);
            const mp4Path = path.join(VIDEOS_DIR, `section_${indexStr}.mp4`);
            const gifPath = path.join(GIFS_DIR, `section_${indexStr}.gif`);

            try {
                // Convert to High Quality MP4
                execSync(`ffmpeg -y -sseof -4.0 -i "${webmPath}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${mp4Path}"`, { stdio: 'ignore' });
                // Convert to High Quality GIF
                execSync(`ffmpeg -y -sseof -4.0 -i "${webmPath}" -vf "fps=15,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifPath}"`, { stdio: 'ignore' });
                
                console.log(`  -> Saved animated video: videos/section_${indexStr}.mp4`);
                console.log(`  -> Saved animated GIF: gifs/section_${indexStr}.gif`);
            } catch (err) {
                console.log(`  -> ⚠️ FFmpeg conversion failed for section ${indexStr}:`, err.message);
            }

            // Cleanup the temp webm
            fs.unlinkSync(webmPath);
        }
    }

    await browser.close();
    console.log(`\n🎉 All done! Check the 'export_final' folder for your Wadiz-ready assets!`);
})();

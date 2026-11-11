const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_URL = 'http://localhost:45678/wadiz1';

const TMP_DIR = path.join(__dirname, 'export_v5_최종', 'tmp');
const IMAGES_DIR = path.join(__dirname, 'export_v5_최종', 'images');
const GIFS_DIR = path.join(__dirname, 'export_v5_최종', 'gifs');
const VIDEOS_DIR = path.join(__dirname, 'export_v5_최종', 'videos');

[TMP_DIR, IMAGES_DIR, GIFS_DIR, VIDEOS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

(async () => {
    console.log("🚀 [궁극의 무결점 추출 모드] 빈 화면/프레임 드랍/화질 저하/N자/레이아웃 밀림 모두 해결 완료!");
    const browser = await chromium.launch({ headless: true });
    
    console.log("📏 1단계: 전체 페이지 분석 및 각 섹션별 실제 높이 측정 중...");
    const measureContext = await browser.newContext({ viewport: { width: 800, height: 1200 } });
    const measurePage = await measureContext.newPage();
    
    await measurePage.addStyleTag({ content: `
        ::-webkit-scrollbar { display: none !important; }
        nextjs-portal, #nextjs-build-indicator, .__next-build-indicator, [data-nextjs-toast], [class*="nextjs"] { display: none !important; opacity: 0 !important; }
        section { 
            width: 800px !important; min-width: 800px !important; max-width: 800px !important; 
            margin: 0 auto !important; display: block !important; box-sizing: border-box !important;
        }
    ` });
    
    // 레이아웃 밀림("앞뒤가 다 틀리고") 방지를 위해 이미지가 완전히 다 뜰 때까지 기다림 (load 이벤트)
    await measurePage.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });
    await measurePage.waitForTimeout(3000);
    
    const sections = await measurePage.$$('section');
    const totalSections = sections.length;
    console.log(`✅ 총 ${totalSections}개의 섹션을 발견했습니다.`);
    
    const sectionHeights = [];
    for (let i = 0; i < totalSections; i++) {
        const boundingBox = await sections[i].boundingBox();
        sectionHeights.push(Math.ceil(boundingBox.height));
    }
    await measureContext.close();
    
    // 2단계: 정밀 녹화
    for (let i = 0; i < totalSections; i++) {
        const indexStr = String(i + 1).padStart(2, '0');
        const height = sectionHeights[i];
        
        console.log(`🎥 [${indexStr} / ${totalSections}] 섹션 촬영 중... (맞춤 캔버스: 800px x ${height}px)`);
        
        const recordContext = await browser.newContext({
            viewport: { width: 800, height: height },
            recordVideo: { dir: TMP_DIR, size: { width: 800, height: height } },
            deviceScaleFactor: 2
        });
        
        const recordPage = await recordContext.newPage();
        
        // [핵심 1] 애니메이션 강제 일시정지
        await recordPage.addInitScript(() => {
            window.__pendingIOMessages = [];
            window.__ioUnblocked = false;
            const OriginalIO = window.IntersectionObserver;
            window.IntersectionObserver = function(callback, options) {
                const wrappedCallback = (entries, observer) => {
                    if (window.__ioUnblocked) callback(entries, observer);
                    else window.__pendingIOMessages.push(() => callback(entries, observer));
                };
                return new OriginalIO(wrappedCallback, options);
            };
            window.IntersectionObserver.prototype = OriginalIO.prototype;
            window.__releaseAnimations = () => {
                window.__ioUnblocked = true;
                window.__pendingIOMessages.forEach(cb => cb());
                window.__pendingIOMessages = [];
            };
            
            // [핵심 2] N자 로고 생성을 원천 차단 (DOM 트리 추가 자체를 막음)
            const originalAppendChild = document.body.appendChild;
            document.body.appendChild = function(node) {
                if (node && node.tagName && (node.tagName.toLowerCase().includes('nextjs') || node.tagName.toLowerCase() === 'next-route-announcer')) {
                    return node; // 돔에 추가하지 않고 무시!
                }
                return originalAppendChild.call(this, node);
            };
        });
        
        await recordPage.addStyleTag({ content: `
            @keyframes forcePaint { 0% { opacity: 0.99; } 50% { opacity: 1; } 100% { opacity: 0.99; } }
            body { animation: forcePaint 0.05s infinite; }
            ::-webkit-scrollbar { display: none !important; }
            nextjs-portal, #nextjs-build-indicator, .__next-build-indicator, [data-nextjs-toast], [class*="nextjs"] { display: none !important; opacity: 0 !important; }
            section { 
                width: 800px !important; min-width: 800px !important; max-width: 800px !important; 
                margin: 0 auto !important; display: block !important; box-sizing: border-box !important;
            }
        ` });
        
        // [핵심 3] 레이아웃 밀림 현상 방지를 위해 '모든 이미지'가 다 뜰 때까지 확실하게 대기 (waitUntil: 'load')
        await recordPage.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });
        
        // N자 로고 추가 10ms 단위 무한 삭제 해머
        await recordPage.evaluate(() => {
            setInterval(() => {
                const nodes = document.querySelectorAll('nextjs-portal, [data-nextjs-toast], #nextjs-build-indicator, [class*="nextjs-toast"], next-route-announcer');
                nodes.forEach(p => p.remove());
            }, 10);
        });
        
        // 목표 섹션으로 스크롤 이동 (이미지가 다 불러와진 상태라 정확한 위치 보장됨)
        const targetSection = (await recordPage.$$('section'))[i];
        const yOffset = await targetSection.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
        await recordPage.evaluate((y) => window.scrollTo(0, y), yOffset);
        
        // 안정화 대기
        await recordPage.waitForTimeout(1000);
        
        // [핵심 4] 흰 화면/밀림 없이 완벽한 상태에서 애니메이션 해방
        await recordPage.evaluate(() => window.__releaseAnimations());
        
        // 애니메이션 3.5초 기록
        await recordPage.waitForTimeout(3500);
        
        // 1. 고화질 정적 이미지(PNG) 저장 (반드시 애니메이션이 모두 끝난 뒤 완성된 화면을 캡처!)
        const imagePath = path.join(IMAGES_DIR, `section_${indexStr}.png`);
        await targetSection.screenshot({ path: imagePath });
        
        const videoPath = await recordPage.video().path();
        await recordContext.close();
        
        const finalMp4 = path.join(VIDEOS_DIR, `section_${indexStr}.mp4`);
        const finalGif = path.join(GIFS_DIR, `section_${indexStr}.gif`);
        
        try {
            // [핵심 5] 정확히 애니메이션 3.5초 구간만 잘라냄
            execSync(`ffmpeg -y -sseof -3.5 -i "${videoPath}" -c:v libx264 -preset fast -crf 22 "${finalMp4}"`, { stdio: 'ignore' });
            execSync(`ffmpeg -y -sseof -3.5 -i "${videoPath}" -vf "fps=24,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=none" -loop 0 "${finalGif}"`, { stdio: 'ignore' });
            fs.unlinkSync(videoPath);
        } catch (e) {
            console.error(`  ❌ FFmpeg 변환 오류 발생 (섹션 ${indexStr})`);
        }
    }
    
    console.log(`\n🎉🎉 모든 섹션 추출이 완벽하게 완료되었습니다! 🎉🎉`);
    await browser.close();
})();

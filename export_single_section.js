const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_URL = 'http://localhost:45678/wadiz1';
const sectionNumber = parseInt(process.argv[2], 10);

if (isNaN(sectionNumber)) {
    console.log('\x1b[31m=========================================\x1b[0m');
    console.log('\x1b[31m사용법: node export_single_section.js <원하는섹션번호>\x1b[0m');
    console.log('\x1b[31m예시: node export_single_section.js 42\x1b[0m');
    console.log('\x1b[31m=========================================\x1b[0m');
    process.exit(1);
}

const TMP_DIR = path.join(__dirname, 'export_final', 'tmp');
const GIFS_DIR = path.join(__dirname, 'export_final', 'gifs');
const VIDEOS_DIR = path.join(__dirname, 'export_final', 'videos');

[TMP_DIR, GIFS_DIR, VIDEOS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

(async () => {
    const browser = await chromium.launch({ headless: true });
    
    // 1단계: 해당 섹션의 정확한 높이 측정
    console.log(`\n📏 섹션 ${sectionNumber}번의 실제 높이를 측정 중입니다...`);
    const measureContext = await browser.newContext({ viewport: { width: 800, height: 1200 } });
    const measurePage = await measureContext.newPage();
    
    await measurePage.addStyleTag({ content: `
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
    
    await measurePage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await measurePage.waitForTimeout(2000); // 렌더링 대기
    
    const sections = await measurePage.$$('section');
    if (sectionNumber < 1 || sectionNumber > sections.length) {
        console.log(`\x1b[31m오류: 섹션 번호는 1부터 ${sections.length} 사이여야 합니다!\x1b[0m`);
        process.exit(1);
    }
    
    const currentSection = sections[sectionNumber - 1];
    const boundingBox = await currentSection.boundingBox();
    const sectionHeight = Math.ceil(boundingBox.height);
    await measureContext.close();
    
    console.log(`✅ 섹션 ${sectionNumber}번의 맞춤 사이즈 확인 완료: 800px x ${sectionHeight}px`);
    
    // 2단계: 여백 1픽셀도 없이 해당 섹션 크기에 정확히 맞춘 맞춤형 캠코더(Context) 생성
    console.log(`🎥 섹션 ${sectionNumber}번 전용 맞춤형 GIF/영상 녹화를 시작합니다...`);
    const recordContext = await browser.newContext({
        viewport: { width: 800, height: sectionHeight },
        recordVideo: { 
            dir: TMP_DIR,
            size: { width: 800, height: sectionHeight } // 비디오 해상도를 섹션 높이와 1:1로 강제 일치!
        },
        deviceScaleFactor: 2
    });
    
    const recordPage = await recordContext.newPage();
    await recordPage.addStyleTag({ content: `
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
    
    await recordPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await recordPage.waitForTimeout(2000);
    
    const recordSections = await recordPage.$$('section');
    const targetSection = recordSections[sectionNumber - 1];
    
    // 캡처 화면 상단과 섹션 상단을 정확히 0픽셀 오차로 맞춤 (여백 원천 차단)
    const yOffset = await targetSection.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
    await recordPage.evaluate((y) => window.scrollTo(0, y), yOffset);
    
    // 애니메이션이 자연스럽게 플레이되도록 3.5초 대기하며 녹화
    await recordPage.waitForTimeout(3500);
    
    const videoPath = await recordPage.video().path();
    await recordContext.close();
    
    const indexStr = String(sectionNumber).padStart(2, '0');
    const finalMp4 = path.join(VIDEOS_DIR, `section_${indexStr}_custom.mp4`);
    const finalGif = path.join(GIFS_DIR, `section_${indexStr}_custom.gif`);
    
    // FFmpeg를 통한 무손실 변환
    console.log(`🔄 최고 화질 MP4 및 GIF로 변환 중...`);
    execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -preset fast -crf 22 "${finalMp4}"`, { stdio: 'ignore' });
    execSync(`ffmpeg -y -i "${videoPath}" -vf "fps=15,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${finalGif}"`, { stdio: 'ignore' });
    
    fs.unlinkSync(videoPath); // 임시 파일 삭제
    
    console.log(`🎉 완벽합니다! 사이즈가 딱 맞는 여백 0% 파일이 생성되었습니다:`);
    console.log(`   -> ${finalMp4}`);
    console.log(`   -> ${finalGif}`);
    await browser.close();
})();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VIDEOS_DIR = path.join(__dirname, 'export_perfect', 'videos');
const GIFS_DIR = path.join(__dirname, 'export_perfect', 'gifs');

const files = fs.readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.mp4'));

console.log(`🚀 총 ${files.length}개의 MP4 영상을 최고 화질 GIF로 재변환합니다...`);

files.forEach((file, idx) => {
    const mp4Path = path.join(VIDEOS_DIR, file);
    const gifName = file.replace('.mp4', '.gif');
    const gifPath = path.join(GIFS_DIR, gifName);
    
    console.log(`[${String(idx+1).padStart(2, '0')}/${files.length}] ${gifName} 화질 업그레이드 중...`);
    
    // 최고 화질 GIF 변환 옵션:
    // 1. fps=24 : 15프레임에서 24프레임으로 올려 모션을 훨씬 부드럽게
    // 2. scale=800:-1:flags=lanczos : 최고급 리사이징 알고리즘(Lanczos) 적용하여 선명도 극대화
    // 3. dither=none : 웹페이지 UI(단색, 텍스트) 특성상 디더링(점박이 노이즈)을 아예 꺼버려서 화면을 가장 깨끗하게 만듦
    try {
        const cmd = `ffmpeg -y -i "${mp4Path}" -vf "fps=24,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=none" -loop 0 "${gifPath}"`;
        execSync(cmd, { stdio: 'ignore' });
    } catch (e) {
        console.error(`❌ 변환 실패: ${file}`);
    }
});

console.log(`\n🎉 모든 GIF의 화질 업그레이드가 완료되었습니다!`);

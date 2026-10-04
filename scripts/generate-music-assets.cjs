// Original Zeechei artwork. Regeneration only: requires ffmpeg and existing canvas dependency.
const { createCanvas } = require('@napi-rs/canvas');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const out = path.join(__dirname, '../assets/music');
mkdirSync(out, { recursive: true });
const work = mkdtempSync(path.join(tmpdir(), 'zeechei-art-'));
const purple = '#b9a5f7', pink = '#f49cc7';
function render(kind, frame, still = false) {
    const banner = kind === 'equalizer-banner';
    const w = banner ? 640 : 128, h = banner ? 112 : 128;
    const canvas = createCanvas(w, h), c = canvas.getContext('2d');
    const t = frame / 24 * Math.PI * 2;
    c.fillStyle = '#181322'; c.fillRect(0, 0, w, h);
    c.fillStyle = purple; c.strokeStyle = purple; c.lineWidth = 7; c.lineCap = 'round';
    if (kind === 'equalizer' || banner) {
        const n = banner ? 44 : 7, width = banner ? 8 : 9, gap = banner ? 5 : 6;
        const x0 = (w - n * (width + gap) + gap) / 2;
        for (let i = 0; i < n; i++) {
            const amplitude = still ? 7 : 10 + (h - 34) * (0.25 + 0.75 * Math.pow(Math.sin(t + i * 0.58), 2)) * (0.65 + 0.35 * Math.sin(i * 1.7) ** 2);
            const g = c.createLinearGradient(0, 10, 0, h - 10);g.addColorStop(0, pink);g.addColorStop(1, purple);c.fillStyle = g;
            c.beginPath();c.roundRect(x0 + i * (width + gap), (h - amplitude) / 2, width, amplitude, 4);c.fill();
        }
    } else {
        c.save(); c.translate(64, 64); const pulse = 1 + 0.06 * Math.sin(t); c.scale(pulse, pulse);
        if (kind === 'play') { c.beginPath();c.moveTo(-20,-32);c.lineTo(33,0);c.lineTo(-20,32);c.closePath();c.fill(); }
        if (kind === 'music') {
            c.beginPath();c.moveTo(-8,20);c.lineTo(-8,-26);c.lineTo(29,-34);c.lineTo(29,12);c.stroke();
            c.beginPath();c.ellipse(-19,23,14,10,-0.25,0,Math.PI*2);c.fill();
            c.beginPath();c.ellipse(18,15,14,10,-0.25,0,Math.PI*2);c.fill();
        }
        if (kind === 'heart') {
            c.fillStyle=pink;c.beginPath();c.moveTo(0,32);c.bezierCurveTo(-65,-8,-30,-48,0,-18);c.bezierCurveTo(30,-48,65,-8,0,32);c.fill();
        }
        if (kind === 'volume') {
            c.beginPath();c.moveTo(-33,-12);c.lineTo(-18,-12);c.lineTo(3,-30);c.lineTo(3,30);c.lineTo(-18,12);c.lineTo(-33,12);c.closePath();c.fill();
            for(let r=18;r<=38;r+=10){c.globalAlpha=0.4+0.6*(0.5+0.5*Math.sin(t-r/10));c.beginPath();c.arc(0,0,r,-0.75,0.75);c.stroke();}
        }
        if (kind === 'loading') {
            c.rotate(t);for(let i=0;i<9;i++){c.globalAlpha=(i+1)/9;c.rotate(Math.PI*2/9);c.beginPath();c.arc(33,0,5,0,Math.PI*2);c.fill();}
        }
        c.restore();
    }
    return canvas.toBuffer('image/png');
}
try {
    for (const kind of ['play','music','heart','volume','loading','equalizer','equalizer-banner']) {
        for(let f=0;f<24;f++) writeFileSync(path.join(work, `${String(f).padStart(2,'0')}.png`), render(kind,f));
        execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','12','-i',path.join(work,'%02d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer','-loop','0',path.join(out,`${kind}.gif`)]);
    }
    writeFileSync(path.join(out,'equalizer-paused.png'),render('equalizer-banner',0,true));
} finally { rmSync(work,{recursive:true,force:true}); }

(() => {
    'use strict';
    const SIZE = 1080;
    const font = 'Impact, Haettenschweiler, Arial Narrow, sans-serif';
    const bodyFont = 'Inter, system-ui, sans-serif';

    function hexAlpha(hex, alpha) {
        const clean = String(hex || '#000000').replace('#', '');
        const value = parseInt(clean.length === 3 ? clean.split('').map(x => x + x).join('') : clean, 16);
        return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
    }

    function text(ctx, value, x, y, width, size, color, align = 'left', weight = '900') {
        let current = size;
        ctx.font = `${weight} ${current}px ${font}`;
        while (ctx.measureText(String(value)).width > width && current > 16) {
            current -= 2;
            ctx.font = `${weight} ${current}px ${font}`;
        }
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(value || ''), x, y);
        return current;
    }

    function smallText(ctx, value, x, y, width, size, color, align = 'left') {
        let current = size;
        ctx.font = `800 ${current}px ${bodyFont}`;
        while (ctx.measureText(String(value)).width > width && current > 12) {
            current -= 1;
            ctx.font = `800 ${current}px ${bodyFont}`;
        }
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(value || ''), x, y);
    }

    function cover(ctx, image, x, y, width, height, transform = {}) {
        if (!image?.naturalWidth) return false;
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * (transform.scale || 1);
        const imageWidth = image.naturalWidth * scale, imageHeight = image.naturalHeight * scale;
        const offsetX = (transform.x || 0) / 100 * width;
        const offsetY = (transform.y || 0) / 100 * height;
        ctx.drawImage(image, x + (width - imageWidth) / 2 + offsetX, y + (height - imageHeight) / 2 + offsetY, imageWidth, imageHeight);
        return true;
    }

    function photoPanel(ctx, image, x, y, width, height, options, radius = 0) {
        ctx.save();
        ctx.beginPath();
        if (radius) ctx.roundRect(x, y, width, height, radius); else ctx.rect(x, y, width, height);
        ctx.clip();
        if (!cover(ctx, image, x, y, width, height, options.photoTransform)) {
            ctx.fillStyle = '#15243a';
            ctx.fillRect(x, y, width, height);
            text(ctx, 'ADD PLAYER PHOTO', x + width / 2, y + height / 2, width - 48, 38, '#ffffff', 'center');
        }
        const shade = ctx.createLinearGradient(x, y, x, y + height);
        shade.addColorStop(0, 'rgba(0,0,0,.02)');
        shade.addColorStop(.7, 'rgba(0,0,0,.04)');
        shade.addColorStop(1, 'rgba(0,0,0,.58)');
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
    }

    function pattern(ctx, colors, alpha = .12) {
        ctx.save();
        ctx.strokeStyle = hexAlpha(colors.accent, alpha);
        ctx.lineWidth = 3;
        for (let i = -1000; i < 1300; i += 42) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 550, SIZE);
            ctx.stroke();
        }
        ctx.restore();
    }

    function statRow(ctx, stats, x, y, width, colors, compact = false) {
        const visible = stats.slice(0, compact ? 3 : 4);
        const cell = width / Math.max(visible.length, 1);
        visible.forEach(([label, value], index) => {
            const left = x + cell * index;
            ctx.fillStyle = hexAlpha('#ffffff', .12);
            ctx.fillRect(left + 6, y, cell - 12, compact ? 124 : 142);
            text(ctx, value, left + cell / 2, y + (compact ? 65 : 75), cell - 20, compact ? 54 : 64, '#ffffff', 'center');
            smallText(ctx, label, left + cell / 2, y + (compact ? 100 : 117), cell - 20, 14, '#ffffff', 'center');
        });
    }

    function badge(ctx, label, x, y, colors) {
        const width = Math.min(360, Math.max(170, 36 + label.length * 18));
        ctx.fillStyle = hexAlpha(colors.accent, .95);
        ctx.beginPath();
        ctx.roundRect(x, y, width, 48, 24);
        ctx.fill();
        text(ctx, label.toUpperCase(), x + width / 2, y + 33, width - 32, 22, '#111827', 'center');
    }

    function note(ctx, value, x, y, width, color, align = 'left') {
        if (!value) return;
        const line = String(value).trim().replace(/\s+/g, ' ');
        smallText(ctx, line.length > 78 ? `${line.slice(0, 75).trim()}…` : line, x, y, width, 13, color, align);
    }

    function brand(ctx, data, colors, x = 64, y = 1020, align = 'left') {
        smallText(ctx, 'HOOPTRACK', x, y, 260, 24, '#ffffff', align);
        smallText(ctx, 'GAME PERFORMANCE', x, y + 28, 260, 12, hexAlpha('#ffffff', .8), align);
        smallText(ctx, data.league || data.season, x, y + 50, 260, 13, hexAlpha('#ffffff', .8), align);
        if (data.logo?.naturalWidth) {
            const logoX = align === 'right' ? x - 312 : x + 250;
            ctx.drawImage(data.logo, logoX, y - 36, 54, 54);
        }
    }

    function gameResult(ctx, data, x, y, width, colors, dark = false) {
        const ink = dark ? '#ffffff' : '#122033';
        const muted = dark ? hexAlpha('#ffffff', .72) : '#56677b';
        if (data.finalScore) {
            smallText(ctx, data.result || 'FINAL', x, y, width, 14, colors.accent);
            text(ctx, data.finalScore, x, y + 56, width, 48, ink);
            smallText(ctx, `${data.team} vs ${data.opponent}`, x, y + 84, width, 14, muted);
        } else {
            smallText(ctx, `VS ${data.opponent}`, x, y + 18, width, 16, muted);
        }
    }

    function bold(ctx, data, options) {
        const { colors, photo } = options;
        const background = ctx.createLinearGradient(0, 0, SIZE, SIZE);
        background.addColorStop(0, colors.primary);
        background.addColorStop(.58, '#091521');
        background.addColorStop(1, colors.secondary);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, SIZE, SIZE);
        pattern(ctx, colors, .18);
        text(ctx, data.jersey ? `#${data.jersey}` : 'HT', 72, 350, 520, 360, hexAlpha('#ffffff', .1));
        photoPanel(ctx, photo, 420, 62, 610, 780, options, 18);
        ctx.fillStyle = hexAlpha(colors.primary, .9);
        ctx.fillRect(0, 0, 540, 1080);
        smallText(ctx, data.team.toUpperCase(), 60, 92, 400, 18, colors.accent);
        text(ctx, data.player.toUpperCase(), 60, 180, 400, 76, '#ffffff');
        smallText(ctx, `${data.date} • ${data.league}`, 60, 212, 410, 15, hexAlpha('#ffffff', .8));
        text(ctx, data.points, 62, 386, 270, 160, '#ffffff');
        smallText(ctx, 'POINTS', 66, 420, 220, 20, colors.accent);
        gameResult(ctx, data, 66, 500, 360, colors, true);
        if (data.achievements[0]) badge(ctx, data.achievements[0], 62, 650, colors);
        note(ctx, data.notes, 66, 740, 350, hexAlpha('#ffffff', .78));
        statRow(ctx, data.stats, 50, 850, 980, colors);
        brand(ctx, data, colors);
    }

    function classic(ctx, data, options) {
        const { colors, photo } = options;
        ctx.fillStyle = '#f7f9fc';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = colors.primary;
        ctx.fillRect(0, 0, 1080, 22);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(0, 22, 1080, 10);
        photoPanel(ctx, photo, 64, 76, 580, 726, options, 18);
        ctx.fillStyle = colors.secondary;
        ctx.fillRect(674, 76, 342, 726);
        smallText(ctx, data.team.toUpperCase(), 714, 122, 260, 16, colors.accent);
        text(ctx, data.player.toUpperCase(), 714, 202, 266, 50, '#ffffff');
        text(ctx, data.jersey ? `#${data.jersey}` : '', 714, 316, 260, 86, colors.accent);
        text(ctx, data.points, 714, 480, 260, 120, '#ffffff');
        smallText(ctx, 'POINTS', 720, 512, 180, 18, colors.accent);
        gameResult(ctx, data, 714, 590, 250, colors, true);
        if (data.achievements[0]) badge(ctx, data.achievements[0], 694, 715, colors);
        note(ctx, data.notes, 714, 790, 250, hexAlpha('#ffffff', .78));
        ctx.fillStyle = colors.primary;
        ctx.fillRect(0, 842, 1080, 238);
        statRow(ctx, data.stats, 58, 872, 964, colors);
        brand(ctx, data, colors);
    }

    function spotlight(ctx, data, options) {
        const { colors, photo } = options;
        const background = ctx.createRadialGradient(540, 310, 10, 540, 450, 900);
        background.addColorStop(0, hexAlpha(colors.accent, .82));
        background.addColorStop(.36, colors.primary);
        background.addColorStop(1, '#050a12');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, SIZE, SIZE);
        pattern(ctx, colors, .1);
        ctx.shadowColor = hexAlpha(colors.accent, .78);
        ctx.shadowBlur = 52;
        photoPanel(ctx, photo, 138, 42, 804, 850, options, 30);
        ctx.shadowBlur = 0;
        const fade = ctx.createLinearGradient(0, 0, 0, SIZE);
        fade.addColorStop(.5, 'rgba(5,10,18,0)');
        fade.addColorStop(1, '#050a12');
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, SIZE, SIZE);
        text(ctx, data.player.toUpperCase(), 54, 844, 972, 84, '#ffffff', 'center');
        smallText(ctx, `${data.team} • ${data.date} • ${data.league}`, 540, 874, 850, 16, hexAlpha('#ffffff', .82), 'center');
        text(ctx, data.points, 80, 1000, 200, 92, '#ffffff');
        smallText(ctx, 'POINTS', 84, 1028, 180, 16, colors.accent);
        statRow(ctx, data.stats, 302, 914, 690, colors, true);
        if (data.achievements[0]) badge(ctx, data.achievements[0], 80, 620, colors);
        note(ctx, data.notes, 80, 700, 320, hexAlpha('#ffffff', .82));
        brand(ctx, data, colors, 1016, 962, 'right');
    }

    function minimal(ctx, data, options) {
        const { colors, photo } = options;
        ctx.fillStyle = '#fbfcfe';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = colors.primary;
        ctx.fillRect(0, 0, 1080, 294);
        photoPanel(ctx, photo, 588, 48, 420, 592, options, 18);
        smallText(ctx, data.team.toUpperCase(), 64, 82, 440, 18, colors.accent);
        text(ctx, data.player.toUpperCase(), 64, 166, 470, 70, '#ffffff');
        smallText(ctx, `${data.date} • ${data.league}`, 64, 198, 450, 15, hexAlpha('#ffffff', .82));
        text(ctx, data.points, 64, 430, 360, 150, colors.primary);
        smallText(ctx, 'POINTS', 72, 466, 220, 19, colors.accent);
        gameResult(ctx, data, 72, 542, 360, colors, false);
        if (data.achievements[0]) badge(ctx, data.achievements[0], 64, 690, colors);
        note(ctx, data.notes, 64, 786, 460, '#56677b');
        ctx.fillStyle = colors.secondary;
        ctx.fillRect(0, 826, 1080, 254);
        statRow(ctx, data.stats, 52, 856, 976, colors);
        brand(ctx, data, colors);
    }

    function render(canvas, data, options) {
        const ctx = canvas.getContext('2d');
        canvas.width = SIZE;
        canvas.height = SIZE;
        ctx.clearRect(0, 0, SIZE, SIZE);
        const safe = { ...options, colors: { primary: '#153a70', secondary: '#0b1f3a', accent: '#ff7a1a', ...options.colors } };
        ({ bold, classic, spotlight, minimal }[safe.template] || bold)(ctx, data, safe);
    }

    window.HoopTrackGraphicRenderer = { render, SIZE };
})();

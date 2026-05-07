// Generate minimal PNG icons for PWA
// Run: node scripts/generate-icons.js
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

function createPNG(size, bgColor, textColor) {
	const width = size;
	const height = size;

	// Create raw RGBA pixel data
	const pixels = Buffer.alloc(width * height * 4);

	const bg = parseColor(bgColor);
	const fg = parseColor(textColor);

	// Fill background
	for (let i = 0; i < width * height; i++) {
		pixels[i * 4] = bg[0];
		pixels[i * 4 + 1] = bg[1];
		pixels[i * 4 + 2] = bg[2];
		pixels[i * 4 + 3] = 255;
	}

	// Draw "R" letter (simple pixel font scaled to size)
	const letterR = [
		'XXXXX...',
		'XX..XX..',
		'XX..XX..',
		'XXXXX...',
		'XX.XX...',
		'XX..XX..',
		'XX...XX.',
	];

	const margin = Math.floor(size * 0.25);
	const drawArea = size - margin * 2;
	const cellW = Math.floor(drawArea / 8);
	const cellH = Math.floor(drawArea / 7);
	const offsetX = margin + Math.floor((drawArea - cellW * 8) / 2);
	const offsetY = margin + Math.floor((drawArea - cellH * 7) / 2);

	for (let row = 0; row < letterR.length; row++) {
		for (let col = 0; col < letterR[row].length; col++) {
			if (letterR[row][col] === 'X') {
				fillRect(pixels, width, height,
					offsetX + col * cellW, offsetY + row * cellH,
					cellW, cellH, fg);
			}
		}
	}

	// Add rounded corner mask (circular mask for maskable icon)
	const cx = width / 2;
	const cy = height / 2;
	const cornerRadius = Math.floor(size * 0.18);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// Check corners
			const inCorner = isInCornerZone(x, y, width, height, cornerRadius);
			if (inCorner) {
				const idx = (y * width + x) * 4;
				pixels[idx + 3] = 0; // Make transparent
			}
		}
	}

	return encodePNG(pixels, width, height);
}

function isInCornerZone(x, y, w, h, r) {
	const corners = [
		[r, r], [w - r - 1, r],
		[r, h - r - 1], [w - r - 1, h - r - 1]
	];
	for (const [cx, cy] of corners) {
		const inXZone = (cx <= r) ? (x < r) : (x > w - r - 1);
		const inYZone = (cy <= r) ? (y < r) : (y > h - r - 1);
		if (inXZone && inYZone) {
			const dx = x - cx;
			const dy = y - cy;
			if (dx * dx + dy * dy > r * r) return true;
		}
	}
	return false;
}

function fillRect(pixels, imgW, imgH, x, y, w, h, color) {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			const px = x + dx;
			const py = y + dy;
			if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
				const idx = (py * imgW + px) * 4;
				pixels[idx] = color[0];
				pixels[idx + 1] = color[1];
				pixels[idx + 2] = color[2];
			}
		}
	}
}

function parseColor(hex) {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16)
	];
}

function encodePNG(pixels, width, height) {
	// PNG file structure: signature + IHDR + IDAT + IEND

	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	// IHDR chunk
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type: RGBA
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter
	ihdr[12] = 0; // interlace
	const ihdrChunk = makeChunk('IHDR', ihdr);

	// IDAT chunk - raw pixel data with filter bytes
	const rawData = Buffer.alloc(height * (1 + width * 4));
	for (let y = 0; y < height; y++) {
		rawData[y * (1 + width * 4)] = 0; // filter: none
		pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
	}
	const compressed = deflateSync(rawData);
	const idatChunk = makeChunk('IDAT', compressed);

	// IEND chunk
	const iendChunk = makeChunk('IEND', Buffer.alloc(0));

	return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);

	const typeBytes = Buffer.from(type, 'ascii');
	const crcData = Buffer.concat([typeBytes, data]);

	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(crcData), 0);

	return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buf) {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc ^= buf[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const sizes = [192, 512];
for (const size of sizes) {
	const png = createPNG(size, '#1f2937', '#ffffff'); // gray-800 bg, white text
	writeFileSync(`static/icon-${size}.png`, png);
	console.log(`Created static/icon-${size}.png (${png.length} bytes)`);
}

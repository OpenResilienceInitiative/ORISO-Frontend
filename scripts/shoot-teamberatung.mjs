// Five screenshots of the Teamberatung channel for Frank's review sheet.
// Shoots the LIVE stories (play functions run in the iframe), so what lands
// in the PNG is the same wired stage the tests assert on.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SB_BASE || 'http://localhost:6017';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const shots = [
	{
		file: 'team-offen-1440.png',
		id: 'templates-teamcounsellingchannel--team-channel-open',
		width: 1440,
		height: 900
	},
	{
		file: 'team-und-thread-1440.png',
		id: 'templates-teamcounsellingchannel--team-open-while-thread-exists',
		width: 1440,
		height: 900
	},
	{
		file: 'kanalkarte-drei-1440.png',
		id: 'templates-teamcounsellingchannel--channel-card-with-three',
		width: 1440,
		height: 900
	},
	{
		file: 'team-390.png',
		id: 'templates-teamcounsellingchannel--team-on-phone',
		width: 390,
		height: 844
	},
	{
		file: 'team-dunkel.png',
		id: 'templates-teamcounsellingchannel--team-dark-scheme',
		width: 1440,
		height: 900,
		globals: 'scheme:dark'
	}
];

const browser = await chromium.launch();
for (const shot of shots) {
	const page = await browser.newPage({
		viewport: { width: shot.width, height: shot.height },
		deviceScaleFactor: 2
	});
	const url =
		`${BASE}/iframe.html?id=${shot.id}&viewMode=story` +
		(shot.globals ? `&globals=${encodeURIComponent(shot.globals)}` : '');
	await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
	// The stage mounts a real timeline and composer; wait for both, then let
	// the play function (channel card, FAB) settle.
	await page
		.waitForSelector('.messageItem', { timeout: 30_000 })
		.catch(() => {});
	await page.waitForTimeout(2500);
	await page.screenshot({ path: path.join(OUT, shot.file) });
	console.log(shot.file, '←', shot.id);
	await page.close();
}
await browser.close();

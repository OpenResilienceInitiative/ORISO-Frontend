import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.env.EVIDENCE_DIR;
if (!out) throw new Error('EVIDENCE_DIR is required');
await mkdir(out, { recursive: true });
const origin = process.env.STORYBOOK_ORIGIN || 'http://127.0.0.1:6033';
const locales = ['de', 'en', 'fr'];
const translations = Object.fromEntries(
	await Promise.all(
		locales.map(async (locale) => [
			locale,
			JSON.parse(
				await readFile(
					new URL(
						`../../../../src/resources/i18n/${locale}/common.json`,
						import.meta.url
					),
					'utf8'
				)
			)
		])
	)
);
const normalize = (text) => text?.replace(/\s+/g, ' ').trim();
const commit = '4e9f0b00dec34f64b0a1ce49f187054f6b7d51dd';
const viewports = [
	[390, 844],
	[820, 1180],
	[1440, 900],
	[320, 844],
	[412, 915],
	[899, 900],
	[900, 900],
	[1199, 900],
	[1200, 900]
];
const failures = [];
const results = [];
const luminance = (rgb) =>
	rgb
		.map((n) => n / 255)
		.map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
		.reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) =>
	(Math.max(luminance(a), luminance(b)) + 0.05) /
	(Math.min(luminance(a), luminance(b)) + 0.05);
const browser = await chromium.launch({ headless: true });
try {
	for (const locale of locales) {
		for (const surface of [
			'public',
			'login',
			'registration',
			'authenticated',
			'authenticated-waiting',
			'authenticated-waiting-calendar'
		]) {
			for (const [width, height] of viewports) {
				const context = await browser.newContext({
					viewport: { width, height },
					locale: { de: 'de-DE', en: 'en-GB', fr: 'fr-FR' }[locale],
					reducedMotion: 'reduce',
					deviceScaleFactor: 1
				});
				const page = await context.newPage();
				const errors = [];
				page.on('pageerror', (error) => errors.push(String(error)));
				try {
					await page.goto(
						`${origin}/iframe.html?id=login-build-identity--${surface}&viewMode=story&globals=locale:${locale}`,
						{ waitUntil: 'networkidle' }
					);
					const identity = page.getByTestId('build-identity');
					await identity.waitFor({
						state: 'attached',
						timeout: 60000
					});
					const expectedTranslations = translations[locale];
					if (surface !== 'authenticated') {
						await page.waitForFunction(
							(expected) =>
								document
									.querySelector('.stage__title')
									?.textContent.replace(/\s+/g, ' ')
									.trim() === expected,
							normalize(expectedTranslations.app.stage.title)
						);
					}
					await page.evaluate(() => document.fonts.ready);
					await page.evaluate(() =>
						window.scrollTo(
							0,
							document.documentElement.scrollHeight
						)
					);
					const measurement = await identity.evaluate((element) => {
						const rect = element.getBoundingClientRect().toJSON();
						const style = getComputedStyle(element);
						// Probe actual paint-order obstruction, including disabled buttons.
						// Pointer-events:none should not make painted text appear occluded.
						const hitTest = (node) => {
							const bounds = node.getBoundingClientRect();
							const previous =
								node.style.getPropertyValue('pointer-events');
							const priority =
								node.style.getPropertyPriority(
									'pointer-events'
								);
							node.style.setProperty(
								'pointer-events',
								'auto',
								'important'
							);
							try {
								// Keep button samples inside rounded corners; text samples reach its edges.
								const fractions =
									node.tagName === 'BUTTON'
										? [0.25, 0.5, 0.75]
										: [0.05, 0.5, 0.95];
								return fractions.flatMap((x) =>
									fractions.map((y) => {
										const hit = document.elementFromPoint(
											bounds.left + bounds.width * x,
											bounds.top + bounds.height * y
										);
										return {
											x,
											y,
											clear:
												hit === node ||
												node.contains(hit),
											hit:
												hit?.tagName +
												'.' +
												hit?.className
										};
									})
								);
							} finally {
								if (previous)
									node.style.setProperty(
										'pointer-events',
										previous,
										priority
									);
								else
									node.style.removeProperty('pointer-events');
							}
						};
						const controls = [
							...document.querySelectorAll(
								'[data-testid="group-entry-join"], [data-testid="group-entry-calendar"]'
							)
						].map((node) => ({
							testId: node.getAttribute('data-testid'),
							rect: node.getBoundingClientRect().toJSON(),
							visible: node.checkVisibility({
								checkOpacity: true,
								checkVisibilityCSS: true
							}),
							hits: hitTest(node)
						}));
						const legal = document.querySelector(
							'.stageLayout__legalLinks'
						);
						const legalButtons = [
							...(legal?.querySelectorAll(
								'button[data-cy-link]'
							) ?? [])
						];
						const templates = [
							'.sb-nopreview',
							'.sb-errordisplay',
							'.sb-preparing-docs',
							'.sb-argstableBlock'
						].map((selector) => {
							const template = document.querySelector(selector);
							return {
								selector,
								present: !!template,
								hidden:
									!!template &&
									!template.checkVisibility({
										checkOpacity: true,
										checkVisibilityCSS: true
									})
							};
						});
						const branding = [
							...document.querySelectorAll(
								'.stage__title, .stage__claim, .stage__logo, .stageMobileHero__brand, .stageMobileHero__headline, .stageMobileHero__claim'
							)
						]
							.filter((node) =>
								node.checkVisibility({
									checkOpacity: true,
									checkVisibilityCSS: true
								})
							)
							.map((node) => ({
								className: node.className,
								text: node.textContent.trim(),
								rect: node.getBoundingClientRect().toJSON()
							}))
							.filter(
								(node) =>
									node.rect.width > 0 && node.rect.height > 0
							);
						const title =
							document.querySelector(
								'.stage__title'
							)?.textContent;
						const fixed = document.querySelector(
							'[data-cy="registration-footer"]'
						);
						const content = document.querySelector(
							'.stageLayout__content'
						);
						return {
							hits: hitTest(element),
							controls,
							text: element.textContent,
							commit: element.getAttribute('data-build-commit'),
							release: element.getAttribute(
								'data-platform-version'
							),
							rect,
							branding,
							title,
							color: style.color,
							fontSize: style.fontSize,
							legalVisible:
								!!legal &&
								legal.getBoundingClientRect().height > 0,
							legalCount: legalButtons.length,
							legalButtons: legalButtons.map((button) => ({
								text: button.textContent.trim(),
								url: button.getAttribute('data-cy-link'),
								visible: button.checkVisibility({
									checkOpacity: true,
									checkVisibilityCSS: true
								})
							})),
							templates,
							fixed: fixed?.getBoundingClientRect().toJSON(),
							content: content?.getBoundingClientRect().toJSON(),
							pageWidth: document.documentElement.scrollWidth,
							onPrimary: style
								.getPropertyValue('--m3-on-primary')
								.trim(),
							onSurface: style
								.getPropertyValue('--m3-on-surface-variant')
								.trim()
						};
					});
					const checks = {
						unique: (await identity.count()) === 1,
						notOccluded: measurement.hits.every((hit) => hit.clear),
						waitingBarPresent:
							!surface.startsWith('authenticated-waiting') ||
							(measurement.fixed?.height > 0 &&
								measurement.controls.length ===
									(surface.endsWith('-calendar') ? 2 : 1) &&
								measurement.controls.filter(
									(control) =>
										control.testId === 'group-entry-join'
								).length === 1 &&
								(!surface.endsWith('-calendar') ||
									measurement.controls.filter(
										(control) =>
											control.testId ===
											'group-entry-calendar'
									).length === 1)),
						waitingControlsClear: measurement.controls.every(
							(control) =>
								control.visible &&
								control.rect.width > 0 &&
								control.rect.height > 0 &&
								control.hits.every((hit) => hit.clear) &&
								(measurement.rect.right <= control.rect.left ||
									measurement.rect.left >=
										control.rect.right ||
									measurement.rect.bottom <=
										control.rect.top ||
									measurement.rect.top >= control.rect.bottom)
						),
						identity:
							measurement.text === 'v2.0.6 - 4e9f0b0' &&
							measurement.commit === commit &&
							measurement.release === 'v2.0.6',
						visible:
							measurement.rect.width > 0 &&
							measurement.rect.height > 0,
						inViewport:
							measurement.rect.x >= 0 &&
							measurement.rect.right <= width &&
							measurement.rect.y >= 0 &&
							measurement.rect.bottom <= height,
						noHorizontalOverflow: measurement.pageWidth <= width,
						brandingPresent:
							surface === 'authenticated' ||
							measurement.branding.length > 0,
						brandingNonOverlap: measurement.branding.every(
							({ rect: brand }) =>
								measurement.rect.right <= brand.left ||
								measurement.rect.left >= brand.right ||
								measurement.rect.bottom <= brand.top ||
								measurement.rect.top >= brand.bottom
						),
						localeOracle:
							surface === 'authenticated' ||
							(normalize(measurement.title) ===
								normalize(
									expectedTranslations.app.stage.title
								) &&
								measurement.legalButtons.every(
									(button, index) =>
										normalize(button.text) ===
										normalize(
											expectedTranslations.login.legal
												.infoText[
												index === 0
													? 'dataprotection'
													: 'impressum'
											]
										)
								)),
						desktopContentSurface:
							surface === 'authenticated' ||
							width < 1200 ||
							measurement.rect.left >= width * 0.4,
						storybookTemplatesHidden: measurement.templates.every(
							(template) => template.present && template.hidden
						),
						legalButtonsPresent:
							surface === 'authenticated' ||
							(measurement.legalCount === 2 &&
								measurement.legalButtons.every(
									(button, index) =>
										button.text.length > 0 &&
										!button.text.startsWith(
											'login.legal.'
										) &&
										button.url ===
											`${origin}/__fixtures__/legal/${index === 0 ? 'privacy' : 'imprint'}`
								)),
						legalButtonsVisibility:
							surface === 'authenticated' ||
							measurement.legalButtons.every(
								(button) =>
									button.visible ===
									(width < 1200 &&
										(surface === 'login' || width >= 900))
							),
						legalChoicePreserved:
							surface === 'authenticated' ||
							measurement.legalVisible ===
								(width < 1200 &&
									(surface === 'login' || width >= 900)),
						buttonClearance:
							!measurement.fixed ||
							measurement.rect.bottom <= measurement.fixed.top,
						contentClearance:
							!measurement.content ||
							measurement.rect.top >= measurement.content.bottom,
						noPageErrors: errors.length === 0
					};
					const screenshot = await page.screenshot({
						path: path.join(
							out,
							`${locale}-${surface}-${width}.png`
						)
					});
					if (checks.visible && checks.inViewport) {
						const png = PNG.sync.read(screenshot);
						const fg = measurement.color
							.match(/[\d.]+/g)
							.slice(0, 3)
							.map(Number);
						const r = measurement.rect;
						measurement.samples = [
							[r.left - 2, r.top - 2],
							[r.right + 2, r.top - 2],
							[r.left - 2, r.bottom + 2],
							[r.right + 2, r.bottom + 2]
						].map(([x, y]) => {
							x = Math.max(0, Math.min(width - 1, Math.floor(x)));
							y = Math.max(
								0,
								Math.min(height - 1, Math.floor(y))
							);
							const at = (y * png.width + x) * 4;
							const rgb = [...png.data.slice(at, at + 3)];
							return { x, y, rgb, contrast: contrast(fg, rgb) };
						});
						checks.contrastAA = measurement.samples.every(
							(s) => s.contrast >= 4.5
						);
						const token = measurement.onSurface;
						const expected = token.startsWith('#')
							? token
									.slice(1)
									.match(/.{2}/g)
									.map((n) => parseInt(n, 16))
							: token
									.match(/[\d.]+/g)
									?.slice(0, 3)
									.map(Number);
						checks.semanticForeground =
							JSON.stringify(fg) === JSON.stringify(expected);
					}
					const failed = Object.entries(checks)
						.filter(([, pass]) => !pass)
						.map(([name]) => name);
					const result = {
						locale,
						surface,
						width,
						height,
						measurement,
						checks,
						errors,
						failed
					};
					results.push(result);
					console.log(JSON.stringify(result));
					if (failed.length)
						failures.push({ locale, surface, width, failed });
				} finally {
					await context.close();
				}
			}
		}
	}
} finally {
	await browser.close();
	await writeFile(
		path.join(out, 'measurements.json'),
		JSON.stringify({ results, failures }, null, 2)
	);
}
console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;

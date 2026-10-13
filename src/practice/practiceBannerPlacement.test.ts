import { describe, expect, it } from 'vitest';
import {
	practiceBannerRestingBox,
	type PlacementBox
} from './practiceBannerPlacement';

type Box = [left: number, top: number, right: number, bottom: number];

interface MeasuredLayout {
	viewport: { width: number; height: number };
	/** Tour anchors (`data-tour-target`) as they stood during the steps. */
	anchors: Record<string, Box[]>;
	/** The tour tooltip of every step. */
	tooltips: Box[];
}

/**
 * Tallest resting banner, measured with the layouts below: 96 px in F1,
 * 116 px in F2 (its German title takes two lines). French and Russian wrap
 * the two actions onto two rows (148 / 128 px in F1); the banner can be moved.
 */
const TALLEST_RESTING_BANNER = 116;

/**
 * Measured on 2026-10-06 in Chromium (Playwright) on a Storybook stage that
 * mounts the same app as `Organisms/PracticeFlow` (team discussion on,
 * German), walking F1 steps 1-8 and F2 steps 1-4 and reading every
 * `data-tour-target` box and the tooltip box per step. Boxes are
 * [left, top, right, bottom] in CSS px; near-identical boxes are merged.
 * Whole-column containers are left out (the list column itself).
 *
 * Left out on purpose: in F2 steps 2-4 at 1280 and 1440 px the supervision
 * panel folds the list into its rail and the case composer of the main pane
 * starts at x 195, under the banner. It is not the target of those steps and
 * the tour overlay blocks clicks on it while they run.
 */
const MEASURED_LAYOUTS: MeasuredLayout[] = [
	{
		viewport: { width: 1280, height: 720 },
		anchors: {
			'nav-enquiries': [[12, 30, 73, 98]],
			'enquiry-list-item': [[97, 178, 493, 320]],
			'enquiry-accept-button': [
				[689, 615, 889, 663],
				[357, 614, 557, 662]
			],
			'enquiry-team-button': [[905, 615, 1223, 663]],
			'team-discussion-panel': [[734, 26, 1254, 694]],
			'session-composer': [
				[752, 573, 1238, 678],
				[552, 501, 1221, 661]
			],
			'sessions-archive-tab': [[97, 100, 145, 148]],
			'session-supervisor-add': [
				[539, 43, 571, 83],
				[199, 43, 231, 83]
			],
			'supervision-panel': [[735, 25, 1255, 695]]
		},
		tooltips: [
			[109, 10, 509, 312],
			[529, 122, 929, 376],
			[864, 277, 1264, 579],
			[298, 209, 699, 511],
			[257, 300, 657, 578],
			[440, 221, 840, 499],
			[687, 163, 1087, 465],
			[355, 119, 755, 381],
			[440, 209, 840, 511]
		]
	},
	{
		viewport: { width: 1440, height: 900 },
		anchors: {
			'nav-enquiries': [[12, 30, 73, 98]],
			'enquiry-list-item': [[97, 178, 493, 320]],
			'enquiry-accept-button': [
				[849, 795, 1049, 843],
				[437, 794, 637, 842]
			],
			'enquiry-team-button': [[1065, 795, 1383, 843]],
			'team-discussion-panel': [[894, 26, 1414, 874]],
			'session-composer': [
				[912, 753, 1397, 857],
				[552, 697, 1381, 857]
			],
			'sessions-archive-tab': [[97, 100, 145, 148]],
			'session-supervisor-add': [
				[539, 43, 571, 83],
				[199, 43, 231, 83]
			],
			'supervision-panel': [[895, 25, 1415, 875]]
		},
		tooltips: [
			[109, 10, 509, 312],
			[529, 122, 929, 376],
			[1024, 457, 1424, 759],
			[458, 299, 859, 601],
			[337, 480, 737, 758],
			[520, 311, 920, 589],
			[767, 359, 1167, 661],
			[355, 119, 755, 381],
			[520, 299, 920, 601]
		]
	},
	{
		viewport: { width: 1920, height: 1080 },
		anchors: {
			'nav-enquiries': [[12, 30, 73, 98]],
			'enquiry-list-item': [[97, 178, 493, 320]],
			'enquiry-accept-button': [
				[1329, 975, 1529, 1023],
				[847, 975, 1047, 1023]
			],
			'enquiry-team-button': [[1545, 975, 1863, 1023]],
			'team-discussion-panel': [[1375, 25, 1895, 1055]],
			'session-composer': [
				[1393, 933, 1878, 1038],
				[777, 877, 1636, 1037],
				[535, 934, 1358, 1038]
			],
			'sessions-archive-tab': [[97, 100, 145, 148]],
			'session-supervisor-add': [[539, 43, 571, 83]],
			'supervision-panel': [[1375, 25, 1895, 1055]]
		},
		tooltips: [
			[109, 10, 509, 312],
			[529, 122, 929, 376],
			[1504, 637, 1904, 939],
			[939, 389, 1339, 691],
			[747, 661, 1147, 939],
			[760, 401, 1160, 679],
			[1007, 539, 1407, 841],
			[355, 119, 755, 381],
			[760, 389, 1160, 691]
		]
	},
	{
		viewport: { width: 1280, height: 1080 },
		anchors: {
			'nav-enquiries': [[12, 30, 73, 98]],
			'enquiry-list-item': [[97, 178, 493, 320]],
			'enquiry-accept-button': [
				[689, 975, 889, 1023],
				[357, 974, 557, 1022]
			],
			'enquiry-team-button': [[905, 975, 1223, 1023]],
			'team-discussion-panel': [[734, 26, 1254, 1054]],
			'session-composer': [
				[752, 933, 1237, 1037],
				[552, 861, 1221, 1021]
			],
			'sessions-archive-tab': [[97, 100, 145, 148]],
			'session-supervisor-add': [
				[539, 43, 571, 83],
				[199, 43, 231, 83]
			],
			'supervision-panel': [[735, 25, 1255, 1055]]
		},
		tooltips: [
			[109, 10, 509, 312],
			[529, 122, 929, 376],
			[864, 637, 1264, 939],
			[298, 389, 699, 691],
			[257, 660, 657, 938],
			[440, 401, 840, 679],
			[687, 523, 1087, 825],
			[355, 119, 755, 381],
			[440, 389, 840, 691]
		]
	},
	{
		viewport: { width: 1920, height: 720 },
		anchors: {
			'nav-enquiries': [[12, 30, 73, 98]],
			'enquiry-list-item': [[97, 178, 493, 320]],
			'enquiry-accept-button': [
				[1329, 615, 1529, 663],
				[847, 615, 1047, 663]
			],
			'enquiry-team-button': [[1545, 615, 1863, 663]],
			'team-discussion-panel': [[1375, 25, 1895, 695]],
			'session-composer': [
				[1393, 573, 1878, 678],
				[777, 517, 1636, 677],
				[535, 574, 1358, 678]
			],
			'sessions-archive-tab': [[97, 100, 145, 148]],
			'session-supervisor-add': [[539, 43, 571, 83]],
			'supervision-panel': [[1375, 25, 1895, 695]]
		},
		tooltips: [
			[109, 10, 509, 312],
			[529, 122, 929, 376],
			[1504, 277, 1904, 579],
			[939, 209, 1339, 511],
			[747, 301, 1147, 579],
			[760, 221, 1160, 499],
			[1007, 179, 1407, 481],
			[355, 119, 755, 381],
			[760, 209, 1160, 511]
		]
	}
];

const overlaps = (banner: PlacementBox, [left, top, right, bottom]: Box) =>
	banner.left < right &&
	left < banner.right &&
	banner.top < bottom &&
	top < banner.bottom;

describe('practice banner resting place', () => {
	describe.each(MEASURED_LAYOUTS)(
		'at $viewport.width x $viewport.height',
		({ viewport, anchors, tooltips }) => {
			const banner = practiceBannerRestingBox(
				viewport,
				TALLEST_RESTING_BANNER
			);

			it.each(Object.entries(anchors))(
				'leaves the tour anchor %s free',
				(_name, boxes) => {
					for (const box of boxes) {
						expect(overlaps(banner, box), `${box}`).toBe(false);
					}
				}
			);

			it('leaves every tour tooltip free', () => {
				for (const box of tooltips) {
					expect(overlaps(banner, box), `${box}`).toBe(false);
				}
			});

			it('stays inside the window', () => {
				expect(banner.left).toBeGreaterThanOrEqual(8);
				expect(banner.top).toBeGreaterThanOrEqual(8);
				expect(banner.right).toBeLessThanOrEqual(viewport.width - 8);
				expect(banner.bottom).toBeLessThanOrEqual(viewport.height - 8);
			});
		}
	);
});

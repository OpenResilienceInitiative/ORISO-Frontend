// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import {
	FALLBACK_GLYPH_COLOR,
	FAVICON_TILE_COLOR,
	buildSectionFaviconSvg,
	resolveGlyphColor,
	resolveSectionNavItem,
	toSvgDataUrl
} from './sectionFaviconSvg';
import { RouterConfigConsultant, RouterConfigUser } from '../RouterConfig';
import {
	NavChatsIconFilled,
	NavActivityIconFilled
} from '../navigationSidebarIcons';
import { ReactComponent as CalendarIconFilled } from '../../../resources/img/icons/calendar_filled.svg';
import { ReactComponent as ProfileIconFilled } from '../../../resources/img/icons/profil_filled.svg';
import { ReactComponent as ToolsIconFilled } from '../../../resources/img/icons/tools_filled.svg';
import { ReactComponent as NavCounsellorRequestIconFilled } from '../../../resources/img/icons/navigation/counsellor_request_filled.svg';

const settings = { useOverviewPage: false } as any;
const consultantNavigation = RouterConfigConsultant(settings).navigation;
const askerNavigation = RouterConfigUser(settings, true).navigation;

describe('resolveSectionNavItem: route → the nav icon the rail shows', () => {
	it.each([
		['/booking/events', CalendarIconFilled],
		['/booking/events/upcoming', CalendarIconFilled],
		['/sessions/consultant/sessionView', NavChatsIconFilled],
		['/sessions/consultant/sessionView/12/345', NavChatsIconFilled],
		[
			'/sessions/consultant/sessionPreview/7/89',
			NavCounsellorRequestIconFilled
		],
		['/notifications', NavActivityIconFilled],
		['/profile/einstellungen', ProfileIconFilled]
	])('counsellor: %s uses the filled rail icon', (pathname, expectedIcon) => {
		const item = resolveSectionNavItem(pathname, consultantNavigation);
		expect(item?.iconFilled ?? item?.icon).toBe(expectedIcon);
	});

	it.each([
		['/sessions/user/view/3/4', NavChatsIconFilled],
		['/notifications', NavActivityIconFilled],
		['/profile', ProfileIconFilled],
		['/booking/events', CalendarIconFilled],
		['/tools', ToolsIconFilled]
	])('asker: %s uses the filled rail icon', (pathname, expectedIcon) => {
		const item = resolveSectionNavItem(pathname, askerNavigation);
		expect(item?.iconFilled ?? item?.icon).toBe(expectedIcon);
	});

	it.each(['/', '/login', '/drafts', '/profileX', '/bookingevents'])(
		'%s has no section, so the default favicon stays',
		(pathname) => {
			expect(
				resolveSectionNavItem(pathname, consultantNavigation)
			).toBeNull();
		}
	);

	it('prefers the most specific entry when two prefixes match', () => {
		const A = () => null;
		const B = () => null;
		const item = resolveSectionNavItem('/a/b/c', [
			{ to: '/a', icon: A },
			{ to: '/a/b', icon: B }
		]);
		expect(item?.icon).toBe(B);
	});

	it('copes with a missing navigation list', () => {
		expect(resolveSectionNavItem('/profile', undefined)).toBeNull();
	});
});

describe('resolveGlyphColor: the tenant primary colour', () => {
	it.each(['#d1002e', '#ABC', 'rgb(204, 0, 0)', 'hsl(350, 100%, 41%)'])(
		'keeps the valid colour %s',
		(color) => {
			expect(resolveGlyphColor(color)).toBe(color);
		}
	);

	it.each([undefined, null, '', 'red"><script>', 'url(x)', '#12'])(
		'falls back for %s',
		(color) => {
			expect(resolveGlyphColor(color as any)).toBe(FALLBACK_GLYPH_COLOR);
		}
	);
});

describe('buildSectionFaviconSvg', () => {
	const parse = (svg: string) =>
		new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;

	it('draws the glyph on a dark rounded tile in the tenant colour', () => {
		const root = parse(
			buildSectionFaviconSvg(CalendarIconFilled, '#d1002e')
		);
		expect(root.nodeName).toBe('svg');
		expect(root.getAttribute('viewBox')).toBe('0 0 64 64');

		const tile = root.querySelector('rect')!;
		expect(tile.getAttribute('fill')).toBe(FAVICON_TILE_COLOR);
		expect(Number(tile.getAttribute('rx'))).toBeGreaterThan(0);

		const glyph = root.querySelector('g')!;
		expect(glyph.getAttribute('fill')).toBe('#d1002e');
		expect(glyph.getAttribute('color')).toBe('#d1002e');
		// Unit tests stub file SVGs as an empty <svg>; the real glyph paths are
		// checked in SectionFavicon.stories.tsx.
		const inner = glyph.querySelector('svg')!;
		expect(inner.getAttribute('x')).toBe('12');
		expect(inner.getAttribute('width')).toBe('40');
	});

	it('paints currentColor glyphs (inline nav icons) in the tenant colour too', () => {
		const root = parse(
			buildSectionFaviconSvg(NavChatsIconFilled, '#d1002e')
		);
		const inner = root.querySelector('g svg')!;
		expect(root.querySelector('g')!.getAttribute('color')).toBe('#d1002e');
		expect(inner.getAttribute('width')).toBe('40');
		expect(inner.getAttribute('viewBox')).toBe('0 0 27 27');
		expect(inner.querySelector('path')!.getAttribute('fill')).toBe(
			'currentColor'
		);
	});

	it('never lets an invalid colour into the markup', () => {
		const svg = buildSectionFaviconSvg(CalendarIconFilled, '"/><x');
		expect(svg).not.toContain('"/><x');
		expect(svg).toContain(FALLBACK_GLYPH_COLOR);
	});

	it('produces an svg data URL', () => {
		const url = toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"/>');
		expect(url.startsWith('data:image/svg+xml,')).toBe(true);
		expect(
			decodeURIComponent(url.slice('data:image/svg+xml,'.length))
		).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
	});
});

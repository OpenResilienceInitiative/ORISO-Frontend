// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import {
	FAVICON_GLYPH_TOKEN,
	FAVICON_TILE_TOKEN,
	buildSectionFaviconSvg,
	plainColor,
	readFaviconColors,
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

// Test inputs only: the production code reads these from the design tokens.
const CARITAS = { tile: '#a5000a', glyph: '#ffffff' };

describe('plainColor', () => {
	it.each([
		'#d1002e',
		'#ABC',
		'rgb(204, 0, 0)',
		'hsl(350, 100%, 41%)',
		'white'
	])('keeps the plain colour %s', (color) => {
		expect(plainColor(color)).toBe(color);
	});

	it.each([
		undefined,
		null,
		'',
		'red"><script>',
		'url(x)',
		'#12',
		'var(--x)'
	])('rejects %s', (color) => {
		expect(plainColor(color as any)).toBeNull();
	});
});

describe('readFaviconColors: primary tile, on-primary glyph from the tokens', () => {
	it('reads both tokens from the element the palette is applied to', () => {
		const root = document.createElement('div');
		root.style.setProperty(FAVICON_TILE_TOKEN, '#1c4f8f');
		root.style.setProperty(FAVICON_GLYPH_TOKEN, '#ffffff');
		expect(FAVICON_TILE_TOKEN).toBe('--m3-primary');
		expect(FAVICON_GLYPH_TOKEN).toBe('--m3-on-primary');
		expect(readFaviconColors(root)).toEqual({
			tile: '#1c4f8f',
			glyph: '#ffffff'
		});
	});

	it('returns null when a token is missing or not a plain colour', () => {
		const root = document.createElement('div');
		root.style.setProperty(FAVICON_TILE_TOKEN, '#1c4f8f');
		expect(readFaviconColors(root)).toBeNull();
		root.style.setProperty(FAVICON_GLYPH_TOKEN, 'url(x)');
		expect(readFaviconColors(root)).toBeNull();
	});
});

describe('buildSectionFaviconSvg', () => {
	const parse = (svg: string) =>
		new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;

	it('draws the on-primary glyph on a rounded primary tile', () => {
		const root = parse(buildSectionFaviconSvg(CalendarIconFilled, CARITAS));
		expect(root.nodeName).toBe('svg');
		expect(root.getAttribute('viewBox')).toBe('0 0 64 64');

		const tile = root.querySelector('rect')!;
		expect(tile.getAttribute('fill')).toBe('#a5000a');
		expect(Number(tile.getAttribute('rx'))).toBeGreaterThan(0);

		const glyph = root.querySelector('g')!;
		expect(glyph.getAttribute('fill')).toBe('#ffffff');
		expect(glyph.getAttribute('color')).toBe('#ffffff');
		// Unit tests stub file SVGs as an empty <svg>; the real glyph paths are
		// checked in SectionFavicon.stories.tsx.
		const inner = glyph.querySelector('svg')!;
		expect(inner.getAttribute('x')).toBe('12');
		expect(inner.getAttribute('width')).toBe('40');
	});

	it('paints currentColor glyphs (inline nav icons) in on-primary too', () => {
		const root = parse(buildSectionFaviconSvg(NavChatsIconFilled, CARITAS));
		const inner = root.querySelector('g svg')!;
		expect(root.querySelector('g')!.getAttribute('color')).toBe('#ffffff');
		expect(inner.getAttribute('width')).toBe('40');
		expect(inner.getAttribute('viewBox')).toBe('0 0 27 27');
		expect(inner.querySelector('path')!.getAttribute('fill')).toBe(
			'currentColor'
		);
	});

	it('recolours glyphs whose file hard-codes a fill, like the rail does', () => {
		const Grey = () => (
			<svg viewBox="0 0 32 32" fill="none">
				<path d="M0 0h1" fill="#4C555F" />
			</svg>
		);
		const svg = buildSectionFaviconSvg(Grey, CARITAS);
		expect(svg).toContain(
			'<style>.glyph [fill]:not([fill="none"]){fill:#ffffff}</style>'
		);
		expect(parse(svg).querySelector('g')!.getAttribute('class')).toBe(
			'glyph'
		);
	});

	it('crops to the measured ink and fits tight at tab size, lines untouched', () => {
		const box = { x: 3, y: 2, width: 18, height: 20 };
		const tab = parse(
			buildSectionFaviconSvg(CalendarIconFilled, CARITAS, {
				fit: 'tab',
				box
			})
		);
		const inner = tab.querySelector('g svg')!;
		expect(inner.getAttribute('width')).toBe('46');
		expect(inner.getAttribute('x')).toBe('9');
		expect(inner.getAttribute('viewBox')).toBe('3 2 18 20');
		expect(inner.hasAttribute('stroke-width')).toBe(false);
		expect(tab.querySelector('style')!.textContent).not.toContain('stroke');
	});

	it('leaves more air in the large preview', () => {
		const box = { x: 3, y: 2, width: 18, height: 20 };
		const large = parse(
			buildSectionFaviconSvg(CalendarIconFilled, CARITAS, {
				fit: 'large',
				box
			})
		);
		const inner = large.querySelector('g svg')!;
		expect(inner.getAttribute('width')).toBe('38');
		expect(inner.getAttribute('viewBox')).toBe('3 2 18 20');
		expect(inner.hasAttribute('stroke-width')).toBe(false);
		expect(large.querySelector('style')!.textContent).not.toContain(
			'stroke'
		);
	});

	it('never lets an invalid colour into the markup', () => {
		expect(() =>
			buildSectionFaviconSvg(CalendarIconFilled, {
				tile: '"/><x',
				glyph: '#fff'
			})
		).toThrow();
	});

	it('produces an svg data URL', () => {
		const url = toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"/>');
		expect(url.startsWith('data:image/svg+xml,')).toBe(true);
		expect(
			decodeURIComponent(url.slice('data:image/svg+xml,'.length))
		).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
	});
});

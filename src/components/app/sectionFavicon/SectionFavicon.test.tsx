// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { SectionFavicon } from './SectionFavicon';
import { THEME_APPLIED_EVENT } from '../../../utils/theme/themeEvents';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { NavChatsIconFilled } from '../navigationSidebarIcons';

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
	lng: 'de',
	initImmediate: false,
	resources: {
		de: {
			translation: {
				navigation: {
					myProfile: 'Mein Profil',
					consultant: { sessions: { nav: 'Gespräch' } }
				}
			}
		},
		en: {
			translation: {
				navigation: {
					myProfile: 'My profile',
					consultant: { sessions: { nav: 'Chats' } }
				}
			}
		}
	}
});

const Profile = () => (
	<svg viewBox="0 0 24 24">
		<path d="M0 0h1" />
	</svg>
);
const navigation = [
	{
		to: '/sessions/consultant/sessionView',
		iconFilled: NavChatsIconFilled,
		titleKeys: { large: 'navigation.consultant.sessions.nav' }
	},
	{
		to: '/profile',
		icon: Profile,
		titleKeys: { large: 'navigation.myProfile' }
	}
];

let go: (to: string) => void = () => {};
const Navigator = () => {
	const navigate = useNavigate();
	go = (to) => navigate(to);
	return null;
};

const iconHrefs = () =>
	Array.from(
		document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")
	).map((l) => l.getAttribute('href') ?? '');

const svgOf = (href: string) =>
	decodeURIComponent(href.slice('data:image/svg+xml,'.length));

const setTokens = (primary: string | null, onPrimary: string | null) => {
	const style = document.documentElement.style;
	if (primary) style.setProperty('--m3-primary', primary);
	else style.removeProperty('--m3-primary');
	if (onPrimary) style.setProperty('--m3-on-primary', onPrimary);
	else style.removeProperty('--m3-on-primary');
};

describe('SectionFavicon', () => {
	let container: HTMLDivElement;
	let root: Root;

	const render = (path: string) =>
		act(() => {
			root.render(
				<TenantContext.Provider
					value={
						{
							tenant: { theming: {} } as any,
							setTenant: () => {},
							updateTenantSettings: () => {}
						} as any
					}
				>
					<I18nextProvider i18n={i18n}>
						<MemoryRouter initialEntries={[path]}>
							<Navigator />
							<SectionFavicon navigation={navigation} />
						</MemoryRouter>
					</I18nextProvider>
				</TenantContext.Provider>
			);
		});

	beforeEach(() => {
		// jsdom has no canvas: the PNG fallback is skipped (covered in Storybook).
		HTMLCanvasElement.prototype.getContext = (() => null) as any;
		// The compiled token defaults, as the stylesheet would provide them.
		setTokens('#a5000a', '#ffffff');
		document.head.innerHTML =
			'<title>caritas-berlin</title><link rel="icon" href="/favicon.ico" />';
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
	});
	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		document.documentElement.removeAttribute('style');
	});

	it('shows the section icon in the primary/on-primary tokens and follows route changes', () => {
		render('/sessions/consultant/sessionView/1/2');
		const [chats] = iconHrefs();
		expect(chats.startsWith('data:image/svg+xml,')).toBe(true);
		expect(svgOf(chats)).toContain('fill="#a5000a"/>');
		expect(svgOf(chats)).toContain('color="#ffffff"');
		expect(svgOf(chats)).toContain('viewBox="0 0 27 27"');

		act(() => go('/profile'));
		const [profile] = iconHrefs();
		expect(profile).not.toBe(chats);
		expect(svgOf(profile)).toContain('viewBox="0 0 24 24"');
	});

	it('keeps the default favicon and title on routes without a section', () => {
		render('/drafts');
		expect(iconHrefs()).toEqual(['/favicon.ico']);
		expect(document.title).toBe('caritas-berlin');
	});

	it('titles the tab with only the section name, in the active language', async () => {
		render('/profile');
		expect(document.title).toBe('Mein Profil');
		expect(document.title).not.toContain('caritas');

		await act(() => i18n.changeLanguage('en'));
		expect(document.title).toBe('My profile');
		await act(() => i18n.changeLanguage('de'));
		expect(document.title).toBe('Mein Profil');

		act(() => go('/drafts'));
		expect(document.title).toBe('caritas-berlin');
	});

	it('returns to the default favicon and title on leaving a section and on unmount', () => {
		render('/profile');
		expect(iconHrefs()[0]).not.toBe('/favicon.ico');
		act(() => go('/drafts'));
		expect(iconHrefs()).toEqual(['/favicon.ico']);
		act(() => go('/profile'));
		act(() => root.unmount());
		expect(iconHrefs()).toEqual(['/favicon.ico']);
		expect(document.title).toBe('caritas-berlin');
		root = createRoot(container);
	});

	it('redraws when a Träger palette lands (theme-applied event)', () => {
		render('/profile');
		expect(svgOf(iconHrefs()[0])).toContain('fill="#a5000a"/>');

		setTokens('#1c4f8f', '#fefefe');
		act(() => {
			window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
		});
		const svg = svgOf(iconHrefs()[0]);
		expect(svg).toContain('fill="#1c4f8f"/>');
		expect(svg).toContain('color="#fefefe"');
	});

	it('keeps the default favicon when the tokens are missing, but still titles the tab', () => {
		setTokens(null, null);
		render('/profile');
		expect(iconHrefs()).toEqual(['/favicon.ico']);
		expect(document.title).toBe('Mein Profil');
	});
});

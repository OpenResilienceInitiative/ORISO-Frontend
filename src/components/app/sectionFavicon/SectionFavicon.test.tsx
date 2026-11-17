// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { SectionFavicon } from './SectionFavicon';
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

describe('SectionFavicon', () => {
	let container: HTMLDivElement;
	let root: Root;

	const render = (path: string, primaryColor = '#cc1e1c') =>
		act(() => {
			root.render(
				<TenantContext.Provider
					value={
						{
							tenant: { theming: { primaryColor } } as any,
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
		document.head.innerHTML =
			'<title>caritas-berlin</title><link rel="icon" href="/favicon.ico" />';
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
	});
	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('shows the section icon in the tenant colour and follows route changes', () => {
		render('/sessions/consultant/sessionView/1/2');
		const [chats] = iconHrefs();
		expect(chats.startsWith('data:image/svg+xml,')).toBe(true);
		expect(svgOf(chats)).toContain('color="#cc1e1c"');
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

	it('redraws when the tenant colour arrives later', () => {
		render('/profile', '#1c4f8f');
		expect(svgOf(iconHrefs()[0])).toContain('#1c4f8f');
		render('/profile', '#a5000a');
		expect(svgOf(iconHrefs()[0])).toContain('#a5000a');
	});
});

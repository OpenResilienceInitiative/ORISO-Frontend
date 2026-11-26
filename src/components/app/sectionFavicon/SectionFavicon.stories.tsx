import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useLocation, useNavigate } from 'react-router-dom';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { SectionFavicon } from './SectionFavicon';
import i18n from '../../../i18n';
import { RouterConfigConsultant, RouterConfigUser } from '../RouterConfig';
import { applyTenantPalette } from '../../../utils/theme/applyTenantTheme';
import {
	FAVICON_GLYPH_TOKEN,
	FAVICON_TILE_TOKEN,
	buildSectionFaviconSvg,
	measureGlyphBox,
	readFaviconColors,
	sectionIconOf,
	svgToPngDataUrl,
	toSvgDataUrl,
	type FaviconColors,
	type SectionNavItem
} from './sectionFaviconSvg';

/**
 * Every section's browser tab icon: the glyph the navigation rail shows for
 * that section, in the `on-primary` token on a rounded `primary` tile. The
 * colours come from the real token engine: each Träger's seed runs through
 * `applyTenantPalette` on its own wrapper, and the icon reads the tokens back.
 * Shown at tile size and at the 32 px / 16 px sizes a tab strip uses, plus the
 * PNG fallback older Safari takes.
 */

const settings = { useOverviewPage: true } as any;
const SECTIONS: Record<'consultant' | 'asker', SectionNavItem[]> = {
	consultant: RouterConfigConsultant(settings).navigation,
	asker: RouterConfigUser(settings, true).navigation
};

/** Two Träger seeds (story data): Caritas red and a blue Träger. */
const TRAEGER = {
	caritas: { name: 'Caritas', primaryColor: '#a5000a' },
	blue: { name: 'Blue Träger', primaryColor: '#1c4f8f' }
};

const label = (item: SectionNavItem) =>
	i18n.t((item.titleKeys as { large: string }).large);

const IconRow = ({
	item,
	colors
}: {
	item: SectionNavItem;
	colors: FaviconColors;
}) => {
	const Icon = sectionIconOf(item)!;
	const box = measureGlyphBox(Icon);
	// The real tab icon (tight fit) and the roomier large preview.
	const svg = buildSectionFaviconSvg(Icon, colors, { fit: 'tab', box });
	const href = toSvgDataUrl(svg);
	const largeHref = toSvgDataUrl(
		buildSectionFaviconSvg(Icon, colors, { fit: 'large', box })
	);
	const [png, setPng] = React.useState<string | null>(null);
	React.useEffect(() => {
		let current = true;
		svgToPngDataUrl(svg).then((url) => current && setPng(url));
		return () => {
			current = false;
		};
	}, [svg]);

	return (
		<li
			data-testid="section-favicon"
			data-route={item.to}
			data-svg={svg}
			style={{ display: 'contents' }}
		>
			<span style={{ fontWeight: 600 }}>{label(item)}</span>
			<img
				src={largeHref}
				width={64}
				height={64}
				alt={`${label(item)} 64`}
			/>
			<img src={href} width={32} height={32} alt={`${label(item)} 32`} />
			<img src={href} width={16} height={16} alt={`${label(item)} 16`} />
			{png ? (
				<img
					src={png}
					width={32}
					height={32}
					alt={`${label(item)} PNG`}
					data-testid="section-favicon-png"
				/>
			) : (
				<span />
			)}
			<span
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 8,
					padding: '6px 12px',
					borderRadius: '8px 8px 0 0',
					background: '#dfe1e5',
					font: '12px system-ui, sans-serif',
					width: 170
				}}
			>
				<img src={href} width={16} height={16} alt="" />
				{label(item)}
			</span>
		</li>
	);
};

/** One Träger: its palette on a wrapper, the icons read their colours from it. */
const TraegerGallery = ({
	role,
	traeger
}: {
	role: 'consultant' | 'asker';
	traeger: { name: string; primaryColor: string };
}) => {
	const ref = React.useRef<HTMLElement>(null);
	const [colors, setColors] = React.useState<FaviconColors | null>(null);
	React.useLayoutEffect(() => {
		if (!ref.current) return;
		applyTenantPalette({ primaryColor: traeger.primaryColor }, ref.current);
		setColors(readFaviconColors(ref.current));
	}, [traeger.primaryColor]);

	return (
		<section
			ref={ref}
			data-testid="traeger-gallery"
			data-traeger={traeger.name}
			style={{ padding: 16, font: '14px system-ui, sans-serif' }}
		>
			<h3 style={{ margin: '0 0 12px' }}>{traeger.name}</h3>
			<ul
				style={{
					listStyle: 'none',
					margin: 0,
					padding: 0,
					display: 'grid',
					gridTemplateColumns: 'repeat(6, max-content)',
					alignItems: 'center',
					gap: '12px 16px'
				}}
			>
				{colors &&
					SECTIONS[role]
						.filter((item) => item?.to && sectionIconOf(item))
						.map((item) => (
							<IconRow
								key={item.to}
								item={item}
								colors={colors}
							/>
						))}
			</ul>
		</section>
	);
};

const Gallery = ({
	role,
	traeger
}: {
	role: 'consultant' | 'asker';
	traeger: Array<keyof typeof TRAEGER>;
}) => (
	<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
		{traeger.map((key) => (
			<TraegerGallery key={key} role={role} traeger={TRAEGER[key]} />
		))}
	</div>
);

const meta: Meta<typeof Gallery> = {
	title: 'Components/Layout/SectionFavicon',
	component: Gallery,
	args: { role: 'consultant', traeger: ['caritas'] },
	argTypes: {
		role: { control: 'inline-radio', options: ['consultant', 'asker'] },
		traeger: { control: 'check', options: Object.keys(TRAEGER) }
	}
};
export default meta;
type Story = StoryObj<typeof Gallery>;

/** Every row draws the real nav glyph in that Träger's tokens. */
const expectEveryIconDrawn = async (
	canvasElement: HTMLElement,
	routes: string[]
) => {
	const galleries =
		await within(canvasElement).findAllByTestId('traeger-gallery');
	for (const gallery of galleries) {
		const tile = getComputedStyle(gallery)
			.getPropertyValue(FAVICON_TILE_TOKEN)
			.trim();
		const glyph = getComputedStyle(gallery)
			.getPropertyValue(FAVICON_GLYPH_TOKEN)
			.trim();
		await expect(tile).not.toBe('');
		await expect(glyph).not.toBe('');
		const rows = await within(gallery).findAllByTestId('section-favicon');
		await expect(rows.map((row) => row.dataset.route)).toEqual(routes);
		for (const row of rows) {
			const svg = row.dataset.svg ?? '';
			await expect(svg).toContain('<path');
			await expect(svg).toContain(`fill="${tile}"/>`);
			await expect(svg).toContain(`color="${glyph}"`);
		}
	}
	return galleries;
};

const COUNSELLOR_ROUTES = [
	'/overview',
	'/sessions/consultant/sessionPreview',
	'/sessions/consultant/sessionView',
	'/notifications',
	// #2328: "Meine Termine" comes before "Mein Profil" for counsellors.
	'/booking/events',
	'/profile'
];

export const Counsellor: Story = {
	play: async ({ canvasElement }) => {
		await expectEveryIconDrawn(canvasElement, COUNSELLOR_ROUTES);
	}
};

export const Asker: Story = {
	args: { role: 'asker' },
	play: async ({ canvasElement }) => {
		await expectEveryIconDrawn(canvasElement, [
			'/sessions/user/view',
			'/notifications',
			'/profile',
			'/booking/events',
			'/tools'
		]);
	}
};

/**
 * Two Träger with their own colours: the same sections, each in its own
 * primary / on-primary tokens.
 */
export const TwoTraeger: Story = {
	args: { traeger: ['caritas', 'blue'] },
	play: async ({ canvasElement }) => {
		const galleries = await expectEveryIconDrawn(
			canvasElement,
			COUNSELLOR_ROUTES
		);
		await expect(galleries).toHaveLength(2);
		const tiles = galleries.map((gallery) =>
			getComputedStyle(gallery)
				.getPropertyValue(FAVICON_TILE_TOKEN)
				.trim()
		);
		await expect(tiles[0]).not.toBe(tiles[1]);
	}
};

const tabIconHref = () =>
	document
		.querySelector<HTMLLinkElement>(
			"link[rel~='icon']:not([data-section-icon-png])"
		)
		?.getAttribute('href') ?? '';

const LiveControls = ({ role }: { role: 'consultant' | 'asker' }) => {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	return (
		<div style={{ padding: 16, font: '14px system-ui, sans-serif' }}>
			<p>
				This page's own browser tab icon follows the section below. Open
				the story on its own (iframe) to see it in the tab strip.
			</p>
			<p>
				Route: <code data-testid="live-route">{pathname}</code>
			</p>
			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				{SECTIONS[role]
					.filter((item) => item?.to)
					.map((item) => (
						<button
							key={item.to}
							type="button"
							onClick={() => navigate(item.to!)}
						>
							{label(item)}
						</button>
					))}
				<button type="button" onClick={() => navigate('/drafts')}>
					No section (/drafts)
				</button>
			</div>
		</div>
	);
};

/**
 * The real component on a router: switch sections and the tab icon changes;
 * a route without a section restores the default favicon. It starts on the
 * calendar section (`parameters.router.initialPath`).
 */
/** The default icon link `src/pages/app.html` declares (Storybook serves `public/`). */
const withAppDefaultIcon = (Story: React.ComponentType) => {
	if (
		!document.querySelector(
			"link[rel~='icon'][href$='/favicon.ico'], link[data-section-icon]"
		)
	) {
		document
			.querySelectorAll("link[rel~='icon']")
			.forEach((link) => link.remove());
		const link = document.createElement('link');
		link.setAttribute('rel', 'icon');
		link.setAttribute('href', '/favicon.ico');
		document.head.appendChild(link);
	}
	return <Story />;
};

export const LiveTabIcon: Story = {
	decorators: [withAppDefaultIcon],
	parameters: { router: { initialPath: '/booking/events' } },
	render: ({ role }) => (
		<TenantContext.Provider
			value={
				{
					tenant: { theming: {} },
					setTenant: () => {},
					updateTenantSettings: () => {}
				} as any
			}
		>
			<SectionFavicon navigation={SECTIONS[role]} />
			<LiveControls role={role} />
		</TenantContext.Provider>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(tabIconHref()).toMatch(/^data:image\/svg\+xml,/)
		);
		const calendar = tabIconHref();
		// Painted in the page's own primary / on-primary tokens.
		const rootStyle = getComputedStyle(document.documentElement);
		const svg = decodeURIComponent(
			calendar.slice('data:image/svg+xml,'.length)
		);
		await expect(svg).toContain(
			`fill="${rootStyle.getPropertyValue(FAVICON_TILE_TOKEN).trim()}"/>`
		);
		await expect(svg).toContain(
			`color="${rootStyle.getPropertyValue(FAVICON_GLYPH_TOKEN).trim()}"`
		);
		await expect(document.title).toBe(i18n.t('navigation.booking.events'));
		await waitFor(() =>
			expect(
				document.querySelector('link[data-section-icon-png]')
			).not.toBeNull()
		);

		await userEvent.click(
			canvas.getByRole('button', { name: i18n.t('navigation.myProfile') })
		);
		await waitFor(() => expect(tabIconHref()).not.toBe(calendar));
		await expect(document.title).toBe(i18n.t('navigation.myProfile'));
		await expect(tabIconHref()).toMatch(/^data:image\/svg\+xml,/);

		await userEvent.click(
			canvas.getByRole('button', { name: 'No section (/drafts)' })
		);
		await waitFor(() => expect(tabIconHref()).toMatch(/\/favicon\.ico$/));
		await expect(
			document.querySelector('link[data-section-icon-png]')
		).toBeNull();

		// Leave the page showing a section icon for manual inspection.
		await userEvent.click(
			canvas.getByRole('button', {
				name: i18n.t('navigation.booking.events')
			})
		);
	}
};

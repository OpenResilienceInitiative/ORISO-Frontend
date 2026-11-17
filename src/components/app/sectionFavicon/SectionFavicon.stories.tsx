import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useLocation, useNavigate } from 'react-router-dom';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { SectionFavicon } from './SectionFavicon';
import i18n from '../../../i18n';
import { RouterConfigConsultant, RouterConfigUser } from '../RouterConfig';
import {
	buildSectionFaviconSvg,
	sectionIconOf,
	svgToPngDataUrl,
	toSvgDataUrl,
	type SectionNavItem
} from './sectionFaviconSvg';

/**
 * Every section's browser tab icon: the glyph the navigation rail shows for
 * that section, on a dark rounded tile, in the tenant primary colour. Shown at
 * tile size and at the 32 px / 16 px sizes a tab strip actually uses, plus the
 * PNG fallback older Safari takes.
 */

const settings = { useOverviewPage: true } as any;
const SECTIONS: Record<'consultant' | 'asker', SectionNavItem[]> = {
	consultant: RouterConfigConsultant(settings).navigation,
	asker: RouterConfigUser(settings, true).navigation
};

const label = (item: SectionNavItem) =>
	i18n.t((item.titleKeys as { large: string }).large);

const IconRow = ({
	item,
	primaryColor
}: {
	item: SectionNavItem;
	primaryColor: string;
}) => {
	const Icon = sectionIconOf(item)!;
	const svg = buildSectionFaviconSvg(Icon, primaryColor);
	const href = toSvgDataUrl(svg);
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
			<code style={{ fontSize: 12 }}>{item.to}</code>
			<img src={href} width={64} height={64} alt={`${label(item)} 64`} />
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
					width: 200
				}}
			>
				<img src={href} width={16} height={16} alt="" />
				{label(item)} – ORISO
			</span>
		</li>
	);
};

const Gallery = ({
	role,
	primaryColor
}: {
	role: 'consultant' | 'asker';
	primaryColor: string;
}) => (
	<ul
		style={{
			listStyle: 'none',
			margin: 0,
			padding: 16,
			display: 'grid',
			gridTemplateColumns: 'repeat(7, max-content)',
			alignItems: 'center',
			gap: '12px 20px',
			font: '14px system-ui, sans-serif'
		}}
	>
		{SECTIONS[role]
			.filter((item) => item?.to && sectionIconOf(item))
			.map((item) => (
				<IconRow
					key={item.to}
					item={item}
					primaryColor={primaryColor}
				/>
			))}
	</ul>
);

const meta: Meta<typeof Gallery> = {
	title: 'Components/Layout/SectionFavicon',
	component: Gallery,
	args: { role: 'consultant', primaryColor: '#a5000a' },
	argTypes: {
		role: { control: 'inline-radio', options: ['consultant', 'asker'] },
		primaryColor: { control: 'color' }
	}
};
export default meta;
type Story = StoryObj<typeof Gallery>;

const expectEveryIconDrawn = async (
	canvasElement: HTMLElement,
	color: string,
	routes: string[]
) => {
	const rows = within(canvasElement).getAllByTestId('section-favicon');
	await expect(rows.map((row) => row.dataset.route)).toEqual(routes);
	for (const row of rows) {
		const svg = row.dataset.svg ?? '';
		// The real nav glyph is inside (paths), in the tenant colour.
		await expect(svg).toContain('<path');
		await expect(svg).toContain(`color="${color}"`);
	}
};

export const Counsellor: Story = {
	play: async ({ canvasElement }) =>
		expectEveryIconDrawn(canvasElement, '#a5000a', [
			'/overview',
			'/sessions/consultant/sessionPreview',
			'/sessions/consultant/sessionView',
			'/notifications',
			'/profile',
			'/booking/events'
		])
};

export const Asker: Story = {
	args: { role: 'asker' },
	play: async ({ canvasElement }) =>
		expectEveryIconDrawn(canvasElement, '#a5000a', [
			'/sessions/user/view',
			'/notifications',
			'/profile',
			'/booking/events',
			'/tools'
		])
};

/** Another tenant: the glyph follows its primary colour. */
export const OtherTenantColour: Story = {
	args: { primaryColor: '#1c4f8f' },
	play: async ({ canvasElement }) => {
		const rows = within(canvasElement).getAllByTestId('section-favicon');
		for (const row of rows)
			await expect(row.dataset.svg).toContain('color="#1c4f8f"');
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
	render: ({ role, primaryColor }) => (
		<TenantContext.Provider
			value={
				{
					tenant: { theming: { primaryColor } },
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

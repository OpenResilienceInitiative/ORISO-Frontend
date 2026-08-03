/**
 * Design tokens for the transactional e-mail kit.
 *
 * These are deliberately a *separate* token set from the app's MUI/M3 theme:
 * e-mail clients cannot read CSS custom properties, so every value has to be
 * inlined as a literal at render time. The values mirror the muted ORISO M3
 * scheme (see `OrisoScheme`) but are frozen here as plain hex/px so the render
 * layer never depends on a runtime theme.
 *
 * Everything exported from this folder is prefixed `email…` on purpose — the
 * e-mail kit must never be confused with the in-app component library.
 */

export const emailColor = {
	/** Page background behind the card. */
	canvas: '#f2efef',
	/** The card itself. */
	surface: '#ffffff',
	/** Data panel inside the card. */
	surfaceMuted: '#faf6f6',
	outline: '#e0dada',
	onSurface: '#1d1b1b',
	onSurfaceVariant: '#5c5555',
	/** Footer fine print. */
	onSurfaceFaint: '#8a8080',
	/** Separator dots between footer links. */
	separator: '#c4bcbc',
	onPrimary: '#ffffff'
} as const;

export const emailFontStack =
	"Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * M3 type scale, frozen to px. `tracking` is letter-spacing in px.
 * `mobile` overrides are applied through the `<style>` media query, which is
 * the only place an e-mail may use a class instead of an inline style.
 */
export const emailType = {
	headline: {
		size: 24,
		line: 32,
		weight: 500,
		mobile: { size: 22, line: 30 }
	},
	body: { size: 16, line: 26 },
	/** Label column of the data panel. */
	label: { size: 14, line: 20, tracking: 0.25 },
	/** Value column of the data panel, and inline emphasis. */
	value: { size: 16, line: 24, weight: 600 },
	/** The reassuring line under the CTA. */
	footnote: { size: 14, line: 22, tracking: 0.25 },
	caption: { size: 12, line: 18 },
	button: { size: 16, line: 20, weight: 600 },
	/** Wordmark next to the logo. */
	brand: { size: 16, line: 24, weight: 600, tracking: 0.15 },
	orgName: { size: 13, line: 20, weight: 600 },
	/**
	 * A one-time code. Large and widely tracked because it exists to be read off
	 * one screen and typed into another — at body size in a label/value row it is
	 * the hardest thing in the mail to copy correctly.
	 */
	code: {
		size: 32,
		line: 40,
		weight: 600,
		tracking: 4,
		mobile: { size: 26, line: 34, tracking: 3 }
	}
} as const;

export const emailSpace = {
	/** Horizontal gutter inside the 600px column. */
	gutter: 40,
	/** Same gutter below the mobile breakpoint (applied via `.sp`). */
	gutterMobile: 24,
	/** Padding of the outer canvas cell. */
	edge: { top: 32, side: 12, bottom: 48 },
	edgeMobile: { top: 24, side: 8, bottom: 32 },
	panel: { block: 20, inline: 22 },
	panelMobile: { block: 18, inline: 16 }
} as const;

export const emailRadius = {
	card: 24,
	panel: 12,
	logo: 8,
	pill: 999
} as const;

export const emailLayout = {
	/** Canonical e-mail column width. */
	width: 600,
	/** Below this width the stacking media query kicks in. */
	mobileBreakpoint: 620,
	logoSize: 36
} as const;

/** Brand values a tenant can override per send. */
export interface EmailBrand {
	platformName: string;
	orgName: string;
	orgAddress: string;
	contactLine: string;
	logoUrl: string;
	primaryColor: string;
	accentColor: string;
}

/**
 * Default brand. Note these are *placeholder* values: in production every field
 * is filled per tenant, and the colours come from the tenant's theme.
 */
export const emailDefaultBrand: EmailBrand = {
	platformName: '{{platformName}}',
	orgName: '{{orgName}}',
	orgAddress: '{{orgAddress}}',
	contactLine: '{{contactLine}}',
	logoUrl: '{{logoUrl}}',
	primaryColor: '{{primaryColor}}',
	accentColor: '{{accentColor}}'
};

/** Sample values used by the Storybook previews and the local preview build. */
export const emailSampleBrand: EmailBrand = {
	platformName: 'Online-Beratung',
	orgName: 'Caritasverband für die Diözese Mainz e. V.',
	orgAddress: 'Bahnhofstraße 6, 55116 Mainz',
	contactLine: 'kontakt@beratung.example.org · 06131 0000-0',
	// Preview-only: served by Storybook from `public/`. A real send always gets
	// an absolute https URL, because e-mail clients have no origin to resolve
	// a relative path against.
	logoUrl: '/logo512.png',
	primaryColor: '#a5000a',
	accentColor: '#cc1e1c'
};

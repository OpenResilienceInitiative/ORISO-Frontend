import * as React from 'react';
import {
	EMAIL_LOCALES,
	EMAIL_LOCALE_LABELS,
	EMAIL_LOCALE_RELEASE,
	EmailId,
	EmailLocale,
	buildEmail
} from '../index';
import {
	emailColor,
	emailFontStack,
	emailSampleBrand
} from '../kit/emailTokens';
import {
	EMAIL_PREVIEW_WIDTHS,
	EmailPreview,
	EmailPreviewWidth
} from './EmailPreview';

/**
 * Story host for a whole mail — the "page" level of the kit.
 *
 * Renders either MIME part, because the plain-text twin ships with every send
 * and is what a text-only client, a screen reader in text mode, or a
 * suspicious spam filter actually reads.
 */
export interface EmailPageProps {
	id: EmailId;
	locale?: EmailLocale;
	view?: 'html' | 'text';
	width?: EmailPreviewWidth;
	/** Substitute sample data for the `{{placeholders}}`. */
	filled?: boolean;
	/** Tenant primary colour. */
	primaryColor?: string;
	/** Tenant accent colour. */
	accentColor?: string;
}

export const EmailPage: React.FC<EmailPageProps> = ({
	id,
	locale = 'de-sie',
	view = 'html',
	width = 700,
	filled = true,
	primaryColor = emailSampleBrand.primaryColor,
	accentColor = emailSampleBrand.accentColor
}) => {
	const built = buildEmail(id, locale, {
		brand: { ...emailSampleBrand, primaryColor, accentColor }
	});

	if (view === 'text') {
		return (
			<pre
				style={{
					margin: 0,
					padding: '28px 30px',
					maxWidth: width,
					borderRadius: 12,
					border: `1px solid ${emailColor.outline}`,
					background: '#ffffff',
					fontFamily:
						'ui-monospace, SFMono-Regular, Menlo, monospace',
					fontSize: 13,
					lineHeight: '21px',
					color: emailColor.onSurface,
					whiteSpace: 'pre-wrap',
					overflowX: 'auto'
				}}
			>
				{built.text}
			</pre>
		);
	}

	return (
		<EmailPreview
			html={built.html}
			width={width}
			filled={filled}
			subject={built.subject}
			preheader={built.preheader}
		/>
	);
};

/** Controls shared by every page story. */
export const emailPageArgTypes = {
	locale: {
		name: 'Language / tone',
		control: { type: 'radio' as const },
		options: [...EMAIL_LOCALES],
		labels: EMAIL_LOCALE_LABELS
	},
	view: {
		name: 'MIME part',
		control: { type: 'radio' as const },
		options: ['html', 'text'],
		labels: { html: 'text/html', text: 'text/plain' }
	},
	width: {
		name: 'Viewport',
		control: { type: 'select' as const },
		options: Object.values(EMAIL_PREVIEW_WIDTHS),
		labels: Object.fromEntries(
			Object.entries(EMAIL_PREVIEW_WIDTHS).map(([label, value]) => [
				value,
				label
			])
		)
	},
	filled: { name: 'Sample data', control: { type: 'boolean' as const } },
	primaryColor: { name: 'Primary', control: { type: 'color' as const } },
	accentColor: { name: 'Accent', control: { type: 'color' as const } },
	id: { table: { disable: true } }
};

/**
 * Side-by-side of every language and tone, for copy review.
 *
 * The four machine-translated languages are marked, because this is the one
 * place they can be read at all — they produce no files under `dist/` until a
 * person has signed off what they claim. See `Email/Foundations →
 * Translations`.
 */
export const EmailToneRow: React.FC<{
	id: EmailId;
	width?: EmailPreviewWidth;
}> = ({ id, width = 420 }) => (
	<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
		{EMAIL_LOCALES.map((locale) => (
			<div
				key={locale}
				style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
			>
				<div
					style={{
						fontFamily: emailFontStack,
						fontSize: 12,
						letterSpacing: 0.5,
						textTransform: 'uppercase',
						color: emailColor.onSurfaceVariant
					}}
				>
					{EMAIL_LOCALE_LABELS[locale]}
					{EMAIL_LOCALE_RELEASE[locale] === 'released' ? null : (
						<span style={{ color: '#a5000a' }}>
							{' '}
							· not send-ready
						</span>
					)}
				</div>
				<EmailPage id={id} locale={locale} width={width} />
			</div>
		))}
	</div>
);

import * as React from 'react';
import {
	EMAIL_SAMPLE_VALUES,
	fillEmailPlaceholders,
	listEmailPlaceholders
} from '../index';
import {
	emailColor,
	emailFontStack,
	emailSampleBrand
} from '../kit/emailTokens';
import { emailDocument } from '../kit/emailDocument';
import { emailShell } from '../kit/emailOrganisms';

/**
 * Preview harness for the e-mail kit.
 *
 * E-mail markup cannot be rendered inline in a Storybook story: it brings its
 * own `<body>` background, its own resets, and a media query that has to react
 * to a *viewport* width rather than a container width. So every preview here
 * renders into an `<iframe>` whose width is the simulated device width — which
 * is also the only honest way to check the mobile layout.
 */

export type EmailPreviewWidth = number;

/** The widths worth checking. 320 is the narrowest phone still in real use. */
export const EMAIL_PREVIEW_WIDTHS: Record<string, EmailPreviewWidth> = {
	'Wide (900px)': 900,
	'Desktop (700px)': 700,
	'Tablet (620px)': 620,
	'Phone (414px)': 414,
	'Phone (375px)': 375,
	'Phone, narrow (320px)': 320
};

export interface EmailPreviewProps {
	/** A complete e-mail document. */
	html: string;
	/** Simulated viewport width in px. */
	width?: EmailPreviewWidth;
	/** Substitute the sample values for the `{{placeholders}}`. */
	filled?: boolean;
	/** Show the subject/preview-line strip above the frame. */
	subject?: string;
	preheader?: string;
}

const chrome: React.CSSProperties = {
	fontFamily: emailFontStack,
	fontSize: 13,
	lineHeight: '20px',
	color: emailColor.onSurfaceVariant
};

/**
 * Measures the rendered document and grows the frame to fit, so a story shows
 * the whole mail instead of a scroll stub. Re-measures once after load because
 * the logo image settles late.
 */
const useFittedFrame = (dependency: string) => {
	const ref = React.useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = React.useState(600);

	const measure = React.useCallback(() => {
		const doc = ref.current?.contentDocument;
		if (!doc?.body) {
			return;
		}
		const next = Math.max(
			doc.body.scrollHeight,
			doc.documentElement.scrollHeight
		);
		if (next > 40) {
			setHeight((current) =>
				Math.abs(next - current) > 2 ? next : current
			);
		}
	}, []);

	React.useEffect(() => {
		measure();
		const timer = window.setTimeout(measure, 250);
		return () => window.clearTimeout(timer);
	}, [dependency, measure]);

	return { ref, height, measure };
};

export const EmailPreview: React.FC<EmailPreviewProps> = ({
	html,
	width = 700,
	filled = true,
	subject,
	preheader
}) => {
	const source = filled
		? fillEmailPlaceholders(html, {
				...EMAIL_SAMPLE_VALUES,
				...emailSampleBrand
			})
		: html;
	const { ref, height, measure } = useFittedFrame(`${source}:${width}`);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			{subject !== undefined && (
				<div
					style={{
						...chrome,
						maxWidth: width,
						padding: '10px 14px',
						borderRadius: 10,
						background: '#ffffff',
						border: `1px solid ${emailColor.outline}`
					}}
				>
					<div
						style={{ color: emailColor.onSurface, fontWeight: 600 }}
					>
						{filled
							? fillEmailPlaceholders(subject, {
									...EMAIL_SAMPLE_VALUES,
									...emailSampleBrand
								})
							: subject}
					</div>
					{preheader !== undefined && (
						<div style={{ paddingTop: 2 }}>
							{filled
								? fillEmailPlaceholders(preheader, {
										...EMAIL_SAMPLE_VALUES,
										...emailSampleBrand
									})
								: preheader}
						</div>
					)}
				</div>
			)}
			<iframe
				ref={ref}
				title="E-Mail-Vorschau"
				srcDoc={source}
				onLoad={measure}
				style={{
					width,
					maxWidth: '100%',
					height,
					border: `1px solid ${emailColor.outline}`,
					borderRadius: 12,
					background: emailColor.canvas,
					display: 'block'
				}}
			/>
		</div>
	);
};

/**
 * Wraps a fragment of e-mail markup in a minimal document so a single atom or
 * molecule can be previewed under the same resets and media query as the real
 * thing.
 *
 * `rows` are `<tr>`s and get the full canvas + card treatment; `inline`
 * fragments are dropped into a bare cell.
 */
export const wrapEmailFragment = (
	fragment: string,
	{ rows = true, onCard = true }: { rows?: boolean; onCard?: boolean } = {}
): string => {
	const inner = rows
		? fragment
		: `<tr><td style="padding:0;">${fragment}</td></tr>`;
	const body = onCard
		? emailShell(
				'<tr><td style="padding:0;">' +
					'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
					`bgcolor="${emailColor.surface}" style="background-color:${emailColor.surface};` +
					`border-radius:24px;border:1px solid ${emailColor.outline};">` +
					inner +
					'</table></td></tr>'
			)
		: emailShell(inner);

	return emailDocument({
		lang: 'de',
		subject: 'Fragment',
		preheader: '',
		body
	});
};

/** Lists the `{{placeholders}}` still present, for the story docs. */
export const EmailPlaceholderList: React.FC<{ source: string }> = ({
	source
}) => {
	const tokens = listEmailPlaceholders(source);
	if (tokens.length === 0) {
		return null;
	}
	return (
		<div style={{ ...chrome, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
			{tokens.map((token) => (
				<code
					key={token}
					style={{
						fontFamily:
							'ui-monospace, SFMono-Regular, Menlo, monospace',
						fontSize: 11,
						padding: '3px 7px',
						borderRadius: 6,
						background: '#ffffff',
						border: `1px solid ${emailColor.outline}`,
						color: '#a5000a'
					}}
				>
					{token}
				</code>
			))}
		</div>
	);
};

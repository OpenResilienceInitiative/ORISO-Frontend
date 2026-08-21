import * as React from 'react';
import {
	EMAIL_SAMPLE_VALUES,
	EmailId,
	EmailLocale,
	fillEmailPlaceholders,
	getEmailContent
} from '../index';
import {
	emailColor,
	emailFontStack,
	emailSampleBrand
} from '../kit/emailTokens';

/**
 * What a mail looks like in an inbox list, before it is opened.
 *
 * Subject plus preheader is the whole of the first impression, and for a
 * counselling platform it is also the part with the highest privacy stakes: it
 * shows up on a lock screen, over someone's shoulder, in a shared household.
 * That is why no subject or preview line in this kit names a person, a topic or
 * a counselling centre.
 */
export interface EmailInboxLineProps {
	id: EmailId;
	locale?: EmailLocale;
	/** Substitute sample data for the `{{placeholders}}`. */
	filled?: boolean;
}

export const EmailInboxLine: React.FC<EmailInboxLineProps> = ({
	id,
	locale = 'de-sie',
	filled = true
}) => {
	const content = getEmailContent(id, locale);
	const show = (value: string) =>
		filled
			? fillEmailPlaceholders(value, {
					...EMAIL_SAMPLE_VALUES,
					...emailSampleBrand
				})
			: value;

	return (
		<div
			style={{
				fontFamily: emailFontStack,
				maxWidth: 460,
				padding: '14px 16px',
				borderRadius: 12,
				background: '#ffffff',
				border: `1px solid ${emailColor.outline}`
			}}
		>
			<div
				style={{
					fontSize: 13,
					lineHeight: '20px',
					fontWeight: 600,
					color: emailColor.onSurface
				}}
			>
				{show(emailSampleBrand.platformName)}
			</div>
			<div
				style={{
					fontSize: 15,
					lineHeight: '22px',
					fontWeight: 500,
					color: emailColor.onSurface,
					paddingTop: 2
				}}
			>
				{show(content.subject)}
			</div>
			<div
				style={{
					fontSize: 13,
					lineHeight: '20px',
					color: emailColor.onSurfaceVariant,
					paddingTop: 2
				}}
			>
				{show(content.preheader)}
			</div>
		</div>
	);
};

import { verifyEmailLogoVariants } from '../../../.storybook/emailLogoAssertions';
import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { buildEmail } from '../index';
import { EmailPreview } from '../preview/EmailPreview';
import { emailLogoFixtures, emailLogoFixtureBrand } from './emailLogoFixtures';
import {
	EmailPage,
	EmailToneRow,
	emailPageArgTypes
} from '../preview/EmailPage';

const meta = {
	title: 'Email/Pages/AnfrageZugewiesen',
	component: EmailPage,
	argTypes: emailPageArgTypes,
	args: { id: 'anfrage-zugewiesen' as const, locale: 'de-sie' as const },
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The only mail in this set that goes to a counsellor rather than an asker. It still shows no personal data — topic, postcode and time of arrival are all a counsellor needs to decide whether to accept.'
			}
		}
	}
} satisfies Meta<typeof EmailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Formal: Story = {
	name: 'Deutsch (Sie)',
	args: { locale: 'de-sie' }
};

export const Informal: Story = {
	name: 'Deutsch (du)',
	args: { locale: 'de-du' }
};

export const English: Story = {
	name: 'English',
	args: { locale: 'en' }
};

export const AllTones: Story = {
	name: 'All three tones',
	render: (args) => <EmailToneRow id={args.id} />
};

export const PlainText: Story = {
	name: 'text/plain part',
	args: { view: 'text' }
};

export const OnPhone: Story = {
	name: 'Phone (375px)',
	args: { width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { width: 320 }
};

export const TenantColours: Story = {
	name: 'Other tenant colours',
	args: { primaryColor: '#1c4f8f', accentColor: '#3a7bd0' }
};

export const AsTemplateFile: Story = {
	name: 'Template file (placeholders)',
	args: { filled: false }
};

/** A complete page proves that the header cannot widen the card on phones. */
export const VeryWideLogoOnNarrowPhone: Story = {
	name: 'Very wide logo · phone (320px)',
	render: (args) => {
		const built = buildEmail(args.id, args.locale ?? 'de-sie', {
			brand: emailLogoFixtureBrand(emailLogoFixtures[3])
		});
		return (
			<EmailPreview
				html={built.html}
				width={320}
				subject={built.subject}
				preheader={built.preheader}
			/>
		);
	}
};

export const WideLogoBoundaryOnNarrowPhone: Story = {
	name: '3:1 logo boundary · phone (320px)',
	render: (args) => {
		const built = buildEmail(args.id, args.locale ?? 'de-sie', {
			brand: emailLogoFixtureBrand(emailLogoFixtures[2])
		});
		return (
			<EmailPreview
				html={built.html}
				width={320}
				subject={built.subject}
				preheader={built.preheader}
			/>
		);
	}
};

const logoPages = (width: number) => (
	<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
		{emailLogoFixtures.map((fixture) => {
			const built = buildEmail('anfrage-zugewiesen', 'de-sie', {
				brand: emailLogoFixtureBrand(fixture)
			});
			return (
				<section key={fixture.file} aria-label={fixture.name}>
					<h2 style={{ fontSize: 16 }}>
						{fixture.name} · {width}px viewport
					</h2>
					<EmailPreview
						html={built.html}
						width={width}
						subject={built.subject}
						preheader={built.preheader}
					/>
				</section>
			);
		})}
	</div>
);

export const LogoVariantsDesktop: Story = {
	render: () => logoPages(700),
	play: verifyEmailLogoVariants
};
export const LogoVariantsTablet: Story = {
	render: () => logoPages(820),
	play: verifyEmailLogoVariants
};
export const LogoVariantsPhone: Story = {
	render: () => logoPages(375),
	play: verifyEmailLogoVariants
};
export const LogoVariantsNarrowPhone: Story = {
	render: () => logoPages(320),
	play: verifyEmailLogoVariants
};

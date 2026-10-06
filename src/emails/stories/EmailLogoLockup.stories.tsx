import { verifyEmailLogoVariants } from '../../../.storybook/emailLogoAssertions';
import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailHeaderBar } from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';
import { emailLogoFixtures, emailLogoFixtureBrand } from './emailLogoFixtures';

const meta = {
	title: 'Email/Atoms/LogoLockup',
	component: EmailFragment,
	args: { fragment: emailHeaderBar(emailSampleBrand) },
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Every logo is scaled to 48px high without cropping. Logos up to 3:1 keep the adjacent platform name on phones. Wider logos hide that name on phones and retain an accessible image label. Intrinsic dimensions select the layout; unknown dimensions keep the name visible. Without a logo, the name remains. Check 320px and 375px alongside tablet and desktop. Synthetic fixtures are preview-only.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fragment: emailHeaderBar(emailSampleBrand),
		onCard: false,
		width: 700
	}
};

export const LongPlatformName: Story = {
	args: {
		fragment: emailHeaderBar({
			...emailSampleBrand,
			platformName: 'Online-Beratung der Caritas Mainz'
		}),
		onCard: false,
		width: 700
	}
};

export const ImagesBlocked: Story = {
	name: 'Images blocked',
	args: {
		// Deliberately unresolvable. The logo is decorative (alt=""), so a
		// failed image leaves an empty spot and the name beside it stays;
		// clients still draw their own placeholder frame (Outlook a box).
		fragment: emailHeaderBar({
			...emailSampleBrand,
			logoUrl: '/deliberately-missing-logo.png'
		}),
		onCard: false,
		width: 700
	}
};

export const WithoutLogo: Story = {
	name: 'Without logo',
	args: {
		// A tenant without a logo sends an empty URL, and the kit drops the
		// image cell entirely — an <img src=""> would render as a broken-image
		// icon. The text wordmark carries the header alone, exactly what
		// UserService produces when it expands {{logoCell}} to nothing.
		fragment: emailHeaderBar({ ...emailSampleBrand, logoUrl: '' }),
		onCard: false,
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment: emailHeaderBar(emailSampleBrand),
		onCard: false,
		width: 375
	}
};

const variants = (width: number) => (
	<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
		{emailLogoFixtures.map((fixture) => (
			<section key={fixture.file} aria-label={fixture.name}>
				<h2 style={{ fontSize: 16 }}>
					{fixture.name} · {width}px viewport
				</h2>
				<EmailFragment
					fragment={emailHeaderBar(emailLogoFixtureBrand(fixture))}
					onCard={false}
					width={width}
				/>
			</section>
		))}
	</div>
);

export const DesktopVariants: Story = {
	render: () => variants(700),
	play: verifyEmailLogoVariants
};
export const TabletVariants: Story = {
	render: () => variants(820),
	play: verifyEmailLogoVariants
};
export const PhoneVariants: Story = {
	render: () => variants(375),
	play: verifyEmailLogoVariants
};
export const NarrowPhoneVariants: Story = {
	render: () => variants(320),
	play: verifyEmailLogoVariants
};

export const VeryWideOnPhone: Story = {
	args: {
		fragment: emailHeaderBar(emailLogoFixtureBrand(emailLogoFixtures[3])),
		onCard: false,
		width: 320
	}
};

export const WideBoundaryOnPhone: Story = {
	args: {
		fragment: emailHeaderBar(emailLogoFixtureBrand(emailLogoFixtures[2])),
		onCard: false,
		width: 320
	}
};

export const VeryWideImagesBlocked: Story = {
	args: {
		fragment: emailHeaderBar({
			...emailLogoFixtureBrand(emailLogoFixtures[3]),
			logoUrl: '/deliberately-missing-wide-logo.png'
		}),
		onCard: false,
		width: 320
	}
};

export const LongNameOnPhone: Story = {
	args: {
		fragment: emailHeaderBar({
			...emailLogoFixtureBrand(emailLogoFixtures[2]),
			platformName: 'Online-Beratung der Caritas Mainz'
		}),
		onCard: false,
		width: 320
	}
};

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type {
	AgencyContact,
	AgencyContactPerson as Person
} from '../../api/apiGetAgencyContactPerson';
import { AgencyContactPerson } from './AgencyContactPerson';
import './profile.styles';

/**
 * ORISO-Admin#1534: whom a counsellor contacts about one of their centres.
 * The stories pass the `ConsultantAgencyContactDTO` the UserService answers
 * on `GET /users/agencies/{id}/contact-person`; the component is not wired
 * into the profile yet. Resolution order: own contact → Träger default →
 * all admins of the centre → all admins of the Träger → support address.
 */

const maria: Person = {
	role: 'CONTACT',
	displayName: 'Maria Muster',
	email: 'ansprechperson@caritas-nord.example',
	isConsultant: false,
	chatConsultantId: null
};
const jonas: Person = {
	role: 'DEPUTY',
	displayName: 'Jonas Beispiel',
	email: 'j.beispiel@caritas-nord.example',
	isConsultant: false,
	chatConsultantId: null
};
const admin = (displayName: string, email: string): Person => ({
	role: 'ADMIN',
	displayName,
	email,
	isConsultant: false,
	chatConsultantId: null
});

const SCENARIOS = {
	own: { source: 'OWN', people: [maria, jonas] },
	traegerDefault: {
		source: 'TRAEGER_DEFAULT',
		people: [
			{
				...maria,
				displayName: 'Petra Träger',
				email: 'kontakt@caritas-sued.example'
			}
		]
	},
	alsoCounsellor: {
		source: 'OWN',
		people: [
			{ ...maria, isConsultant: true, chatConsultantId: 'consultant-7' },
			{ ...jonas, isConsultant: true, chatConsultantId: null }
		]
	},
	fallbackAgencyAdmins: {
		source: 'FALLBACK_AGENCY_ADMINS',
		people: [
			admin('Alex Admin', 'alex.admin@caritas-nord.example'),
			admin('Sam Stelle', 'sam.stelle@caritas-nord.example')
		]
	},
	fallbackTenantAdmins: {
		source: 'FALLBACK_TENANT_ADMINS',
		people: [admin('Tara Träger', 'tara@caritas-traeger.example')]
	},
	supportOnly: { source: 'SUPPORT_EMAIL', people: [] },
	withTraegerEmail: {
		source: 'OWN',
		people: [maria],
		traegerContactEmail: 'info@caritas-traeger.example'
	}
} satisfies Record<string, AgencyContact>;

/** The centre as "Meine Beratungsstellen" lists it, with the contact block below its name. */
const centreFrame =
	(maxWidth = 560) =>
	(Story: React.ComponentType): React.ReactElement => (
		<div
			className="profile"
			style={{ maxWidth, margin: '0 auto', padding: 16 }}
		>
			<div className="profile__data__content">
				<div>
					Beratungsstelle Musterstadt
					<Story />
				</div>
			</div>
		</div>
	);

const meta = {
	title: 'Profile/Agency contact person',
	component: AgencyContactPerson,
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' },
	decorators: [centreFrame()],
	args: {
		agencyId: 4711,
		contact: SCENARIOS.own,
		supportEmail: 'support@oriso.example',
		onStartChat: fn()
	}
} satisfies Meta<typeof AgencyContactPerson>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The centre names its own contact person and a deputy. */
export const OwnContactAndDeputy: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Maria Muster')).toBeVisible();
		await expect(canvas.getByText('Vertretung')).toBeVisible();
		await expect(
			canvas.getByRole('link', {
				name: 'ansprechperson@caritas-nord.example'
			})
		).toHaveAttribute('href', 'mailto:ansprechperson@caritas-nord.example');
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}
};

/** The centre names nobody, so the Träger's default contact applies. */
export const TraegerDefault: Story = {
	args: { contact: SCENARIOS.traegerDefault },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(
				'Standard-Ansprechperson des Trägers'
			)
		).toBeVisible();
	}
};

/**
 * The contact also counsels at this centre: badge plus "Chat starten". The
 * deputy counsels too but has no chat identity, so only the badge shows.
 */
export const ContactIsAlsoCounsellor: Story = {
	args: { contact: SCENARIOS.alsoCounsellor },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getAllByText('auch Beratende*r')).toHaveLength(2);
		const chat = canvas.getByRole('button', {
			name: 'Chat mit Maria Muster starten'
		});
		await expect(canvas.getAllByRole('button')).toHaveLength(1);
		await userEvent.click(chat);
		await expect(args.onStartChat).toHaveBeenCalledWith(
			expect.objectContaining({ chatConsultantId: 'consultant-7' })
		);
	}
};

/** Nobody set anywhere: the admins of the centre are listed instead. */
export const FallbackAgencyAdmins: Story = {
	args: { contact: SCENARIOS.fallbackAgencyAdmins },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(
				'Noch keine Ansprechperson festgelegt — diese Admins sind zuständig:'
			)
		).toBeVisible();
		await expect(
			canvas.getByText('Admins der Beratungsstelle')
		).toBeVisible();
	}
};

/** The centre has no admin either: the Träger's admins are listed. */
export const FallbackTenantAdmins: Story = {
	args: { contact: SCENARIOS.fallbackTenantAdmins },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText('Admins des Trägers')
		).toBeVisible();
	}
};

/** No admin at all: only the platform's support address remains. */
export const SupportEmailOnly: Story = {
	args: { contact: SCENARIOS.supportOnly },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole('link', {
				name: 'support@oriso.example'
			})
		).toHaveAttribute('href', 'mailto:support@oriso.example');
	}
};

/** The Träger also keeps a general contact address; it shows below the person. */
export const WithTraegerContactEmail: Story = {
	args: { contact: SCENARIOS.withTraegerEmail },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText('Allgemeine Kontaktadresse des Trägers')
		).toBeVisible();
		await expect(
			canvas.getByRole('link', { name: 'info@caritas-traeger.example' })
		).toBeVisible();
	}
};

/** Phone width (390 px): long addresses wrap instead of overflowing. */
export const MobileWidth: Story = {
	args: {
		contact: {
			...SCENARIOS.alsoCounsellor,
			traegerContactEmail:
				'allgemeine-kontaktadresse@caritas-traeger-musterstadt.example'
		}
	},
	globals: { viewport: { value: 'phone390' } },
	play: async ({ canvasElement }) => {
		const block = canvasElement.querySelector('.agencyContactPerson');
		await expect(block).not.toBeNull();
		await expect(block!.scrollWidth).toBeLessThanOrEqual(
			block!.clientWidth
		);
	}
};

/** Still loading: the title and a short status line hold the place. */
export const Loading: Story = {
	args: { loading: true },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText('Ansprechperson wird geladen …')
		).toBeVisible();
	}
};

/** Loading failed: the support address shows instead of a blank block. */
export const LoadErrorFallsBackToSupport: Story = {
	args: { contact: SCENARIOS.supportOnly, loadError: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(
				'Die Ansprechperson konnte gerade nicht geladen werden.'
			)
		).toBeVisible();
		await expect(
			canvas.getByRole('link', { name: 'support@oriso.example' })
		).toBeVisible();
	}
};

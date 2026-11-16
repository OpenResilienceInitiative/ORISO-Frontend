// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
	AgencyContact,
	AgencyContactPerson as Person
} from '../../api/apiGetAgencyContactPerson';
import { AgencyContactPerson } from './AgencyContactPerson';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const K = 'profile.data.agency.contactPerson';

const person = (overrides: Partial<Person> = {}): Person => ({
	role: 'CONTACT',
	displayName: 'Maria Muster',
	email: 'maria@example.org',
	isConsultant: false,
	chatConsultantId: null,
	...overrides
});

const renderIt = (
	contact: AgencyContact,
	props: Partial<React.ComponentProps<typeof AgencyContactPerson>> = {}
) => render(<AgencyContactPerson agencyId={7} contact={contact} {...props} />);

describe('AgencyContactPerson (ORISO-Admin#1534)', () => {
	it('shows the own contact with a mailto link and labels the deputy', () => {
		renderIt({
			source: 'OWN',
			people: [person({ role: 'DEPUTY', displayName: 'Jonas' }), person()]
		});

		const items = screen.getAllByRole('listitem');
		expect(items[0].textContent).toContain('Maria Muster');
		expect(items[1].textContent).toContain('Jonas');
		expect(items[1].textContent).toContain(`${K}.deputy`);
		expect(items[0].textContent).not.toContain(`${K}.deputy`);
		expect(
			screen
				.getAllByRole('link', { name: 'maria@example.org' })[0]
				.getAttribute('href')
		).toBe('mailto:maria@example.org');
		expect(screen.queryByText(`${K}.fallback.heading`)).toBeNull();
	});

	it('shows the address once when an admin has no name but the address', () => {
		renderIt({
			source: 'OWN',
			people: [
				person({
					displayName: 'Maria@Example.org',
					email: 'maria@example.org'
				})
			]
		});

		const links = screen.getAllByRole('link');
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute('href')).toBe('mailto:maria@example.org');
		expect(screen.getByRole('listitem').textContent).not.toContain(
			'Maria@Example.org'
		);
	});

	it('names the Träger default as such', () => {
		renderIt({ source: 'TRAEGER_DEFAULT', people: [person()] });
		expect(screen.getByText(`${K}.traegerDefault`)).toBeTruthy();
	});

	it.each([
		['FALLBACK_AGENCY_ADMINS', `${K}.fallback.agencyAdmins`],
		['FALLBACK_TENANT_ADMINS', `${K}.fallback.tenantAdmins`]
	] as const)(
		'shows the fallback heading and which admins %s lists',
		(source, groupKey) => {
			renderIt({ source, people: [person({ role: 'ADMIN' })] });
			expect(screen.getByText(`${K}.fallback.heading`)).toBeTruthy();
			expect(screen.getByText(groupKey)).toBeTruthy();
		}
	);

	it('shows the badge for a counsellor and the chat button only with a chat identity', () => {
		const onStartChat = vi.fn();
		renderIt(
			{
				source: 'OWN',
				people: [
					person({ isConsultant: true, chatConsultantId: 'c-1' }),
					person({
						role: 'DEPUTY',
						displayName: 'Jonas',
						isConsultant: true
					})
				]
			},
			{ onStartChat }
		);

		expect(screen.getAllByText(`${K}.alsoCounsellor`)).toHaveLength(2);
		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(1);
		fireEvent.click(buttons[0]);
		expect(onStartChat).toHaveBeenCalledWith(
			expect.objectContaining({ chatConsultantId: 'c-1' })
		);
	});

	it('shows no badge for an admin who does not counsel', () => {
		renderIt(
			{ source: 'OWN', people: [person()] },
			{ onStartChat: vi.fn() }
		);
		expect(screen.queryByText(`${K}.alsoCounsellor`)).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('offers no chat when the page passes no handler', () => {
		renderIt({
			source: 'OWN',
			people: [person({ isConsultant: true, chatConsultantId: 'c-1' })]
		});
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('disables the chat button while a room is being opened', () => {
		renderIt(
			{
				source: 'OWN',
				people: [
					person({ isConsultant: true, chatConsultantId: 'c-1' })
				]
			},
			{ onStartChat: vi.fn(), isStartingChat: true }
		);
		expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
			true
		);
	});

	it('falls back to the support address as a mailto link', () => {
		renderIt(
			{ source: 'SUPPORT_EMAIL', people: [] },
			{ supportEmail: 'support@example.org' }
		);
		expect(screen.getByText(`${K}.support.heading`)).toBeTruthy();
		expect(
			screen
				.getByRole('link', { name: 'support@example.org' })
				.getAttribute('href')
		).toBe('mailto:support@example.org');
	});

	it.each([
		['not configured', undefined],
		['carrying mailto parameters', 'a@example.org?bcc=x@example.org']
	])(
		'names the platform administration when the support address is %s',
		(_label, supportEmail) => {
			renderIt({ source: 'SUPPORT_EMAIL', people: [] }, { supportEmail });
			expect(screen.getByText(`${K}.support.none`)).toBeTruthy();
			expect(screen.queryByRole('link')).toBeNull();
		}
	);

	it('shows an address that is not one plain address as text, never as a link', () => {
		renderIt({
			source: 'OWN',
			people: [person({ email: 'a@example.org,b@example.org' })]
		});
		expect(screen.getByText('a@example.org,b@example.org')).toBeTruthy();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it("adds the Träger's general contact address when there is one", () => {
		renderIt({
			source: 'OWN',
			people: [person()],
			traegerContactEmail: 'info@traeger.example'
		});
		expect(screen.getByText(`${K}.traegerContactEmail`)).toBeTruthy();
		expect(
			screen
				.getByRole('link', { name: 'info@traeger.example' })
				.getAttribute('href')
		).toBe('mailto:info@traeger.example');
	});

	it('shows the chat error next to the buttons', () => {
		renderIt(
			{
				source: 'OWN',
				people: [
					person({ isConsultant: true, chatConsultantId: 'c-1' })
				]
			},
			{ onStartChat: vi.fn(), chatError: 'Chat refused' }
		);
		expect(screen.getByRole('alert').textContent).toBe('Chat refused');
	});

	it('shows only the title and a status line while loading', () => {
		renderIt({ source: 'OWN', people: [person()] }, { loading: true });
		expect(screen.getByRole('status').textContent).toBe(`${K}.loading`);
		expect(screen.queryByText('Maria Muster')).toBeNull();
	});

	it('names the load error and keeps the support address, without the "nobody set" heading', () => {
		renderIt(
			{ source: 'SUPPORT_EMAIL', people: [] },
			{ loadError: true, supportEmail: 'support@example.org' }
		);
		expect(screen.getByRole('status').textContent).toBe(`${K}.loadError`);
		expect(screen.queryByText(`${K}.support.heading`)).toBeNull();
		expect(
			screen.getByRole('link', { name: 'support@example.org' })
		).toBeTruthy();
	});
});

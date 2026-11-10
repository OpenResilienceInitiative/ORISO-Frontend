// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { encodeUsername } from '../../utils/encryptionHelpers';
import { ManagePeopleDialog } from './ManagePeopleDialog';
import {
	ManagedPeopleSource,
	ManagedPerson,
	readablePersonName,
	selectableCandidates
} from './managedPeople';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			options?.name ? `${key}:${options.name}` : key,
		i18n: { language: 'de', exists: () => false }
	})
}));

const standing: ManagedPerson = {
	id: 'selma',
	name: 'Selma Bouvier',
	role: 'supervisor',
	isStanding: true,
	canRemove: false,
	canReplace: true
};

const source = (
	overrides: Partial<ManagedPeopleSource> = {}
): ManagedPeopleSource => ({
	kind: 'supervision',
	loadMembers: vi.fn(async () => [standing]),
	loadCandidates: vi.fn(async () => [{ id: 'patty', name: 'Patty Bouvier' }]),
	addPerson: vi.fn(async () => undefined),
	removePerson: vi.fn(async () => undefined),
	replacePerson: vi.fn(async () => undefined),
	...overrides
});

const show = (managed: ManagedPeopleSource) =>
	render(
		<ManagePeopleDialog open onClose={() => undefined} source={managed} />
	);

describe('readablePersonName', () => {
	it('never shows an encoded user name', () => {
		const encoded = encodeUsername('selma.bouvier_at_trail.ist');
		expect(readablePersonName(null, encoded)).toBe(
			'selma.bouvier_at_trail.ist'
		);
		expect(readablePersonName(encoded, encoded)).toBe(
			'selma.bouvier_at_trail.ist'
		);
	});

	it('prefers the display name and falls back when nothing is known', () => {
		expect(readablePersonName('Selma', 'enc.ABC')).toBe('Selma');
		expect(readablePersonName(null, null, 'Unbekannt')).toBe('Unbekannt');
	});
});

describe('selectableCandidates', () => {
	it('drops people already in, duplicates, and sorts by name', () => {
		expect(
			selectableCandidates(
				[
					{ id: 'b', name: 'Zoe' },
					{ id: 'selma', name: 'Selma Bouvier' },
					{ id: 'a', name: 'Anna' },
					{ id: 'a', name: 'Anna' }
				],
				[standing],
				'de'
			).map(({ id }) => id)
		).toEqual(['a', 'b']);
	});
});

describe('ManagePeopleDialog', () => {
	afterEach(cleanup);

	it('offers no removal for a standing supervisor, only a replacement', async () => {
		show(source());
		await screen.findByText('Selma Bouvier');
		expect(
			screen.queryByRole('button', {
				name: 'managePeople.remove.labelFor:Selma Bouvier'
			})
		).toBeNull();
		expect(
			screen.getByRole('button', {
				name: 'managePeople.replace.labelFor:Selma Bouvier'
			})
		).toBeTruthy();
	});

	it('disables the replacement when nobody can take over', async () => {
		show(source({ loadCandidates: async () => [] }));
		const replace = await screen.findByRole('button', {
			name: 'managePeople.replace.labelFor:Selma Bouvier'
		});
		await waitFor(() =>
			expect((replace as HTMLButtonElement).disabled).toBe(true)
		);
		expect(
			screen.getByText('managePeople.standing.noReplacement')
		).toBeTruthy();
	});

	it('asks for the reason before adding when the source requires one', async () => {
		const managed = source({ requiresReason: true });
		show(managed);
		const pick = await screen.findByRole('button', {
			name: 'managePeople.add.labelFor:Patty Bouvier'
		});
		fireEvent.click(pick);

		const confirm = await screen.findByRole('button', {
			name: 'managePeople.add.confirm:Patty Bouvier'
		});
		fireEvent.click(confirm);
		await screen.findByText('managePeople.supervision.reasonMissing');
		expect(managed.addPerson).not.toHaveBeenCalled();

		fireEvent.change(screen.getByRole('textbox'), {
			target: { value: 'Zweite Meinung' }
		});
		fireEvent.click(confirm);
		await waitFor(() =>
			expect(managed.addPerson).toHaveBeenCalledWith(
				{ id: 'patty', name: 'Patty Bouvier' },
				{ reason: 'Zweite Meinung' }
			)
		);
	});

	it('adds directly without a reason and reads both lists again', async () => {
		const managed = source({ kind: 'internalChat' });
		show(managed);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'managePeople.add.labelFor:Patty Bouvier'
			})
		);
		await waitFor(() => expect(managed.addPerson).toHaveBeenCalled());
		await waitFor(() =>
			expect(managed.loadMembers).toHaveBeenCalledTimes(2)
		);
	});

	it('replaces through the picker, not through remove and add', async () => {
		const managed = source({ requiresReason: true });
		show(managed);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'managePeople.replace.labelFor:Selma Bouvier'
			})
		);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'managePeople.replace.pickLabelFor:Patty Bouvier'
			})
		);
		fireEvent.change(await screen.findByRole('textbox'), {
			target: { value: 'Urlaub' }
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'managePeople.replace.confirm:Patty Bouvier'
			})
		);
		await waitFor(() =>
			expect(managed.replacePerson).toHaveBeenCalledWith(
				standing,
				{ id: 'patty', name: 'Patty Bouvier' },
				{ reason: 'Urlaub' }
			)
		);
		expect(managed.removePerson).not.toHaveBeenCalled();
		expect(managed.addPerson).not.toHaveBeenCalled();
	});

	it('removes only after the confirmation inside the row', async () => {
		const person = { ...standing, isStanding: false, canRemove: true };
		const managed = source({ loadMembers: async () => [person] });
		show(managed);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'managePeople.remove.labelFor:Selma Bouvier'
			})
		);
		expect(managed.removePerson).not.toHaveBeenCalled();
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'managePeople.remove.labelFor:Selma Bouvier'
			})
		);
		await waitFor(() =>
			expect(managed.removePerson).toHaveBeenCalledWith(person)
		);
	});

	it('keeps the people visible when only the candidates fail, with a retry', async () => {
		const loadCandidates = vi
			.fn()
			.mockRejectedValueOnce(new Error('403'))
			.mockResolvedValue([{ id: 'patty', name: 'Patty Bouvier' }]);
		show(source({ loadCandidates }));
		await screen.findByText('managePeople.error.candidates');
		expect(screen.getByText('Selma Bouvier')).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', { name: 'managePeople.retry' })
		);
		await screen.findByRole('button', {
			name: 'managePeople.add.labelFor:Patty Bouvier'
		});
	});

	it('reports a failed change and keeps the selection for another try', async () => {
		const managed = source({
			kind: 'internalChat',
			addPerson: vi.fn().mockRejectedValue(new Error('500'))
		});
		show(managed);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'managePeople.add.labelFor:Patty Bouvier'
			})
		);
		await screen.findByText('managePeople.error.add');
		expect(
			screen.getByRole('button', {
				name: 'managePeople.add.labelFor:Patty Bouvier'
			})
		).toBeTruthy();
	});

	it('shows no add section when the source cannot add', async () => {
		show(
			source({
				kind: 'groupChat',
				addPerson: undefined,
				loadCandidates: undefined
			})
		);
		await screen.findByText('Selma Bouvier');
		expect(
			screen.queryByText('managePeople.groupChat.addTitle')
		).toBeNull();
	});
});

// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { createSupervisionPeopleSource } from './supervisionPeopleSource';
import { fetchAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import { apiAddSessionSupervisor } from '../../api/apiAddSessionSupervisor';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiRemoveSessionSupervisor } from '../../api/apiRemoveSessionSupervisor';

vi.mock('../../api/apiGetAgencyConsultantList');
vi.mock('../../api/apiAddSessionSupervisor');
vi.mock('../../api/apiGetSessionSupervisors');
vi.mock('../../api/apiRemoveSessionSupervisor');

const consultant = (id: string, first: string, isSupervisor: boolean) => ({
	consultantId: id,
	firstName: first,
	lastName: 'Bouvier',
	displayName: '',
	username: `enc.${id}`,
	isSupervisor
});

const supervisor = (id: number, consultantId: string, username: string) =>
	({
		id,
		sessionId: 363,
		supervisorConsultantId: consultantId,
		supervisorUsername: username,
		addedByConsultantId: 'me',
		addedDate: '2026-11-04T10:00:00Z',
		notes: 'Second opinion'
	}) as any;

describe('createSupervisionPeopleSource', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(fetchAgencyConsultantList).mockResolvedValue([
			consultant('me', 'Marge', true),
			consultant('selma', 'Selma', true),
			consultant('patty', 'Patty', true),
			consultant('homer', 'Homer', false)
		]);
	});

	it('lists only supervisors who are marked, not yet in and not the counsellor', async () => {
		vi.mocked(apiGetSessionSupervisors).mockResolvedValue([
			supervisor(1, 'patty', 'enc.PATTY')
		]);
		const source = createSupervisionPeopleSource({
			sessionId: 363,
			agencyId: '42',
			currentConsultantId: 'me',
			unknownName: 'Supervisor'
		});

		await source.loadMembers();
		const candidates = await source.loadCandidates!();

		expect(candidates).toEqual([{ id: 'selma', name: 'Selma Bouvier' }]);
	});

	it('names a supervisor from the directory, never as an encoded user name', async () => {
		vi.mocked(apiGetSessionSupervisors).mockResolvedValue([
			supervisor(1, 'selma', 'enc.ONSWY')
		]);
		const source = createSupervisionPeopleSource({
			sessionId: 363,
			agencyId: '42',
			currentConsultantId: 'me',
			unknownName: 'Supervisor'
		});

		const [person] = await source.loadMembers();

		expect(person).toMatchObject({
			id: '1',
			name: 'Selma Bouvier',
			role: 'supervisor',
			reason: 'Second opinion',
			canRemove: true
		});
	});

	it('filters candidates against the current supervisors even before the members answer', async () => {
		vi.mocked(apiGetSessionSupervisors).mockResolvedValue([
			supervisor(1, 'patty', 'enc.PATTY')
		]);
		const source = createSupervisionPeopleSource({
			sessionId: 363,
			agencyId: '42',
			currentConsultantId: 'me',
			unknownName: 'Supervisor'
		});

		// No loadMembers() first: the dialog loads both lists in parallel.
		const candidates = await source.loadCandidates!();

		expect(candidates).toEqual([{ id: 'selma', name: 'Selma Bouvier' }]);
	});

	it('still names the supervisor when the directory is refused (403)', async () => {
		vi.mocked(fetchAgencyConsultantList).mockRejectedValue(
			new Error('403')
		);
		vi.mocked(apiGetSessionSupervisors).mockResolvedValue([
			supervisor(1, 'selma', 'enc.ONSWY')
		]);
		const source = createSupervisionPeopleSource({
			sessionId: 363,
			agencyId: '42',
			currentConsultantId: 'me',
			unknownName: 'Supervisor'
		});

		const [person] = await source.loadMembers();

		// Neither the encoded nor a plain login: the label the caller gave.
		expect(person.name).toBe('Supervisor');
		await expect(source.loadCandidates!()).rejects.toThrow();
	});

	it('adds with the written reason and reports the change', async () => {
		const onChanged = vi.fn();
		const source = createSupervisionPeopleSource({
			sessionId: 363,
			agencyId: '42',
			currentConsultantId: 'me',
			unknownName: 'Supervisor',
			onChanged
		});

		await source.addPerson!(
			{ id: 'selma', name: 'Selma Bouvier' },
			{ reason: 'Second opinion' }
		);

		expect(apiAddSessionSupervisor).toHaveBeenCalledWith(
			363,
			'selma',
			'Second opinion'
		);
		expect(onChanged).toHaveBeenCalledWith({
			kind: 'added',
			name: 'Selma Bouvier'
		});
	});

	it('removes by assignment id and reports the change', async () => {
		const onChanged = vi.fn();
		const source = createSupervisionPeopleSource({
			sessionId: 363,
			agencyId: '42',
			currentConsultantId: 'me',
			unknownName: 'Supervisor',
			onChanged
		});

		await source.removePerson!({
			id: '7',
			name: 'Selma Bouvier',
			role: 'supervisor',
			canRemove: true,
			canReplace: false
		});

		expect(apiRemoveSessionSupervisor).toHaveBeenCalledWith(363, 7);
		expect(onChanged).toHaveBeenCalledWith({
			kind: 'removed',
			name: 'Selma Bouvier'
		});
	});

	describe('replacing the supervisor in one step', () => {
		const setup = (onChanged = vi.fn()) => {
			vi.mocked(apiGetSessionSupervisors).mockResolvedValue([
				supervisor(1, 'patty', 'enc.PATTY')
			]);
			const source = createSupervisionPeopleSource({
				sessionId: 363,
				agencyId: '42',
				currentConsultantId: 'me',
				unknownName: 'Supervisor',
				onChanged
			});
			return { source, onChanged };
		};

		it('lets the counsellor replace every listed supervisor', async () => {
			const { source } = setup();
			const [patty] = await source.loadMembers();
			expect(patty.canReplace).toBe(true);
			expect(patty.canRemove).toBe(true);
		});

		it('adds the new supervisor only after the removal has finished', async () => {
			let finishRemoval: () => void = () => undefined;
			vi.mocked(apiRemoveSessionSupervisor).mockImplementation(
				() =>
					new Promise<void>((resolve) => {
						finishRemoval = resolve;
					})
			);
			vi.mocked(apiAddSessionSupervisor).mockResolvedValue(undefined);
			const { source, onChanged } = setup();
			const [patty] = await source.loadMembers();
			await source.loadCandidates!();

			const replacing = source.replacePerson!(
				patty,
				{ id: 'selma', name: 'Selma Bouvier' },
				{ reason: 'Different focus' }
			);
			await Promise.resolve();
			await Promise.resolve();
			expect(apiRemoveSessionSupervisor).toHaveBeenCalledWith(363, 1);
			expect(apiAddSessionSupervisor).not.toHaveBeenCalled();

			finishRemoval();
			await replacing;
			expect(apiAddSessionSupervisor).toHaveBeenCalledWith(
				363,
				'selma',
				'Different focus'
			);
			expect(onChanged).toHaveBeenCalledTimes(1);
		});

		it('removes the old supervisor first, then adds the new one, and reports one change', async () => {
			const order: string[] = [];
			vi.mocked(apiRemoveSessionSupervisor).mockImplementation(
				async () => {
					order.push('remove');
				}
			);
			vi.mocked(apiAddSessionSupervisor).mockImplementation(async () => {
				order.push('add');
			});
			const { source, onChanged } = setup();
			const [patty] = await source.loadMembers();
			await source.loadCandidates!();

			await source.replacePerson!(
				patty,
				{ id: 'selma', name: 'Selma Bouvier' },
				{ reason: 'Different focus' }
			);

			expect(order).toEqual(['remove', 'add']);
			expect(apiRemoveSessionSupervisor).toHaveBeenCalledWith(363, 1);
			expect(apiAddSessionSupervisor).toHaveBeenCalledWith(
				363,
				'selma',
				'Different focus'
			);
			expect(onChanged).toHaveBeenCalledTimes(1);
			expect(onChanged).toHaveBeenCalledWith({
				kind: 'replaced',
				from: 'Patty Bouvier',
				to: 'Selma Bouvier'
			});
		});

		it('does not add anyone when the removal fails', async () => {
			vi.mocked(apiRemoveSessionSupervisor).mockRejectedValue(
				new Error('no')
			);
			const { source, onChanged } = setup();
			const [patty] = await source.loadMembers();

			await expect(
				source.replacePerson!(
					patty,
					{ id: 'selma', name: 'Selma' },
					{ reason: 'x' }
				)
			).rejects.toThrow('no');

			expect(apiAddSessionSupervisor).not.toHaveBeenCalled();
			expect(onChanged).not.toHaveBeenCalled();
		});

		it('reports the removal and rethrows when only the new supervisor cannot be added', async () => {
			vi.mocked(apiRemoveSessionSupervisor).mockResolvedValue(
				undefined as any
			);
			vi.mocked(apiAddSessionSupervisor).mockRejectedValue(
				new Error('refused')
			);
			const { source, onChanged } = setup();
			const [patty] = await source.loadMembers();

			await expect(
				source.replacePerson!(
					patty,
					{ id: 'selma', name: 'Selma' },
					{ reason: 'x' }
				)
			).rejects.toThrow('refused');

			expect(onChanged).toHaveBeenCalledTimes(1);
			expect(onChanged).toHaveBeenCalledWith({
				kind: 'removed',
				name: 'Patty Bouvier'
			});
		});
	});
});

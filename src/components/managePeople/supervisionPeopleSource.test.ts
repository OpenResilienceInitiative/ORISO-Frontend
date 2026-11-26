// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { createSupervisionPeopleSource } from './supervisionPeopleSource';
import { fetchAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import { apiAddSessionSupervisor } from '../../api/apiAddSessionSupervisor';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiRemoveSessionSupervisor } from '../../api/apiRemoveSessionSupervisor';
import { apiReplaceSessionSupervisor } from '../../api/apiReplaceSessionSupervisor';

vi.mock('../../api/apiGetAgencyConsultantList');
vi.mock('../../api/apiAddSessionSupervisor');
vi.mock('../../api/apiGetSessionSupervisors');
vi.mock('../../api/apiRemoveSessionSupervisor');
vi.mock('../../api/apiReplaceSessionSupervisor');

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

		it('swaps the supervisor in one server call and reports one change', async () => {
			vi.mocked(apiReplaceSessionSupervisor).mockResolvedValue({
				id: 2,
				matrixRoomId: '!side:dev',
				supervisorMatrixUserId: '@selma:dev'
			} as any);
			const { source, onChanged } = setup();
			const [patty] = await source.loadMembers();
			await source.loadCandidates!();

			await source.replacePerson!(
				patty,
				{ id: 'selma', name: 'Selma Bouvier' },
				{ reason: 'Different focus' }
			);

			expect(apiReplaceSessionSupervisor).toHaveBeenCalledWith(
				363,
				1,
				'selma',
				'Different focus',
				true
			);
			expect(apiRemoveSessionSupervisor).not.toHaveBeenCalled();
			expect(apiAddSessionSupervisor).not.toHaveBeenCalled();
			expect(onChanged).toHaveBeenCalledTimes(1);
			expect(onChanged).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: 'replaced',
					from: 'Patty Bouvier',
					to: 'Selma Bouvier',
					sideRoomId: '!side:dev',
					supervisorMatrixUserId: '@selma:dev'
				})
			);
		});

		it("passes the counsellor's choice not to notify the advice seeker", async () => {
			vi.mocked(apiReplaceSessionSupervisor).mockResolvedValue({} as any);
			const { source } = setup();
			const [patty] = await source.loadMembers();

			await source.replacePerson!(
				patty,
				{ id: 'selma', name: 'Selma' },
				{ reason: 'x', notifyClient: false }
			);

			expect(apiReplaceSessionSupervisor).toHaveBeenCalledWith(
				363,
				1,
				'selma',
				'x',
				false
			);
		});

		it('rethrows and reports nothing when the swap is refused', async () => {
			vi.mocked(apiReplaceSessionSupervisor).mockRejectedValue(
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

			expect(onChanged).not.toHaveBeenCalled();
		});

		it('does not wait for the caller to refresh before resolving', async () => {
			vi.mocked(apiReplaceSessionSupervisor).mockResolvedValue({} as any);
			const onChanged = vi.fn(() => new Promise<void>(() => undefined));
			const { source } = setup(onChanged);
			const [patty] = await source.loadMembers();

			await source.replacePerson!(
				patty,
				{ id: 'selma', name: 'Selma' },
				{ reason: 'x' }
			);

			expect(onChanged).toHaveBeenCalledTimes(1);
		});
	});
});

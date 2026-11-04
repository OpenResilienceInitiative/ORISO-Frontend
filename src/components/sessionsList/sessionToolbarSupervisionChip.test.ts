/**
 * Supervision chip (ADR-008 list marker).
 *
 * The chip must match sessions the viewer actively supervises, using the
 * backend's `session.supervision` marker. Older backends do not send the
 * marker — there the old "any non-owner consultant row" heuristic remains so
 * the chip keeps working until the backend is upgraded.
 */
import { describe, expect, it } from 'vite-plus/test';
import { sessionMatchesToolbar } from './sessionToolbarFilters';
import { classifySession } from '../../utils/displayFilter/sessions';

const ME = 'consultant-me';
const OWNER = 'consultant-owner';

const raw = (session: Record<string, unknown>, consultantId = OWNER) =>
	({
		consultant: { id: consultantId },
		session: {
			id: 1,
			matrixRoomId: '!room:hs',
			messagesRead: true,
			...session
		}
	}) as any;

const extended = (r: any) => ({ isGroup: false, item: r.session }) as any;

const matches = (r: any, me = ME) =>
	sessionMatchesToolbar(r, extended(r), '', 'supervision', [], [], me);

describe('sessionMatchesToolbar — supervision chip', () => {
	it('matches when the marker says supervisedByMe', () => {
		const r = raw({
			supervision: {
				supervisedByMe: true,
				supervisorConsultantIds: [ME],
				supervisorDisplayNames: ['Me']
			}
		});
		expect(matches(r)).toBe(true);
	});

	it('does not match a non-owner row when the marker says I do not supervise it', () => {
		const r = raw({
			supervision: {
				supervisedByMe: false,
				supervisorConsultantIds: ['someone-else'],
				supervisorDisplayNames: ['Someone']
			}
		});
		expect(matches(r)).toBe(false);
	});

	it('does not match my own session when the marker is present and empty', () => {
		const r = raw(
			{
				supervision: {
					supervisedByMe: false,
					supervisorConsultantIds: [],
					supervisorDisplayNames: []
				}
			},
			ME
		);
		expect(matches(r)).toBe(false);
	});

	it('matches my own session when the marker lists me (defensive: id list wins)', () => {
		const r = raw(
			{
				supervision: {
					supervisorConsultantIds: [ME],
					supervisorDisplayNames: ['Me']
				}
			},
			ME
		);
		expect(matches(r)).toBe(true);
	});

	describe('fallback without marker (older backend)', () => {
		it('keeps matching non-owner consultant rows', () => {
			expect(matches(raw({}))).toBe(true);
		});

		it('keeps excluding own rows', () => {
			expect(matches(raw({}, ME))).toBe(false);
		});

		it('keeps excluding rows without a consultant', () => {
			const r = raw({});
			delete r.consultant;
			expect(matches(r)).toBe(false);
		});
	});

	describe('group chats are never supervision (#1703)', () => {
		// Shape measured on dev.oriso.org 2026-10-28: a colleague's internal
		// group chat, `session: null`, no supervision marker.
		const colleagueGroup = (conversationType: string) => {
			const r = {
				consultant: { id: OWNER },
				session: null,
				chat: {
					id: 24,
					matrixRoomId: '!g24:hs',
					conversationType,
					messagesRead: true
				}
			} as any;
			return { r, ext: { isGroup: true, item: r.chat } as any };
		};

		it.each(['INTERNAL_GROUP', 'SELF_HELP'])(
			"a colleague's %s chat without marker is not supervision",
			(conversationType) => {
				const { r, ext } = colleagueGroup(conversationType);
				expect(
					sessionMatchesToolbar(r, ext, '', 'supervision', [], [], ME)
				).toBe(false);
			}
		);

		it("a colleague's 1:1 session without marker still is (older backend)", () => {
			expect(
				matches(raw({ conversationType: 'AGENCY_COUNSELLING' }))
			).toBe(true);
		});

		it('agrees with classifySession on every row', () => {
			const oneToOne = raw({});
			const rows = [
				{ r: oneToOne, ext: extended(oneToOne) },
				colleagueGroup('INTERNAL_GROUP'),
				colleagueGroup('SELF_HELP')
			];
			rows.forEach(({ r, ext }) => {
				expect(
					sessionMatchesToolbar(r, ext, '', 'supervision', [], [], ME)
				).toBe(classifySession(r, ext, ME, true) === 'supervision');
			});
		});
	});
});

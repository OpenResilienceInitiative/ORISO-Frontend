// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	InvitationAfterAppointmentError,
	saveAppointmentInvitation
} from './saveAppointmentInvitation';
import {
	fromInvitationPresetState,
	MEDIUM_FOR_KIND,
	toInvitationPresetState
} from './invitationModel';

const { create, move, invite } = vi.hoisted(() => ({
	create: vi.fn(),
	move: vi.fn(),
	invite: vi.fn()
}));
vi.mock('../../api/apiSessionAppointments', () => ({
	apiCreateSessionAppointment: create,
	apiMoveSessionAppointment: move
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiCreateSessionDirectInvitation: invite
}));

const slot = {
	start: new Date('2026-11-20T13:00:00.000Z'),
	end: new Date('2026-11-20T14:00:00.000Z')
};
const link = { validityMinutes: 60, access: 'guests' as const, knock: false };

describe('saveAppointmentInvitation — one save path for the 1:1 and the calendar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		create.mockResolvedValue({ id: 'a1' });
		invite.mockResolvedValue({ id: 'l1' });
	});

	it('stores only the appointment with its Art when nobody else is invited', async () => {
		await expect(
			saveAppointmentInvitation({
				sessionId: 4,
				slot,
				kind: 'onsite',
				link: null
			})
		).resolves.toEqual({ appointmentId: 'a1' });
		expect(create).toHaveBeenCalledWith(4, {
			startTime: '2026-11-20T13:00:00.000Z',
			endTime: '2026-11-20T14:00:00.000Z',
			kind: 'ONSITE'
		});
		expect(invite).not.toHaveBeenCalled();
	});

	it('binds the invitation to the stored appointment, with the medium of the Art', async () => {
		await expect(
			saveAppointmentInvitation({
				sessionId: 4,
				slot,
				kind: 'phone',
				link
			})
		).resolves.toEqual({ appointmentId: 'a1', invitation: { id: 'l1' } });
		expect(invite).toHaveBeenCalledWith(4, {
			appointmentId: 'a1',
			medium: 'AUDIO',
			validityAfterEndMinutes: 60,
			accessMode: 'GUESTS_ONLY',
			knock: false
		});
	});

	it('reports a refused link with the appointment it already stored', async () => {
		const refusal = new Response(null, { status: 409 });
		invite.mockRejectedValue(refusal);
		const error = await saveAppointmentInvitation({
			sessionId: 4,
			slot,
			kind: 'video',
			link
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(InvitationAfterAppointmentError);
		expect((error as InvitationAfterAppointmentError).appointmentId).toBe(
			'a1'
		);
		expect((error as InvitationAfterAppointmentError).cause).toBe(refusal);
	});

	it('retries only the link for an unchanged stored appointment', async () => {
		await saveAppointmentInvitation({
			sessionId: 4,
			slot,
			link,
			saved: { appointmentId: 'a1', slot }
		});
		expect(create).not.toHaveBeenCalled();
		expect(move).not.toHaveBeenCalled();
		expect(invite).toHaveBeenCalledWith(
			4,
			expect.objectContaining({ appointmentId: 'a1' })
		);
	});

	it('stores a changed Art before the retry, so appointment and link agree', async () => {
		await saveAppointmentInvitation({
			sessionId: 4,
			slot,
			kind: 'phone',
			link,
			saved: { appointmentId: 'a1', slot, kind: 'video' }
		});
		expect(create).not.toHaveBeenCalled();
		expect(move).toHaveBeenCalledWith(4, 'a1', {
			startTime: '2026-11-20T13:00:00.000Z',
			endTime: '2026-11-20T14:00:00.000Z',
			kind: 'PHONE'
		});
		expect(invite).toHaveBeenCalledWith(
			4,
			expect.objectContaining({ appointmentId: 'a1', medium: 'AUDIO' })
		);
	});

	it('leaves an appointment failure as it is: nothing was stored', async () => {
		const failure = new Error('down');
		create.mockRejectedValue(failure);
		await expect(
			saveAppointmentInvitation({ sessionId: 4, slot, link })
		).rejects.toBe(failure);
		expect(invite).not.toHaveBeenCalled();
	});
});

describe('the calendar hands a new person to "Chat erstellen"', () => {
	it('keeps slot and Art through router state', () => {
		const state = toInvitationPresetState({ ...slot, kind: 'onsite' });
		expect(JSON.parse(JSON.stringify(state))).toEqual(state);
		expect(fromInvitationPresetState(state)).toEqual({
			...slot,
			kind: 'onsite'
		});
	});

	it('ignores state that is no preset', () => {
		expect(fromInvitationPresetState(null)).toBeUndefined();
		expect(
			fromInvitationPresetState({
				invitationPreset: { start: 'x', end: 'y' }
			})
		).toBeUndefined();
		expect(
			fromInvitationPresetState({
				invitationPreset: {
					start: slot.end.toISOString(),
					end: slot.start.toISOString()
				}
			})
		).toBeUndefined();
		expect(
			fromInvitationPresetState({
				invitationPreset: {
					start: slot.start.toISOString(),
					end: slot.end.toISOString(),
					kind: 'teleport'
				}
			})
		).toEqual(slot);
	});

	it('opens a link for every Art: on site meets in the chat', () => {
		expect(MEDIUM_FOR_KIND).toEqual({
			video: 'VIDEO',
			phone: 'AUDIO',
			chat: 'CHAT',
			onsite: 'CHAT'
		});
	});
});

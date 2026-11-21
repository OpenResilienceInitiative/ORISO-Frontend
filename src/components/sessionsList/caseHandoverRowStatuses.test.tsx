// @vitest-environment oriso-jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vite-plus/test';
import type { CaseHandoverCandidate } from '../../api/apiCaseHandover';
import { useCaseHandoverRowStatuses } from './caseHandoverRowStatuses';

const candidate = (status: string): CaseHandoverCandidate => ({
	session: { id: 11 } as CaseHandoverCandidate['session'],
	caseHandoverStatus: { status, canViewContent: false, hasRequest: true }
});

it('ignores late status responses from a previous archive or actor scope', () => {
	const { result, rerender } = renderHook(
		({ actor, archived }) =>
			useCaseHandoverRowStatuses(actor, archived, true),
		{ initialProps: { actor: 'consultant-a', archived: false } }
	);
	const activeRead = result.current.startRead();
	rerender({ actor: 'consultant-a', archived: true });
	const archivedRead = result.current.startRead();
	act(() => archivedRead([candidate('DENIED')]));
	act(() => activeRead([candidate('NOT_REQUESTED')]));
	expect(result.current.getRowStatus(11)?.lockedStatus?.status).toBe(
		'DENIED'
	);

	const oldActorRead = result.current.startRead();
	rerender({ actor: 'consultant-b', archived: true });
	expect(result.current.getRowStatus(11)).toBeUndefined();
	act(() => oldActorRead([candidate('DENIED')]));
	expect(result.current.getRowStatus(11)).toBeUndefined();
	const currentActorRead = result.current.startRead();
	act(() => currentActorRead([candidate('PENDING_CLIENT_CONSENT')]));
	expect(result.current.getRowStatus(11)?.lockedStatus?.status).toBe(
		'PENDING_CLIENT_CONSENT'
	);
});

it('uses the current read for each row and falls back for an unrecognized status', () => {
	const { result } = renderHook(() =>
		useCaseHandoverRowStatuses('consultant', false, true)
	);
	const blank = result.current.startRead();
	const named = result.current.startRead();
	act(() => named([candidate('PENDING_CLIENT_CONSENT')]));
	act(() => blank([candidate('NOT_REQUESTED')]));
	expect(result.current.getRowStatus(11)?.lockedStatus?.status).toBe(
		'PENDING_CLIENT_CONSENT'
	);
	const next = result.current.startRead();
	act(() => next([candidate('UNRECOGNIZED_STATUS')]));
	expect(result.current.getRowStatus(11)?.lockedStatus).toBeUndefined();
});

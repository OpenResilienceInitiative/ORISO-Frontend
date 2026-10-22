// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConversationActions } from './useConversationActions';

const transport = vi.hoisted(() => ({
	sendReaction: vi.fn(async () => ({ success: true })),
	removeReaction: vi.fn(async () => ({ success: true })),
	redactMessage: vi.fn(async () => ({ success: true }))
}));

// The real service pulls in matrix-js-sdk; the hook only needs these calls.
vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: transport
}));

const ROOM = '!room:matrix.example';

const message = (overrides: Record<string, unknown> = {}): any => ({
	_id: '$m1',
	message: '<p>Hallo <strong>Welt</strong></p>',
	displayName: 'Lisa',
	username: 'lisa',
	userId: '@lisa:matrix.example',
	...overrides
});

const setup = (props: Parameters<typeof useConversationActions>[0]) =>
	renderHook((current) => useConversationActions(current), {
		initialProps: props
	});

afterEach(() => vi.clearAllMocks());

describe('useConversationActions (#1824 S1)', () => {
	it('reacts, un-reacts and deletes in the given room', async () => {
		const { result } = setup({ roomId: ROOM });
		await act(async () => {
			result.current.handleReact('$m1', '👍');
			result.current.handleUnreact('$r1');
			result.current.handleDeleteDirect(message());
		});
		expect(transport.sendReaction).toHaveBeenCalledWith({
			matrixRoomId: ROOM,
			targetEventId: '$m1',
			key: '👍'
		});
		expect(transport.removeReaction).toHaveBeenCalledWith({
			matrixRoomId: ROOM,
			reactionEventId: '$r1'
		});
		expect(transport.redactMessage).toHaveBeenCalledWith({
			matrixRoomId: ROOM,
			targetEventId: '$m1'
		});
	});

	it('does nothing without a room', async () => {
		const { result } = setup({ roomId: null });
		await act(async () => {
			result.current.handleReact('$m1', '👍');
			result.current.handleDeleteDirect(message());
		});
		expect(transport.sendReaction).not.toHaveBeenCalled();
		expect(transport.redactMessage).not.toHaveBeenCalled();
	});

	it('reports a settled write and a failed one', async () => {
		const onWrite = vi.fn();
		const onWriteFailed = vi.fn();
		transport.sendReaction.mockRejectedValueOnce(new Error('403'));
		const { result } = setup({ roomId: ROOM, onWrite, onWriteFailed });
		await act(async () => {
			result.current.handleReact('$m1', '👍');
		});
		expect(onWriteFailed).toHaveBeenCalledTimes(1);
		expect(onWrite).not.toHaveBeenCalled();
		await act(async () => {
			result.current.handleReact('$m1', '👍');
		});
		expect(onWrite).toHaveBeenCalledTimes(1);
	});

	it('builds the reply and edit context the composer expects', () => {
		const { result } = setup({ roomId: ROOM });
		act(() => result.current.handleReplyDirect(message()));
		expect(result.current.replyTo).toMatchObject({
			eventId: '$m1',
			text: 'Hallo Welt'
		});
		act(() => result.current.handleEditDirect(message()));
		// Composer HTML, so formatting survives an edit (#978).
		expect(result.current.editingMessage?.eventId).toBe('$m1');
		expect(result.current.editingMessage?.text).toContain(
			'<strong>Welt</strong>'
		);
		act(() => {
			result.current.handleCancelReply();
			result.current.handleCancelEdit();
		});
		expect(result.current.replyTo).toBeNull();
		expect(result.current.editingMessage).toBeNull();
	});

	it('drops a reply or edit context when the conversation changes', () => {
		const { result, rerender } = setup({ roomId: ROOM, resetKey: 'a' });
		act(() => {
			result.current.handleReplyDirect(message());
			result.current.handleEditDirect(message());
		});
		rerender({ roomId: ROOM, resetKey: 'b' });
		expect(result.current.replyTo).toBeNull();
		expect(result.current.editingMessage).toBeNull();
	});
});

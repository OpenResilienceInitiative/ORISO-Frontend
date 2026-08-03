// @vitest-environment jsdom
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMatrixActivityEvent } from '../../hooks/useMatrixActivityEvent';
import { MatrixActivityPreviewHydrator } from './MatrixActivityPreviewHydrator';

vi.mock('../../hooks/useMatrixActivityEvent', () => ({
	useMatrixActivityEvent: vi.fn()
}));

describe('MatrixActivityPreviewHydrator', () => {
	it('publishes sender plus the exact decrypted message as searchable card text', async () => {
		const event = {
			getType: () => 'm.room.message',
			getContent: () => ({ body: 'the exact message' })
		};
		vi.mocked(useMatrixActivityEvent).mockReturnValue({
			status: 'resolved',
			event
		} as any);
		const onPreviewChange = vi.fn();

		render(
			<MatrixActivityPreviewHydrator
				activityEventId="activity-1"
				roomRef="!room:oriso"
				matrixEventId="$event"
				senderName="Lisa"
				fallbackText="You received a new message."
				labels={{
					image: 'Image',
					file: 'File',
					audio: 'Audio message',
					video: 'Video',
					notice: 'Notice',
					unsupported: 'Unsupported message'
				}}
				onPreviewChange={onPreviewChange}
			/>
		);

		await waitFor(() =>
			expect(onPreviewChange).toHaveBeenCalledWith(
				'activity-1',
				'Lisa: the exact message',
				'text'
			)
		);
	});
});

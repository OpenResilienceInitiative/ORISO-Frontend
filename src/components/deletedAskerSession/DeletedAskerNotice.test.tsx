// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeletedAskerNotice } from './DeletedAskerNotice';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const translate = (key: string, options?: Record<string, unknown>) =>
	options?.date ? `${key}:${options.date}` : key;

const renderNotice = (
	props: Partial<React.ComponentProps<typeof DeletedAskerNotice>> = {}
) =>
	render(
		<MemoryRouter>
			<DeletedAskerNotice
				translate={translate}
				deletedOn="12. November 2026"
				archiveState="idle"
				onArchive={() => undefined}
				backPath="/sessions/consultant/sessionView"
				{...props}
			/>
		</MemoryRouter>
	);

afterEach(cleanup);

describe('DeletedAskerNotice', () => {
	it('says the chat was deleted and when, without guessing who', () => {
		renderNotice();

		expect(
			screen.getByText('deletedAskerSession.notice.title')
		).toBeTruthy();
		expect(
			screen.getByText(
				'deletedAskerSession.notice.deletedOn:12. November 2026'
			)
		).toBeTruthy();
		expect(
			screen.getByText('deletedAskerSession.notice.text')
		).toBeTruthy();
	});

	it('leaves the date out when it is not known', () => {
		renderNotice({ deletedOn: null });

		expect(
			screen.queryByText(/deletedAskerSession\.notice\.deletedOn/)
		).toBeNull();
	});

	it('archives with the existing archive action', () => {
		const onArchive = vi.fn();
		renderNotice({ onArchive });

		fireEvent.click(
			screen.getByRole('button', { name: 'chatFlyout.archive' })
		);

		expect(onArchive).toHaveBeenCalledTimes(1);
	});

	it('blocks a second click while archiving and reports a failure', () => {
		const { rerender } = renderNotice({ archiveState: 'busy' });
		expect(
			(
				screen.getByRole('button', {
					name: 'chatFlyout.archive'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);

		rerender(
			<MemoryRouter>
				<DeletedAskerNotice
					translate={translate}
					deletedOn={null}
					archiveState="failed"
					onArchive={() => undefined}
					backPath="/x"
				/>
			</MemoryRouter>
		);
		expect(screen.getByRole('alert').textContent).toBe(
			'deletedAskerSession.archiveFailed'
		);
	});

	it('offers no archive action once the entry is in the archive', () => {
		renderNotice({ archiveState: 'archived', onArchive: undefined });

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('deletedAskerSession.archived')).toBeTruthy();
	});
});

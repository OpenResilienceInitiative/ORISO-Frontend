// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

const apiPutSessionData = vi.hoisted(() => vi.fn());
const regeneratePseudonym = vi.hoisted(() =>
	vi.fn(() => ({
		displayName: 'Ruhiges Yak Kim',
		avatar: { file: 'yak.svg', bg: '#fff', iconColor: '#000' },
		animalLabel: 'Yak',
		name: 'Kim'
	}))
);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../api/apiPutSessionData', () => ({
	apiPutSessionData: (...args: unknown[]) => apiPutSessionData(...args)
}));

vi.mock('../../utils/pseudonymGenerator', () => ({
	regeneratePseudonym: (...args: unknown[]) => regeneratePseudonym(...args)
}));

vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' },
	Overlay: ({
		item,
		handleOverlay
	}: React.ComponentProps<typeof import('../overlay/Overlay').Overlay>) => (
		<div>
			<h2>{item.headline}</h2>
			{item.copy && <p>{item.copy}</p>}
			{item.nestedComponent}
			{item.buttonSet?.map((button) => (
				<button
					key={button.label}
					disabled={button.disabled}
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</div>
	)
}));

/* eslint-disable-next-line import/first -- component import must follow vi.mock */
import { ErstantwortDisplayNameOverlay } from './ErstantwortDisplayNameOverlay';

afterEach(cleanup);
beforeEach(() => {
	apiPutSessionData.mockReset();
	apiPutSessionData.mockResolvedValue(undefined);
	regeneratePseudonym.mockClear();
});

describe('ErstantwortDisplayNameOverlay', () => {
	it('shows the current name and re-rolls it with the dice', () => {
		render(
			<ErstantwortDisplayNameOverlay
				sessionId={51}
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={vi.fn()}
				onSaved={vi.fn()}
			/>
		);

		expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
			'Sanftes Alpaka Kala'
		);

		act(() => {
			screen.getByRole('button', { name: 'Namen neu würfeln' }).click();
		});

		expect(regeneratePseudonym).toHaveBeenCalledWith(
			expect.objectContaining({ displayName: 'Sanftes Alpaka Kala' }),
			'de'
		);
		expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
			'Ruhiges Yak Kim'
		);
	});

	it('disables re-roll while the save request is in flight', async () => {
		let finishSave: (value?: unknown) => void = () => undefined;
		apiPutSessionData.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishSave = resolve;
				})
		);

		render(
			<ErstantwortDisplayNameOverlay
				sessionId={51}
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={vi.fn()}
				onSaved={vi.fn()}
			/>
		);

		act(() => {
			screen.getByRole('button', { name: 'Übernehmen' }).click();
		});

		expect(
			(
				screen.getByRole('button', {
					name: 'Namen neu würfeln'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);

		await act(async () => {
			finishSave();
		});
	});

	it('saves the rolled name via apiPutSessionData', async () => {
		const onSaved = vi.fn();
		render(
			<ErstantwortDisplayNameOverlay
				sessionId={51}
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={vi.fn()}
				onSaved={onSaved}
			/>
		);

		act(() => {
			screen.getByRole('button', { name: 'Namen neu würfeln' }).click();
		});
		act(() => {
			screen.getByRole('button', { name: 'Übernehmen' }).click();
		});

		await waitFor(() =>
			expect(apiPutSessionData).toHaveBeenCalledWith(51, {
				displayName: 'Ruhiges Yak Kim'
			})
		);
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
	});

	it('closes without saving', () => {
		const onClose = vi.fn();
		render(
			<ErstantwortDisplayNameOverlay
				sessionId={51}
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={onClose}
				onSaved={vi.fn()}
			/>
		);

		act(() => {
			screen.getByRole('button', { name: 'Close' }).click();
		});

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(apiPutSessionData).not.toHaveBeenCalled();
	});
});

describe('display-name typing is governed by the tenant account permission', () => {
	it('saves a custom alias when typing is allowed', async () => {
		render(
			<ErstantwortDisplayNameOverlay
				sessionId={51}
				currentName="Ruhiges Yak Kim"
				locale="de"
				editable
				onClose={vi.fn()}
				onSaved={vi.fn()}
			/>
		);
		fireEvent.change(
			screen.getByRole('textbox', { name: 'profile.data.displayName' }),
			{
				target: { value: 'My custom name' }
			}
		);
		fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
		await waitFor(() =>
			expect(apiPutSessionData).toHaveBeenCalledWith(51, {
				displayName: 'My custom name'
			})
		);
	});
	it('keeps the dice while the name field is read-only', () => {
		render(
			<ErstantwortDisplayNameOverlay
				sessionId={51}
				currentName="Ruhiges Yak Kim"
				locale="de"
				editable={false}
				onClose={vi.fn()}
				onSaved={vi.fn()}
			/>
		);
		expect(
			screen.getByRole<HTMLInputElement>('textbox', {
				name: 'profile.data.displayName'
			}).readOnly
		).toBe(true);
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'Namen neu würfeln'
			}).disabled
		).toBe(false);
	});
});

it('does not let an old save close the editor for another session', async () => {
	let finishSave = () => {};
	apiPutSessionData.mockReturnValueOnce(
		new Promise<void>((resolve) => {
			finishSave = resolve;
		})
	);
	const saved = vi.fn();
	const Frame = ({ sessionId }: { sessionId: number }) => {
		const [open, setOpen] = React.useState(true);
		return open ? (
			<ErstantwortDisplayNameOverlay
				key={sessionId}
				sessionId={sessionId}
				currentName={sessionId === 51 ? 'First name' : 'Second name'}
				locale="de"
				editable
				onClose={() => setOpen(false)}
				onSaved={saved}
			/>
		) : null;
	};
	const view = render(<Frame sessionId={51} />);
	fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
	view.rerender(<Frame sessionId={52} />);
	await act(async () => {
		finishSave();
	});
	expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
		'Second name'
	);
	expect(saved).not.toHaveBeenCalled();
});

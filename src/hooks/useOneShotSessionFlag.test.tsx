// @vitest-environment jsdom
import * as React from 'react';
import { Suspense } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOneShotSessionFlag } from './useOneShotSessionFlag';

const KEY = 'test_oneShotFlag';

const Probe = ({
	wait
}: {
	wait?: { done: boolean; promise: Promise<void> };
}) => {
	const flagged = useOneShotSessionFlag(KEY);
	// A first render that suspends is thrown away and runs again (FE#1807).
	if (wait && !wait.done) throw wait.promise;
	return <span>{String(flagged)}</span>;
};

describe('useOneShotSessionFlag', () => {
	afterEach(() => {
		cleanup();
		sessionStorage.clear();
	});

	it('keeps the flag through a render React throws away, then clears it', async () => {
		sessionStorage.setItem(KEY, 'true');
		let resolve = () => {};
		const wait = {
			done: false,
			promise: new Promise<void>((done) => {
				resolve = done;
			})
		};
		const { container } = render(
			<Suspense fallback={<span>loading</span>}>
				<Probe wait={wait} />
			</Suspense>
		);
		expect(container.textContent).toBe('loading');
		await act(async () => {
			wait.done = true;
			resolve();
			await wait.promise;
		});
		expect(container.textContent).toBe('true');
		expect(sessionStorage.getItem(KEY)).toBeNull();
	});

	it('reads false once the flag is gone', () => {
		const { container } = render(<Probe />);
		expect(container.textContent).toBe('false');
	});
});

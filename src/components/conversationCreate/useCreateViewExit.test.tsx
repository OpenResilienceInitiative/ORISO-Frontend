// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useCreateViewExit } from './useCreateViewExit';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const Harness = ({
	blocked,
	dirty,
	onLeave
}: {
	blocked: boolean;
	dirty: boolean;
	onLeave: () => void;
}) => {
	const { surfaceRef, discardDialog } = useCreateViewExit({
		hasExtraInput: () => dirty,
		isBlocked: () => blocked,
		onLeave
	});
	return (
		<div>
			<div className="conversationCreate" ref={surfaceRef} />
			{discardDialog}
		</div>
	);
};

describe('useCreateViewExit', () => {
	afterEach(cleanup);

	it('stays open on Escape while a request is running', () => {
		const onLeave = vi.fn();
		render(<Harness blocked dirty={false} onLeave={onLeave} />);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onLeave).not.toHaveBeenCalled();
	});

	it('stays open on a click outside while a request is running', () => {
		const onLeave = vi.fn();
		render(<Harness blocked dirty={false} onLeave={onLeave} />);
		fireEvent.click(document.body);
		expect(onLeave).not.toHaveBeenCalled();
	});

	it('leaves on Escape when idle and clean', () => {
		const onLeave = vi.fn();
		render(<Harness blocked={false} dirty={false} onLeave={onLeave} />);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onLeave).toHaveBeenCalledTimes(1);
	});

	it('asks first when extra input (name or colleagues) exists', () => {
		const onLeave = vi.fn();
		render(<Harness blocked={false} dirty onLeave={onLeave} />);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onLeave).not.toHaveBeenCalled();
	});
});

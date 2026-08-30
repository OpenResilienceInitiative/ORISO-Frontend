// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationChoiceCard } from './NotificationChoiceCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'erstantwort.notificationChoice.email':
				'Schreiben Sie mir eine E-Mail',
			'erstantwort.notificationChoice.emailHint':
				'Was Sie hier besprechen, steht nie in dieser E-Mail.',
			'erstantwort.notificationChoice.browser':
				'Geben Sie mir hier ein Signal',
			'erstantwort.notificationChoice.browserHint':
				'Ohne Adresse — funktioniert aber nur auf diesem Gerät.',
			'erstantwort.notificationChoice.both':
				'Beides, und Passwort jetzt selbst festlegen',
			'erstantwort.notificationChoice.bothHint':
				'Empfohlen. Dann kommen Sie auch wieder herein, wenn Sie etwas vergessen.'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

describe('NotificationChoiceCard (#825 post-dispatch)', () => {
	afterEach(cleanup);

	it('offers the three ways to be reached, each as its own target', () => {
		render(<NotificationChoiceCard onChoose={() => undefined} />);

		expect(screen.getAllByRole('button')).toHaveLength(3);
		expect(screen.getByText(/Schreiben Sie mir eine E-Mail/i)).toBeTruthy();
		expect(screen.getByText(/Geben Sie mir hier ein Signal/i)).toBeTruthy();
		expect(screen.getByText(/Beides/i)).toBeTruthy();
	});

	it('reports the chosen way to the caller', () => {
		const onChoose = vi.fn();
		render(<NotificationChoiceCard onChoose={onChoose} />);

		fireEvent.click(screen.getByText(/Schreiben Sie mir eine E-Mail/i));

		expect(onChoose).toHaveBeenCalledWith('EMAIL');
	});

	it('never offers a browser signal the browser cannot deliver', () => {
		render(
			<NotificationChoiceCard
				isBrowserNotificationSupported={false}
				onChoose={() => undefined}
			/>
		);

		expect(screen.queryByText(/Geben Sie mir hier ein Signal/i)).toBeNull();
		expect(screen.getAllByRole('button')).toHaveLength(2);
	});

	it('says out loud that the browser signal only reaches this device', () => {
		render(<NotificationChoiceCard onChoose={() => undefined} />);

		expect(screen.getByText(/nur auf diesem Gerät/i)).toBeTruthy();
	});

	it('marks the chosen option as pressed so it is not answered twice', () => {
		render(<NotificationChoiceCard onChoose={() => undefined} />);

		const both = screen.getByText(/Beides/i).closest('button');
		fireEvent.click(both as HTMLButtonElement);

		expect(both?.getAttribute('aria-pressed')).toBe('true');
	});
});

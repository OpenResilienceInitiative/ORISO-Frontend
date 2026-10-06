import * as React from 'react';
import { useLayoutEffect } from 'react';
import i18n from 'i18next';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';
import type { TourDefinition } from '../productTour/types';
import {
	enterPracticeMode,
	exitPracticeMode
} from '../../practice/practiceMode';

/** Stand-ins for the S5/S6 tours in stories; same ids, own keys. */
export const storyPracticeTours: TourDefinition[] = [
	{
		id: 'consultant-practice-accept',
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 'tour.practice.accept.title',
		summaryKey: 'tour.practice.accept.summary',
		dismissible: false,
		steps: []
	},
	{
		id: 'consultant-practice-supervision',
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 'tour.practice.supervision.title',
		summaryKey: 'tour.practice.supervision.summary',
		dismissible: false,
		steps: []
	}
];

/**
 * Story-only German copy for the tour titles, until S5/S6 ship theirs. Added
 * without overwriting, so the real copy wins as soon as it exists.
 */
export const provideStoryPracticeCopy = (): void => {
	i18n.addResourceBundle(
		'de',
		'common',
		{
			tour: {
				practice: {
					accept: {
						title: 'Anfrage annehmen',
						summary:
							'Nehmen Sie eine Übungsanfrage an und schreiben Sie die erste Antwort.'
					},
					supervision: {
						title: 'Supervision',
						summary:
							'Ziehen Sie in einem laufenden Übungsfall eine Supervisorin hinzu.'
					}
				}
			}
		},
		true,
		false
	);
};

type ProgressFixture = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'surface' | 'status'
>[];

/**
 * Serves the progress read of the practice cards, like the tour list does on
 * Dev. Installed in a layout effect: it runs before the cards' passive-effect
 * fetch, and the cleanup restores `fetch` even when React abandons a render.
 */
export const ScopedProgressFetch = ({
	progress = [],
	children
}: {
	progress?: ProgressFixture;
	children: React.ReactNode;
}) => {
	useLayoutEffect(() => {
		const realFetch = window.fetch;
		window.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const url = String(
				typeof input === 'string' || input instanceof URL
					? input
					: input.url
			);
			if (url.includes('/service/users/tutorials/progress')) {
				return new Response(JSON.stringify(progress), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
			return realFetch(input as RequestInfo, init);
		}) as typeof window.fetch;
		return () => {
			window.fetch = realFetch;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	return <>{children}</>;
};

/**
 * Puts the story in practice mode like a started tour does, and out of it
 * again when the story goes away: the guard patches real globals, so it must
 * never outlive the story.
 */
export const InPracticeMode = ({
	tourId = 'consultant-practice-accept',
	children
}: {
	tourId?: string;
	children: React.ReactNode;
}) => {
	useLayoutEffect(() => {
		enterPracticeMode({ tourId });
		return () => exitPracticeMode();
	}, [tourId]);
	return <>{children}</>;
};

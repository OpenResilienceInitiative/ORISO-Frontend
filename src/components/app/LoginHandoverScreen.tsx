import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Loading } from './Loading';
import {
	endLoginHandover,
	isLoginHandoverActive,
	removeLoginHandoverSplash,
	useLoginHandoverActive
} from './loginHandover';
import './loginHandoverScreen.styles.scss';

/** Matches the fade in loginHandoverScreen.styles.scss. */
export const LOGIN_HANDOVER_FADE_MS = 240;
/** Never keep a person behind the screen if the app never reports ready. */
export const LOGIN_HANDOVER_MAX_VISIBLE_MS = 30_000;

export interface LoginHandoverScreenProps {
	/** Fade in over the login page (on the login page only). */
	animateIn?: boolean;
	/** Fade out to reveal the app. */
	leaving?: boolean;
}

/**
 * The full-screen loading surface between "Login" and the app: the app's
 * background with the ORISO loading animation, the same one the app shows
 * while it boots, so the whole sign-in reads as one screen.
 */
export const LoginHandoverScreen = ({
	animateIn = false,
	leaving = false
}: LoginHandoverScreenProps) => (
	<div
		className={clsx('loginHandoverScreen', {
			'loginHandoverScreen--enter': animateIn,
			'loginHandoverScreen--leaving': leaving
		})}
		data-cy="login-handover-screen"
	>
		<Loading layout="page" delayMs={0} />
	</div>
);

const prefersReducedMotion = () => {
	try {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
};

/** Shows `LoginHandoverScreen` while a login handover is active. */
export const LoginHandoverGate = () => {
	const active = useLoginHandoverActive();
	const [mounted, setMounted] = useState(active);
	// Active on the first render means a new document continues the handover:
	// the screen is already there (app.html painted its background), so it
	// must not fade in a second time.
	const [continued] = useState(() => isLoginHandoverActive());

	// app.html painted a still of the screen for the document load; once this
	// live screen is on screen (two frames), the still goes.
	useLayoutEffect(() => {
		if (!mounted) return;
		let second = 0;
		const first = window.requestAnimationFrame(() => {
			second = window.requestAnimationFrame(removeLoginHandoverSplash);
		});
		return () => {
			window.cancelAnimationFrame(first);
			window.cancelAnimationFrame(second);
		};
	}, [mounted]);

	useEffect(() => {
		if (active) {
			setMounted(true);
			return;
		}
		const timeout = window.setTimeout(
			() => setMounted(false),
			prefersReducedMotion() ? 0 : LOGIN_HANDOVER_FADE_MS
		);
		return () => window.clearTimeout(timeout);
	}, [active]);

	useEffect(() => {
		if (!active) return;
		const timeout = window.setTimeout(
			endLoginHandover,
			LOGIN_HANDOVER_MAX_VISIBLE_MS
		);
		return () => window.clearTimeout(timeout);
	}, [active]);

	// Back from the app into a login page restored from the back/forward
	// cache: the screen it left with must not stay over the form.
	useEffect(() => {
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) endLoginHandover();
		};
		window.addEventListener('pageshow', onPageShow);
		return () => window.removeEventListener('pageshow', onPageShow);
	}, []);

	if (!mounted) return null;
	return <LoginHandoverScreen animateIn={!continued} leaving={!active} />;
};

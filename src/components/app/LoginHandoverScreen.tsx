import clsx from 'clsx';
import * as React from 'react';
import {
	forwardRef,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Loading } from './Loading';
import {
	endLoginHandover,
	getContinuedLoginHandoverLabel,
	isLoginHandoverActive,
	isLoginHandoverDocumentCurtain,
	removeLoginHandoverSplash,
	useLoginHandoverActive,
	useLoginHandoverSourceCurtain
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
	/** Overrides the default label (the words the login page showed). */
	label?: string;
	/** The pre-script curtain paints the viewport while this announces loading. */
	curtainStatus?: boolean;
}

/**
 * The full-screen loading surface between "Login" and the app: the app's
 * background with the ORISO loading animation, the same one the app shows
 * while it boots, so the whole sign-in reads as one screen.
 */
export const LoginHandoverScreen = forwardRef<
	HTMLDivElement,
	LoginHandoverScreenProps
>(
	(
		{
			animateIn = false,
			leaving = false,
			label: labelProp,
			curtainStatus = false
		},
		ref
	) => {
		const { t } = useTranslation();
		const label = labelProp ?? t('app.wait');
		return (
			<div
				ref={ref}
				className={clsx('loginHandoverScreen', {
					'loginHandoverScreen--enter': animateIn,
					'loginHandoverScreen--leaving': leaving,
					'loginHandoverScreen--curtainStatus': curtainStatus
				})}
				data-cy="login-handover-screen"
				role="status"
				aria-label={label}
				aria-live="polite"
				tabIndex={-1}
			>
				{!curtainStatus && (
					<div aria-hidden="true">
						<Loading layout="page" delayMs={0} label={label} />
					</div>
				)}
			</div>
		);
	}
);
LoginHandoverScreen.displayName = 'LoginHandoverScreen';

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
	const sourceCurtain = useLoginHandoverSourceCurtain();
	const showScreen = active && !sourceCurtain;
	const [mounted, setMounted] = useState(showScreen);
	const [documentCurtain, setDocumentCurtain] = useState(
		isLoginHandoverDocumentCurtain
	);
	const screenRef = useRef<HTMLDivElement>(null);
	// Active on the first render means a new document continues the handover:
	// the screen is already there (app.html painted its background), so it
	// must not fade in a second time.
	const [continued] = useState(() => isLoginHandoverActive());

	// app.html painted a still of the screen for the document load; once this
	// live screen is on screen (two frames), the still goes. A document
	// curtain stays until readiness, with the live loader as its escape hatch.
	useLayoutEffect(() => {
		if (!mounted) return;
		if (documentCurtain) {
			const onExpiry = () => setDocumentCurtain(false);
			window.addEventListener(
				'oriso:login-handover-splash-expired',
				onExpiry
			);
			if (!isLoginHandoverDocumentCurtain()) onExpiry();
			return () => {
				window.removeEventListener(
					'oriso:login-handover-splash-expired',
					onExpiry
				);
			};
		}
		let second = 0;
		const first = window.requestAnimationFrame(() => {
			second = window.requestAnimationFrame(removeLoginHandoverSplash);
		});
		return () => {
			window.cancelAnimationFrame(first);
			window.cancelAnimationFrame(second);
		};
	}, [mounted, documentCurtain]);

	// The screen is portalled outside the app container so the covered login
	// page can be made inert without also disabling this status. Move focus to
	// the status while it covers the page, then return it when a same-document
	// failure reveals the form again.
	useLayoutEffect(() => {
		if (!showScreen || !mounted) return;
		const covered = document.querySelector<HTMLElement>('.app__container');
		const previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const alreadyInert = covered?.hasAttribute('inert') ?? false;
		covered?.setAttribute('inert', '');
		screenRef.current?.focus({ preventScroll: true });
		return () => {
			if (covered && !alreadyInert) covered.removeAttribute('inert');
			// Let the browser apply the inert removal before restoring focus.
			// A new handover started in the meantime owns focus instead.
			queueMicrotask(() => {
				if (!isLoginHandoverActive() && previousFocus?.isConnected) {
					previousFocus.focus({ preventScroll: true });
				}
			});
		};
	}, [showScreen, mounted]);

	useEffect(() => {
		if (showScreen) {
			setMounted(true);
			return;
		}
		const timeout = window.setTimeout(
			() => setMounted(false),
			prefersReducedMotion() ? 0 : LOGIN_HANDOVER_FADE_MS
		);
		return () => window.clearTimeout(timeout);
	}, [showScreen]);

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

	if (!mounted || sourceCurtain) return null;
	return createPortal(
		<LoginHandoverScreen
			ref={screenRef}
			animateIn={!continued}
			leaving={!active}
			label={continued ? getContinuedLoginHandoverLabel() : undefined}
			curtainStatus={documentCurtain}
		/>,
		document.body
	);
};

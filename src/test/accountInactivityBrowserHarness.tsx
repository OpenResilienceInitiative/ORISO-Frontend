import * as React from 'react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setValueInCookie } from '../components/sessionCookie/accessSessionCookie';
import { useAccountInactivityActivity } from '../hooks/useAccountInactivityActivity';

const setAccount = (subject: string, version = 1) => {
	setValueInCookie(
		'keycloak',
		`header.${btoa(JSON.stringify({ sub: subject, iat: version }))}.signature`
	);
};
const TrackedSurface = () => {
	useAccountInactivityActivity();
	return <input aria-label="Write a message" />;
};
const Harness = () => {
	const [enabled, setEnabled] = useState(true);
	return (
		<>
			<button type="button" onClick={() => setAccount('person-a')}>
				Use account A
			</button>
			<button type="button" onClick={() => setAccount('person-b')}>
				Use account B
			</button>
			<button type="button" onClick={() => setAccount('person-a', 2)}>
				Refresh account A token
			</button>
			<button
				type="button"
				onClick={() => setValueInCookie('keycloak', '')}
			>
				Log out
			</button>
			<button type="button" onClick={() => setEnabled(false)}>
				Unmount tracking
			</button>
			{enabled ? (
				<TrackedSurface />
			) : (
				<input aria-label="Tracking removed" />
			)}
		</>
	);
};
const root = document.getElementById('root');
if (root) createRoot(root).render(<Harness />);

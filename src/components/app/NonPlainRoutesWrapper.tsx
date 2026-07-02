import React from 'react';

interface NonPlainRoutesWrapperProps {
	children?: React.ReactNode;
	logoutHandler?: Function;
}

/**
 * Historical wrapper that restored legacy Rocket.Chat E2EE keys on
 * non-plain routes. RC E2EE is removed (Matrix-only app), so this is a
 * plain pass-through kept only to avoid touching the route tree.
 */
export const NonPlainRoutesWrapper: React.FC<NonPlainRoutesWrapperProps> = ({
	children
}) => {
	return <>{children}</>;
};

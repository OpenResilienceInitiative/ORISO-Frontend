import * as React from 'react';
import { useState } from 'react';
import { readHandoverDepartment } from './handoverDepartment';
import {
	RegistrationHandover,
	RegistrationHandoverProps
} from './RegistrationHandover';

/**
 * The handover after the document load that follows registering: the very
 * waiting room `Registration` showed before the load, frame included, so the
 * reload swaps nothing (#1219, #1735; Frank, 2026-10-15). The stage does not
 * replay its intro: the person has already watched it on the form.
 */
export const PostRegistrationHandover = (props: RegistrationHandoverProps) => {
	/* The department `Registration` remembered before the load, so the legal
	   links open the same documents on both sides. */
	const [department] = useState(readHandoverDepartment);
	return <RegistrationHandover department={department} {...props} />;
};

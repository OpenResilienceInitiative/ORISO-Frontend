import * as React from 'react';
import { useContext } from 'react';
import { StageLayout } from '../../stageLayout/StageLayout';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import {
	RegistrationHandover,
	RegistrationHandoverProps
} from './RegistrationHandover';

/**
 * The handover after registering, inside the same split layout the
 * registration form and the entry rooms use. The red stage, partner logos and
 * legal links stay put, so the hard reload after sign-up no longer swaps the
 * whole page for a full-screen overlay (Frank, 2026-10-15). The stage does not
 * replay its intro: the person has already watched it on the form.
 */
export const PostRegistrationHandover = (
	props: Omit<RegistrationHandoverProps, 'variant'>
) => {
	const { Stage } = useContext(GlobalComponentContext);
	return (
		<StageLayout
			className="stageLayout--registration"
			showLegalLinks={true}
			showLoginLink={false}
			showRegistrationLink={false}
			stage={<Stage hasAnimation={false} isReady={true} />}
			mobileHero="bar"
		>
			<RegistrationHandover {...props} variant="inline" />
		</StageLayout>
	);
};

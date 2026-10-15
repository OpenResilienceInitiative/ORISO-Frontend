import * as React from 'react';
import { useContext } from 'react';
import { StageLayout } from '../../stageLayout/StageLayout';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';

export interface HandoverStageProps {
	children: React.ReactNode;
}

/**
 * The frame of the waiting room after "Registrieren": the red stage on the
 * left, the white column on the right.
 *
 * `Registration` renders it from the click on, `AuthenticatedApp` renders it
 * again after the document load that lets browsers offer to save the password.
 * Both mount this one component with no props that could differ, so the
 * second document paints the same pixels the first one left (#1219). No login
 * link and no info drawer: the person is past both.
 */
export const HandoverStage = ({ children }: HandoverStageProps) => {
	const { Stage } = useContext(GlobalComponentContext);
	return (
		<StageLayout
			className="stageLayout--registration"
			showLegalLinks={true}
			showLoginLink={false}
			showRegistrationLink={false}
			stage={<Stage hasAnimation={false} />}
			mobileHero="bar"
		>
			{children}
		</StageLayout>
	);
};

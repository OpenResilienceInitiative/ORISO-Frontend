import * as React from 'react';
import { useContext } from 'react';
import { StageLayout } from '../stageLayout/StageLayout';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { Stage as DefaultStage } from '../stage/stage';

export interface WaitingRoomFrameProps {
	children: React.ReactNode;
	/** Heading in the stage header on a desktop (the entry room's two lines). */
	headerStart?: React.ReactNode;
	/** Legal links of the department behind this room, once known. */
	legalDepartment?: { agencyId: number; topicId: number } | null;
	/** Phone bar action; the group rooms put their legal menu here. */
	renderHeaderAction?: (tone: 'surface' | 'onPrimary') => React.ReactNode;
	showLoginLink?: boolean;
	loginParams?: string;
	loginState?: unknown;
}

/**
 * The one frame of every waiting room: the app's own stage on the left, the
 * white column on the right, the shared `RegistrationFooter` bar under it.
 *
 * Used by the waiting room after "Registrieren" (on both sides of the document
 * load), the live-chat entry room and the self-help group's waiting room. One
 * frame, so moving from one of them to the next only changes what stands in
 * the column, never the page around it (#1219; Frank, 2026-10-15: "statt die
 * Elemente eben elegant ineinander fassen").
 *
 * What is fixed here is fixed on purpose — the stage never animates, never
 * links to registration, and is always the app's stage component (a room that
 * imports `Stage` directly paints a different panel than the one before it).
 * `waitingRoomLayoutContract.ts` checks the result in every waiting-room story.
 */
export const WaitingRoomFrame = ({
	children,
	headerStart,
	legalDepartment,
	renderHeaderAction,
	showLoginLink = false,
	loginParams,
	loginState
}: WaitingRoomFrameProps) => {
	// The app always provides its stage; tests and stories without the app
	// shell get the default one.
	const Stage = useContext(GlobalComponentContext)?.Stage ?? DefaultStage;
	return (
		<StageLayout
			className="stageLayout--registration stageLayout--waitingRoom"
			showLegalLinks={true}
			legalDepartment={legalDepartment}
			showLoginLink={showLoginLink}
			loginParams={loginParams}
			loginState={loginState}
			showRegistrationLink={false}
			stage={
				<Stage hasAnimation={false} legalDepartment={legalDepartment} />
			}
			mobileHero="bar"
			headerStart={headerStart}
			renderHeaderAction={renderHeaderAction}
		>
			{children}
		</StageLayout>
	);
};

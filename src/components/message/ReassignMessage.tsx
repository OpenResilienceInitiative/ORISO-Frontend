import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './reassignRequestMessage.styles';
import { ConsultantListContext } from '../../globalState';
import {
	type ConsultantReassignment,
	ReassignStatus
} from '../../api/apiSendAliasMessage';

/**
 * Name for a counsellor in a reassignment record: the live consultant list
 * first, then the name stored in the message, then a neutral placeholder.
 */
const useConsultantName = (
	consultantId: string | undefined,
	storedName: string | undefined,
	lookUp = true
): string => {
	const { t: translate } = useTranslation();
	const { consultantList } = useContext(ConsultantListContext);

	return useMemo(() => {
		if (lookUp && consultantId && consultantList?.length > 0) {
			const consultant = consultantList.find(
				(entry) => entry.value === consultantId
			);
			if (consultant) {
				return consultant.label;
			}
		}
		return (
			storedName?.trim() ||
			translate('caseHandover.history.unknownConsultant')
		);
	}, [consultantId, consultantList, lookUp, storedName, translate]);
};

export const ReassignRequestMessage: React.FC<{
	fromConsultantName: string;
	toConsultantName: string;
}> = (props) => {
	const { t: translate } = useTranslation();
	const oldConsultant = useConsultantName(
		undefined,
		props.fromConsultantName,
		false
	);
	const newConsultant = useConsultantName(
		undefined,
		props.toConsultantName,
		false
	);

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				<h5>
					{translate(
						'session.reassign.system.message.reassign.title',
						{ oldConsultant, newConsultant }
					)}
				</h5>

				<span className="description">
					{translate(
						'session.reassign.system.message.reassign.description.noTeam',
						{ oldConsultant, newConsultant }
					)}
				</span>
			</div>
		</div>
	);
};

export const ReassignRequestSentMessage: React.FC<{
	toAskerName: string;
	fromConsultantId: string;
	toConsultantId: string;
	toConsultantName?: string;
	isMySession: boolean;
}> = (props) => {
	const { t: translate } = useTranslation();
	const toConsultantName = useConsultantName(
		props.toConsultantId,
		props.toConsultantName
	);

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				<h5>
					{translate(
						'session.reassign.system.message.reassign.sent.title'
					)}
				</h5>
				<span className="description">
					{translate(
						'session.reassign.system.message.reassign.sent.description.noTeam',
						{
							client1: props.toAskerName,
							client2: props.toAskerName,
							newConsultant: toConsultantName
						}
					)}
				</span>
			</div>
		</div>
	);
};

export const ReassignRequestAcceptedMessage: React.FC<{
	toAskerName: string;
	toConsultantName: string;
	toConsultantId: string;
	isAsker: boolean;
	fromConsultantId: string;
	fromConsultantName?: string;
	isMySession: boolean;
}> = (props) => {
	const { t: translate } = useTranslation();
	// Advice seekers never see staff lookups, only the stored names.
	const fromConsultantName = useConsultantName(
		props.fromConsultantId,
		props.fromConsultantName,
		!props.isAsker
	);
	const toConsultantName = useConsultantName(
		props.toConsultantId,
		props.toConsultantName,
		!props.isAsker
	);

	const forWhichConsultant = props.isMySession ? 'self' : 'other';

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				{props.isAsker ? (
					<>
						<h5>
							{translate(
								'session.reassign.system.message.reassign.accepted.consultant.title',
								{ newConsultant: toConsultantName }
							)}
						</h5>
						<span className="description">
							{translate(
								'session.reassign.system.message.reassign.accepted.new.consultant.description',
								{
									newConsultant1: toConsultantName,
									newConsultant2: toConsultantName
								}
							)}
						</span>
					</>
				) : (
					<>
						<h5>
							{translate(
								`session.reassign.system.message.reassign.accepted.title.${forWhichConsultant}`,
								{
									oldConsultant: fromConsultantName,
									newConsultant: toConsultantName,
									client: props.toAskerName
								}
							)}
						</h5>
						<span className="description">
							{translate(
								`session.reassign.system.message.reassign.accepted.description.${forWhichConsultant}`,
								{
									client: props.toAskerName,
									consultant: toConsultantName
								}
							)}
						</span>
					</>
				)}
			</div>
		</div>
	);
};

export const ReassignRequestDeclinedMessage: React.FC<{
	isAsker: boolean;
	isMySession: boolean;
	toAskerName: string;
	fromConsultantName: string;
	fromConsultantId: string;
}> = (props) => {
	const { t: translate } = useTranslation();
	const fromConsultantName = useConsultantName(
		props.fromConsultantId,
		props.fromConsultantName,
		!props.isAsker
	);

	const forWhichConsultant = props.isMySession ? 'self' : 'other';

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				{props.isAsker ? (
					<h5>
						{translate(
							'session.reassign.system.message.reassign.declined.old.consultant.title',
							{ oldConsultant: fromConsultantName }
						)}
					</h5>
				) : (
					<>
						<h5>
							{translate(
								'session.reassign.system.message.reassign.declined.title',
								{ client: props.toAskerName }
							)}
						</h5>
						<span className="description">
							{translate(
								`session.reassign.system.message.reassign.declined.description.${forWhichConsultant}`,
								{
									client: props.toAskerName,
									consultant: fromConsultantName
								}
							)}
						</span>
					</>
				)}
			</div>
		</div>
	);
};

/**
 * Legacy REASSIGN_CONSULTANT record, read-only. Nothing on dev can still
 * create or answer one (no /service/messages handler), so no buttons.
 */
export const HistoricalReassignMessage = ({
	message,
	isAsker,
	isMySession
}: {
	message: string;
	isAsker: boolean;
	isMySession: boolean;
}) => {
	let params: ConsultantReassignment;
	try {
		params = JSON.parse(message);
	} catch {
		return null;
	}
	if (!params || typeof params !== 'object') return null;

	switch (params.status) {
		case ReassignStatus.REQUESTED:
			return isAsker ? (
				<ReassignRequestMessage {...params} />
			) : (
				<ReassignRequestSentMessage
					{...params}
					isMySession={isMySession}
				/>
			);
		case ReassignStatus.CONFIRMED:
			return (
				<ReassignRequestAcceptedMessage
					{...params}
					isAsker={isAsker}
					isMySession={isMySession}
				/>
			);
		case ReassignStatus.REJECTED:
			return (
				<ReassignRequestDeclinedMessage
					{...params}
					isAsker={isAsker}
					isMySession={isMySession}
				/>
			);
		default:
			return null;
	}
};

import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './reassignRequestMessage.styles';
import { ConsultantListContext } from '../../globalState';
import {
	type ConsultantReassignment,
	ReassignStatus
} from '../../api/apiSendAliasMessage';

export const ReassignRequestMessage: React.FC<{
	fromConsultantName: string;
	toConsultantName: string;
}> = (props) => {
	const { t: translate } = useTranslation();

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				<h5>
					{translate(
						'session.reassign.system.message.reassign.title',
						{
							oldConsultant: props.fromConsultantName,
							newConsultant: props.toConsultantName
						}
					)}
				</h5>

				<span className="description">
					{translate(
						'session.reassign.system.message.reassign.description.noTeam',
						{
							oldConsultant: props.fromConsultantName,
							newConsultant: props.toConsultantName
						}
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
	isMySession: boolean;
}> = (props) => {
	const { t: translate } = useTranslation();
	const { consultantList } = useContext(ConsultantListContext);

	const toConsultantName = useMemo(() => {
		if (props.toConsultantId && consultantList.length > 0) {
			const toConsultant = consultantList.find(
				(consultant) => consultant.value === props.toConsultantId
			);
			if (toConsultant) {
				return toConsultant.label;
			}
		}

		return '';
	}, [consultantList, props.toConsultantId]);

	let descriptionToTranslate =
		'session.reassign.system.message.reassign.sent.description.noTeam';

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				<h5>
					{translate(
						'session.reassign.system.message.reassign.sent.title'
					)}
				</h5>
				<span className="description">
					{translate(descriptionToTranslate, {
						client1: props.toAskerName,
						client2: props.toAskerName,
						newConsultant: toConsultantName
					})}
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
	isMySession: boolean;
}> = (props) => {
	const { t: translate } = useTranslation();
	const { consultantList } = useContext(ConsultantListContext);
	const fromConsultantName = useMemo(() => {
		if (
			props.fromConsultantId &&
			!props.isAsker &&
			consultantList.length > 0
		) {
			const fromConsultant = consultantList.find(
				(consultant) => consultant.value === props.fromConsultantId
			);
			if (fromConsultant) {
				return fromConsultant.label;
			}
		}

		return '';
	}, [consultantList, props.fromConsultantId, props.isAsker]);

	const toConsultantName = useMemo(() => {
		if (
			props.toConsultantId &&
			!props.isAsker &&
			consultantList.length > 0
		) {
			const toConsultant = consultantList.find(
				(consultant) => consultant.value === props.toConsultantId
			);
			if (toConsultant) {
				return toConsultant.label;
			}
		}

		return '';
	}, [consultantList, props.isAsker, props.toConsultantId]);

	const forWhichConsultant = props.isMySession ? 'self' : 'other';

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				{props.isAsker ? (
					<>
						<h5>
							{translate(
								'session.reassign.system.message.reassign.accepted.consultant.title',
								{
									newConsultant: props.toConsultantName
								}
							)}
						</h5>
						<span className="description">
							{translate(
								'session.reassign.system.message.reassign.accepted.new.consultant.description',
								{
									newConsultant1: props.toConsultantName,
									newConsultant2: props.toConsultantName
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
	const { consultantList } = useContext(ConsultantListContext);
	const fromConsultantName = useMemo(() => {
		if (
			props.fromConsultantId &&
			!props.isAsker &&
			consultantList.length > 0
		) {
			const fromConsultant = consultantList.find(
				(consultant) => consultant.value === props.fromConsultantId
			);
			if (fromConsultant) {
				return fromConsultant.label;
			}
		}

		return '';
	}, [consultantList, props.fromConsultantId, props.isAsker]);

	const forWhichConsultant = props.isMySession ? 'self' : 'other';

	return (
		<div className="reassignRequestMessage">
			<div className="wrapper">
				{props.isAsker ? (
					<h5>
						{translate(
							'session.reassign.system.message.reassign.declined.old.consultant.title',
							{
								oldConsultant: props.fromConsultantName
							}
						)}
					</h5>
				) : (
					<>
						<h5>
							{translate(
								'session.reassign.system.message.reassign.declined.title',
								{
									client: props.toAskerName
								}
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

/** Historical aliases remain readable but cannot invoke the retired assignment API. */
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

import * as React from 'react';
import { useEffect, useState } from 'react';
import { AgencyDataInterface } from '../../../globalState/interfaces';
import { apiGetAgenciesByTenant, FETCH_ERRORS } from '../../../api';
import { InputField, InputFieldItem } from '../../inputField/InputField';
import '../../agencySelection/agencySelection.styles';
import '../profile.styles';
import { Text } from '../../text/Text';
import { Headline } from '../../headline/Headline';
import { useTranslation } from 'react-i18next';
import { AgencyRadioSelect } from '../../agencyRadioSelect/AgencyRadioSelect';
import { VALID_POSTCODE_LENGTH } from '../../agencySelection/agencySelectionHelpers';
import { sortKnownAgenciesFirst } from '../../../utils/sortKnownAgenciesFirst';

export interface AdditionalAgencySelectionProps {
	onAgencyChange: Function;
	onPostcodeChange: Function;
	selectedTopicId: number;
	/** Prefill for the postcode input - user can still change it. */
	initialPostcode?: string;
	/** Agencies the asker already talks to; listed first with a badge. */
	knownAgencyIds?: number[];
}

export const AdditionalAgencySelection = (
	props: AdditionalAgencySelectionProps
) => {
	const { t: translate } = useTranslation(['common', 'agencies']);
	const [proposedAgencies, setProposedAgencies] = useState<
		AgencyDataInterface[] | null
	>(null);
	const [selectedPostcode, setSelectedPostcode] = useState(
		props.initialPostcode ?? ''
	);
	const [selectedAgency, setSelectedAgency] =
		useState<AgencyDataInterface | null>(null);

	// Debug logging
	useEffect(() => {
		// console.log('🟢 selectedAgency changed:', selectedAgency?.id);
	}, [selectedAgency]);
	const validPostcode = () =>
		selectedPostcode?.length === VALID_POSTCODE_LENGTH;

	const isSelectedAgencyValidated = () =>
		validPostcode() && typeof selectedAgency?.id === 'number';

	useEffect(() => {
		if (isSelectedAgencyValidated()) {
			const agency = {
				...selectedAgency,
				postcode: selectedPostcode
			};
			props.onAgencyChange(agency);
			props.onPostcodeChange(selectedPostcode);
		} else {
			props.onAgencyChange(null);
			props.onPostcodeChange(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedAgency, selectedPostcode]);

	useEffect(() => {
		if (validPostcode()) {
			apiGetAgenciesByTenant(selectedPostcode, props.selectedTopicId)
				.then((agencies) => {
					const sorted = sortKnownAgenciesFirst(
						agencies,
						props.knownAgencyIds
					);
					setProposedAgencies(sorted);
					/* The proposals are scoped to postcode + topic, so an
					   agency picked before the change may not serve the new
					   pair at all. Keeping it would submit the enquiry to a
					   counselling centre that never offered the topic
					   (ORISO-Frontend#1143), so only a selection that is
					   still on offer survives. */
					setSelectedAgency((current) =>
						current && sorted.some((a) => a.id === current.id)
							? current
							: (sorted[0] ?? null)
					);
				})
				.catch((err: any) => {
					if (err.message === FETCH_ERRORS.EMPTY) {
						setProposedAgencies(null);
						setSelectedAgency(null);
					}
				});
		} else if (proposedAgencies) {
			setProposedAgencies(null);
			setSelectedAgency(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedPostcode, props.selectedTopicId]);

	const postcodeInputItem: InputFieldItem = {
		name: 'postcode',
		class: 'asker__registration__postcodeInput',
		id: 'postcode',
		type: 'number',
		label: translate('registration.agencySelection.postcode.label'),
		content: selectedPostcode,
		maxLength: VALID_POSTCODE_LENGTH,
		pattern: '^[0-9]+$'
	};

	const handlePostcodeInput = (e) => {
		setSelectedPostcode(e.target.value);
	};

	const introItemsTranslations = [
		'registration.agencySelection.intro.point1',
		'registration.agencySelection.intro.point2',
		'registration.agencySelection.intro.point3'
	];

	return (
		<div className="agencySelection">
			<>
				<Headline
					semanticLevel="5"
					text={translate('registration.agencySelection.headline')}
				/>
				<div className="agencySelection__intro">
					<Text
						text={translate(
							'registration.agencySelection.intro.overline'
						)}
						type="standard"
					/>
					<div className="agencySelection__intro__content">
						<Text
							text={translate(
								'registration.agencySelection.intro.subline'
							)}
							type="standard"
						/>
						<ul>
							{introItemsTranslations.map(
								(introItemTranslation, i) => (
									<li key={i}>
										<Text
											text={translate(
												introItemTranslation
											)}
											type="standard"
										/>
									</li>
								)
							)}
						</ul>
					</div>
				</div>

				<InputField
					item={postcodeInputItem}
					inputHandle={(e) => handlePostcodeInput(e)}
				/>
				{validPostcode() && (
					<div className="agencySelection__proposedAgencies">
						<h3>
							{translate(
								'registration.agencySelection.title.start'
							)}{' '}
							{selectedPostcode}
							{translate(
								'registration.agencySelection.title.end'
							)}
						</h3>
						{proposedAgencies ? (
							proposedAgencies.map(
								(proposedAgency: AgencyDataInterface) => (
									<div key={`agency-${proposedAgency.id}`}>
										{props.knownAgencyIds?.includes(
											proposedAgency.id
										) && (
											<Text
												text={translate(
													'profile.data.register.agencyKnownBadge'
												)}
												type="infoLargeAlternative"
											/>
										)}
										<AgencyRadioSelect
											agency={proposedAgency}
											checkedValue={
												selectedAgency?.id.toString() ||
												''
											}
											showTooltipAbove={true}
											onChange={(agency) => {
												setSelectedAgency(agency);
											}}
										/>
									</div>
								)
							)
						) : (
							<Text
								text={translate(
									'registration.agencySelection.noAgencies'
								)}
								type="infoLargeAlternative"
							/>
						)}
					</div>
				)}
			</>
		</div>
	);
};

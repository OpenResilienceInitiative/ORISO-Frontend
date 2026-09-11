import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '../box/Box';
import { Headline } from '../headline/Headline';
import { apiGetAgencyById } from '../../api/apiGetAgencyId';
import {
	AgencyDataInterface,
	ListItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { DepartmentLegalSection } from '../departmentLegal/DepartmentLegalSection';
import { buildOsmSearchUrl } from '../../utils/osmLink';

export interface AgencyInfoCardProps {
	item: ListItemInterface;
}

/**
 * One card per asker session: topic, agency address with an OSM search link,
 * the department's legal texts, opening hours and phone. The asker session
 * list only embeds name/postcode/city, so the full public agency record is
 * fetched once per card; until it resolves (or if it fails) the card degrades
 * to the embedded minimal data.
 */
export const AgencyInfoCard = ({ item }: AgencyInfoCardProps) => {
	const { t: translate } = useTranslation([
		'common',
		'consultingTypes',
		'agencies'
	]);
	const [fullAgency, setFullAgency] = useState<AgencyDataInterface | null>(
		null
	);

	const agencyId = item?.agency?.id;
	useEffect(() => {
		if (typeof agencyId !== 'number') {
			return;
		}
		apiGetAgencyById(agencyId)
			.then((agency) => setFullAgency(agency))
			.catch(() => setFullAgency(null));
	}, [agencyId]);

	const agency = fullAgency ?? item?.agency;
	const sessionTopic = item?.session?.topic;
	const streetLine = [agency?.street, agency?.houseNumber]
		.filter(Boolean)
		.join(' ');
	const cityLine = [agency?.postcode, agency?.city].filter(Boolean).join(' ');
	const mapUrl = buildOsmSearchUrl({
		street: agency?.street,
		houseNumber: agency?.houseNumber,
		postcode: agency?.postcode,
		city: agency?.city
	});

	return (
		<Box>
			<div className="profile__data__itemWrapper">
				<div className="profile__content__title">
					<Headline
						className="pr--3"
						text={
							sessionTopic?.name || translate('profile.noContent')
						}
						semanticLevel="5"
					/>
				</div>
				<div className="profile__data__item">
					<p className="profile__data__label">
						{translate('profile.data.agency.label')}
					</p>
					<p className="profile__data__content">
						{agency?.name || translate('profile.noContent')}
						{streetLine && (
							<>
								<br />
								{streetLine}
							</>
						)}
						<br />
						{cityLine}
					</p>
					{mapUrl && (
						<a
							href={mapUrl}
							target="_blank"
							rel="noreferrer"
							className="profile__data__content"
						>
							{translate('profile.data.agency.mapLink')}
						</a>
					)}
				</div>
				{fullAgency && sessionTopic && (
					<div className="profile__data__item">
						<DepartmentLegalSection
							agency={fullAgency}
							topic={
								{
									id: sessionTopic.id,
									name: sessionTopic.name
								} as TopicsDataInterface
							}
							variant="details"
						/>
					</div>
				)}
				{agency?.openingHours && (
					<div className="profile__data__item">
						<p className="profile__data__label">
							{translate(
								'profile.data.agency.openingHours.label'
							)}
						</p>
						<p
							className="profile__data__content"
							style={{ whiteSpace: 'pre-line' }}
						>
							{agency.openingHours}
						</p>
					</div>
				)}
				{agency?.phone && (
					<div className="profile__data__item">
						<p className="profile__data__label">
							{translate('profile.data.agency.phone.label')}
						</p>
						<p className="profile__data__content">
							<a href={`tel:${agency.phone}`}>{agency.phone}</a>
						</p>
					</div>
				)}
			</div>
		</Box>
	);
};

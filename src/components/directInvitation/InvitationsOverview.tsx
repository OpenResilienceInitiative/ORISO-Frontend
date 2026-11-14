/**
 * "Termine & Direkteinladungen" (#2252, decision 13): one page, two sections.
 * Upcoming appointments by date, each with link, QR, access and knock; below
 * them the invitations without appointment as today's tiles. Designed states
 * for nothing at all and for a single section with content.
 * Presentational: data and actions come from the caller (checkpoint 4).
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import { CircularProgress } from '@mui/material';
import { ReactComponent as WaitingIllustration } from '../../resources/img/illustrations/chat-waiting.svg';
import { copyTextToClipboard } from '../../utils/clipboardHelpers';
import { MyDirectLinks } from '../conversationCreate/directLink/MyDirectLinks';
import { DirectLinkMediumIcon } from '../conversationCreate/directLink/DirectLinkMediumIcon';
import type {
	DirectLink,
	DirectLinkMedium
} from '../conversationCreate/directLink/directLink';
import type { DirectLinksLoadState } from '../directLinks/useMyDirectLinks';
import {
	groupUpcomingByDay,
	type InvitationAccess,
	type InvitationSlot
} from './invitationModel';
import './directInvitation.styles.scss';

const KEYS = 'directInvitation.overview';
const COPIED_MS = 2_000;

/** One upcoming appointment: a Direkteinladung with date or a 1:1 appointment. */
export interface UpcomingInvitation extends InvitationSlot {
	id: string;
	/** The name the counsellor gave, e.g. "Termin Frau M.". */
	name: string;
	/** Share link; absent for a 1:1 appointment nobody else is invited to. */
	url?: string;
	medium: DirectLinkMedium;
	access?: InvitationAccess;
	knock?: boolean;
	/** End + validity: when the link stops working. */
	expiresAt?: Date;
	/** Set for "Termin anlegen" in a 1:1: the person it is with. */
	counterpart?: string;
}

export interface InvitationsOverviewProps {
	state: DirectLinksLoadState;
	appointments: UpcomingInvitation[];
	/** Invitations without appointment: today's tiles. */
	links: DirectLink[];
	/** Defaults to the current time; stories pin it. */
	now?: Date;
	onCreate: () => void;
	onRetry: () => void;
	onShowAppointmentQr: (appointment: UpcomingInvitation) => void;
	onEditAppointment?: (appointment: UpcomingInvitation) => void;
	onToggle: (id: string, active: boolean) => void;
	pendingIds?: ReadonlySet<string>;
	onShowQr: (link: DirectLink) => void;
	onEdit?: (link: DirectLink) => void;
	onCopy?: (url: string) => void | Promise<void>;
}

const CreateButton = ({ onCreate }: { onCreate: () => void }) => {
	const { t } = useTranslation();
	return (
		<button
			type="button"
			className="invitationsOverview__create"
			onClick={onCreate}
			data-testid="invitations-create"
		>
			<AddIcon aria-hidden />
			{t(`${KEYS}.create`)}
		</button>
	);
};

const time = (date: Date, locale: string) =>
	date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

const AppointmentRow = ({
	item,
	locale,
	copied,
	onCopy,
	onShowQr,
	onEdit
}: {
	item: UpcomingInvitation;
	locale: string;
	copied: boolean;
	onCopy: () => void;
	onShowQr: () => void;
	onEdit?: () => void;
}) => {
	const { t } = useTranslation();
	return (
		<li className="invitationRow" data-testid="upcoming-invitation">
			<time
				className="invitationRow__time"
				dateTime={item.start.toISOString()}
			>
				{t(`${KEYS}.time`, {
					start: time(item.start, locale),
					end: time(item.end, locale)
				})}
			</time>
			<div className="invitationRow__body">
				<span className="invitationRow__name">
					<DirectLinkMediumIcon medium={item.medium} filled />
					{item.name}
				</span>
				{item.counterpart && (
					<span className="invitationRow__meta">
						{t(`${KEYS}.oneToOne`, { name: item.counterpart })}
					</span>
				)}
				{(item.access || item.knock !== undefined) && (
					<span className="invitationRow__chips">
						{item.access && (
							<span className="directLinkChip">
								{t(
									`directInvitation.dialog.access.${item.access}`
								)}
							</span>
						)}
						{item.knock !== undefined && (
							<span className="directLinkChip">
								{t(
									`${KEYS}.${item.knock ? 'knockOn' : 'knockOff'}`
								)}
							</span>
						)}
					</span>
				)}
				{item.expiresAt && (
					<span className="invitationRow__meta">
						{t(`${KEYS}.validUntil`, {
							date: item.expiresAt.toLocaleString(locale, {
								weekday: 'short',
								day: 'numeric',
								month: 'short',
								hour: '2-digit',
								minute: '2-digit'
							})
						})}
					</span>
				)}
			</div>
			<div className="invitationRow__actions">
				{item.url && (
					<>
						<button
							type="button"
							className="myDirectLinks__iconButton"
							aria-label={t(`${KEYS}.copy`, { name: item.name })}
							title={t('directLink.copy')}
							onClick={onCopy}
						>
							{copied ? (
								<CheckOutlinedIcon aria-hidden />
							) : (
								<ContentCopyOutlinedIcon aria-hidden />
							)}
						</button>
						<button
							type="button"
							className="myDirectLinks__iconButton"
							aria-label={t(`${KEYS}.qr`, { name: item.name })}
							title={t('directLink.list.qr')}
							onClick={onShowQr}
						>
							<QrCode2OutlinedIcon aria-hidden />
						</button>
					</>
				)}
				{onEdit && (
					<button
						type="button"
						className="myDirectLinks__iconButton"
						aria-label={t(`${KEYS}.edit`, { name: item.name })}
						title={t(`${KEYS}.edit`, { name: item.name })}
						onClick={onEdit}
					>
						<EditOutlinedIcon aria-hidden />
					</button>
				)}
			</div>
		</li>
	);
};

/** A section that has nothing yet: one line inside it, not a box beside it. */
const SectionEmpty = ({ text }: { text: string }) => (
	<p className="invitationsOverview__sectionEmpty">{text}</p>
);

export const InvitationsOverview = ({
	state,
	appointments,
	links,
	now = new Date(),
	onCreate,
	onRetry,
	onShowAppointmentQr,
	onEditAppointment,
	onToggle,
	pendingIds,
	onShowQr,
	onEdit,
	onCopy = (url) => copyTextToClipboard(url)
}: InvitationsOverviewProps) => {
	const { t, i18n } = useTranslation();
	const locale = i18n?.language || 'de';
	const [copiedId, setCopiedId] = useState<string>();
	const [copyFailed, setCopyFailed] = useState(false);

	useEffect(() => {
		if (!copiedId) return undefined;
		const timer = window.setTimeout(
			() => setCopiedId(undefined),
			COPIED_MS
		);
		return () => window.clearTimeout(timer);
	}, [copiedId]);

	const groups = groupUpcomingByDay(appointments, now);
	const nothing = groups.length === 0 && links.length === 0;

	const header = (
		<header className="invitationsOverview__header">
			<h1 className="invitationsOverview__title">{t(`${KEYS}.title`)}</h1>
			{!nothing && state === 'ready' && (
				<CreateButton onCreate={onCreate} />
			)}
		</header>
	);

	if (state === 'loading') {
		return (
			<div className="invitationsOverview">
				{header}
				<div className="invitationsOverview__status" aria-busy="true">
					<CircularProgress
						size={32}
						aria-label={t('directLink.page.loading')}
					/>
				</div>
			</div>
		);
	}

	if (state === 'failed') {
		return (
			<div className="invitationsOverview">
				{header}
				<div className="invitationsOverview__status" role="alert">
					<p>{t('directLink.page.loadFailed')}</p>
					<button
						type="button"
						className="invitationsOverview__retry"
						onClick={onRetry}
					>
						{t('directLink.page.retry')}
					</button>
				</div>
			</div>
		);
	}

	if (nothing) {
		return (
			<div className="invitationsOverview">
				{header}
				<div
					className="invitationsOverview__empty"
					data-testid="invitations-empty"
				>
					<WaitingIllustration
						aria-hidden
						className="invitationsOverview__illustration"
					/>
					<p className="invitationsOverview__emptyHeadline">
						{t(`${KEYS}.emptyHeadline`)}
					</p>
					<p className="invitationsOverview__emptyText">
						{t(`${KEYS}.emptyText`)}
					</p>
					<CreateButton onCreate={onCreate} />
				</div>
			</div>
		);
	}

	const copy = async (item: UpcomingInvitation) => {
		if (!item.url) return;
		try {
			await onCopy(item.url);
			setCopyFailed(false);
			setCopiedId(item.id);
		} catch {
			setCopiedId(undefined);
			setCopyFailed(true);
		}
	};

	return (
		<div className="invitationsOverview">
			{header}
			<section
				className="invitationsOverview__section"
				aria-labelledby="invitationsUpcomingTitle"
			>
				<header className="myDirectLinks__header">
					<EventOutlinedIcon
						aria-hidden
						className="myDirectLinks__headerIcon"
					/>
					<h2
						id="invitationsUpcomingTitle"
						className="myDirectLinks__title"
					>
						{t(`${KEYS}.upcoming`)}
					</h2>
				</header>
				{copyFailed && (
					<p role="alert" className="directLinkCopyError">
						{t(`${KEYS}.copyFailed`)}
					</p>
				)}
				{groups.length === 0 ? (
					<SectionEmpty text={t(`${KEYS}.noUpcoming`)} />
				) : (
					groups.map((group) => (
						<div
							key={group.day.getTime()}
							className="invitationsOverview__day"
						>
							<h3 className="invitationsOverview__dayTitle">
								{group.relative
									? `${t(`${KEYS}.${group.relative}`)}, `
									: ''}
								{group.day.toLocaleDateString(locale, {
									weekday: group.relative
										? undefined
										: 'long',
									day: 'numeric',
									month: 'long'
								})}
							</h3>
							<ul className="invitationsOverview__rows">
								{group.items.map((item) => (
									<AppointmentRow
										key={item.id}
										item={item}
										locale={locale}
										copied={copiedId === item.id}
										onCopy={() => void copy(item)}
										onShowQr={() =>
											onShowAppointmentQr(item)
										}
										onEdit={
											onEditAppointment
												? () => onEditAppointment(item)
												: undefined
										}
									/>
								))}
							</ul>
						</div>
					))
				)}
			</section>
			<div className="invitationsOverview__section">
				<MyDirectLinks
					title={t(`${KEYS}.withoutAppointment`)}
					links={links}
					onToggle={onToggle}
					pendingIds={pendingIds}
					onShowQr={onShowQr}
					onEdit={onEdit}
					onCopy={onCopy}
					emptyState={<SectionEmpty text={t(`${KEYS}.noLinks`)} />}
				/>
			</div>
		</div>
	);
};

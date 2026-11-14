/**
 * ADR-032 §4–§5: the counsellor's secret subscription link (out) and the
 * private ICS address of their own calendar for busy times (in).
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextField } from '../form/OrisoTextField';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import { useRangeFormat } from './useEntryLabel';

export interface CalendarFeed {
	url: string;
	lastFetchedAt?: string;
}

/**
 * The busy-time import. The private address never comes back from
 * UserService, only its host, so the field starts empty and replaces it.
 */
export interface CalendarImport {
	host?: string;
	lastSyncedAt?: string;
	failed?: boolean;
}

/**
 * A sync action. A returned promise that rejects means it failed: the
 * dialog says so and keeps what the user typed.
 */
type SyncAction<A extends unknown[] = []> = (
	...args: A
) => void | Promise<unknown>;

const settle = (result: void | Promise<unknown>) =>
	Promise.resolve(result).then(
		() => true,
		() => false
	);

export interface CalendarSyncDialogProps {
	open: boolean;
	feed: CalendarFeed;
	busyImport: CalendarImport;
	fullScreen?: boolean;
	onCopyFeed: (url: string) => void;
	onResetFeed: SyncAction;
	onSaveImport: SyncAction<[url: string]>;
	onRemoveImport: SyncAction;
	onClose: () => void;
}

export const CalendarSyncDialog = ({
	open,
	feed,
	busyImport,
	fullScreen,
	onCopyFeed,
	onResetFeed,
	onSaveImport,
	onRemoveImport,
	onClose
}: CalendarSyncDialogProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const [copied, setCopied] = useState(false);
	const [confirmReset, setConfirmReset] = useState(false);
	const [importUrl, setImportUrl] = useState('');
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);

	/** Runs a sync action; `onSuccess` only once it is stored. */
	const act = (result: void | Promise<unknown>, onSuccess?: () => void) => {
		setPending(true);
		setFailed(false);
		settle(result).then((stored) => {
			setPending(false);
			if (stored) onSuccess?.();
			else setFailed(true);
		});
	};

	if (confirmReset)
		return (
			<M3Dialog
				open={open}
				data-testid="calendar-feed-reset-dialog"
				title={t('calendar.syncDialog.resetTitle')}
				width={400}
				onClose={() => setConfirmReset(false)}
				closeLabel={t('app.close')}
				actions={[
					{
						label: t('app.cancel'),
						onClick: () => setConfirmReset(false)
					},
					{
						label: t('calendar.syncDialog.resetAction'),
						primary: true,
						testId: 'calendar-feed-reset-confirm',
						onClick: () => {
							setConfirmReset(false);
							setCopied(false);
							act(onResetFeed());
						}
					}
				]}
			>
				<p className="calendarSync__text">
					{t('calendar.syncDialog.resetText')}
				</p>
			</M3Dialog>
		);

	return (
		<M3Dialog
			open={open}
			data-testid="calendar-sync-dialog"
			icon={<SyncOutlinedIcon />}
			title={t('calendar.syncDialog.title')}
			description={t('calendar.syncDialog.description')}
			width={560}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={[{ label: t('app.close'), onClick: onClose }]}
		>
			<section className="calendarSync__section">
				<h3 className="calendarSync__heading">
					{t('calendar.syncDialog.feedTitle')}
				</h3>
				<p className="calendarSync__text">
					{t('calendar.syncDialog.feedText')}
				</p>
				<OrisoTextField
					label={t('calendar.syncDialog.feedTitle')}
					value={feed.url}
					fullWidth
					InputProps={{ readOnly: true }}
					data-cy="calendar-feed-url"
				/>
				<p className="calendarSync__meta">
					{feed.lastFetchedAt
						? t('calendar.syncDialog.lastFetched', {
								date: format(feed.lastFetchedAt)
							})
						: t('calendar.syncDialog.neverFetched')}
				</p>
				<ButtonGroup
					alignment="horizontal-flex"
					disableAutoStack
					items={[
						{
							id: 'copy',
							label: t(
								copied
									? 'calendar.syncDialog.copied'
									: 'calendar.syncDialog.copy'
							),
							variant: 'tonal',
							testingAttribute: 'calendar-feed-copy',
							onClick: () => {
								onCopyFeed(feed.url);
								setCopied(true);
							}
						},
						{
							id: 'reset',
							label: t('calendar.syncDialog.reset'),
							variant: 'outline',
							disabled: pending,
							testingAttribute: 'calendar-feed-reset',
							onClick: () => setConfirmReset(true)
						}
					]}
				/>
				<div
					className="calendarSync__preview"
					aria-label={t('calendar.syncDialog.preview')}
				>
					<span className="calendarSync__previewLabel">
						{t('calendar.syncDialog.preview')}
					</span>
					<span className="calendarSync__previewEvent">
						<strong>ORISO-Termin</strong> · 10:00–11:00
					</span>
				</div>
				<p className="calendarSync__meta">
					{t('calendar.syncDialog.refreshHint')}
				</p>
			</section>
			<section className="calendarSync__section">
				<h3 className="calendarSync__heading">
					{t('calendar.syncDialog.importTitle')}
				</h3>
				<p className="calendarSync__text">
					{t('calendar.syncDialog.importText')}
				</p>
				<OrisoTextField
					label={t('calendar.syncDialog.importField')}
					value={importUrl}
					onChange={(event) => setImportUrl(event.target.value)}
					placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics"
					error={busyImport.failed}
					helperText={
						busyImport.failed
							? t('calendar.syncDialog.importError')
							: busyImport.host !== undefined
								? busyImport.lastSyncedAt
									? t('calendar.syncDialog.importStatus', {
											host: busyImport.host,
											date: format(
												busyImport.lastSyncedAt
											)
										})
									: t('calendar.syncDialog.importConnected', {
											host: busyImport.host
										})
								: undefined
					}
					fullWidth
					data-cy="calendar-import-url"
				/>
				<ButtonGroup
					alignment="horizontal-flex"
					disableAutoStack
					items={[
						{
							id: 'save',
							label: t('calendar.syncDialog.importSave'),
							variant: 'tonal',
							disabled:
								pending ||
								!/^(https?|webcal):\/\//.test(importUrl.trim()),
							testingAttribute: 'calendar-import-save',
							// The private address stays until it is stored, so a
							// failed save can be corrected and sent again.
							onClick: () =>
								act(onSaveImport(importUrl.trim()), () =>
									setImportUrl('')
								)
						},
						...(busyImport.host !== undefined
							? [
									{
										id: 'remove',
										label: t(
											'calendar.syncDialog.importRemove'
										),
										variant: 'outline' as const,
										disabled: pending,
										testingAttribute:
											'calendar-import-remove',
										onClick: () =>
											act(onRemoveImport(), () =>
												setImportUrl('')
											)
									}
								]
							: [])
					]}
				/>
			</section>
			{failed && (
				<p className="calendarDialog__error" role="alert">
					{t('calendar.saveFailed')}
				</p>
			)}
		</M3Dialog>
	);
};

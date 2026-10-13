import { MenuBackdrop } from './MenuBackdrop';
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';
import { MenuVerticalIcon } from '../../resources/img/icons';
import {
	ChatMenuDropdown,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem
} from './ChatMenuDropdown';
import { useChatMenuPosition } from './useChatMenuPosition';
import '../sessionMenu/sessionMenu.styles';

function MenuPlacementDemo({
	edge = false,
	tall = false
}: {
	edge?: boolean;
	tall?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const [selected, setSelected] = React.useState<number | null>(null);
	const anchorRef = React.useRef<HTMLButtonElement>(null);
	const menuRef = React.useRef<HTMLDivElement>(null);
	const style = useChatMenuPosition({ open, anchorRef, menuRef });
	return (
		<div style={{ minHeight: '100vh', background: '#eae7e8' }}>
			<MenuBackdrop
				open={open}
				onClose={() => {
					setOpen(false);
					anchorRef.current?.focus();
				}}
			/>
			<button
				ref={anchorRef}
				type="button"
				className="sessionMenu__icon sessionMenu__icon--desktop"
				style={{
					display: 'inline-flex',
					position: 'fixed',
					...(edge
						? { right: 16, bottom: 24 }
						: { left: 24, top: 72 })
				}}
				aria-label="Menü öffnen"
				aria-expanded={open}
				aria-controls={open ? 'placement-menu' : undefined}
				onClick={() => setOpen(!open)}
			>
				<MenuVerticalIcon />
			</button>
			{open &&
				createPortal(
					<ChatMenuDropdown
						id="placement-menu"
						ref={menuRef}
						style={style}
						ariaLabel="Menüplatzierung"
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								setOpen(false);
								anchorRef.current?.focus();
							}
						}}
					>
						<ChatMenuDropdownHeader
							subtitle="Gespräch verwalten"
							title="Informationen & Einstellungen"
						/>
						{Array.from({ length: tall ? 16 : 3 }, (_, index) => (
							<ChatMenuDropdownItem
								key={index}
								icon={<InfoIcon />}
								title={`Menüaktion ${index + 1}${tall && index === 5 ? ': Benachrichtigungseinstellungen' : ''}`}
								active={selected === index}
								aria-pressed={selected === index}
								onClick={() => setSelected(index)}
								description="Informationen zu dieser Aktion ansehen."
							/>
						))}
					</ChatMenuDropdown>,
					document.body
				)}
		</div>
	);
}

const meta = {
	title: 'Components/Chat/MenuPlacement',
	component: MenuPlacementDemo,
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof MenuPlacementDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
const exercise: Story['play'] = async ({ canvasElement }) => {
	const trigger = within(canvasElement).getByRole('button', {
		name: 'Menü öffnen'
	});
	const before = trigger.getBoundingClientRect();
	await userEvent.click(trigger);
	const menu = await within(document.body).findByRole('dialog', {
		name: 'Menüplatzierung'
	});
	await waitFor(() => expect(menu).toBeVisible());
	const rect = menu.getBoundingClientRect();
	expect(rect.left).toBeGreaterThanOrEqual(11);
	expect(rect.top).toBeGreaterThanOrEqual(11);
	expect(rect.right).toBeLessThanOrEqual(window.innerWidth - 11);
	expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight - 11);
	expect(trigger.getBoundingClientRect().width).toBe(before.width);
	expect(trigger.getBoundingClientRect().height).toBe(before.height);
	await userEvent.click(
		within(menu).getByRole('button', { name: /Menüaktion 1 / })
	);
	await userEvent.keyboard('{Escape}');
	expect(trigger).toHaveFocus();
	expect(
		within(document.body).queryByRole('dialog', { name: 'Menüplatzierung' })
	).not.toBeInTheDocument();
};
const exerciseTallRows: Story['play'] = async ({ canvasElement }) => {
	const trigger = within(canvasElement).getByRole('button', {
		name: 'Menü öffnen'
	});
	await userEvent.click(trigger);
	const menu = await within(document.body).findByRole('dialog', {
		name: 'Menüplatzierung'
	});
	await waitFor(() => expect(menu).toBeVisible());
	const bounds = menu.getBoundingClientRect();
	await expect(bounds.left).toBeGreaterThanOrEqual(11);
	await expect(bounds.top).toBeGreaterThanOrEqual(11);
	await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth - 11);
	await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight - 11);

	const rows = within(menu).getAllByRole('button');
	const assertContained = async (row: HTMLElement) => {
		const bounds = row.getBoundingClientRect();
		for (const child of row.querySelectorAll<HTMLElement>(
			'.chatMenuDropdown__itemIcon, .chatMenuDropdown__itemTitle, .chatMenuDropdown__itemDescription'
		)) {
			const content = child.getBoundingClientRect();
			await expect(content.top).toBeGreaterThanOrEqual(bounds.top);
			await expect(content.bottom).toBeLessThanOrEqual(bounds.bottom);
			await expect(content.left).toBeGreaterThanOrEqual(bounds.left);
			await expect(content.right).toBeLessThanOrEqual(bounds.right);
		}
	};
	await userEvent.hover(rows[5]);
	await assertContained(rows[5]);
	await userEvent.click(rows[0]);
	await expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
	await waitFor(() =>
		expect(getComputedStyle(rows[0]).backgroundColor).not.toBe(
			'rgba(0, 0, 0, 0)'
		)
	);
	await assertContained(rows[0]);
	for (let index = 1; index < rows.length; index++) {
		await userEvent.keyboard('{Tab}');
		await expect(rows[index]).toHaveFocus();
		await assertContained(rows[index]);
	}
	await userEvent.keyboard('{Enter}');
	await expect(rows[15]).toHaveAttribute('aria-pressed', 'true');
	await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
	await expect(menu.scrollTop).toBeGreaterThan(0);
	await expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth + 1);
	await userEvent.keyboard('{Escape}');
	await expect(trigger).toHaveFocus();
};

export const RightSpace: Story = { play: exercise };
export const RightBottomEdge: Story = { args: { edge: true }, play: exercise };
export const NarrowTall: Story = {
	args: { edge: true, tall: true },
	globals: { viewport: { value: 'phone390', isRotated: false } },
	play: exerciseTallRows
};

export const NarrowTallSmallPhone: Story = {
	parameters: {
		viewport: {
			options: {
				phone320: {
					name: 'Phone320',
					styles: { width: '320px', height: '568px' },
					type: 'mobile'
				}
			}
		}
	},
	args: { edge: true, tall: true },
	globals: { viewport: { value: 'phone320', isRotated: false } },
	play: exerciseTallRows
};
export const DesktopTall: Story = {
	globals: { viewport: { value: 'desktop1440', isRotated: false } },
	args: { edge: true, tall: true },
	play: exerciseTallRows
};

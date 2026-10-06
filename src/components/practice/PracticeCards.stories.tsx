import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { PracticeCards } from '../../practice/PracticeCards';
import { practiceTours } from '../../practice/practiceTours';

type Progress = Awaited<
	ReturnType<Parameters<typeof PracticeCards>[0]['loadProgress']>
>;

const meta = {
	title: 'Organisms/PracticeCards',
	component: PracticeCards,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'The practice flows in Profile → Help → "Meine Rundgänge" (#1622). Same card look as the tours of the screens, plus a **Practice** badge and a dashed edge. Start works whatever the personal tutorial switch says. Practice state lives in memory only, so an interrupted flow starts over; there is no "continue". On a phone, Start is off and the card asks to practise on a computer.'
			}
		}
	},
	args: {
		tours: practiceTours,
		isPhone: false,
		loadProgress: () => Promise.resolve([] as Progress),
		onStartTour: fn()
	},
	globals: { viewport: { value: 'desktop1440', isRotated: false } }
} satisfies Meta<typeof PracticeCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotStarted: Story = {
	name: 'Not started · desktop',
	play: async ({ canvas, args }) => {
		const cards = await canvas.findAllByRole('listitem');
		await expect(cards).toHaveLength(2);
		// Every card says it is practice.
		await expect(canvas.getAllByText('Übung')).toHaveLength(2);

		await userEvent.click(
			canvas.getAllByRole('button', { name: 'Übung starten' })[0]
		);
		await expect(args.onStartTour).toHaveBeenCalledWith(
			practiceTours[0],
			'start'
		);
	}
};

export const CompletedAndInterrupted: Story = {
	name: 'Completed and interrupted · desktop',
	args: {
		loadProgress: () =>
			Promise.resolve<Progress>([
				{
					tourId: 'consultant-practice-accept',
					tourVersion: 1,
					status: 'completed'
				},
				{
					tourId: 'consultant-practice-supervision',
					tourVersion: 1,
					status: 'in_progress'
				}
			]),
		onStartTour: fn()
	},
	parameters: {
		docs: {
			description: {
				story: 'A finished flow shows "Abgeschlossen" and is offered again ("Noch einmal üben"). An interrupted one starts from the beginning.'
			}
		}
	},
	play: async ({ canvas, args }) => {
		await expect(await canvas.findByText('Abgeschlossen')).toBeVisible();
		await expect(canvas.getByText('In Bearbeitung')).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: /fortsetzen/i })
		).toBeNull();

		await userEvent.click(
			canvas.getByRole('button', { name: 'Noch einmal üben' })
		);
		await expect(args.onStartTour).toHaveBeenCalledWith(
			practiceTours[0],
			'restart'
		);
	}
};

export const SupervisionHidden: Story = {
	name: 'Supervision switched off · desktop',
	args: { tours: practiceTours.slice(0, 1) },
	parameters: {
		docs: {
			description: {
				story: 'When the Träger switched Supervision off, its card is hidden, not greyed. The wired section (`Organisms/PracticeOverviewSection`) does the filtering from the tenant settings.'
			}
		}
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findAllByRole('listitem')).toHaveLength(1);
		await expect(canvas.queryByText(/Supervision/)).toBeNull();
	}
};

export const PhoneHint: Story = {
	name: 'Phone hint · phone 390',
	args: { isPhone: true },
	globals: { viewport: { value: 'phone390', isRotated: false } },
	play: async ({ canvas, args }) => {
		await canvas.findAllByRole('listitem');
		const hints = canvas.getAllByText('Bitte üben Sie am Computer.');
		await expect(hints).toHaveLength(2);
		for (const button of canvas.getAllByRole('button', {
			name: 'Übung starten'
		})) {
			await expect(button).toBeDisabled();
		}
		await userEvent.click(
			canvas.getAllByRole('button', { name: 'Übung starten' })[0]
		);
		await expect(args.onStartTour).not.toHaveBeenCalled();
	}
};

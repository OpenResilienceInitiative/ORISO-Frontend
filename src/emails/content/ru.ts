/**
 * Russian. Machine-translated from `de-sie`, not yet read by a native speaker.
 *
 * See `translationManifest.json` for what this was translated from and
 * `translationReview.json` for which strings still need a human. Until the
 * strings marked in `emailProtectedPaths` are signed off, this locale is
 * `pending-human-review` and no service may select it.
 *
 * Terminology, decided once so the 22 occasions agree with each other:
 *   Beratung            → консультационная служба (the relationship), консультация (the session)
 *   Beratungsstelle     → консультационный центр
 *   Fachkraft           → специалист
 *   Träger              → организация
 *   ratsuchende Person  → человек, обратившийся за консультацией
 *   Fachaustausch       → профессиональный обмен
 *   AVV                 → договор об обработке персональных данных
 *
 * The address form is the formal, capitalised `Вы` throughout — Russian has a
 * T–V distinction, but whether a second, informal tone is needed is
 * deliberately out of scope (ORISO-Frontend#1065, scope note).
 */

import { EmailContent } from '../kit/emailTemplate';
import { EmailId } from './emailCatalogue';

const footer = {
	offeredBy: '{{platformName}} — это сервис организации {{orgName}}.',
	links: [
		{ label: 'Настройки', href: '{{settingsUrl}}' },
		{ label: 'Защита данных', href: '{{privacyUrl}}' },
		{ label: 'Выходные данные', href: '{{imprintUrl}}' },
		{ label: 'Отказаться от уведомлений', href: '{{unsubscribeUrl}}' }
	],
	automatedNote:
		'Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.'
};

const assurance =
	'Ваши сообщения защищены сквозным шифрованием. Прочитать их можете только Вы и Ваша консультационная служба — даже мы не можем.';

/** See `de-sie` — no unsubscribe link, because nothing switches these off. */
const securityFooter = {
	offeredBy: '{{platformName}} — это сервис организации {{orgName}}.',
	links: [
		{ label: 'Защита данных', href: '{{privacyUrl}}' },
		{ label: 'Выходные данные', href: '{{imprintUrl}}' }
	],
	automatedNote:
		'Это письмо относится ко входу в аккаунт, от него нельзя отписаться. Пожалуйста, не отвечайте на него.'
};

const legalFooter = {
	...securityFooter,
	automatedNote:
		'Это письмо относится к договорным отношениям, от него нельзя отписаться. Пожалуйста, не отвечайте на него.'
};

const staffAssurance =
	'Содержание консультаций никогда не попадает в письмо. Вы видите его только в зашифрованном виде после входа в аккаунт.';

const securityAssurance =
	'Мы никогда не спрашиваем Ваш пароль по электронной почте. Не передавайте эту ссылку никому.';

const codeAssurance =
	'Мы никогда не спрашиваем Ваш пароль по электронной почте. Не передавайте этот код никому.';

const accountAssurance =
	'Мы никогда не спрашиваем Ваш пароль по электронной почте. Об изменениях в Вашем доступе мы сообщаем всегда.';

const legalAssurance =
	'Это письмо относится к договорным отношениям между {{orgName}} и {{tenantName}}.';

export const ru: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'Для Вас есть новое сообщение',
		preheader: 'В Вашей консультации Вас ждёт новое сообщение.',
		headline: 'Для Вас есть новое сообщение',
		paragraphs: [
			'В Вашей консультации на {{platformName}} Вас ждёт новое сообщение.',
			'В целях защиты данных мы не показываем здесь ни содержания, ни имён. Сообщение Вы прочитаете в зашифрованном виде после входа в аккаунт.'
		],
		cta: { label: 'К сообщению', href: '{{messageUrl}}' },
		footnote:
			'Отвечать сразу не обязательно. Сообщение останется в Вашем почтовом ящике столько, сколько нужно.',
		assurance,
		footer
	},

	'willkommen': {
		subject: 'Добро пожаловать на {{platformName}}',
		preheader: 'Ваш анонимный доступ создан — вот что дальше.',
		headline: 'Ваш доступ создан',
		paragraphs: [
			'Вы анонимно зарегистрировались на {{platformName}}. Мы рады, что Вы здесь.',
			'Пожалуйста, сохраните имя пользователя в надёжном месте. В целях защиты данных мы не можем его восстановить.'
		],
		panel: [{ label: 'Имя пользователя', value: '{{username}}' }],
		cta: { label: 'Войти в консультацию', href: '{{loginUrl}}' },
		footnote:
			'Ваш консультант или консультантка ответит в течение 2 рабочих дней.',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'Задать новый пароль',
		preheader: 'Ссылка действительна {{expiryHours}} часов.',
		headline: 'Задать новый пароль',
		paragraphs: [
			'Вы запросили новый пароль для своего доступа на {{platformName}}.',
			'Ссылка действительна {{expiryHours}} часов и срабатывает только один раз.'
		],
		cta: { label: 'Задать новый пароль', href: '{{resetUrl}}' },
		footnote:
			'Если Вы этого не запрашивали, просто не обращайте внимания на это письмо. Пароль останется прежним.',
		assurance,
		footer
	},

	'termin': {
		subject: 'Ваша встреча {{appointmentDate}}',
		preheader:
			'{{appointmentDate}}, {{appointmentTime}} — {{appointmentType}}.',
		headline: 'Ваша встреча подтверждена',
		paragraphs: [
			'Мы записали Вашу встречу. Готовиться не нужно — просто приходите такими, какие Вы есть.'
		],
		panel: [
			{ label: 'Дата', value: '{{appointmentDate}}' },
			{ label: 'Время', value: '{{appointmentTime}}' },
			{ label: 'Формат', value: '{{appointmentType}}' },
			{ label: 'Место', value: '{{locationName}}<br>{{locationAddress}}' }
		],
		cta: { label: 'Посмотреть встречу', href: '{{appointmentUrl}}' },
		secondaryAction: {
			label: 'Открыть адрес на карте',
			href: '{{mapUrl}}'
		},
		footnote:
			'За 24 часа до встречи Вы получите напоминание. Отменить можно в любой момент.',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'Как связаться с Вашей консультацией',
		preheader: 'Прямой номер, часы приёма и запись — на одном экране.',
		headline: 'Как связаться с Вашей консультацией',
		paragraphs: [
			'Кроме защищённого чата Вы можете связаться с консультацией по телефону или сразу записаться на встречу.',
			'Ваш доступ при этом остаётся анонимным — Вы сами решаете, что рассказывать.'
		],
		panel: [
			{ label: 'Консультация', value: '{{consultantName}}' },
			{ label: 'Прямой номер', value: '{{consultantPhone}}' },
			{ label: 'Часы приёма', value: '{{consultantHours}}' },
			{ label: 'Эл. почта', value: '{{consultantEmail}}' }
		],
		cta: { label: 'Записаться на встречу', href: '{{bookingUrl}}' },
		secondaryAction: {
			label: 'К защищённому чату',
			href: '{{messageUrl}}'
		},
		footnote:
			'Вне часов приёма лучше написать в чат. Мы ответим в течение 2 рабочих дней.',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'Новый запрос на консультацию',
		preheader: 'Вас ждёт новый запрос.',
		headline: 'Вас ждёт новый запрос',
		paragraphs: [
			'Вам назначен новый запрос на консультацию. Подробности Вы увидите после входа в разделе консультаций.'
		],
		panel: [
			{ label: 'Тема', value: '{{requestTopic}}' },
			{ label: 'Почтовый индекс', value: '{{requestPostcode}}' },
			{ label: 'Поступил', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Открыть запрос', href: '{{requestUrl}}' },
		footnote: 'Пожалуйста, примите запрос в течение 2 рабочих дней.',
		assurance,
		footer
	},

	'systemhinweis': {
		subject: 'Плановые работы {{maintenanceDate}}',
		preheader: 'Недоступно с {{maintenanceStart}} до {{maintenanceEnd}}.',
		headline: 'Короткий перерыв на технические работы',
		paragraphs: [
			'{{maintenanceDate}} платформа {{platformName}} будет недоступна с {{maintenanceStart}} до {{maintenanceEnd}}.',
			'После этого Вы сможете писать как обычно.'
		],
		cta: { label: 'Посмотреть страницу статуса', href: '{{statusUrl}}' },
		footnote: 'Уже написанные сообщения не пропадут.',
		assurance,
		footer
	},

	'neue-anfrage': {
		subject: 'Новый запрос в Вашем консультационном центре',
		preheader: 'Запрос ждёт, чтобы его приняли.',
		headline: 'Поступил новый запрос',
		paragraphs: [
			'В Ваш консультационный центр поступил новый запрос на консультацию. Он ещё никому не назначен.',
			'Кто примет его, тот и ведёт консультацию.'
		],
		panel: [
			{ label: 'Тема', value: '{{requestTopic}}' },
			{ label: 'Почтовый индекс', value: '{{requestPostcode}}' },
			{ label: 'Поступил', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Посмотреть запрос', href: '{{requestUrl}}' },
		footnote: 'Пожалуйста, примите запрос в течение 2 рабочих дней.',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'Запрос адресован лично Вам',
		preheader: 'Этот запрос написан для Вас.',
		headline: 'Запрос адресован лично Вам',
		paragraphs: [
			'Человек, обратившийся за консультацией, при написании запроса выбрал именно Вас.',
			'Если Вы не можете взять этот запрос, пожалуйста, верните его консультационному центру, чтобы он не остался без ответа.'
		],
		panel: [
			{ label: 'Тема', value: '{{requestTopic}}' },
			{ label: 'Поступил', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Открыть запрос', href: '{{requestUrl}}' },
		footnote: 'Пожалуйста, ответьте в течение 2 рабочих дней.',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'Ваша сводка за день',
		preheader: 'Открытые запросы в Вашем консультационном центре.',
		headline: 'Ваша сводка за день',
		paragraphs: [
			'В Вашем консультационном центре есть запросы, ожидающие принятия.'
		],
		panel: [
			{ label: 'Открытые запросы', value: '{{openRequestCount}}' },
			{ label: 'Самое долгое ожидание', value: '{{oldestRequestAge}}' },
			{ label: 'На момент', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'Посмотреть запросы', href: '{{requestUrl}}' },
		footnote:
			'Эта сводка приходит раз в день. Отключить её можно в настройках.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'Запрошена передача',
		preheader: 'Консультацию предлагают передать Вам.',
		headline: 'Консультацию предлагают передать Вам',
		paragraphs: [
			'{{fromConsultantName}} просит передать Вам текущую консультацию.',
			'Пожалуйста, проверьте в разделе консультаций, сможете ли Вы её взять.'
		],
		panel: [
			{ label: 'Дело', value: '{{caseReference}}' },
			{ label: 'Запросил', value: '{{fromConsultantName}}' },
			{ label: 'Запрошено', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Проверить передачу', href: '{{requestUrl}}' },
		footnote:
			'Пока Вы не согласитесь, консультация остаётся у прежнего специалиста.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-bestaetigt': {
		subject: 'Передача подтверждена',
		preheader: 'Ответственность перешла к другому специалисту.',
		headline: 'Передача подтверждена',
		paragraphs: [
			'Консультацию приняли. С этого момента отвечает {{toConsultantName}}.',
			'Человека, обратившегося за консультацией, уведомили об этом в приложении.'
		],
		panel: [
			{ label: 'Дело', value: '{{caseReference}}' },
			{ label: 'Новая ответственность', value: '{{toConsultantName}}' },
			{ label: 'Передано', value: '{{handoverAt}}' }
		],
		cta: { label: 'Открыть консультацию', href: '{{requestUrl}}' },
		footnote:
			'Ваш доступ к прежней истории переписки прекращается вместе с передачей.',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'Новый отклик в профессиональном обмене',
		preheader: 'В профессиональном обмене Вас ждёт отклик.',
		headline: 'Новый отклик в профессиональном обмене',
		paragraphs: [
			'В защищённом профессиональном обмене по одной из Ваших консультаций появился новый отклик.',
			'Содержание Вы увидите в зашифрованном виде после входа в аккаунт.'
		],
		panel: [
			{ label: 'Дело', value: '{{caseReference}}' },
			{ label: 'Поступил', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Прочитать отклик', href: '{{messageUrl}}' },
		footnote:
			'Профессиональный обмен не виден человеку, обратившемуся за консультацией.',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: '{{messageSubject}}',
		preheader: '{{messagePreview}}',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: { label: 'На {{platformName}}', href: '{{loginUrl}}' },
		assurance,
		footer
	},

	'anmeldelink': {
		subject: 'Ваша ссылка для входа на {{platformName}}',
		preheader: 'Ссылка действует {{expiryMinutes}} минут.',
		headline: 'Ваша ссылка для входа',
		paragraphs: [
			'По этой ссылке Вы войдёте без пароля.',
			'Ссылка действует {{expiryMinutes}} минут и срабатывает ровно один раз.'
		],
		cta: { label: 'Войти сейчас', href: '{{loginUrl}}' },
		footnote:
			'Если Вы не собирались входить, не обращайте внимания на это письмо. Без ссылки ничего не произойдёт.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'Ваш одноразовый код для входа',
		preheader: 'Код действует {{expiryMinutes}} минут.',
		headline: 'Ваш одноразовый код',
		paragraphs: ['Введите этот код в окне входа.'],
		code: { label: 'Код', value: '{{otpCode}}' },
		cta: { label: 'К окну входа', href: '{{loginUrl}}' },
		footnote: 'Если Вы не собирались входить, пожалуйста, смените пароль.',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'Приглашение: {{tenantName}} на {{platformName}}',
		preheader: 'Настройте свой доступ к администрированию.',
		headline: 'Добро пожаловать на {{platformName}}',
		paragraphs: [
			'Для {{tenantName}} создан доступ к администрированию {{platformName}}.',
			'По ссылке Вы зададите пароль и завершите настройку.'
		],
		panel: [
			{ label: 'Организация', value: '{{tenantName}}' },
			{ label: 'Ссылка действует до', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Настроить доступ', href: '{{inviteUrl}}' },
		footnote:
			'Если Вы не ожидали этого приглашения, свяжитесь с тем, кто Вас пригласил.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: 'Приглашение в консультацию на {{platformName}}',
		preheader: 'Настройте свой доступ как специалист.',
		headline: 'Вас пригласили в консультацию',
		paragraphs: [
			'{{agencyName}} пригласил(а) Вас на {{platformName}} как специалиста.',
			'По ссылке Вы зададите пароль и настроите двухфакторный вход.'
		],
		panel: [
			{ label: 'Консультационный центр', value: '{{agencyName}}' },
			{ label: 'Ссылка действует до', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Настроить доступ', href: '{{inviteUrl}}' },
		footnote: 'Без двухфакторного входа доступ к консультациям невозможен.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'avv-unterschrift': {
		subject: 'Договор об обработке персональных данных на подпись',
		preheader: 'Договор для {{tenantName}} готов.',
		headline: 'Договор готов к подписанию',
		paragraphs: [
			'Для {{tenantName}} составлен договор об обработке персональных данных.',
			'Пожалуйста, проверьте договор и подпишите его электронно.'
		],
		panel: [
			{ label: 'Организация', value: '{{tenantName}}' },
			{ label: 'Предоставлен', value: '{{dpaProvidedAt}}' },
			{ label: 'Подписать до', value: '{{dpaExpiresAt}}' }
		],
		cta: { label: 'Открыть договор', href: '{{dpaUrl}}' },
		footnote:
			'Без подписанного договора консультация для этой организации остаётся заблокированной.',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'Изменение в Вашей команде',
		preheader: 'Ваши зоны ответственности изменились.',
		headline: 'В Вашей команде что-то изменилось',
		paragraphs: [
			'{{teamChangeStatement}}',
			'Что это означает для Ваших зон ответственности, Вы увидите в разделе консультаций.'
		],
		panel: [
			{ label: 'Дело', value: '{{caseReference}}' },
			{ label: 'Изменено', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'В раздел консультаций', href: '{{appUrl}}' },
		footnote: 'Отправлять ли это уведомление, решает Ваша организация.',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'Тест SMTP пройден',
		preheader: 'Отправка через {{smtpHost}} работает.',
		headline: 'Тестовое письмо SMTP дошло',
		paragraphs: [
			'Если Вы читаете это письмо, отправка через сохранённые данные SMTP работает.'
		],
		panel: [
			{ label: 'Сервер', value: '{{smtpHost}}' },
			{ label: 'Отправитель', value: '{{smtpFrom}}' },
			{ label: 'Отправлено', value: '{{sentAt}}' }
		],
		cta: { label: 'В администрирование', href: '{{appUrl}}' },
		footnote:
			'Это письмо отправляется только по запросу из администрирования.',
		assurance: staffAssurance,
		footer
	},

	'email-geaendert': {
		subject: 'Ваш адрес электронной почты изменён',
		preheader: 'Изменение действует с этого момента.',
		headline: 'Ваш адрес электронной почты изменён',
		paragraphs: [
			'Адрес электронной почты для доступа {{username}} изменён. С этого момента уведомления приходят на этот адрес.',
			'Если это были не Вы, немедленно смените пароль.'
		],
		cta: { label: 'В профиль', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: securityFooter
	}
};

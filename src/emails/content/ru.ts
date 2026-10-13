/**
 * Russian. Machine-translated from `de-sie`, not yet read by a native speaker.
 *
 * See `translationManifest.json` for what this was translated from and
 * `translationReview.json` for which strings still need a human. Until the
 * strings marked in `emailProtectedPaths` are signed off, this locale is
 * `pending-human-review` and its review status remains visible in the catalogue.
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
import { selfHelpAppointmentContent } from './selfHelpAppointments';

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
	'Это письмо относится к договорным отношениям между {{orgName}} и {{tenantNameDative}}.';

export const ru: Record<EmailId, EmailContent> = {
	...selfHelpAppointmentContent('ru', footer, assurance, staffAssurance),
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

	'neue-nachricht-beratung': {
		subject: 'Новое сообщение на {{platformName}}',
		preheader: 'Пожалуйста, войдите в систему.',
		headline: 'Новое сообщение для Вас',
		paragraphs: [
			'В одной из Ваших консультаций появилось новое сообщение.',
			'Войдите в аккаунт, чтобы прочитать сообщение в защищённом разделе.'
		],
		cta: { label: 'Открыть сообщение', href: '{{messageUrl}}' },
		assurance: staffAssurance,
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
		footer: {
			...securityFooter,
			automatedNote:
				'Это письмо предназначено для сброса пароля, от него нельзя отписаться. Пожалуйста, не отвечайте на него.'
		}
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
		preheader: 'Контактные данные Вашей консультации.',
		headline: 'Как связаться с Вашей консультацией',
		paragraphs: [
			'Вы запросили контактные данные Вашей консультации. Доступные способы связи приведены ниже.'
		],
		panel: [
			{ label: 'Консультация', value: '{{consultantName}}' },
			{ label: 'Прямой номер', value: '{{consultantPhone}}' },
			{ label: 'Часы приёма', value: '{{consultantHours}}' },
			{ label: 'Эл. почта', value: '{{consultantEmail}}' }
		],
		cta: { label: 'К защищённому чату', href: '{{messageUrl}}' },
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

	'einsicht-angefragt': {
		subject: 'Новое уведомление',
		preheader: 'Пожалуйста, войдите.',
		headline: 'Запрос по Вашей консультации',
		paragraphs: [
			'Другой специалист вашей консультационной службы просит вашего согласия на временный доступ к вашей беседе.',
			'Рассмотрите запрос в защищённом разделе. Ваш нынешний специалист остаётся ответственным за вашу консультацию.'
		],
		cta: { label: 'Рассмотреть запрос', href: '{{requestUrl}}' },
		assurance,
		footer: { ...footer, links: securityFooter.links }
	},

	'uebergabe-angefragt': {
		subject: 'Новое уведомление',
		preheader: 'Пожалуйста, войдите.',
		headline: 'Запрос по Вашей консультации',
		paragraphs: [
			'Консультант запрашивает Ваше согласие на изменение в Вашей консультации.',
			'Войдите, чтобы рассмотреть запрос в защищённом разделе.'
		],
		cta: { label: 'Рассмотреть запрос', href: '{{requestUrl}}' },
		assurance,
		footer: { ...footer, links: securityFooter.links }
	},

	'uebergabe-bestaetigt': {
		subject: 'Передача подтверждена',
		preheader: 'Передача подтверждена',
		headline: 'Передача подтверждена',
		paragraphs: [
			'Теперь Вы отвечаете за эту консультацию.',
			'Откройте дело в защищённом разделе.'
		],
		cta: { label: 'Открыть дело', href: '{{requestUrl}}' },
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'Новое сообщение на {{platformName}}',
		preheader: 'Пожалуйста, войдите в систему.',
		headline: 'Новый отклик в профессиональном обмене',
		paragraphs: [
			'В защищённом профессиональном обмене по одной из Ваших консультаций появился новый отклик.',
			'Содержание Вы увидите в зашифрованном виде после входа в аккаунт.'
		],
		cta: { label: 'Прочитать отклик', href: '{{messageUrl}}' },
		footnote:
			'Профессиональный обмен не виден человеку, обратившемуся за консультацией.',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: 'Новое сообщение на {{platformName}}',
		preheader: 'Пожалуйста, войдите в систему.',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: { label: 'На {{platformName}}', href: '{{loginUrl}}' },
		assurance,
		footer
	},

	'konto-einrichten': {
		subject: 'Настройте доступ к {{platformName}}',
		preheader: 'Выберите собственный пароль.',
		headline: 'Ваша учётная запись уже создана',
		paragraphs: [
			'Для Вас уже создана учётная запись на {{platformName}}.',
			'Перейдите по этой ссылке, чтобы выбрать собственный пароль. Затем войдите обычным способом; все обязательные проверки безопасности сохраняются.'
		],
		panel: [
			{ label: 'Ссылка действительна до', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Выбрать пароль', href: '{{setupUrl}}' },
		footnote:
			'Если Вы не ожидали эту настройку, не используйте ссылку и обратитесь к администратору.',
		assurance: securityAssurance,
		footer: {
			...securityFooter,
			offeredBy: securityFooter.offeredBy
				.replace('{{platformName}}', '{{offeringName}}')
				.replace('{{orgName}}', '{{operatorName}}')
		}
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
		subject: 'Ваш одноразовый код',
		preheader: 'Код действует {{expiryMinutes}} минут.',
		headline: 'Ваш одноразовый код',
		paragraphs: ['Введите этот код в {{platformName}}.'],
		code: { label: 'Код', value: '{{otpCode}}' },
		cta: { label: 'Открыть {{platformName}}', href: '{{loginUrl}}' },
		footnote:
			'Если Вы не запрашивали этот код, просто не обращайте внимания на это письмо.',
		assurance: codeAssurance,
		footer: {
			...securityFooter,
			automatedNote:
				'Это письмо содержит код безопасности, от него нельзя отписаться. Пожалуйста, не отвечайте на него.'
		}
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
		subject: 'Договорные документы для {{tenantName}}',
		preheader: 'Договорные документы для {{tenantName}} готовы.',
		headline: 'Договорные документы готовы к подтверждению',
		paragraphs: [
			'Для {{tenantName}} подготовлены договорные документы.',
			'Пожалуйста, проверьте документы и подтвердите их в электронном виде.'
		],
		panel: [
			{ label: 'Организация', value: '{{tenantName}}' },
			{ label: 'Предоставлен', value: '{{dpaProvidedAt}}' },
			{ label: 'Подтвердить до', value: '{{dpaExpiresAt}}' }
		],
		cta: {
			label: 'Открыть договор',
			href: '{{dpaUrl}}',
			fallbackHint:
				'Если кнопка не работает, скопируйте эту ссылку в браузер:'
		},
		footnote:
			'Без подтверждения договорных документов консультации для этой организации останутся заблокированными.',
		assurance: legalAssurance,
		footer: {
			...legalFooter,
			offeredBy:
				'{{offeringName}} предоставляется организацией {{operatorName}}.'
		}
	},

	'einladung-freitext': {
		subject: '{{subject}}',
		preheader: '{{preheader}}',
		headline: '{{subject}}',
		paragraphs: [],
		authoredBody: { html: '{{bodyHtml}}', text: '{{bodyText}}' },
		actionSlot: '{{ctaBlock}}',
		assuranceSlot: '{{assuranceBlock}}',
		footer: {
			...securityFooter,
			offeredBy:
				'{{offeringName}} предоставляется организацией {{operatorName}}.',
			automatedNote: '{{footerNote}}'
		}
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
		wrapLongTokens: true,
		subject: 'Ваш адрес электронной почты изменён',
		preheader: 'Изменение действует с этого момента.',
		headline: 'Ваш адрес электронной почты изменён',
		paragraphs: [
			'Адрес электронной почты для доступа {{username}} изменён. С этого момента уведомления приходят на этот адрес.',
			'Если это были не Вы, немедленно смените пароль.'
		],
		cta: { label: 'В профиль', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: {
			...securityFooter,
			automatedNote:
				'Это письмо сообщает об изменении адреса электронной почты. Отключить такое уведомление безопасности нельзя. Пожалуйста, не отвечайте на него.'
		}
	},
	'anruf-erinnerung': {
		subject: 'Сеанс скоро начнётся',
		preheader: 'Войдите в систему, чтобы посмотреть подробности.',
		headline: 'Ваш сеанс скоро начнётся',
		paragraphs: [
			'Запланированный аудио- или видеосеанс скоро начнётся. Все остальные сведения будут безопасно доступны после входа в систему.'
		],
		cta: { label: 'Открыть сеанс', href: '{{callUrl}}' },
		footnote:
			'Это письмо намеренно не содержит темы, имён или сведений об участниках.',
		assurance,
		footer
	},

	'anruf-einladung': {
		subject: 'Вас пригласили на сеанс',
		preheader: 'Приглашение безопасно доступно в вашей учётной записи.',
		headline: 'Новое приглашение',
		paragraphs: [
			'Вас пригласили на аудио- или видеосеанс. Подробности будут безопасно доступны после входа в систему.'
		],
		cta: { label: 'Посмотреть приглашение', href: '{{callUrl}}' },
		footnote:
			'Это письмо намеренно не содержит темы, имён или сведений об участниках.',
		assurance,
		footer
	},

	'anruf-verpasst': {
		subject: 'Вы пропустили звонок',
		preheader: 'Войдите в систему, чтобы открыть защищённую историю.',
		headline: 'Пропущенный звонок',
		paragraphs: [
			'Во время вашего отсутствия состоялся аудио- или видеозвонок. Дополнительные сведения будут безопасно доступны после входа в систему.'
		],
		cta: { label: 'Открыть защищённую историю', href: '{{callUrl}}' },
		footnote:
			'Это письмо намеренно не содержит темы, имён или сведений об участниках.',
		assurance,
		footer
	}
};

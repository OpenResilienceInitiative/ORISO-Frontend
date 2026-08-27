/**
 * Turkish. Machine-translated from `de-sie`, not yet read by a native speaker.
 *
 * See `translationManifest.json` for what this was translated from and
 * `translationReview.json` for which strings still need a human. Until the
 * strings marked in `emailProtectedPaths` are signed off, this locale is
 * `pending-human-review` and no service may select it.
 *
 * Terminology, decided once so the 22 occasions agree with each other:
 *   Beratung            → danışmanlık (the relationship), görüşme (the session)
 *   Beratungsstelle     → danışma merkezi
 *   Fachkraft           → uzman
 *   Träger              → kurum
 *   ratsuchende Person  → danışan
 *   Fachaustausch       → uzmanlar arası paylaşım
 *   AVV                 → veri işleme sözleşmesi
 *
 * The address form is the formal `siz` throughout — Turkish has a T–V
 * distinction, but whether a second, informal tone is needed is deliberately
 * out of scope (ORISO-Frontend#1065, scope note).
 */

import { EmailContent } from '../kit/emailTemplate';
import { EmailId } from './emailCatalogue';

const footer = {
	offeredBy:
		'{{platformName}}, {{orgName}} tarafından sunulan bir hizmettir.',
	links: [
		{ label: 'Ayarlar', href: '{{settingsUrl}}' },
		{ label: 'Veri koruma', href: '{{privacyUrl}}' },
		{ label: 'Künye', href: '{{imprintUrl}}' },
		{ label: 'Bildirimlerden çık', href: '{{unsubscribeUrl}}' }
	],
	automatedNote:
		'Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.'
};

const assurance =
	'Mesajlarınız uçtan uca şifrelenmiştir. Sizden ve danışmanlığınızdan başka kimse onları okuyamaz – biz de okuyamayız.';

/** See `de-sie` — no unsubscribe link, because nothing switches these off. */
const securityFooter = {
	offeredBy:
		'{{platformName}}, {{orgName}} tarafından sunulan bir hizmettir.',
	links: [
		{ label: 'Veri koruma', href: '{{privacyUrl}}' },
		{ label: 'Künye', href: '{{imprintUrl}}' }
	],
	automatedNote:
		'Bu e-posta oturum açma sürecinin bir parçasıdır ve iptal edilemez. Lütfen yanıtlamayınız.'
};

const legalFooter = {
	...securityFooter,
	automatedNote:
		'Bu e-posta sözleşme ilişkisinin bir parçasıdır ve iptal edilemez. Lütfen yanıtlamayınız.'
};

const staffAssurance =
	'Danışmanlık içerikleri hiçbir zaman e-postada yer almaz. Onları yalnızca oturum açtıktan sonra şifreli olarak görürsünüz.';

const securityAssurance =
	'Şifrenizi hiçbir zaman e-postayla sormayız. Bu bağlantıyı kimseyle paylaşmayın.';

const codeAssurance =
	'Şifrenizi hiçbir zaman e-postayla sormayız. Bu kodu kimseyle paylaşmayın.';

const accountAssurance =
	'Şifrenizi hiçbir zaman e-postayla sormayız. Erişiminizdeki değişiklikleri size her zaman bildiririz.';

const legalAssurance =
	'Bu e-posta, {{orgName}} ile {{tenantName}} arasındaki sözleşme ilişkisinin bir parçasıdır.';

export const tr: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'Yeni bir mesajınız var',
		preheader: 'Danışmanlığınızda sizin için yeni bir mesaj hazır.',
		headline: 'Yeni bir mesajınız var',
		paragraphs: [
			'{{platformName}} üzerindeki danışmanlığınızda sizin için yeni bir mesaj hazır.',
			'Veri koruma nedeniyle burada ne içerik ne de isim gösteriyoruz. Mesajı oturum açtıktan sonra şifreli olarak okursunuz.'
		],
		cta: { label: 'Mesaja git', href: '{{messageUrl}}' },
		footnote:
			'Hemen yanıtlamak zorunda değilsiniz. Mesaj, ihtiyacınız olduğu sürece posta kutunuzda kalır.',
		assurance,
		footer
	},

	'willkommen': {
		subject: '{{platformName}} platformuna hoş geldiniz',
		preheader: 'Anonim erişiminiz hazır – bundan sonrası şöyle.',
		headline: 'Erişiminiz hazır',
		paragraphs: [
			'{{platformName}} platformuna anonim olarak kaydoldunuz. Aramızda olmanıza sevindik.',
			'Lütfen kullanıcı adınızı iyi saklayın. Veri koruma nedeniyle onu geri getiremeyiz.'
		],
		panel: [{ label: 'Kullanıcı adı', value: '{{username}}' }],
		cta: { label: 'Danışmanlığa giriş yap', href: '{{loginUrl}}' },
		footnote: 'Danışmanınız 2 iş günü içinde yanıt verir.',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'Yeni şifre belirleyin',
		preheader: 'Bağlantı {{expiryHours}} saat geçerlidir.',
		headline: 'Yeni şifre belirleyin',
		paragraphs: [
			'{{platformName}} erişiminiz için yeni bir şifre talep ettiniz.',
			'Bağlantı {{expiryHours}} saat geçerlidir ve yalnızca bir kez kullanılabilir.'
		],
		cta: { label: 'Şifreyi yeniden belirle', href: '{{resetUrl}}' },
		footnote:
			'Bunu siz talep etmediyseniz bu e-postayı dikkate almayın. Şifreniz değişmeden kalır.',
		assurance,
		footer
	},

	'termin': {
		subject: '{{appointmentDate}} tarihli randevunuz',
		preheader:
			'{{appointmentDate}}, {{appointmentTime}} – {{appointmentType}}.',
		headline: 'Randevunuz onaylandı',
		paragraphs: [
			'Randevunuzu not aldık. Hazırlanmanız gereken bir şey yok – olduğunuz gibi gelin.'
		],
		panel: [
			{ label: 'Tarih', value: '{{appointmentDate}}' },
			{ label: 'Saat', value: '{{appointmentTime}}' },
			{ label: 'Tür', value: '{{appointmentType}}' },
			{ label: 'Yer', value: '{{locationName}}<br>{{locationAddress}}' }
		],
		cta: { label: 'Randevuyu görüntüle', href: '{{appointmentUrl}}' },
		secondaryAction: {
			label: 'Adresi haritada aç',
			href: '{{mapUrl}}'
		},
		footnote:
			'24 saat önce bir hatırlatma alırsınız. İptal etmek her zaman mümkündür.',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'Danışmanlığınıza nasıl ulaşırsınız',
		preheader: 'Doğrudan hat, görüşme saatleri ve randevu tek bakışta.',
		headline: 'Danışmanlığınıza nasıl ulaşırsınız',
		paragraphs: [
			'Korumalı sohbetin yanı sıra danışmanlığınıza telefonla da ulaşabilir veya doğrudan randevu alabilirsiniz.',
			'Erişiminiz bu sırada anonim kalır – neyi anlatacağınıza siz karar verirsiniz.'
		],
		panel: [
			{ label: 'Danışmanlık', value: '{{consultantName}}' },
			{ label: 'Doğrudan hat', value: '{{consultantPhone}}' },
			{ label: 'Görüşme saatleri', value: '{{consultantHours}}' },
			{ label: 'E-posta', value: '{{consultantEmail}}' }
		],
		cta: { label: 'Randevu al', href: '{{bookingUrl}}' },
		secondaryAction: {
			label: 'Korumalı sohbete git',
			href: '{{messageUrl}}'
		},
		footnote:
			'Görüşme saatleri dışında en iyisi sohbete yazmanızdır. 2 iş günü içinde size döneriz.',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'Yeni danışmanlık talebi',
		preheader: 'Yeni bir talep sizi bekliyor.',
		headline: 'Yeni bir talep sizi bekliyor',
		paragraphs: [
			'Size yeni bir danışmanlık talebi atandı. Ayrıntıları oturum açtıktan sonra danışmanlık alanında görürsünüz.'
		],
		panel: [
			{ label: 'Konu', value: '{{requestTopic}}' },
			{ label: 'Posta kodu', value: '{{requestPostcode}}' },
			{ label: 'Geliş', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Talebi aç', href: '{{requestUrl}}' },
		footnote: 'Lütfen talebi 2 iş günü içinde kabul edin.',
		assurance,
		footer
	},

	'systemhinweis': {
		subject: '{{maintenanceDate}} tarihinde planlı bakım',
		preheader:
			'{{maintenanceStart}} – {{maintenanceEnd}} arasında erişilemez.',
		headline: 'Kısa bir bakım molası',
		paragraphs: [
			'{{maintenanceDate}} tarihinde {{platformName}}, {{maintenanceStart}} ile {{maintenanceEnd}} arasında erişilemez olacak.',
			'Sonrasında her zamanki gibi yazmaya devam edebilirsiniz.'
		],
		cta: { label: 'Durum sayfasını görüntüle', href: '{{statusUrl}}' },
		footnote: 'Daha önce yazdığınız mesajlar kaybolmaz.',
		assurance,
		footer
	},

	'neue-anfrage': {
		subject: 'Danışma merkezinizde yeni talep',
		preheader: 'Bir talep kabul edilmeyi bekliyor.',
		headline: 'Yeni bir talep geldi',
		paragraphs: [
			'Danışma merkezinize yeni bir danışmanlık talebi geldi. Henüz kimseye atanmadı.',
			'Talebi kabul eden kişi danışmanlığı üstlenir.'
		],
		panel: [
			{ label: 'Konu', value: '{{requestTopic}}' },
			{ label: 'Posta kodu', value: '{{requestPostcode}}' },
			{ label: 'Geliş', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Talebi görüntüle', href: '{{requestUrl}}' },
		footnote: 'Lütfen talebi 2 iş günü içinde kabul edin.',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'Bir talep doğrudan size yönelik',
		preheader: 'Bu talep sizin için yazıldı.',
		headline: 'Bir talep doğrudan size yönelik',
		paragraphs: [
			'Bir danışan, talebini yazarken açıkça sizi seçti.',
			'Talebi üstlenemiyorsanız lütfen danışma merkezine geri verin, böylece bekleyip kalmaz.'
		],
		panel: [
			{ label: 'Konu', value: '{{requestTopic}}' },
			{ label: 'Geliş', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Talebi aç', href: '{{requestUrl}}' },
		footnote: 'Lütfen 2 iş günü içinde yanıt verin.',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'Günlük özetiniz',
		preheader: 'Danışma merkezinizdeki açık talepler.',
		headline: 'Günlük özetiniz',
		paragraphs: [
			'Danışma merkezinizde kabul edilmeyi bekleyen açık talepler var.'
		],
		panel: [
			{ label: 'Açık talepler', value: '{{openRequestCount}}' },
			{ label: 'En uzun bekleme', value: '{{oldestRequestAge}}' },
			{ label: 'Durum', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'Talepleri görüntüle', href: '{{requestUrl}}' },
		footnote:
			'Bu özet günde bir kez gelir. Ayarlardan aboneliğinizi iptal edebilirsiniz.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'Devir talebi',
		preheader: 'Bir danışmanlığın size devredilmesi isteniyor.',
		headline: 'Bir danışmanlığın size devredilmesi isteniyor',
		paragraphs: [
			'{{fromConsultantName}}, devam eden bir danışmanlığın size devredilmesini istiyor.',
			'Lütfen danışmanlık alanında devralıp devralamayacağınızı kontrol edin.'
		],
		panel: [
			{ label: 'Dosya', value: '{{caseReference}}' },
			{ label: 'Talep eden', value: '{{fromConsultantName}}' },
			{ label: 'Talep tarihi', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Devri incele', href: '{{requestUrl}}' },
		footnote: 'Siz onaylayana kadar danışmanlık mevcut uzmanda kalır.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-bestaetigt': {
		subject: 'Devir onaylandı',
		preheader: 'Sorumluluk değişti.',
		headline: 'Devir onaylandı',
		paragraphs: [
			'Danışmanlık devralındı. Bundan sonra {{toConsultantName}} sorumlu.',
			'Danışan, uygulama üzerinden bilgilendirildi.'
		],
		panel: [
			{ label: 'Dosya', value: '{{caseReference}}' },
			{ label: 'Yeni sorumlu', value: '{{toConsultantName}}' },
			{ label: 'Devir tarihi', value: '{{handoverAt}}' }
		],
		cta: { label: 'Danışmanlığı aç', href: '{{requestUrl}}' },
		footnote: 'Önceki yazışmalara erişiminiz devirle birlikte sona erer.',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'Uzmanlar arası paylaşımda yeni geri bildirim',
		preheader:
			'Uzmanlar arası paylaşımda sizin için bir geri bildirim var.',
		headline: 'Uzmanlar arası paylaşımda yeni geri bildirim',
		paragraphs: [
			'Danışmanlıklarınızdan biriyle ilgili korumalı uzmanlar arası paylaşımda yeni bir geri bildirim var.',
			'İçeriği oturum açtıktan sonra şifreli olarak görürsünüz.'
		],
		panel: [
			{ label: 'Dosya', value: '{{caseReference}}' },
			{ label: 'Geliş', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Geri bildirimi oku', href: '{{messageUrl}}' },
		footnote: 'Uzmanlar arası paylaşım danışana görünmez.',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: '{{messageSubject}}',
		preheader: '{{messagePreview}}',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: {
			label: '{{platformName}} platformuna git',
			href: '{{loginUrl}}'
		},
		assurance,
		footer
	},

	'anmeldelink': {
		subject: '{{platformName}} için giriş bağlantınız',
		preheader: 'Bağlantı {{expiryMinutes}} dakika geçerlidir.',
		headline: 'Giriş bağlantınız',
		paragraphs: [
			'Bu bağlantıyla şifresiz giriş yaparsınız.',
			'Bağlantı {{expiryMinutes}} dakika geçerlidir ve tam olarak bir kez çalışır.'
		],
		cta: { label: 'Şimdi giriş yap', href: '{{loginUrl}}' },
		footnote:
			'Giriş yapmak istemediyseniz bu e-postayı dikkate almayın. Bağlantı olmadan hiçbir şey olmaz.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'Giriş için tek kullanımlık kodunuz',
		preheader: 'Kod {{expiryMinutes}} dakika geçerlidir.',
		headline: 'Tek kullanımlık kodunuz',
		paragraphs: ['Bu kodu giriş penceresine yazın.'],
		code: { label: 'Kod', value: '{{otpCode}}' },
		cta: { label: 'Girişe git', href: '{{loginUrl}}' },
		footnote: 'Giriş yapmak istemediyseniz lütfen şifrenizi değiştirin.',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'Davet: {{platformName}} üzerinde {{tenantName}}',
		preheader: 'Yönetim erişiminizi kurun.',
		headline: '{{platformName}} platformuna hoş geldiniz',
		paragraphs: [
			'{{tenantName}} için {{platformName}} yönetimine erişim oluşturuldu.',
			'Bağlantı üzerinden şifrenizi belirler ve kurulumu tamamlarsınız.'
		],
		panel: [
			{ label: 'Kurum', value: '{{tenantName}}' },
			{ label: 'Bağlantı geçerlilik sonu', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Erişimi kur', href: '{{inviteUrl}}' },
		footnote:
			'Bu daveti beklemiyorduysanız lütfen sizi davet eden kişiyle iletişime geçin.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: '{{platformName}} üzerinde danışmanlığa davet',
		preheader: 'Uzman erişiminizi kurun.',
		headline: 'Danışmanlığa davet edildiniz',
		paragraphs: [
			'{{agencyName}}, sizi uzman olarak {{platformName}} platformuna davet etti.',
			'Bağlantı üzerinden şifrenizi belirler ve iki faktörlü girişi kurarsınız.'
		],
		panel: [
			{ label: 'Danışma merkezi', value: '{{agencyName}}' },
			{ label: 'Bağlantı geçerlilik sonu', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Erişimi kur', href: '{{inviteUrl}}' },
		footnote:
			'İki faktörlü giriş olmadan danışmanlıklara erişim mümkün değildir.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'avv-unterschrift': {
		subject: 'Veri işleme sözleşmesi imzaya hazır',
		preheader: '{{tenantName}} için sözleşme hazır.',
		headline: 'Sözleşme imzaya hazır',
		paragraphs: [
			'{{tenantName}} için bir veri işleme sözleşmesi hazırlandı.',
			'Lütfen sözleşmeyi inceleyin ve dijital olarak imzalayın.'
		],
		panel: [
			{ label: 'Kurum', value: '{{tenantName}}' },
			{ label: 'Hazırlanma tarihi', value: '{{dpaProvidedAt}}' },
			{ label: 'Son imza tarihi', value: '{{dpaExpiresAt}}' }
		],
		cta: { label: 'Sözleşmeyi aç', href: '{{dpaUrl}}' },
		footnote:
			'İmzalanmış veri işleme sözleşmesi olmadan bu kurum için danışmanlık kapalı kalır.',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'Ekibinizde değişiklik',
		preheader: 'Sorumluluklarınız değişti.',
		headline: 'Ekibinizde bir şey değişti',
		paragraphs: [
			'{{teamChangeStatement}}',
			'Bunun sorumluluklarınız için ne anlama geldiğini danışmanlık alanında görürsünüz.'
		],
		panel: [
			{ label: 'İşlem', value: '{{caseReference}}' },
			{ label: 'Değişiklik tarihi', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'Danışmanlık alanına git', href: '{{appUrl}}' },
		footnote:
			'Bu bildirimin gönderilip gönderilmeyeceğine kurumunuz karar verir.',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'SMTP testi başarılı',
		preheader: '{{smtpHost}} üzerinden gönderim çalışıyor.',
		headline: 'SMTP testi ulaştı',
		paragraphs: [
			'Bu e-postayı okuyorsanız, kayıtlı SMTP bilgileriyle gönderim çalışıyor demektir.'
		],
		panel: [
			{ label: 'Sunucu', value: '{{smtpHost}}' },
			{ label: 'Gönderen', value: '{{smtpFrom}}' },
			{ label: 'Gönderim', value: '{{sentAt}}' }
		],
		cta: { label: 'Yönetime git', href: '{{appUrl}}' },
		footnote:
			'Bu e-posta yalnızca yönetimden talep edildiğinde gönderilir.',
		assurance: staffAssurance,
		footer
	},

	'email-geaendert': {
		subject: 'E-posta adresiniz değiştirildi',
		preheader: 'Değişiklik şu andan itibaren geçerli.',
		headline: 'E-posta adresiniz değiştirildi',
		paragraphs: [
			'{{username}} erişimine ait e-posta adresi değiştirildi. Bildirimler bundan böyle bu adrese gidiyor.',
			'Bunu siz yapmadıysanız lütfen hemen şifrenizi değiştirin.'
		],
		cta: { label: 'Profile git', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: securityFooter
	}
};

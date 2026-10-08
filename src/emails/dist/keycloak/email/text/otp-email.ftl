<#ftl output_format="plainText">
${msg("orisoOtpHeadline")}
========================================

${msg("orisoOtpBody1", properties.orisoPlatformName)}

${msg("orisoOtpCodeLabel")}: ${otp}

${msg("orisoOtpFootnote")}

----------------------------------------------------------------
${msg("orisoOtpAssurance")}

${properties.orisoOrgName}
${(properties.orisoOrgAddress)!''}
${(properties.orisoContactLine)!''}

${msg("orisoOtpOfferedBy", properties.orisoPlatformName, properties.orisoOrgName)}

${msg("orisoOtpFooterLink1")}: ${properties.orisoPrivacyUrl}
${msg("orisoOtpFooterLink2")}: ${properties.orisoImprintUrl}

${msg("orisoOtpAutomatedNote")}

package com.campusnotices.alerts;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.AppProperties;
import com.campusnotices.mail.Mailer;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class AlertComposeTest {

	private final AlertSender sender = new AlertSender(null, null, new AppProperties("https://notices.example", "x"),
			null, null, null, null);

	private static AlertSender.Match match(long id, String title, String titleEn, String summary, LocalDate deadline) {
		return new AlertSender.Match(id, "scholarship", title, titleEn, summary, deadline);
	}

	@Test
	void oneMatchWithoutEnglishUsesTheKoreanTitleInTheSubject() {
		Mailer.Email mail = sender.compose("a@b.c", "tok", List.of(match(7, "장학금 안내", null, null, null)));

		assertThat(mail.subject()).isEqualTo("New notice: 장학금 안내");
		assertThat(mail.text()).contains("- 장학금 안내\n  Matched \"scholarship\"\n  https://notices.example/notices/7");
		assertThat(mail.text()).doesNotContain("deadline");
		assertThat(mail.html()).doesNotContain("deadline");
	}

	@Test
	void englishTitleSummaryAndDeadlineAreShownWhenKnown() {
		Mailer.Email mail = sender.compose("a@b.c", "tok",
				List.of(match(8, "장학금 안내", "Scholarship info", "Apply online.", LocalDate.of(2026, 11, 2))));

		assertThat(mail.subject()).isEqualTo("New notice: Scholarship info");
		assertThat(mail.text()).contains("- Scholarship info\n  장학금 안내\n").contains("deadline 2026-11-02");
		assertThat(mail.html()).contains("Apply online.").contains("deadline 2026-11-02");
	}

	@Test
	void severalMatchesBecomeOneEmailWithACountInTheSubject() {
		Mailer.Email mail = sender.compose("a@b.c", "tok",
				List.of(match(1, "하나", null, null, null), match(2, "둘", null, null, null)));

		assertThat(mail.subject()).isEqualTo("2 new notices match your keywords");
		assertThat(mail.text()).contains("/notices/1").contains("/notices/2");
	}

	@Test
	void htmlEscapesNoticeTextAndTheUnsubscribeTokenIsUrlEncoded() {
		Mailer.Email mail = sender.compose("a@b.c", "a+b/c=",
				List.of(match(3, "<script>alert(1)</script>", null, "x & y", null)));

		assertThat(mail.html()).doesNotContain("<script>").contains("&lt;script&gt;").contains("x &amp; y");
		assertThat(mail.text()).contains("https://notices.example/unsubscribe?token=a%2Bb%2Fc%3D");
		assertThat(mail.headers())
				.containsEntry("List-Unsubscribe", "<https://notices.example/api/alerts/unsubscribe?token=a%2Bb%2Fc%3D>")
				.containsEntry("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
	}
}

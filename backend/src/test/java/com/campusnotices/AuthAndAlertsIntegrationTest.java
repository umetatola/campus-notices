package com.campusnotices;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import com.campusnotices.alerts.AlertMatcher;
import com.campusnotices.alerts.AlertSender;
import com.campusnotices.crawler.NoticeWriter;
import com.campusnotices.mail.Mailer;
import com.campusnotices.notice.Notice;
import com.campusnotices.notice.ScrapedNotice;
import com.campusnotices.summary.Summarizer;
import com.campusnotices.summary.SummaryQueue;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Sign-in by email link, keyword subscriptions and alert emails, end to end over HTTP. */
@SpringBootTest(properties = {"crawler.enabled=false", "summarizer.provider=none",
		"summarizer.initial-delay=PT1H", "alerts.initial-delay=PT1H", "alerts.summary-wait=PT0S"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class AuthAndAlertsIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

	private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

	@Autowired
	MockMvcTester mvc;

	@Autowired
	CapturingMailer mail;

	@Autowired
	JdbcClient jdbc;

	@Autowired
	NoticeWriter writer;

	@Autowired
	SummaryQueue summaries;

	@Autowired
	AlertMatcher matcher;

	@Autowired
	AlertSender sender;

	@BeforeEach
	void clearMail() {
		mail.sent.clear();
	}

	private String requestLinkAndReadToken(String email) {
		assertThat(mvc.post().uri("/api/auth/request-link").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
				.hasStatus(202);
		Mailer.Email last = mail.sent.getLast();
		assertThat(last.to()).isEqualTo(email.toLowerCase());
		Matcher m = TOKEN.matcher(last.text());
		assertThat(m.find()).isTrue();
		return m.group(1);
	}

	private MockHttpSession signIn(String email) {
		String token = requestLinkAndReadToken(email);
		MockHttpSession session = new MockHttpSession();
		assertThat(mvc.post().uri("/api/auth/verify").session(session).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
				.hasStatusOk();
		return session;
	}

	@Test
	void signInWithEmailLink() {
		// writes need the CSRF token
		assertThat(mvc.post().uri("/api/auth/request-link")
				.contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"a@ajou.ac.kr\"}"))
				.hasStatus(403);
		assertThat(mvc.post().uri("/api/auth/request-link").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"not-an-email\"}"))
				.hasStatus(400);
		assertThat(mvc.get().uri("/api/me")).hasStatus(401);

		String token = requestLinkAndReadToken("Student@Ajou.ac.kr");
		MockHttpSession session = new MockHttpSession();
		assertThat(mvc.post().uri("/api/auth/verify").session(session).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
				.hasStatusOk().bodyJson().hasPathSatisfying("$.email", v -> v.assertThat().isEqualTo("student@ajou.ac.kr"));
		assertThat(mvc.get().uri("/api/me").session(session))
				.hasStatusOk().bodyJson().hasPathSatisfying("$.email", v -> v.assertThat().isEqualTo("student@ajou.ac.kr"));

		// the link works once
		assertThat(mvc.post().uri("/api/auth/verify").session(new MockHttpSession()).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
				.hasStatus(400);
		// the database has only the hash, never the token itself
		assertThat(jdbc.sql("select count(*) from login_tokens where token_hash = :t").param("t", token)
				.query(Integer.class).single()).isZero();

		assertThat(mvc.post().uri("/api/auth/logout").session(session).with(csrf())).hasStatus(204);
		assertThat(mvc.get().uri("/api/me").session(session)).hasStatus(401);
	}

	@Test
	void expiredLinkIsRejectedAndRequestsAreRateLimited() {
		String token = requestLinkAndReadToken("late@ajou.ac.kr");
		jdbc.sql("update login_tokens set expires_at = now() - interval '1 second' where email = 'late@ajou.ac.kr'").update();
		assertThat(mvc.post().uri("/api/auth/verify").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
				.hasStatus(400);

		requestLinkAndReadToken("late@ajou.ac.kr");
		requestLinkAndReadToken("late@ajou.ac.kr");
		int before = mail.sent.size();
		// fourth request in the window: same 202 answer, but no email
		assertThat(mvc.post().uri("/api/auth/request-link").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"late@ajou.ac.kr\"}"))
				.hasStatus(202);
		assertThat(mail.sent).hasSize(before);
	}

	@Test
	void keywordsAreScopedToTheUser() {
		MockHttpSession alice = signIn("alice@ajou.ac.kr");
		MockHttpSession bob = signIn("bob@ajou.ac.kr");

		assertThat(mvc.post().uri("/api/subscriptions").session(alice).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"keyword\":\"  dorm  \"}"))
				.hasStatus(201).bodyJson().hasPathSatisfying("$.keyword", v -> v.assertThat().isEqualTo("dorm"));
		assertThat(mvc.post().uri("/api/subscriptions").session(alice).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"keyword\":\"DORM\"}"))
				.hasStatus(409);
		long id = jdbc.sql("select id from subscriptions where keyword = 'dorm'").query(Long.class).single();

		assertThat(mvc.get().uri("/api/subscriptions").session(bob)).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.length()", v -> v.assertThat().isEqualTo(0));
		assertThat(mvc.delete().uri("/api/subscriptions/" + id).session(bob).with(csrf())).hasStatus(404);
		assertThat(mvc.delete().uri("/api/subscriptions/" + id).session(alice).with(csrf())).hasStatus(204);
		assertThat(mvc.get().uri("/api/subscriptions")).hasStatus(401);
	}

	@Test
	void matchingNoticesAreEmailedOnceInOneDigest() {
		// a notice from before the user followed anything never triggers an alert
		Notice old = save("800001", "[장학] 오래된 장학금 안내", "지난 공지");
		matcher.matchNewNotices(100);

		MockHttpSession session = signIn("carol@ajou.ac.kr");
		for (String keyword : List.of("장학", "internship")) {
			assertThat(mvc.post().uri("/api/subscriptions").session(session).with(csrf())
					.contentType(MediaType.APPLICATION_JSON).content("{\"keyword\":\"" + keyword + "\"}"))
					.hasStatus(201);
		}

		Notice korean = save("800002", "[학생지원팀] 2026-2 교내 장학금 신청", "장학금 신청 기간 안내");
		Notice english = save("800003", "[일자리+센터] 현장실습 모집", "모집 안내");
		Notice unrelated = save("800004", "[총무팀] 주차 안내", "주차장 공사");
		// the English keyword can only match through the English summary
		SummaryQueue.Job job = summaries.claim(100).stream().filter(j -> j.noticeId() == english.getId()).findFirst().orElseThrow();
		summaries.complete(job, new Summarizer.Result("[Career Center] Internship recruitment",
				"Applications for the fall internship program are open.", LocalDate.of(2026, 10, 2), null, "test"));

		mail.sent.clear();
		matcher.matchNewNotices(100);
		assertThat(sender.sendPending(50)).isEqualTo(1);

		assertThat(mail.sent).singleElement().satisfies(email -> {
			assertThat(email.to()).isEqualTo("carol@ajou.ac.kr");
			assertThat(email.subject()).isEqualTo("2 new notices match your keywords");
			assertThat(email.text())
					.contains("/notices/" + korean.getId())
					.contains("[Career Center] Internship recruitment")
					.contains("deadline 2026-10-02")
					.doesNotContain("/notices/" + unrelated.getId())
					.doesNotContain("/notices/" + old.getId());
		});

		// nothing new: no second email
		matcher.matchNewNotices(100);
		assertThat(sender.sendPending(50)).isZero();
	}

	@Test
	void oneClickUnsubscribePausesAlertsUntilTurnedBackOn() {
		MockHttpSession session = signIn("dave@ajou.ac.kr");
		assertThat(mvc.post().uri("/api/subscriptions").session(session).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"keyword\":\"zebra\"}"))
				.hasStatus(201);

		save("800101", "[행사] zebra 특강 안내", "강연");
		mail.sent.clear();
		matcher.matchNewNotices(100);
		assertThat(sender.sendPending(50)).isEqualTo(1);
		Mailer.Email first = mail.sent.getLast();
		assertThat(first.headers()).containsEntry("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
		assertThat(first.text()).contains("/unsubscribe?token=");
		Matcher m = Pattern.compile("<https?://[^>]*/api/alerts/unsubscribe\\?token=([A-Za-z0-9_-]+)>")
				.matcher(first.headers().get("List-Unsubscribe"));
		assertThat(m.matches()).isTrue();
		String token = m.group(1);

		// the mail app's one-click POST: no session, no CSRF token
		assertThat(mvc.post().uri("/api/alerts/unsubscribe?token=" + token)
				.contentType(MediaType.APPLICATION_FORM_URLENCODED).content("List-Unsubscribe=One-Click"))
				.hasStatus(204);
		assertThat(mvc.post().uri("/api/alerts/unsubscribe?token=" + token)).hasStatus(204); // idempotent
		assertThat(mvc.post().uri("/api/alerts/unsubscribe?token=not-a-real-token")).hasStatus(404);
		assertThat(mvc.get().uri("/api/alerts/status").session(session)).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.paused", v -> v.assertThat().isEqualTo(true));
		// keywords are kept
		assertThat(mvc.get().uri("/api/subscriptions").session(session)).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.length()", v -> v.assertThat().isEqualTo(1));

		// while paused: no email, and nothing piles up for later
		save("800102", "[행사] zebra 2차 특강", "강연");
		matcher.matchNewNotices(100);
		assertThat(sender.sendPending(50)).isZero();

		// turning alerts back on needs the session and the CSRF token
		assertThat(mvc.post().uri("/api/alerts/resume").session(session)).hasStatus(403);
		assertThat(mvc.post().uri("/api/alerts/resume").session(session).with(csrf())).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.paused", v -> v.assertThat().isEqualTo(false));
		save("800103", "[행사] zebra 3차 특강", "강연");
		mail.sent.clear();
		matcher.matchNewNotices(100);
		assertThat(sender.sendPending(50)).isEqualTo(1);
		assertThat(mail.sent.getLast().subject()).contains("zebra 3차").doesNotContain("2차");
		// the same token keeps working in later emails
		assertThat(mail.sent.getLast().headers().get("List-Unsubscribe")).contains(token);
	}

	private Notice save(String articleId, String title, String body) {
		return writer.save("test", new ScrapedNotice(articleId, "장학", title, "학생지원팀", LocalDate.of(2026, 9, 29),
				"https://example.org/" + articleId, false, "<p>" + body + "</p>", body, List.of()));
	}

	static class CapturingMailer implements Mailer {

		final List<Email> sent = new CopyOnWriteArrayList<>();

		@Override
		public void send(Email email) {
			sent.add(email);
		}
	}

	@TestConfiguration
	static class Mail {

		@Bean
		@Primary
		CapturingMailer capturingMailer() {
			return new CapturingMailer();
		}
	}
}

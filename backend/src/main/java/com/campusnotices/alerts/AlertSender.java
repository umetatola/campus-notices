package com.campusnotices.alerts;

import com.campusnotices.Metrics;
import com.campusnotices.AppProperties;
import com.campusnotices.mail.EmailHtml;
import com.campusnotices.mail.Mailer;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

/**
 * Sends the email outbox: one email per user listing every unsent match, so a busy day is one email, not ten.
 *
 * <p>Each user's rows are locked ({@code FOR UPDATE SKIP LOCKED}) while their email is sent, so two instances
 * never send the same alert. Delivery is at-least-once: if the database commit fails after the SMTP server
 * accepted the email, the next run sends it again.
 */
@Component
public class AlertSender {

	private static final Logger log = LoggerFactory.getLogger(AlertSender.class);

	record Match(long noticeId, String keyword, String title, String titleEn, String summaryEn, LocalDate deadline) {
	}

	private final JdbcClient jdbc;
	private final Mailer mailer;
	private final AppProperties app;
	private final AlertProperties props;
	private final TransactionTemplate tx;
	private final UnsubscribeService unsubscribe;
	private final Metrics metrics;

	public AlertSender(JdbcClient jdbc, Mailer mailer, AppProperties app, AlertProperties props,
			TransactionTemplate tx, UnsubscribeService unsubscribe, Metrics metrics) {
		this.jdbc = jdbc;
		this.mailer = mailer;
		this.app = app;
		this.props = props;
		this.tx = tx;
		this.unsubscribe = unsubscribe;
		this.metrics = metrics;
	}

	/** Returns how many emails were sent. */
	public int sendPending(int maxUsers) {
		List<Long> users = jdbc.sql("""
				select distinct d.user_id from alert_deliveries d
				  join users u on u.id = d.user_id and u.alerts_paused_at is null
				 where d.sent_at is null and d.attempts < :max
				 limit :limit
				""")
				.param("max", props.maxAttempts())
				.param("limit", maxUsers)
				.query(Long.class).list();
		int sent = 0;
		for (long userId : users) {
			if (Boolean.TRUE.equals(tx.execute(status -> sendTo(userId)))) {
				sent++;
			}
		}
		return sent;
	}

	private boolean sendTo(long userId) {
		List<Match> matches = jdbc.sql("""
				select d.notice_id, d.keyword, n.title, s.title_en, s.summary_en, s.deadline
				  from alert_deliveries d
				  join notices n on n.id = d.notice_id
				  left join notice_summaries s on s.notice_id = n.id and s.status = 'DONE'
				 where d.user_id = :u and d.sent_at is null and d.attempts < :max
				 order by n.posted_on desc, n.id desc
				   for update of d skip locked
				""")
				.param("u", userId)
				.param("max", props.maxAttempts())
				.query((rs, i) -> new Match(rs.getLong("notice_id"), rs.getString("keyword"), rs.getString("title"),
						rs.getString("title_en"), rs.getString("summary_en"),
						rs.getObject("deadline", LocalDate.class)))
				.list();
		if (matches.isEmpty()) {
			return false;   // another instance has them
		}
		String email = jdbc.sql("select email from users where id = :u").param("u", userId).query(String.class).single();
		String unsubscribeToken = unsubscribe.tokenFor(userId);
		List<Long> ids = matches.stream().map(Match::noticeId).toList();
		try {
			mailer.send(compose(email, unsubscribeToken, matches));
			jdbc.sql("update alert_deliveries set sent_at = now() where user_id = :u and notice_id in (:ids)")
					.param("u", userId).param("ids", ids).update();
			metrics.alertEmail(true);
			return true;
		} catch (RuntimeException e) {
			log.warn("Alert email to user {} failed: {}", userId, e.toString());
			metrics.alertEmail(false);
			String error = e.toString();
			jdbc.sql("""
					update alert_deliveries set attempts = attempts + 1, last_error = :error
					 where user_id = :u and notice_id in (:ids)
					""")
					.param("error", error.length() > 1000 ? error.substring(0, 1000) : error)
					.param("u", userId).param("ids", ids).update();
			return false;
		}
	}

	Mailer.Email compose(String to, String unsubscribeToken, List<Match> matches) {
		String subject = matches.size() == 1
				? "New notice: " + display(matches.getFirst())
				: matches.size() + " new notices match your keywords";
		StringBuilder text = new StringBuilder();
		StringBuilder html = new StringBuilder(
				"<p style=\"margin:0 0 8px\">New notices that match the keywords you follow:</p>"
						+ "<ul style=\"padding-left:18px;margin:0\">");
		for (Match m : matches) {
			String url = app.baseUrl() + "/notices/" + m.noticeId();
			text.append("- ").append(display(m)).append('\n');
			if (m.titleEn() != null) {
				text.append("  ").append(m.title()).append('\n');
			}
			text.append("  Matched \"").append(m.keyword()).append('"');
			if (m.deadline() != null) {
				text.append(" · deadline ").append(m.deadline());
			}
			text.append('\n').append("  ").append(url).append("\n\n");

			html.append("<li style=\"margin:0 0 14px\"><a style=\"color:#0e6b63;font-weight:600\" href=\"")
					.append(HtmlUtils.htmlEscape(url)).append("\">")
					.append(HtmlUtils.htmlEscape(display(m))).append("</a>");
			if (m.titleEn() != null) {
				html.append("<br><span style=\"color:#4b5768\">").append(HtmlUtils.htmlEscape(m.title())).append("</span>");
			}
			if (m.summaryEn() != null) {
				html.append("<br>").append(HtmlUtils.htmlEscape(m.summaryEn()));
			}
			html.append("<br><span style=\"color:#6e7887;font-size:13px\">Matched \"").append(HtmlUtils.htmlEscape(m.keyword())).append('"');
			if (m.deadline() != null) {
				html.append(" · deadline ").append(m.deadline());
			}
			html.append("</span></li>");
		}
		String manage = app.baseUrl() + "/alerts";
		String token = URLEncoder.encode(unsubscribeToken, StandardCharsets.UTF_8);
		String unsubscribePage = app.baseUrl() + "/unsubscribe?token=" + token;
		text.append("Change the keywords you follow: ").append(manage).append('\n');
		text.append("Stop these emails: ").append(unsubscribePage).append('\n');
		html.append("</ul>").append(EmailHtml.note("<a style=\"color:#6e7887\" href=\""
				+ HtmlUtils.htmlEscape(manage) + "\">Change the keywords you follow</a> · <a style=\"color:#6e7887\" href=\""
				+ HtmlUtils.htmlEscape(unsubscribePage) + "\">Unsubscribe</a>"));
		// RFC 2369 + RFC 8058: mail apps show their own unsubscribe button and POST to this URL in one click
		Map<String, String> headers = Map.of(
				"List-Unsubscribe", "<" + app.baseUrl() + "/api/alerts/unsubscribe?token=" + token + ">",
				"List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
		return new Mailer.Email(to, subject, text.toString(), EmailHtml.page(html.toString()), headers);
	}

	private static String display(Match m) {
		return m.titleEn() != null ? m.titleEn() : m.title();
	}
}

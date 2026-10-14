package com.campusnotices.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.AppProperties;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class SmtpMailerTest {

	@Test
	void buildsAPlainTextAndHtmlEmailWithItsExtraHeaders() throws Exception {
		List<MimeMessage> sent = new ArrayList<>();
		JavaMailSenderImpl sender = new JavaMailSenderImpl() {
			@Override
			public void send(MimeMessage message) {
				sent.add(message);
			}
		};
		Mailer mailer = new SmtpMailer(sender, new AppProperties("https://notices.example",
				"Campus Notices <no-reply@notices.example>"));

		mailer.send(new Mailer.Email("me@ajou.ac.kr", "2 new notices: 장학금", "plain text", "<p>html</p>",
				Map.of("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")));

		assertThat(sent).hasSize(1);
		MimeMessage m = sent.getFirst();
		assertThat(m.getSubject()).isEqualTo("2 new notices: 장학금");
		assertThat(m.getFrom()[0].toString()).contains("no-reply@notices.example");
		assertThat(m.getAllRecipients()[0].toString()).isEqualTo("me@ajou.ac.kr");
		assertThat(m.getHeader("List-Unsubscribe-Post")).containsExactly("List-Unsubscribe=One-Click");
		assertThat(m.getContent()).isInstanceOf(MimeMultipart.class);
		ByteArrayOutputStream raw = new ByteArrayOutputStream();
		m.writeTo(raw);
		assertThat(raw.toString(StandardCharsets.UTF_8)).contains("text/plain").contains("text/html")
				.contains("plain text").contains("<p>html</p>");
	}
}

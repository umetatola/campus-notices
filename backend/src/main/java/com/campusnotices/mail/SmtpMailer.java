package com.campusnotices.mail;

import com.campusnotices.AppProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
public class SmtpMailer implements Mailer {

	private final JavaMailSender sender;
	private final AppProperties app;

	public SmtpMailer(JavaMailSender sender, AppProperties app) {
		this.sender = sender;
		this.app = app;
	}

	@Override
	public void send(Email email) {
		try {
			MimeMessage message = sender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
			helper.setFrom(app.mailFrom());
			helper.setTo(email.to());
			helper.setSubject(email.subject());
			helper.setText(email.text(), email.html());
			sender.send(message);
		} catch (MessagingException e) {
			throw new MailSendException("Could not build email to " + email.to(), e);
		}
	}
}

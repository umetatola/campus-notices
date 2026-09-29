package com.campusnotices.mail;

/** Sends one email. The SMTP version is used everywhere except tests, which capture messages instead. */
public interface Mailer {

	void send(Email email);

	record Email(String to, String subject, String text, String html) {
	}
}

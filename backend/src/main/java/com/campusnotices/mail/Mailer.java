package com.campusnotices.mail;

import java.util.Map;

/** Sends one email. The SMTP version is used everywhere except tests, which capture messages instead. */
public interface Mailer {

	void send(Email email);

	/** {@code headers} are extra message headers, e.g. List-Unsubscribe on alert emails. */
	record Email(String to, String subject, String text, String html, Map<String, String> headers) {

		public Email(String to, String subject, String text, String html) {
			this(to, subject, text, html, Map.of());
		}
	}
}

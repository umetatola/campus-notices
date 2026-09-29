package com.campusnotices.mail;

import org.springframework.web.util.HtmlUtils;

/** Shared look for outgoing email. Inline styles only: most mail clients drop style sheets. */
public final class EmailHtml {

	private EmailHtml() {
	}

	/** Wraps body HTML in the standard frame. */
	public static String page(String bodyHtml) {
		return """
				<div style="font-family:-apple-system,'Segoe UI','Malgun Gothic',Arial,sans-serif;font-size:15px;\
				line-height:1.6;color:#16202c;max-width:560px;margin:0 auto;padding:24px 16px">
				<p style="margin:0 0 20px;font-weight:600;font-size:16px">Campus Notices</p>
				%s
				</div>""".formatted(bodyHtml);
	}

	public static String button(String url, String label) {
		return "<p style=\"margin:24px 0\"><a href=\"" + HtmlUtils.htmlEscape(url) + "\" style=\"background:#0e6b63;"
				+ "color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;"
				+ "display:inline-block\">" + HtmlUtils.htmlEscape(label) + "</a></p>";
	}

	public static String note(String text) {
		return "<p style=\"color:#6e7887;font-size:13px;margin:16px 0 0\">" + text + "</p>";
	}
}

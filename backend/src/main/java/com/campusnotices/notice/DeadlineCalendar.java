package com.campusnotices.notice;

import com.campusnotices.notice.NoticeDtos.NoticeDetail;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * A notice's deadline as an iCalendar file (RFC 5545): one all-day event on the deadline with a reminder the
 * day before, so students can add it to Google Calendar, Outlook or their phone in one click.
 */
final class DeadlineCalendar {

	private static final DateTimeFormatter DATE = DateTimeFormatter.BASIC_ISO_DATE; // yyyyMMdd
	private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
			.withZone(ZoneOffset.UTC);

	private DeadlineCalendar() {
	}

	/** @return the .ics text, or null when the notice has no known deadline */
	static String of(NoticeDetail notice, Instant now) {
		LocalDate deadline = notice.summary().deadline();
		if (deadline == null) {
			return null;
		}
		String title = notice.summary().titleEn() != null ? notice.summary().titleEn() : notice.title();
		StringBuilder description = new StringBuilder();
		if (notice.summary().deadlineNote() != null) {
			description.append("Deadline: ").append(notice.summary().deadlineNote()).append("\n\n");
		}
		if (notice.summary().summaryEn() != null) {
			description.append(notice.summary().summaryEn()).append("\n\n");
		}
		description.append("Original notice: ").append(notice.sourceUrl());

		StringBuilder ics = new StringBuilder();
		line(ics, "BEGIN:VCALENDAR");
		line(ics, "VERSION:2.0");
		line(ics, "PRODID:-//Campus Notices//Deadlines//EN");
		line(ics, "CALSCALE:GREGORIAN");
		line(ics, "METHOD:PUBLISH");
		line(ics, "BEGIN:VEVENT");
		line(ics, "UID:notice-" + notice.id() + "-deadline@campus-notices");
		line(ics, "DTSTAMP:" + STAMP.format(now));
		line(ics, "DTSTART;VALUE=DATE:" + DATE.format(deadline));
		line(ics, "DTEND;VALUE=DATE:" + DATE.format(deadline.plusDays(1)));
		line(ics, "SUMMARY:" + escape("Due: " + title));
		line(ics, "DESCRIPTION:" + escape(description.toString()));
		line(ics, "URL:" + notice.sourceUrl());
		line(ics, "TRANSP:TRANSPARENT");
		line(ics, "BEGIN:VALARM");
		line(ics, "ACTION:DISPLAY");
		line(ics, "DESCRIPTION:" + escape("Due tomorrow: " + title));
		line(ics, "TRIGGER:-P1D");
		line(ics, "END:VALARM");
		line(ics, "END:VEVENT");
		line(ics, "END:VCALENDAR");
		return ics.toString();
	}

	/** RFC 5545 text escaping: backslash, semicolon, comma and line breaks. */
	static String escape(String text) {
		return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
				.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n");
	}

	/**
	 * Appends one content line, folded so no physical line exceeds 75 octets of UTF-8 (Korean characters take
	 * three), never splitting a character; continuation lines start with a space. Lines end with CRLF.
	 */
	static void line(StringBuilder out, String content) {
		int octets = 0;
		int limit = 75;
		for (int i = 0; i < content.length();) {
			int cp = content.codePointAt(i);
			int size = new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8).length;
			if (octets + size > limit) {
				out.append("\r\n ");
				octets = 1; // the leading space counts
				limit = 75;
			}
			out.appendCodePoint(cp);
			octets += size;
			i += Character.charCount(cp);
		}
		out.append("\r\n");
	}
}

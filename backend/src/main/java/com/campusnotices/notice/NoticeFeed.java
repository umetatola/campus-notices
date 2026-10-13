package com.campusnotices.notice;

import com.campusnotices.notice.NoticeDtos.NoticeItem;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * The notice list as an Atom feed (RFC 4287), for feed readers. Entries link to the web app's notice page; the
 * title is the English title when there is one, and the Korean original is the summary.
 */
final class NoticeFeed {

	private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
	private static final DateTimeFormatter RFC3339 = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

	private NoticeFeed() {
	}

	static String atom(String baseUrl, String selfUrl, String title, List<NoticeItem> items, Instant now) {
		String updated = items.isEmpty() ? RFC3339.format(now.atZone(KOREA)) : date(items.getFirst().postedOn());
		StringBuilder xml = new StringBuilder("""
				<?xml version="1.0" encoding="utf-8"?>
				<feed xmlns="http://www.w3.org/2005/Atom">
				""");
		xml.append("  <title>").append(escape(title)).append("</title>\n")
				.append("  <id>").append(escape(selfUrl)).append("</id>\n")
				.append("  <link rel=\"self\" href=\"").append(escape(selfUrl)).append("\"/>\n")
				.append("  <link rel=\"alternate\" href=\"").append(escape(baseUrl)).append("/\"/>\n")
				.append("  <updated>").append(updated).append("</updated>\n")
				.append("  <author><name>Campus Notices</name></author>\n");
		for (NoticeItem n : items) {
			String page = baseUrl + "/notices/" + n.id();
			String entryTitle = n.titleEn() != null ? n.titleEn() : n.title();
			xml.append("  <entry>\n")
					.append("    <id>").append(escape(page)).append("</id>\n")
					.append("    <title>").append(escape(entryTitle)).append("</title>\n")
					.append("    <link href=\"").append(escape(page)).append("\"/>\n")
					.append("    <updated>").append(date(n.postedOn())).append("</updated>\n");
			if (n.category() != null) {
				xml.append("    <category term=\"").append(escape(n.category())).append("\"/>\n");
			}
			StringBuilder summary = new StringBuilder(n.title());
			if (n.deadline() != null) {
				summary.append(" (deadline ").append(n.deadline()).append(')');
			}
			xml.append("    <summary xml:lang=\"ko\">").append(escape(summary.toString())).append("</summary>\n")
					.append("  </entry>\n");
		}
		return xml.append("</feed>\n").toString();
	}

	private static String date(LocalDate day) {
		return RFC3339.format(day.atStartOfDay(KOREA));
	}

	/** XML text and attribute escaping; also drops control characters XML 1.0 does not allow. */
	static String escape(String text) {
		StringBuilder out = new StringBuilder(text.length());
		text.codePoints().forEach(cp -> {
			switch (cp) {
				case '&' -> out.append("&amp;");
				case '<' -> out.append("&lt;");
				case '>' -> out.append("&gt;");
				case '"' -> out.append("&quot;");
				case '\'' -> out.append("&apos;");
				default -> {
					if (cp >= 0x20 || cp == '\t' || cp == '\n' || cp == '\r') {
						out.appendCodePoint(cp);
					}
				}
			}
		});
		return out.toString();
	}
}

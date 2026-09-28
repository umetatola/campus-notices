package com.campusnotices.notice;

import java.time.LocalDate;
import java.util.List;

/** One notice as read from the university website, before it is stored. */
public record ScrapedNotice(
		String sourceArticleId,
		String category,
		String title,
		String department,
		LocalDate postedOn,
		String url,
		boolean pinned,
		String bodyHtml,
		String bodyText,
		List<Attachment> attachments) {
}

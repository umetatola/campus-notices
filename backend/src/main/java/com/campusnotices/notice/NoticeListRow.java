package com.campusnotices.notice;

import java.time.Instant;
import java.time.LocalDate;

/** One row of the notice list: the notice plus its English title and deadline, when summarized. */
public record NoticeListRow(long id, String title, String category, String department, LocalDate postedOn,
		boolean pinned, String url, String titleEn, LocalDate deadline, Instant editedAt) {
}

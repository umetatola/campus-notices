package com.campusnotices.notice;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** JSON shapes returned by the API. Entities never leave the service layer. */
public final class NoticeDtos {

	private NoticeDtos() {
	}

	public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {
	}

	public record NoticeItem(long id, String title, String category, String department,
			LocalDate postedOn, boolean pinned, String sourceUrl) {

		static NoticeItem from(Notice n) {
			return new NoticeItem(n.getId(), n.getTitle(), n.getCategory(), n.getDepartment(),
					n.getPostedOn(), n.isPinned(), n.getUrl());
		}
	}

	public record NoticeDetail(long id, String title, String category, String department,
			LocalDate postedOn, boolean pinned, String sourceUrl, String bodyHtml, String bodyText,
			List<Attachment> attachments, Instant firstSeenAt, Instant updatedAt) {

		static NoticeDetail from(Notice n) {
			return new NoticeDetail(n.getId(), n.getTitle(), n.getCategory(), n.getDepartment(),
					n.getPostedOn(), n.isPinned(), n.getUrl(), n.getBodyHtml(), n.getBodyText(),
					List.copyOf(n.getAttachments()), n.getFirstSeenAt(), n.getUpdatedAt());
		}
	}
}

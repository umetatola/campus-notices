package com.campusnotices.notice;

import com.campusnotices.summary.NoticeSummary;
import com.campusnotices.summary.SummaryStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** JSON shapes returned by the API. Entities never leave the service layer. */
public final class NoticeDtos {

	private NoticeDtos() {
	}

	public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {
	}

	/** {@code editedAt}: when the notice was changed on the university site after we first saw it, or null. */
	public record NoticeItem(long id, String title, String titleEn, String category, String department,
			LocalDate postedOn, LocalDate deadline, boolean pinned, String sourceUrl, Instant editedAt) {

		static NoticeItem from(NoticeListRow r) {
			return new NoticeItem(r.id(), r.title(), r.titleEn(), r.category(), r.department(), r.postedOn(),
					r.deadline(), r.pinned(), r.url(), r.editedAt());
		}
	}

	/** The English version; {@code status} is PENDING until it has been written. */
	public record Summary(SummaryStatus status, String titleEn, String summaryEn, LocalDate deadline,
			String deadlineNote) {

		static Summary from(NoticeSummary s) {
			if (s == null) {
				return new Summary(SummaryStatus.PENDING, null, null, null, null);
			}
			boolean done = s.getStatus() == SummaryStatus.DONE;
			// while re-summarizing an edited notice, keep showing nothing rather than the old version
			return new Summary(s.getStatus(), done ? s.getTitleEn() : null, done ? s.getSummaryEn() : null,
					done ? s.getDeadline() : null, done ? s.getDeadlineNote() : null);
		}
	}

	public record NoticeDetail(long id, String title, String category, String department,
			LocalDate postedOn, boolean pinned, String sourceUrl, String bodyHtml, String bodyText,
			List<Attachment> attachments, Summary summary, Instant firstSeenAt, Instant updatedAt, Instant editedAt) {

		static NoticeDetail from(Notice n, NoticeSummary s) {
			return new NoticeDetail(n.getId(), n.getTitle(), n.getCategory(), n.getDepartment(),
					n.getPostedOn(), n.isPinned(), n.getUrl(), n.getBodyHtml(), n.getBodyText(),
					List.copyOf(n.getAttachments()), Summary.from(s), n.getFirstSeenAt(), n.getUpdatedAt(),
					n.getEditedAt());
		}
	}
}

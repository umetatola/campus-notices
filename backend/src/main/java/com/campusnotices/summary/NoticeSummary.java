package com.campusnotices.summary;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/** Read-only view of a summary row. Writes go through {@link SummaryQueue}, which owns the queue logic. */
@Entity
@Table(name = "notice_summaries")
public class NoticeSummary {

	@Id
	@Column(name = "notice_id")
	private Long noticeId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private SummaryStatus status;

	@Column(name = "title_en")
	private String titleEn;

	@Column(name = "summary_en")
	private String summaryEn;

	private LocalDate deadline;

	@Column(name = "deadline_note")
	private String deadlineNote;

	private String model;

	@Column(name = "updated_at")
	private Instant updatedAt;

	protected NoticeSummary() {
	}

	public Long getNoticeId() { return noticeId; }
	public SummaryStatus getStatus() { return status; }
	public String getTitleEn() { return titleEn; }
	public String getSummaryEn() { return summaryEn; }
	public LocalDate getDeadline() { return deadline; }
	public String getDeadlineNote() { return deadlineNote; }
	public String getModel() { return model; }
	public Instant getUpdatedAt() { return updatedAt; }
}

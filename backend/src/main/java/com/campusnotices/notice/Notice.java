package com.campusnotices.notice;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "notices")
public class Notice {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private String source;

	@Column(name = "source_article_id", nullable = false)
	private String sourceArticleId;

	private String category;

	@Column(nullable = false)
	private String title;

	private String department;

	@Column(name = "posted_on", nullable = false)
	private LocalDate postedOn;

	@Column(nullable = false)
	private String url;

	@Column(nullable = false)
	private boolean pinned;

	@Column(name = "body_html")
	private String bodyHtml;

	@Column(name = "body_text")
	private String bodyText;

	@Column(name = "content_hash", nullable = false, length = 64)
	private String contentHash;

	@Column(name = "first_seen_at", nullable = false)
	private Instant firstSeenAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Column(name = "checked_at")
	private Instant checkedAt;

	@Column(name = "edited_at")
	private Instant editedAt;

	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "notice_attachments", joinColumns = @JoinColumn(name = "notice_id"))
	@OrderColumn(name = "position")
	private List<Attachment> attachments = new ArrayList<>();

	protected Notice() {
	}

	public Notice(String source, String sourceArticleId) {
		this.source = source;
		this.sourceArticleId = sourceArticleId;
		this.firstSeenAt = Instant.now();
	}

	/** Copies scraped content in; returns true when the content changed. */
	public boolean applyContent(ScrapedNotice scraped, String hash) {
		boolean changed = !hash.equals(contentHash);
		boolean edited = changed && contentHash != null; // stored before, now different
		this.category = scraped.category();
		this.title = scraped.title();
		this.department = scraped.department();
		this.postedOn = scraped.postedOn();
		this.url = scraped.url();
		this.pinned = scraped.pinned();
		this.bodyHtml = scraped.bodyHtml();
		this.bodyText = scraped.bodyText();
		this.contentHash = hash;
		this.attachments.clear();
		this.attachments.addAll(scraped.attachments());
		Instant now = Instant.now();
		if (changed) {
			this.updatedAt = now;
		}
		if (edited) {
			this.editedAt = now;
		}
		this.checkedAt = now;
		return changed;
	}

	public void markChecked() {
		this.checkedAt = Instant.now();
	}

	public Long getId() { return id; }
	public String getSource() { return source; }
	public String getSourceArticleId() { return sourceArticleId; }
	public String getCategory() { return category; }
	public String getTitle() { return title; }
	public String getDepartment() { return department; }
	public LocalDate getPostedOn() { return postedOn; }
	public String getUrl() { return url; }
	public boolean isPinned() { return pinned; }
	public String getBodyHtml() { return bodyHtml; }
	public String getBodyText() { return bodyText; }
	public String getContentHash() { return contentHash; }
	public Instant getFirstSeenAt() { return firstSeenAt; }
	public Instant getUpdatedAt() { return updatedAt; }
	public Instant getCheckedAt() { return checkedAt; }
	public Instant getEditedAt() { return editedAt; }
	public List<Attachment> getAttachments() { return attachments; }
}

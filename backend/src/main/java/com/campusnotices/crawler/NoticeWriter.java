package com.campusnotices.crawler;

import com.campusnotices.notice.Attachment;
import com.campusnotices.notice.Notice;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.notice.ScrapedNotice;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Inserts or updates one notice in its own transaction, so one bad notice can't roll back a whole crawl. */
@Component
public class NoticeWriter {

	private final NoticeRepository notices;

	public NoticeWriter(NoticeRepository notices) {
		this.notices = notices;
	}

	@Transactional
	public Notice save(String source, ScrapedNotice scraped) {
		if (scraped.title() == null || scraped.postedOn() == null) {
			throw new IllegalArgumentException("notice " + scraped.sourceArticleId() + " has no title or date");
		}
		Notice notice = notices.findBySourceAndSourceArticleId(source, scraped.sourceArticleId())
				.orElseGet(() -> new Notice(source, scraped.sourceArticleId()));
		notice.applyContent(scraped, contentHash(scraped));
		return notices.save(notice);
	}

	static String contentHash(ScrapedNotice n) {
		StringBuilder sb = new StringBuilder()
				.append(n.title()).append('\n')
				.append(n.bodyText() == null ? "" : n.bodyText()).append('\n');
		for (Attachment a : n.attachments()) {
			sb.append(a.name()).append('\n');
		}
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256")
					.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}

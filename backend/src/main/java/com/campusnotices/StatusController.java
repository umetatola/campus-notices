package com.campusnotices;

import com.campusnotices.crawler.CrawlStatus;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public site status for the web app: when notices were last updated, and whether updates are delayed. */
@RestController
public class StatusController {

	public record Status(Instant lastUpdatedAt, boolean updatesDelayed) {
	}

	private final CrawlStatus crawl;

	public StatusController(CrawlStatus crawl) {
		this.crawl = crawl;
	}

	@GetMapping("/api/status")
	public Status status() {
		CrawlStatus.Freshness f = crawl.freshness(Instant.now());
		return new Status(f.lastUpdatedAt(), f.delayed());
	}
}

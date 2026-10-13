package com.campusnotices.crawler;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "crawler")
public record CrawlerProperties(
		boolean enabled,
		URI listUrl,
		String source,
		Duration interval,
		int recheckDays,
		Duration recheckEvery,
		int recheckBatch,
		Duration initialDelay,
		Duration requestDelay,
		int maxPages,
		String userAgent) {
}

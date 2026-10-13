package com.campusnotices.crawler;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Records crawler runs and answers "how fresh are the notices?". Updates count as delayed after three missed
 * runs; that is logged once per check, but deliberately not reported as an unhealthy app (the university site
 * being down must not make the container restart).
 */
@Component
public class CrawlStatus {

	private static final Logger log = LoggerFactory.getLogger(CrawlStatus.class);

	public record Freshness(Instant lastUpdatedAt, boolean delayed) {
	}

	private final JdbcClient jdbc;
	private final CrawlerProperties props;

	public CrawlStatus(JdbcClient jdbc, CrawlerProperties props) {
		this.jdbc = jdbc;
		this.props = props;
	}

	void recordSuccess() {
		jdbc.sql("""
				insert into crawl_status (source, last_success_at, last_attempt_at) values (:s, now(), now())
				on conflict (source) do update set last_success_at = now(), last_attempt_at = now(), last_error = null
				""").param("s", props.source()).update();
	}

	void recordFailure(Exception e) {
		String error = e.toString();
		jdbc.sql("""
				insert into crawl_status (source, last_attempt_at, last_error) values (:s, now(), :e)
				on conflict (source) do update set last_attempt_at = now(), last_error = :e
				""").param("s", props.source()).param("e", error.length() > 1000 ? error.substring(0, 1000) : error).update();
	}

	public Freshness freshness(Instant now) {
		Optional<Instant> last = jdbc.sql("select last_success_at from crawl_status where source = :s")
				.param("s", props.source())
				.query((rs, i) -> rs.getObject("last_success_at", OffsetDateTime.class))
				.optional()
				.map(t -> t == null ? null : t.toInstant());
		Instant lastUpdated = last.orElse(null);
		boolean delayed = props.enabled()
				&& (lastUpdated == null || Duration.between(lastUpdated, now).compareTo(props.interval().multipliedBy(3)) > 0);
		return new Freshness(lastUpdated, delayed);
	}

	@Scheduled(fixedDelayString = "PT15M", initialDelayString = "PT30M")
	void warnWhenDelayed() {
		Freshness f = freshness(Instant.now());
		if (f.delayed()) {
			log.warn("Notices are not being updated: last successful crawl {}", f.lastUpdatedAt() == null ? "never" : f.lastUpdatedAt());
		}
	}
}

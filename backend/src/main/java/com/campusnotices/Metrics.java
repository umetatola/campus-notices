package com.campusnotices;

import com.campusnotices.summary.SummaryQueue;
import com.campusnotices.summary.SummaryStatus;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * The app's own counters, scraped at /actuator/prometheus (reachable only inside the server; Caddy hides it).
 * Names show up in Prometheus as e.g. {@code campus_notices_crawl_runs_total{outcome="ok"}}.
 */
@Component
public class Metrics {

	private final Counter crawlOk;
	private final Counter crawlFailed;
	private final Counter noticesSaved;
	private final Counter noticesEdited;
	private final Counter summariesDone;
	private final Counter summariesRetrying;
	private final Counter summariesFailed;
	private final Counter alertEmailsSent;
	private final Counter alertEmailsFailed;

	public Metrics(MeterRegistry registry, SummaryQueue queue) {
		crawlOk = counter(registry, "campus_notices.crawl.runs", "Crawler runs", "outcome", "ok");
		crawlFailed = counter(registry, "campus_notices.crawl.runs", "Crawler runs", "outcome", "failed");
		noticesSaved = counter(registry, "campus_notices.notices.saved", "New notices stored", null, null);
		noticesEdited = counter(registry, "campus_notices.notices.edited", "Notices found edited on recheck", null, null);
		summariesDone = counter(registry, "campus_notices.summaries", "Summary attempts", "outcome", "done");
		summariesRetrying = counter(registry, "campus_notices.summaries", "Summary attempts", "outcome", "retrying");
		summariesFailed = counter(registry, "campus_notices.summaries", "Summary attempts", "outcome", "failed");
		alertEmailsSent = counter(registry, "campus_notices.alert.emails", "Alert digest emails", "outcome", "sent");
		alertEmailsFailed = counter(registry, "campus_notices.alert.emails", "Alert digest emails", "outcome", "failed");
		// read from the database on each scrape, so it is right even after a restart
		Gauge.builder("campus_notices.summaries.pending", queue, q -> q.countByStatus(SummaryStatus.PENDING))
				.description("Notices waiting for an English summary")
				.register(registry);
	}

	private static Counter counter(MeterRegistry registry, String name, String description, String tag, String value) {
		Counter.Builder b = Counter.builder(name).description(description);
		if (tag != null) {
			b.tag(tag, value);
		}
		return b.register(registry);
	}

	public void crawlFinished(int saved) {
		crawlOk.increment();
		noticesSaved.increment(saved);
	}

	public void crawlFailed() {
		crawlFailed.increment();
	}

	public void noticesEdited(int n) {
		noticesEdited.increment(n);
	}

	public void summaries(int done, int retrying, int failed) {
		summariesDone.increment(done);
		summariesRetrying.increment(retrying);
		summariesFailed.increment(failed);
	}

	public void alertEmail(boolean sent) {
		(sent ? alertEmailsSent : alertEmailsFailed).increment();
	}
}

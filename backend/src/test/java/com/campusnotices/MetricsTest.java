package com.campusnotices;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.campusnotices.summary.SummaryQueue;
import com.campusnotices.summary.SummaryStatus;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class MetricsTest {

	private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
	private final SummaryQueue queue = mock(SummaryQueue.class);

	private double count(String name, String outcome) {
		var search = registry.find(name);
		return (outcome == null ? search : search.tag("outcome", outcome)).counter().count();
	}

	@Test
	void countsCrawlsSummariesAndEmailsByOutcome() {
		Metrics metrics = new Metrics(registry, queue);

		metrics.crawlFinished(3);
		metrics.crawlFinished(0);
		metrics.crawlFailed();
		metrics.noticesEdited(2);
		metrics.summaries(4, 1, 0);
		metrics.alertEmail(true);
		metrics.alertEmail(false);
		metrics.alertEmail(true);

		assertThat(count("campus_notices.crawl.runs", "ok")).isEqualTo(2);
		assertThat(count("campus_notices.crawl.runs", "failed")).isEqualTo(1);
		assertThat(count("campus_notices.notices.saved", null)).isEqualTo(3);
		assertThat(count("campus_notices.notices.edited", null)).isEqualTo(2);
		assertThat(count("campus_notices.summaries", "done")).isEqualTo(4);
		assertThat(count("campus_notices.summaries", "retrying")).isEqualTo(1);
		assertThat(count("campus_notices.summaries", "failed")).isZero();
		assertThat(count("campus_notices.alert.emails", "sent")).isEqualTo(2);
		assertThat(count("campus_notices.alert.emails", "failed")).isEqualTo(1);
	}

	@Test
	void pendingSummariesAreReadFromTheQueue() {
		when(queue.countByStatus(SummaryStatus.PENDING)).thenReturn(7);
		new Metrics(registry, queue);

		assertThat(registry.get("campus_notices.summaries.pending").gauge().value()).isEqualTo(7);
	}
}

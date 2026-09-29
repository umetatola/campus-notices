package com.campusnotices.summary;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.crawler.NoticeWriter;
import com.campusnotices.notice.Notice;
import com.campusnotices.notice.ScrapedNotice;
import com.campusnotices.summary.SummaryQueue.Job;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** The queue's edge cases against a real PostgreSQL: retries, giving up, and edits during summarizing. */
@SpringBootTest(properties = {"crawler.enabled=false", "summarizer.provider=none", "summarizer.initial-delay=PT1H"})
@Testcontainers(disabledWithoutDocker = true)
class SummaryQueueIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

	private static final AtomicInteger ids = new AtomicInteger(900_000);

	@Autowired
	NoticeWriter writer;

	@Autowired
	SummaryQueue queue;

	@Autowired
	JdbcClient jdbc;

	private Notice newNotice(String body) {
		return writer.save("test", scraped(String.valueOf(ids.incrementAndGet()), body));
	}

	private static ScrapedNotice scraped(String articleId, String body) {
		return new ScrapedNotice(articleId, "학사", "Notice " + articleId, "교무팀", LocalDate.of(2026, 9, 28),
				"https://example.org/" + articleId, false, "<p>" + body + "</p>", body, List.of());
	}

	private Job claimOnly(long noticeId) {
		List<Job> jobs = queue.claim(100);
		assertThat(jobs).extracting(Job::noticeId).contains(noticeId);
		// put back anything else this test did not ask for, so tests stay independent
		jobs.stream().filter(j -> j.noticeId() != noticeId).forEach(j -> queue.fail(j, "not this test", true));
		return jobs.stream().filter(j -> j.noticeId() == noticeId).findFirst().orElseThrow();
	}

	private String status(long noticeId) {
		return jdbc.sql("select status from notice_summaries where notice_id = :id").param("id", noticeId)
				.query(String.class).single();
	}

	@Test
	void savingTheSameContentTwiceQueuesOnce() {
		Notice n = newNotice("same body");
		writer.save("test", scraped(n.getSourceArticleId(), "same body"));

		Job job = claimOnly(n.getId());
		assertThat(job.attempts()).isEqualTo(1);
		assertThat(queue.claim(100)).extracting(Job::noticeId).doesNotContain(n.getId());
	}

	@Test
	void retryableFailureWaitsThenGivesUpWhenNotRetryable() {
		Notice n = newNotice("body");
		Job first = claimOnly(n.getId());

		queue.fail(first, "rate limited", true);
		assertThat(status(n.getId())).isEqualTo("PENDING");
		// backoff: not claimable again right away
		assertThat(queue.claim(100)).extracting(Job::noticeId).doesNotContain(n.getId());

		jdbc.sql("update notice_summaries set next_attempt_at = now() where notice_id = :id").param("id", n.getId()).update();
		Job second = claimOnly(n.getId());
		assertThat(second.attempts()).isEqualTo(2);

		queue.fail(second, "model declined", false);
		assertThat(status(n.getId())).isEqualTo("FAILED");
	}

	@Test
	void editDuringSummarizingDropsTheStaleResultAndRequeues() {
		Notice n = newNotice("original text");
		Job job = claimOnly(n.getId());

		// the notice is edited on the university site while the model is still working on the old version
		writer.save("test", scraped(n.getSourceArticleId(), "edited text"));

		boolean stored = queue.complete(job, new Summarizer.Result("Old", "Summary of the old text", null, null, "test"));
		assertThat(stored).isFalse();
		assertThat(status(n.getId())).isEqualTo("PENDING");
		assertThat(claimOnly(n.getId()).contentHash()).isNotEqualTo(job.contentHash());
	}

	@Test
	void expiredLockIsClaimedAgain() {
		Notice n = newNotice("body");
		claimOnly(n.getId());
		// the worker holding it crashed: nothing picks it up until the lock expires
		assertThat(queue.claim(100)).extracting(Job::noticeId).doesNotContain(n.getId());

		jdbc.sql("update notice_summaries set locked_until = now() - interval '1 second' where notice_id = :id")
				.param("id", n.getId()).update();
		assertThat(claimOnly(n.getId()).attempts()).isEqualTo(2);
	}

	@Test
	void stubSummariesCanBeRequeued() {
		Notice n = newNotice("body");
		Job job = claimOnly(n.getId());
		assertThat(queue.complete(job, new Summarizer.Result("[Stub] x", "fake", null, null, "stub"))).isTrue();
		assertThat(status(n.getId())).isEqualTo("DONE");

		assertThat(queue.requeueModel("stub")).isGreaterThanOrEqualTo(1);
		assertThat(status(n.getId())).isEqualTo("PENDING");
	}

	@Test
	void backoffDoublesAndIsCapped() {
		assertThat(SummaryQueue.backoff(1)).isEqualTo(Duration.ofMinutes(1));
		assertThat(SummaryQueue.backoff(2)).isEqualTo(Duration.ofMinutes(2));
		assertThat(SummaryQueue.backoff(4)).isEqualTo(Duration.ofMinutes(8));
		assertThat(SummaryQueue.backoff(20)).isEqualTo(Duration.ofMinutes(60));
	}
}

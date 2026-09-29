package com.campusnotices.summary;

import java.sql.Types;
import java.time.Duration;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * A work queue kept in the notice_summaries table.
 *
 * <p>Claiming uses {@code FOR UPDATE SKIP LOCKED}, so several workers (or app instances) never take the same
 * notice, and a claim holds no transaction open while the model runs: the row is marked RUNNING with a lock
 * expiry instead, and an expired lock makes it claimable again.
 */
@Component
public class SummaryQueue {

	static final Duration LOCK = Duration.ofMinutes(5);

	public record Job(long noticeId, String contentHash, int attempts) {
	}

	private final JdbcClient jdbc;

	public SummaryQueue(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Queues a notice unless this exact version is already queued or summarized. An edited notice drops its old
	 * English text, so the list and the notice page never show a summary of a previous version.
	 */
	public void enqueue(long noticeId, String contentHash) {
		jdbc.sql("""
				insert into notice_summaries (notice_id, content_hash, status)
				values (:id, :hash, 'PENDING')
				on conflict (notice_id) do update
				   set content_hash = excluded.content_hash, status = 'PENDING', attempts = 0,
				       title_en = null, summary_en = null, deadline = null, deadline_note = null, model = null,
				       last_error = null, locked_until = null, next_attempt_at = now(), updated_at = now()
				 where notice_summaries.content_hash <> excluded.content_hash
				""")
				.param("id", noticeId)
				.param("hash", contentHash)
				.update();
	}

	@Transactional
	public List<Job> claim(int limit) {
		return jdbc.sql("""
				update notice_summaries
				   set status = 'RUNNING', attempts = attempts + 1,
				       locked_until = now() + make_interval(secs => :lockSeconds), updated_at = now()
				 where notice_id in (
				       select notice_id from notice_summaries
				        where (status = 'PENDING' and next_attempt_at <= now())
				           or (status = 'RUNNING' and locked_until < now())
				        order by next_attempt_at
				        limit :limit
				        for update skip locked)
				returning notice_id, content_hash, attempts
				""")
				.param("lockSeconds", LOCK.toSeconds())
				.param("limit", limit)
				.query((rs, i) -> new Job(rs.getLong("notice_id"), rs.getString("content_hash"), rs.getInt("attempts")))
				.list();
	}

	/**
	 * Stores a finished summary. Returns false if the notice was edited while it was being summarized; the row
	 * is then already queued again for the new version and this result is dropped.
	 */
	public boolean complete(Job job, Summarizer.Result result) {
		return jdbc.sql("""
				update notice_summaries
				   set status = 'DONE', title_en = :titleEn, summary_en = :summaryEn, deadline = :deadline,
				       deadline_note = :deadlineNote, model = :model, last_error = null, locked_until = null,
				       updated_at = now()
				 where notice_id = :id and content_hash = :hash and status = 'RUNNING'
				""")
				.param("titleEn", result.titleEn())
				.param("summaryEn", result.summaryEn())
				.param("deadline", result.deadline(), Types.DATE)
				.param("deadlineNote", result.deadlineNote())
				.param("model", result.model())
				.param("id", job.noticeId())
				.param("hash", job.contentHash())
				.update() == 1;
	}

	/** Retries later with exponential backoff (1, 2, 4 … minutes, at most an hour), or gives up. */
	public void fail(Job job, String error, boolean retry) {
		jdbc.sql("""
				update notice_summaries
				   set status = case when :retry then 'PENDING' else 'FAILED' end,
				       next_attempt_at = now() + make_interval(secs => :backoffSeconds),
				       last_error = :error, locked_until = null, updated_at = now()
				 where notice_id = :id and content_hash = :hash and status = 'RUNNING'
				""")
				.param("retry", retry)
				.param("backoffSeconds", backoff(job.attempts()).toSeconds())
				.param("error", error.length() > 1000 ? error.substring(0, 1000) : error)
				.param("id", job.noticeId())
				.param("hash", job.contentHash())
				.update();
	}

	static Duration backoff(int attempts) {
		long minutes = 1L << Math.min(Math.max(attempts - 1, 0), 6);
		return Duration.ofMinutes(Math.min(minutes, 60));
	}

	/** Queues again every summary written by the given model, e.g. the stub's fake ones. Returns how many. */
	public int requeueModel(String model) {
		return jdbc.sql("""
				update notice_summaries
				   set status = 'PENDING', attempts = 0, title_en = null, summary_en = null, deadline = null,
				       deadline_note = null, model = null, last_error = null, locked_until = null,
				       next_attempt_at = now(), updated_at = now()
				 where model = :model
				""")
				.param("model", model)
				.update();
	}

	/** For tests and the admin view later: how many notices are in each state. */
	public int countByStatus(SummaryStatus status) {
		return jdbc.sql("select count(*) from notice_summaries where status = :s")
				.param("s", status.name())
				.query(Integer.class)
				.single();
	}
}

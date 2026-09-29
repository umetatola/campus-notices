package com.campusnotices.summary;

import com.campusnotices.notice.Attachment;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.summary.Summarizer.Input;
import com.campusnotices.summary.Summarizer.SummarizerException;
import com.campusnotices.summary.SummaryQueue.Job;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Takes queued notices and summarizes them, one small batch per run. */
@Component
public class SummaryWorker {

	private static final Logger log = LoggerFactory.getLogger(SummaryWorker.class);

	public record Result(int claimed, int done, int retrying, int failed) {
	}

	private final Summarizer summarizer;
	private final SummaryQueue queue;
	private final NoticeRepository notices;
	private final SummarizerProperties props;
	private final TransactionTemplate readOnly;

	public SummaryWorker(Summarizer summarizer, SummaryQueue queue, NoticeRepository notices,
			SummarizerProperties props, TransactionTemplate transactions) {
		this.summarizer = summarizer;
		this.queue = queue;
		this.notices = notices;
		this.props = props;
		this.readOnly = new TransactionTemplate(transactions.getTransactionManager());
		this.readOnly.setReadOnly(true);
	}

	/** Fake summaries from development must never stay once a real summarizer is running. */
	@EventListener(ApplicationReadyEvent.class)
	public void replaceStubSummaries() {
		if (summarizer.enabled() && !(summarizer instanceof StubSummarizer)) {
			int n = queue.requeueModel("stub");
			if (n > 0) {
				log.info("Re-queued {} stub summaries for real summarizing", n);
			}
		}
	}

	@Scheduled(fixedDelayString = "${summarizer.interval}", initialDelayString = "${summarizer.initial-delay:PT15S}")
	public void scheduledRun() {
		if (!summarizer.enabled()) {
			return;
		}
		try {
			Result r = runOnce();
			if (r.claimed() > 0) {
				log.info("Summaries: {} done, {} retrying later, {} failed", r.done(), r.retrying(), r.failed());
			}
		} catch (Exception e) {
			log.warn("Summary run failed: {}", e.toString());
		}
	}

	public Result runOnce() {
		List<Job> jobs = queue.claim(props.batchSize());
		int done = 0;
		int retrying = 0;
		int failed = 0;
		for (Job job : jobs) {
			Optional<Input> input = load(job.noticeId());
			if (input.isEmpty()) {
				continue;   // notice deleted; its summary row went with it
			}
			try {
				if (queue.complete(job, summarizer.summarize(input.get()))) {
					done++;
				}
			} catch (SummarizerException | RuntimeException e) {
				boolean retryable = !(e instanceof SummarizerException se) || se.retryable();
				boolean retry = retryable && job.attempts() < props.maxAttempts();
				queue.fail(job, e.getMessage() == null ? e.toString() : e.getMessage(), retry);
				if (retry) {
					retrying++;
				} else {
					failed++;
					log.warn("Giving up on summary for notice {}: {}", job.noticeId(), e.getMessage());
				}
			}
		}
		return new Result(jobs.size(), done, retrying, failed);
	}

	private Optional<Input> load(long noticeId) {
		return readOnly.execute(tx -> notices.findById(noticeId).map(n -> new Input(
				n.getTitle(), n.getCategory(), n.getDepartment(), n.getPostedOn(), n.getBodyText(),
				n.getAttachments().stream().map(Attachment::name).toList())));
	}
}

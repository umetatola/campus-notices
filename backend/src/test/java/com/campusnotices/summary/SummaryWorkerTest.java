package com.campusnotices.summary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.campusnotices.Metrics;
import com.campusnotices.notice.Notice;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.summary.Summarizer.Input;
import com.campusnotices.summary.Summarizer.SummarizerException;
import com.campusnotices.summary.SummaryQueue.Job;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

/** One worker run: success, retry, give-up, deleted notices, and the stub clean-up on start. */
class SummaryWorkerTest {

	private static final Summarizer.Result RESULT = new Summarizer.Result("Title", "Summary", null, null, "m");

	private final Summarizer summarizer = mock(Summarizer.class);
	private final SummaryQueue queue = mock(SummaryQueue.class);
	private final NoticeRepository notices = mock(NoticeRepository.class);
	private final Metrics metrics = mock(Metrics.class);
	private final SummaryWorker worker;

	SummaryWorkerTest() {
		PlatformTransactionManager tm = mock(PlatformTransactionManager.class);
		when(tm.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
		SummarizerProperties props = new SummarizerProperties("stub", null, "m", false, java.time.Duration.ofMinutes(1), 5, 3);
		worker = new SummaryWorker(summarizer, queue, notices, props, new TransactionTemplate(tm), metrics);
		when(summarizer.enabled()).thenReturn(true);
	}

	private void noticeExists(long id) {
		Notice n = mock(Notice.class);
		when(n.getTitle()).thenReturn("제목");
		when(n.getAttachments()).thenReturn(List.of());
		when(notices.findById(id)).thenReturn(Optional.of(n));
	}

	@Test
	void summarizesClaimedNotices() throws Exception {
		Job job = new Job(1, "h", 1);
		when(queue.claim(5)).thenReturn(List.of(job));
		noticeExists(1);
		when(summarizer.summarize(any())).thenReturn(RESULT);
		when(queue.complete(job, RESULT)).thenReturn(true);

		assertThat(worker.runOnce()).isEqualTo(new SummaryWorker.Result(1, 1, 0, 0));
		verify(metrics).summaries(1, 0, 0);
	}

	@Test
	void skipsNoticesThatWereDeleted() throws Exception {
		when(queue.claim(5)).thenReturn(List.of(new Job(2, "h", 1)));
		when(notices.findById(2L)).thenReturn(Optional.empty());

		assertThat(worker.runOnce()).isEqualTo(new SummaryWorker.Result(1, 0, 0, 0));
		verify(summarizer, never()).summarize(any());
	}

	@Test
	void retryableErrorIsRetriedUntilAttemptsRunOut() throws Exception {
		Job early = new Job(3, "h", 2);
		Job last = new Job(4, "h", 3);
		when(queue.claim(5)).thenReturn(List.of(early, last));
		noticeExists(3);
		noticeExists(4);
		when(summarizer.summarize(any())).thenThrow(new SummarizerException("rate limited", true, null));

		assertThat(worker.runOnce()).isEqualTo(new SummaryWorker.Result(2, 0, 1, 1));
		verify(queue).fail(early, "rate limited", true);
		verify(queue).fail(last, "rate limited", false);
	}

	@Test
	void nonRetryableErrorFailsAtOnce() throws Exception {
		Job job = new Job(5, "h", 1);
		when(queue.claim(5)).thenReturn(List.of(job));
		noticeExists(5);
		when(summarizer.summarize(any())).thenThrow(new SummarizerException("refused", false, null));

		assertThat(worker.runOnce()).isEqualTo(new SummaryWorker.Result(1, 0, 0, 1));
		verify(queue).fail(job, "refused", false);
	}

	@Test
	void unexpectedErrorsAreRetriedAndKeepTheirName() throws Exception {
		Job job = new Job(6, "h", 1);
		when(queue.claim(5)).thenReturn(List.of(job));
		noticeExists(6);
		when(summarizer.summarize(any())).thenThrow(new IllegalStateException());

		assertThat(worker.runOnce().retrying()).isEqualTo(1);
		verify(queue).fail(eq(job), eq("java.lang.IllegalStateException"), eq(true));
	}

	@Test
	void doesNothingWhenSummarizerIsOff() {
		when(summarizer.enabled()).thenReturn(false);
		worker.scheduledRun();
		verify(queue, never()).claim(5);
	}

	@Test
	void scheduledRunSurvivesAFailingQueue() {
		when(queue.claim(5)).thenThrow(new IllegalStateException("db down"));
		worker.scheduledRun();
		verify(metrics, never()).summaries(0, 0, 0);
	}

	@Test
	void realSummarizerReplacesStubSummariesOnStart() {
		when(queue.requeueModel("stub")).thenReturn(2);
		worker.replaceStubSummaries();
		verify(queue).requeueModel("stub");
	}

	@Test
	void stubSummarizerKeepsItsOwnSummaries() {
		SummarizerProperties props = new SummarizerProperties("stub", null, "m", false, java.time.Duration.ofMinutes(1), 5, 3);
		PlatformTransactionManager tm = mock(PlatformTransactionManager.class);
		SummaryWorker stubWorker = new SummaryWorker(new StubSummarizer(), queue, notices, props, new TransactionTemplate(tm), metrics);
		stubWorker.replaceStubSummaries();
		verify(queue, never()).requeueModel(anyString());
	}
}

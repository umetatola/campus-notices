package com.campusnotices.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.campusnotices.notice.NoticeDtos.Summary;
import com.campusnotices.summary.NoticeSummary;
import com.campusnotices.summary.SummaryStatus;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class NoticeSummaryDtoTest {

	private static NoticeSummary summary(SummaryStatus status) {
		NoticeSummary s = mock(NoticeSummary.class);
		when(s.getStatus()).thenReturn(status);
		when(s.getTitleEn()).thenReturn("Title");
		when(s.getSummaryEn()).thenReturn("Body");
		when(s.getDeadline()).thenReturn(LocalDate.of(2026, 10, 1));
		when(s.getDeadlineNote()).thenReturn("by noon");
		return s;
	}

	@Test
	void noSummaryYetIsPending() {
		assertThat(Summary.from(null)).isEqualTo(new Summary(SummaryStatus.PENDING, null, null, null, null));
	}

	@Test
	void aFinishedSummaryIsShownInFull() {
		assertThat(Summary.from(summary(SummaryStatus.DONE)))
				.isEqualTo(new Summary(SummaryStatus.DONE, "Title", "Body", LocalDate.of(2026, 10, 1), "by noon"));
	}

	@Test
	void anUnfinishedSummaryHidesTheTextEvenIfOldTextIsStillStored() {
		// an edited notice is re-summarized: showing nothing beats showing the outdated version
		for (SummaryStatus status : new SummaryStatus[] { SummaryStatus.PENDING, SummaryStatus.RUNNING, SummaryStatus.FAILED }) {
			assertThat(Summary.from(summary(status))).isEqualTo(new Summary(status, null, null, null, null));
		}
	}
}

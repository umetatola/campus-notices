package com.campusnotices.summary;

import java.time.LocalDate;
import java.util.List;

/** Turns one Korean notice into an English title, summary and deadline. */
public interface Summarizer {

	/** False when no summarizer is configured; queued notices then wait until one is. */
	default boolean enabled() {
		return true;
	}

	Result summarize(Input notice) throws SummarizerException;

	record Input(String title, String category, String department, LocalDate postedOn, String bodyText,
			List<String> attachmentNames) {
	}

	/** {@code deadline} and {@code deadlineNote} are null when the notice has no clear deadline. */
	record Result(String titleEn, String summaryEn, LocalDate deadline, String deadlineNote, String model) {
	}

	class SummarizerException extends Exception {

		private final boolean retryable;

		public SummarizerException(String message, boolean retryable, Throwable cause) {
			super(message, cause);
			this.retryable = retryable;
		}

		/** Rate limits, timeouts and server errors are worth retrying; a refusal or a bad request is not. */
		public boolean retryable() {
			return retryable;
		}
	}
}

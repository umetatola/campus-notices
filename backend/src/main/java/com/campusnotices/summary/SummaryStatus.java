package com.campusnotices.summary;

public enum SummaryStatus {
	/** Waiting for a summarizer (also the state while no summarizer is configured). */
	PENDING,
	/** Claimed by a worker. */
	RUNNING,
	DONE,
	/** Gave up after the maximum number of attempts, or the model declined. */
	FAILED
}

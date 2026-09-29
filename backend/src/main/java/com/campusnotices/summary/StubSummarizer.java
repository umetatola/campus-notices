package com.campusnotices.summary;

/** Clearly fake summaries, for working on the UI without an API key. Never use in production. */
public class StubSummarizer implements Summarizer {

	@Override
	public Result summarize(Input notice) {
		String kind = notice.bodyText() == null ? "an image or attachment notice" : "a text notice";
		return new Result(
				"[Stub] " + notice.title(),
				"Stub summary: this is " + kind + " from " + (notice.department() == null ? "the university" : notice.department())
						+ ", posted " + notice.postedOn() + ". A real English summary appears here once an Anthropic API key is set.",
				null, null, "stub");
	}
}

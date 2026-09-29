package com.campusnotices.summary;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.StructuredMessage;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/** Summarizes notices with Claude, using structured output so the reply is always the {@link Output} shape. */
public class AnthropicSummarizer implements Summarizer {

	static final String SYSTEM_PROMPT = """
			You write English versions of Ajou University (Korea) notices for international students who don't \
			read Korean. For each notice you get its Korean title, category, office, posted date, body text and \
			attachment file names.

			titleEn: a natural English title. Translate bracketed office names too, e.g. [총무팀] becomes \
			[General Affairs Team].

			summaryEn: two to four short sentences covering what the notice is, who it is for, the key dates, and \
			what students need to do. Use only facts stated in the notice. When the body is empty because the \
			notice is published as images or attachments, say that the details are in the images or attached \
			files, and summarize only what the title and file names show.

			deadline: the date by which students must act (apply, submit, register, sign up), as YYYY-MM-DD. Take \
			a missing year from the posted date. Empty string when the notice has no such date.

			deadlineNote: a few words on what the deadline is for, with the time if one is given, e.g. \
			"Applications close at 18:00". Empty string when there is no deadline.""";

	/** What the model returns. Empty strings mean "none", so every field is always present. */
	record Output(
			@JsonPropertyDescription("Natural English title of the notice") String titleEn,
			@JsonPropertyDescription("Two to four sentence English summary") String summaryEn,
			@JsonPropertyDescription("Action deadline as YYYY-MM-DD, or an empty string") String deadline,
			@JsonPropertyDescription("What the deadline is for, or an empty string") String deadlineNote) {
	}

	private final AnthropicClient client;
	private final String model;
	private final boolean fallbacks;

	public AnthropicSummarizer(AnthropicClient client, String model, boolean fallbacks) {
		this.client = client;
		this.model = model;
		this.fallbacks = fallbacks;
	}

	@Override
	public Result summarize(Input notice) throws SummarizerException {
		MessageCreateParams.Builder builder = MessageCreateParams.builder()
				.model(model)
				.maxTokens(16000L)
				.system(SYSTEM_PROMPT)
				.addUserMessage(render(notice));
		if (fallbacks) {
			// If the model declines, let the API retry on a fallback model chosen by refusal category.
			builder.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
					.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));
		}
		StructuredMessageCreateParams<Output> params = builder.outputConfig(Output.class).build();

		StructuredMessage<Output> response;
		try {
			response = client.messages().create(params);
		} catch (AnthropicServiceException e) {
			int status = e.statusCode();
			throw new SummarizerException("Claude API returned " + status + ": " + e.getMessage(),
					status == 408 || status == 409 || status == 429 || status >= 500, e);
		} catch (AnthropicIoException e) {
			throw new SummarizerException("Could not reach the Claude API: " + e.getMessage(), true, e);
		}

		StopReason stop = response.stopReason().orElse(null);
		if (StopReason.REFUSAL.equals(stop)) {
			throw new SummarizerException("The model declined to summarize this notice", false, null);
		}
		if (StopReason.MAX_TOKENS.equals(stop)) {
			throw new SummarizerException("The summary was cut off at the token limit", false, null);
		}
		Output out = response.content().stream()
				.flatMap(block -> block.text().stream())
				.map(text -> text.text())
				.findFirst()
				.orElseThrow(() -> new SummarizerException("The response had no summary", true, null));
		return new Result(out.titleEn().strip(), out.summaryEn().strip(), parseDate(out.deadline()),
				blankToNull(out.deadlineNote()), response.model().asString());
	}

	static String render(Input n) {
		StringBuilder sb = new StringBuilder()
				.append("Title: ").append(n.title()).append('\n')
				.append("Category: ").append(n.category() == null ? "-" : n.category()).append('\n')
				.append("Office: ").append(n.department() == null ? "-" : n.department()).append('\n')
				.append("Posted: ").append(n.postedOn()).append('\n')
				.append("Attachments: ").append(n.attachmentNames().isEmpty() ? "none" : String.join(", ", n.attachmentNames()))
				.append("\n\nBody:\n")
				.append(n.bodyText() == null ? "(no text: the notice is images and/or attachments only)" : n.bodyText());
		return sb.toString();
	}

	static LocalDate parseDate(String s) {
		if (s == null || s.isBlank()) {
			return null;
		}
		try {
			return LocalDate.parse(s.strip());
		} catch (DateTimeParseException e) {
			return null;   // a malformed date is dropped rather than failing the whole summary
		}
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.strip();
	}
}

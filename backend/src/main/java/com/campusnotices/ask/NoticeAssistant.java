package com.campusnotices.ask;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.MessageParam;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.Tool;
import com.anthropic.models.messages.ToolChoiceNone;
import com.anthropic.models.messages.ToolResultBlockParam;
import com.anthropic.models.messages.ToolUseBlock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AI mode. The user writes any question or request about campus notices; Claude searches and reads the notices with
 * two tools ({@link NoticeTools}), then answers with links to the notices it used. Each step is reported as it
 * happens, so the page can show "Searching for 장학…" while it works.
 */
public class NoticeAssistant {

	static final String SYSTEM_PROMPT = """
			You are the AI mode of Campus Notices, a site that collects the official notice board of Ajou University \
			in Korea. Most people using it are international students who don't read Korean well. They ask about \
			scholarships, deadlines, dorms, visas, courses, events, jobs and anything else the university announces.

			Answer from the notices only. Use search_notices to find them (Korean words often work best: 장학 \
			scholarship, 기숙사 dorm, 비자 visa, 수강 courses, 졸업 graduation, 등록 registration, 채용/취업 jobs) and \
			read_notice for the details of the ones that matter. Try a few searches when the first finds little. If \
			the notices don't answer the question, say so plainly and suggest who to ask; don't fill gaps from \
			general knowledge about universities.

			Write the answer in the language of the question (Korean or English). Keep it short and practical: what \
			it is, who it is for, the dates, and what to do. Link every notice you rely on as a Markdown link to its \
			page, like [Winter internship applications](/notices/123). Use short paragraphs and "- " bullet lists; \
			no headings or tables. Dates are in Korea time.""";

	static final Pattern NOTICE_LINK = Pattern.compile("\\(/notices/(\\d+)\\)");

	/** What the page hears while a question is being answered. */
	public sealed interface Event {
		/** A search or a notice being read. */
		record Step(String kind, String detail) implements Event {
		}

		record Answer(String text, List<NoticeTools.Hit> sources, String model) implements Event {
		}

		record Failed(String message) implements Event {
		}
	}

	/** An earlier question and its answer, for follow-ups ("and the deadline?"). */
	public record Turn(String question, String answer) {
	}

	private final AnthropicClient client;
	private final NoticeTools tools;
	private final AssistantProperties props;
	private final boolean fallbacks;

	public NoticeAssistant(AnthropicClient client, NoticeTools tools, AssistantProperties props, boolean fallbacks) {
		this.client = client;
		this.tools = tools;
		this.props = props;
		this.fallbacks = fallbacks;
	}

	public void ask(String question, List<Turn> history, Consumer<Event> events) {
		List<MessageParam> messages = new ArrayList<>();
		for (Turn t : history) {
			messages.add(MessageParam.builder().role(MessageParam.Role.USER).content(t.question()).build());
			messages.add(MessageParam.builder().role(MessageParam.Role.ASSISTANT).content(t.answer()).build());
		}
		LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
		messages.add(MessageParam.builder().role(MessageParam.Role.USER)
				.content("Today is " + today + " (" + today.getDayOfWeek() + ").\n\n" + question).build());

		Tool search = searchTool();
		Tool read = readTool();
		try {
			for (int step = 0; ; step++) {
				// same model, system prompt and tools every round, so the prompt prefix stays cacheable
				MessageCreateParams.Builder request = MessageCreateParams.builder()
						.model(props.model())
						.maxTokens(16000L)
						.system(SYSTEM_PROMPT)
						.addTool(search)
						.addTool(read)
						// Q&A over a small database: medium effort keeps answers quick without getting sloppy
						.outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.MEDIUM).build())
						.messages(messages);
				if (fallbacks) {
					// if the model declines, the API retries on a fallback model chosen by refusal category
					request.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
							.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));
				}
				if (step >= props.maxSteps()) {
					request.toolChoice(ToolChoiceNone.builder().build());   // enough research: answer now
				}
				Message response = client.messages().create(request.build());
				StopReason stop = response.stopReason().orElse(null);
				if (StopReason.REFUSAL.equals(stop)) {
					events.accept(new Event.Failed("The AI declined to answer this one. Try asking another way."));
					return;
				}
				// the whole reply goes back, thinking blocks included, so the next turn continues where it left off
				messages.add(response.toParam());
				List<ToolUseBlock> calls = response.content().stream().flatMap(b -> b.toolUse().stream()).toList();
				if (calls.isEmpty() || !StopReason.TOOL_USE.equals(stop)) {
					String text = response.content().stream().flatMap(b -> b.text().stream())
							.map(t -> t.text()).reduce("", String::concat).strip();
					if (text.isEmpty()) {
						events.accept(new Event.Failed(StopReason.MAX_TOKENS.equals(stop)
								? "The answer got too long. Try a narrower question."
								: "The AI didn't write an answer. Please try again."));
						return;
					}
					events.accept(new Event.Answer(text, tools.describe(linkedIds(text)), response.model().asString()));
					return;
				}
				List<ContentBlockParam> results = new ArrayList<>();
				for (ToolUseBlock call : calls) {
					results.add(ContentBlockParam.ofToolResult(run(call, events)));
				}
				messages.add(MessageParam.builder().role(MessageParam.Role.USER).contentOfBlockParams(results).build());
			}
		} catch (AnthropicServiceException e) {
			int status = e.statusCode();
			events.accept(new Event.Failed(switch (status) {
				case 401, 403 -> "The Claude API key was not accepted. Check it in Settings.";
				case 429, 529 -> "The AI is busy right now. Please try again in a minute.";
				default -> "The AI service returned an error (" + status + "). Please try again.";
			}));
		} catch (AnthropicIoException e) {
			events.accept(new Event.Failed("Could not reach the AI service. Check the internet connection."));
		}
	}

	private ToolResultBlockParam run(ToolUseBlock call, Consumer<Event> events) {
		ToolResultBlockParam.Builder result = ToolResultBlockParam.builder().toolUseId(call.id());
		Map<String, Object> in;
		try {
			in = call._input().convert(new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
			});
		} catch (RuntimeException e) {
			return result.content("The tool input was not valid JSON: " + e.getMessage()).isError(true).build();
		}
		if (in == null) {
			in = Map.of();
		}
		switch (call.name()) {
			case "search_notices" -> {
				NoticeTools.Search search = new NoticeTools.Search(string(in.get("query")), string(in.get("category")),
						integer(in.get("posted_within_days")), integer(in.get("deadline_within_days")));
				events.accept(new Event.Step("search", describe(search)));
				List<NoticeTools.Hit> hits = tools.search(search);
				return result.content(render(hits)).build();
			}
			case "read_notice" -> {
				Integer id = integer(in.get("id"));
				if (id == null) {
					return result.content("read_notice needs an id").isError(true).build();
				}
				var notice = tools.read(id);
				events.accept(new Event.Step("read", notice.map(text -> firstLine(text, "Title: ")).orElse("#" + id)));
				return notice.map(text -> result.content(text).build())
						.orElseGet(() -> result.content("There is no notice " + id).isError(true).build());
			}
			default -> {
				return result.content("Unknown tool " + call.name()).isError(true).build();
			}
		}
	}

	private Tool searchTool() {
		List<String> categories = tools.categories();
		return Tool.builder()
				.name("search_notices")
				.description("""
						Search the notices, newest first (or soonest deadline first when deadline_within_days is \
						set). Returns up to %d notices with id, titles, office, dates and a short summary. Every word \
						of the query must appear in the notice (Korean text or English summary); leave the query out \
						to list notices by the other filters.""".formatted(NoticeTools.SEARCH_LIMIT))
				.inputSchema(Tool.InputSchema.builder()
						.properties(Tool.InputSchema.Properties.builder()
								.putAdditionalProperty("query", JsonValue.from(Map.of("type", "string",
										"description", "Words to look for, Korean or English, e.g. 장학 or visa")))
								.putAdditionalProperty("category", JsonValue.from(Map.of("type", "string",
										"description", "Only this board category. One of: " + String.join(", ", categories))))
								.putAdditionalProperty("posted_within_days", JsonValue.from(Map.of("type", "integer",
										"description", "Only notices posted in the last N days")))
								.putAdditionalProperty("deadline_within_days", JsonValue.from(Map.of("type", "integer",
										"description", "Only notices with a deadline from today to N days from now")))
								.build())
						.build())
				.build();
	}

	private static Tool readTool() {
		return Tool.builder()
				.name("read_notice")
				.description("Read one notice in full: Korean body text, English summary, deadline, attachments, link.")
				.inputSchema(Tool.InputSchema.builder()
						.properties(Tool.InputSchema.Properties.builder()
								.putAdditionalProperty("id", JsonValue.from(Map.of("type", "integer",
										"description", "Notice id from search_notices")))
								.build())
						.required(List.of("id"))
						.build())
				.build();
	}

	static String render(List<NoticeTools.Hit> hits) {
		if (hits.isEmpty()) {
			return "No notices matched.";
		}
		StringBuilder sb = new StringBuilder();
		for (NoticeTools.Hit h : hits) {
			sb.append("- id ").append(h.id()).append(": ").append(h.title());
			if (h.titleEn() != null) {
				sb.append(" | ").append(h.titleEn());
			}
			sb.append("\n  office ").append(h.department() == null ? "-" : h.department())
					.append(", posted ").append(h.postedOn())
					.append(h.deadline() == null ? "" : ", deadline " + h.deadline());
			if (h.snippet() != null && !h.snippet().isBlank()) {
				sb.append("\n  ").append(h.snippet().replaceAll("\\s+", " ").strip());
			}
			sb.append('\n');
		}
		return sb.toString();
	}

	static List<Long> linkedIds(String answer) {
		LinkedHashSet<Long> ids = new LinkedHashSet<>();
		Matcher m = NOTICE_LINK.matcher(answer);
		while (m.find()) {
			ids.add(Long.parseLong(m.group(1)));
		}
		return List.copyOf(ids);
	}

	private static String describe(NoticeTools.Search s) {
		List<String> parts = new ArrayList<>();
		if (s.query() != null && !s.query().isBlank()) {
			parts.add("\"" + s.query().strip() + "\"");
		}
		if (s.category() != null && !s.category().isBlank()) {
			parts.add(s.category().strip());
		}
		if (s.deadlineWithinDays() != null) {
			parts.add("due within " + s.deadlineWithinDays() + " days");
		}
		if (s.postedWithinDays() != null) {
			parts.add("last " + s.postedWithinDays() + " days");
		}
		return parts.isEmpty() ? "latest notices" : String.join(" · ", parts);
	}

	private static String firstLine(String text, String prefix) {
		return text.lines().filter(l -> l.startsWith(prefix)).findFirst().map(l -> l.substring(prefix.length()))
				.orElse("");
	}

	private static String string(Object o) {
		return o == null ? null : o.toString();
	}

	private static Integer integer(Object o) {
		if (o instanceof Number n) {
			return n.intValue();
		}
		if (o instanceof String s && s.strip().matches("\\d{1,6}")) {
			return Integer.parseInt(s.strip());
		}
		return null;
	}
}

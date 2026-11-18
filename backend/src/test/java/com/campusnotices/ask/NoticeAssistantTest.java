package com.campusnotices.ask;

import static org.assertj.core.api.Assertions.assertThat;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The AI mode loop against a fake Messages API: tool calls, steps, links, step limit and failures. */
class NoticeAssistantTest {

	private HttpServer server;
	private final List<String> requests = new CopyOnWriteArrayList<>();
	private final List<String> betaHeaders = new CopyOnWriteArrayList<>();
	private final List<String> replies = new ArrayList<>();
	private volatile int status = 200;

	/** Database stand-in: one scholarship notice, id 5. */
	private final NoticeTools tools = new NoticeTools(null) {
		final Hit scholarship = new Hit(5, "[학생지원팀] 교내 장학금 신청", "On-campus scholarship applications", "학생지원팀",
				LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 25), "Apply on the portal by Nov 25.");

		@Override
		public List<Hit> search(Search s) {
			return "장학".equals(s.query()) ? List.of(scholarship) : List.of();
		}

		@Override
		public Optional<String> read(long id) {
			return id == 5 ? Optional.of("Notice 5\nTitle: [학생지원팀] 교내 장학금 신청\n\nBody:\n포털에서 신청") : Optional.empty();
		}

		@Override
		public List<Hit> describe(List<Long> ids) {
			return ids.contains(5L) ? List.of(scholarship) : List.of();
		}

		@Override
		public List<String> categories() {
			return List.of("장학", "학사");
		}
	};

	@BeforeEach
	void start() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/messages", exchange -> {
			requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			betaHeaders.add(String.valueOf(exchange.getRequestHeaders().getFirst("anthropic-beta")));
			String reply = replies.isEmpty() ? message("end_turn", text("done")) : replies.removeFirst();
			byte[] body = reply.getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(status, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
	}

	@AfterEach
	void stop() {
		server.stop(0);
	}

	private NoticeAssistant assistant(int maxSteps) {
		return new NoticeAssistant(AnthropicOkHttpClient.builder()
				.apiKey("test-key")
				.baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
				.maxRetries(0)
				.build(), tools, new AssistantProperties("claude-test", 30, maxSteps), true);
	}

	private static String message(String stopReason, String content) {
		return """
				{"id":"msg_1","type":"message","role":"assistant","model":"claude-test-20261101","content":[%s],
				 "stop_reason":"%s","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":20}}
				""".formatted(content, stopReason);
	}

	private static String text(String s) {
		return "{\"type\":\"text\",\"text\":\"" + s.replace("\"", "\\\"").replace("\n", "\\n") + "\"}";
	}

	private static String toolUse(String id, String name, String inputJson) {
		return "{\"type\":\"tool_use\",\"id\":\"" + id + "\",\"name\":\"" + name + "\",\"input\":" + inputJson + "}";
	}

	private List<NoticeAssistant.Event> ask(NoticeAssistant a, String question) {
		List<NoticeAssistant.Event> events = new ArrayList<>();
		a.ask(question, List.of(), events::add);
		return events;
	}

	@Test
	void searchesReadsAndAnswersWithLinks() {
		replies.add(message("tool_use", text("Let me look.") + "," + toolUse("tu_1", "search_notices", "{\"query\":\"장학\"}")));
		replies.add(message("tool_use", toolUse("tu_2", "read_notice", "{\"id\":5}")));
		replies.add(message("end_turn", text("- [On-campus scholarship applications](/notices/5): apply by Nov 25.")));

		List<NoticeAssistant.Event> events = ask(assistant(6), "Any scholarships I can apply for?");

		assertThat(events).hasSize(3);
		assertThat(events.get(0)).isEqualTo(new NoticeAssistant.Event.Step("search", "\"장학\""));
		assertThat(events.get(1)).isEqualTo(new NoticeAssistant.Event.Step("read", "[학생지원팀] 교내 장학금 신청"));
		assertThat(events.get(2)).isInstanceOfSatisfying(NoticeAssistant.Event.Answer.class, a -> {
			assertThat(a.text()).contains("(/notices/5)");
			assertThat(a.sources()).extracting(NoticeTools.Hit::id).containsExactly(5L);
			assertThat(a.model()).isEqualTo("claude-test-20261101");
		});

		assertThat(requests).hasSize(3);
		// first request: the question with today's date, both tools, medium effort, server-side fallback
		assertThat(requests.get(0))
				.contains("Any scholarships I can apply for?", "Today is ", "\"search_notices\"", "\"read_notice\"",
						"\"effort\":\"medium\"", "\"fallbacks\":\"default\"", "장학, 학사")
				.doesNotContain("tool_choice");
		assertThat(betaHeaders.get(0)).contains("server-side-fallback-2026-07-01");
		// the search result went back as a tool_result for tu_1, and the history grew append-only
		assertThat(requests.get(1)).contains("\"tool_use_id\":\"tu_1\"", "id 5: [학생지원팀] 교내 장학금 신청",
				"deadline 2026-11-25", "Let me look.");
		assertThat(requests.get(2)).contains("\"tool_use_id\":\"tu_2\"", "포털에서 신청", "\"tool_use_id\":\"tu_1\"");
	}

	@Test
	void stopsResearchingAfterMaxStepsAndMustAnswer() {
		replies.add(message("tool_use", toolUse("tu_1", "search_notices", "{\"query\":\"visa\"}")));
		replies.add(message("end_turn", text("I couldn't find a notice about that. Ask the International Office.")));

		List<NoticeAssistant.Event> events = ask(assistant(1), "visa?");

		assertThat(requests.get(1)).contains("\"tool_choice\":{\"type\":\"none\"}");
		assertThat(events.getLast()).isInstanceOfSatisfying(NoticeAssistant.Event.Answer.class,
				a -> assertThat(a.sources()).isEmpty());
	}

	@Test
	void unknownNoticeAndUnknownToolAreReportedToTheModelAsErrors() {
		replies.add(message("tool_use", toolUse("tu_1", "read_notice", "{\"id\":999}") + ","
				+ toolUse("tu_2", "delete_everything", "{}")));
		replies.add(message("end_turn", text("No such notice.")));

		ask(assistant(6), "notice 999?");

		assertThat(requests.get(1)).contains("There is no notice 999", "Unknown tool delete_everything",
				"\"is_error\":true");
	}

	@Test
	void refusalAndBadKeyBecomeFriendlyErrors() {
		replies.add(message("refusal", ""));
		assertThat(ask(assistant(6), "something")).singleElement()
				.isInstanceOfSatisfying(NoticeAssistant.Event.Failed.class,
						f -> assertThat(f.message()).contains("declined"));

		status = 401;
		replies.add("{\"type\":\"error\",\"error\":{\"type\":\"authentication_error\",\"message\":\"bad key\"}}");
		assertThat(ask(assistant(6), "something")).singleElement()
				.isInstanceOfSatisfying(NoticeAssistant.Event.Failed.class,
						f -> assertThat(f.message()).contains("API key"));
	}

	@Test
	void linkedIdsAreFoundOnceInOrder() {
		assertThat(NoticeAssistant.linkedIds("[a](/notices/7) and [b](/notices/3), again [a](/notices/7)"))
				.containsExactly(7L, 3L);
	}
}

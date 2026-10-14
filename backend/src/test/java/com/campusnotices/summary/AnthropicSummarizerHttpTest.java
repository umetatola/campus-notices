package com.campusnotices.summary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.campusnotices.summary.Summarizer.Input;
import com.campusnotices.summary.Summarizer.Result;
import com.campusnotices.summary.Summarizer.SummarizerException;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The Claude summarizer against a fake Messages API on localhost: request shape, replies and error mapping. */
class AnthropicSummarizerHttpTest {

	private static final Input NOTICE = new Input("[학사팀] 수강철회 안내", "학사", "학사팀", LocalDate.of(2026, 10, 1),
			"10월 20일까지 포털에서 신청", List.of("안내문.pdf"));

	private HttpServer server;
	private final AtomicReference<String> requestBody = new AtomicReference<>();
	private final AtomicReference<String> betaHeader = new AtomicReference<>();
	private volatile int status = 200;
	private volatile String reply;

	@BeforeEach
	void start() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/messages", exchange -> {
			requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			betaHeader.set(exchange.getRequestHeaders().getFirst("anthropic-beta"));
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

	private AnthropicSummarizer summarizer(boolean fallbacks) {
		return new AnthropicSummarizer(AnthropicOkHttpClient.builder()
				.apiKey("test-key")
				.baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
				.maxRetries(0)
				.build(), "claude-test", fallbacks);
	}

	private static String message(String stopReason, String text) {
		String content = text == null ? "[]"
				: "[{\"type\":\"text\",\"text\":" + quote(text) + "}]";
		return """
				{"id":"msg_1","type":"message","role":"assistant","model":"claude-test-20261001","content":%s,
				 "stop_reason":"%s","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":20}}
				""".formatted(content, stopReason);
	}

	private static String quote(String s) {
		return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
	}

	private static String error(String type) {
		return "{\"type\":\"error\",\"error\":{\"type\":\"" + type + "\",\"message\":\"nope\"}}";
	}

	@Test
	void readsTheStructuredReply() throws Exception {
		reply = message("end_turn", """
				{"titleEn":" [Academic Affairs] Course withdrawal ","summaryEn":"Withdraw online by Oct 20.",
				 "deadline":"2026-10-20","deadlineNote":"  "}""");

		Result r = summarizer(false).summarize(NOTICE);

		assertThat(r.titleEn()).isEqualTo("[Academic Affairs] Course withdrawal");
		assertThat(r.summaryEn()).isEqualTo("Withdraw online by Oct 20.");
		assertThat(r.deadline()).isEqualTo(LocalDate.of(2026, 10, 20));
		assertThat(r.deadlineNote()).isNull();
		assertThat(r.model()).isEqualTo("claude-test-20261001");
		// the request carries the model, the system prompt and the rendered notice, with no fallback extras
		assertThat(requestBody.get()).contains("\"model\":\"claude-test\"").contains("international students")
				.contains("안내문.pdf").doesNotContain("fallbacks");
		assertThat(betaHeader.get()).isNull();
	}

	@Test
	void asksForServerSideFallbacksWhenEnabled() throws Exception {
		reply = message("end_turn",
				"{\"titleEn\":\"T\",\"summaryEn\":\"S\",\"deadline\":\"\",\"deadlineNote\":\"\"}");

		Result r = summarizer(true).summarize(NOTICE);

		assertThat(r.deadline()).isNull();
		assertThat(requestBody.get()).contains("\"fallbacks\":\"default\"");
		assertThat(betaHeader.get()).contains("server-side-fallback-2026-07-01");
	}

	@Test
	void refusalsAndCutOffRepliesAreNotRetried() {
		reply = message("refusal", null);
		assertThatThrownBy(() -> summarizer(false).summarize(NOTICE))
				.isInstanceOfSatisfying(SummarizerException.class, e -> {
					assertThat(e.retryable()).isFalse();
					assertThat(e).hasMessageContaining("declined");
				});

		reply = message("max_tokens", "{\"titleEn\":\"T\"");
		assertThatThrownBy(() -> summarizer(false).summarize(NOTICE))
				.isInstanceOfSatisfying(SummarizerException.class, e -> {
					assertThat(e.retryable()).isFalse();
					assertThat(e).hasMessageContaining("token limit");
				});
	}

	@Test
	void anEmptyReplyIsRetried() {
		reply = message("end_turn", null);
		assertThatThrownBy(() -> summarizer(false).summarize(NOTICE))
				.isInstanceOfSatisfying(SummarizerException.class, e -> assertThat(e.retryable()).isTrue());
	}

	@Test
	void rateLimitsAndServerErrorsAreRetriedButBadRequestsAreNot() {
		for (int code : new int[] {429, 500, 529}) {
			status = code;
			reply = error(code == 429 ? "rate_limit_error" : "api_error");
			assertThatThrownBy(() -> summarizer(false).summarize(NOTICE))
					.isInstanceOfSatisfying(SummarizerException.class, e -> {
						assertThat(e.retryable()).as("HTTP %d", code).isTrue();
						assertThat(e).hasMessageContaining("returned " + code);
					});
		}
		status = 400;
		reply = error("invalid_request_error");
		assertThatThrownBy(() -> summarizer(false).summarize(NOTICE))
				.isInstanceOfSatisfying(SummarizerException.class, e -> assertThat(e.retryable()).isFalse());
	}

	@Test
	void anUnreachableApiIsRetried() {
		server.stop(0);
		assertThatThrownBy(() -> summarizer(false).summarize(NOTICE))
				.isInstanceOfSatisfying(SummarizerException.class, e -> {
					assertThat(e.retryable()).isTrue();
					assertThat(e).hasMessageContaining("Could not reach");
				});
	}
}

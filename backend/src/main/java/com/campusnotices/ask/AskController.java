package com.campusnotices.ask;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.campusnotices.account.SessionUser;
import com.campusnotices.summary.SummarizerProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AI mode over HTTP. The answer arrives as server-sent events: {@code step} for each search or notice read, then
 * one {@code answer} or {@code error}. On the website it needs a signed-in user (it spends API credit); in the
 * desktop app it is open to this PC.
 */
@RestController
@RequestMapping("/api/ask")
public class AskController {

	static final int MAX_HISTORY = 4;

	public record Status(boolean enabled, String model) {
	}

	public record Question(@NotBlank @Size(max = 2000) String question, List<NoticeAssistant.Turn> history) {
	}

	private final NoticeAssistant assistant;   // null when there is no API key
	private final AssistantProperties props;
	private final Map<String, Deque<Instant>> recent = new ConcurrentHashMap<>();
	private final ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();

	@org.springframework.beans.factory.annotation.Autowired
	public AskController(SummarizerProperties summarizer, AssistantProperties props, NoticeTools tools) {
		this.props = props;
		boolean hasKey = summarizer.apiKey() != null && !summarizer.apiKey().isBlank();
		boolean off = "none".equalsIgnoreCase(summarizer.provider()) || "stub".equalsIgnoreCase(summarizer.provider());
		this.assistant = hasKey && !off
				? new NoticeAssistant(AnthropicOkHttpClient.builder().apiKey(summarizer.apiKey()).build(), tools, props,
						summarizer.fallbacks())
				: null;
	}

	/** For tests: a ready assistant (e.g. pointed at a fake API). */
	AskController(NoticeAssistant assistant, AssistantProperties props) {
		this.assistant = assistant;
		this.props = props;
	}

	@GetMapping("/status")
	public Status status() {
		return new Status(assistant != null, assistant == null ? null : props.model());
	}

	@PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter ask(@AuthenticationPrincipal SessionUser user, @Valid @RequestBody Question body) {
		if (assistant == null) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"AI mode is off: it needs a Claude API key (desktop app: Settings).");
		}
		if (!allow(user == null ? "this-pc" : "user-" + user.id())) {
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
					"You asked " + props.questionsPerHour() + " questions in the last hour. Please try again later.");
		}
		List<NoticeAssistant.Turn> history = body.history() == null ? List.of()
				: body.history().subList(Math.max(0, body.history().size() - MAX_HISTORY), body.history().size()).stream()
						.filter(t -> t != null && t.question() != null && t.answer() != null)
						.toList();

		SseEmitter emitter = new SseEmitter(Duration.ofMinutes(5).toMillis());
		workers.submit(() -> {
			try {
				assistant.ask(body.question().strip(), history, event -> send(emitter, event));
				emitter.complete();
			} catch (RuntimeException e) {
				send(emitter, new NoticeAssistant.Event.Failed("Something went wrong. Please try again."));
				emitter.complete();
			}
		});
		return emitter;
	}

	private static void send(SseEmitter emitter, NoticeAssistant.Event event) {
		String name = switch (event) {
			case NoticeAssistant.Event.Step s -> "step";
			case NoticeAssistant.Event.Answer a -> "answer";
			case NoticeAssistant.Event.Failed f -> "error";
		};
		try {
			emitter.send(SseEmitter.event().name(name).data(event, MediaType.APPLICATION_JSON));
		} catch (IOException | IllegalStateException e) {
			// the page was closed; the answer has nowhere to go
		}
	}

	/** Sliding one-hour window per user. */
	boolean allow(String who) {
		Instant now = Instant.now();
		Deque<Instant> times = recent.computeIfAbsent(who, k -> new ArrayDeque<>());
		synchronized (times) {
			while (!times.isEmpty() && times.peekFirst().isBefore(now.minus(Duration.ofHours(1)))) {
				times.pollFirst();
			}
			if (times.size() >= props.questionsPerHour()) {
				return false;
			}
			times.addLast(now);
			return true;
		}
	}
}

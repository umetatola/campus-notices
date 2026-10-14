package com.campusnotices.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PoliteHttpClientTest {

	private static final Duration DELAY = Duration.ofMillis(300);

	private HttpServer server;
	private final List<Long> arrivals = new CopyOnWriteArrayList<>();
	private final List<String> userAgents = new CopyOnWriteArrayList<>();
	private PoliteHttpClient client;

	@BeforeEach
	void start() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", exchange -> {
			arrivals.add(System.nanoTime());
			userAgents.add(exchange.getRequestHeaders().getFirst("User-Agent"));
			boolean missing = exchange.getRequestURI().getPath().equals("/missing");
			byte[] body = (missing ? "not here" : "<p>장학금 안내</p>").getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "text/html; charset=UTF-8");
			exchange.sendResponseHeaders(missing ? 404 : 200, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
		client = new PoliteHttpClient(new CrawlerProperties(true, URI.create(url("/list")), "test", Duration.ofMinutes(15),
				7, Duration.ofHours(6), 10, Duration.ofSeconds(10), DELAY, 3, "CampusNoticesBot/1.0 (+test)"));
	}

	@AfterEach
	void stop() {
		server.stop(0);
	}

	private String url(String path) {
		return "http://127.0.0.1:" + server.getAddress().getPort() + path;
	}

	@Test
	void sendsItsUserAgentAndReadsKoreanText() throws Exception {
		assertThat(client.get(URI.create(url("/page")))).isEqualTo("<p>장학금 안내</p>");
		assertThat(userAgents).containsExactly("CampusNoticesBot/1.0 (+test)");
	}

	@Test
	void waitsBetweenRequests() throws Exception {
		for (int i = 0; i < 3; i++) {
			client.get(URI.create(url("/page")));
		}
		assertThat(arrivals).hasSize(3);
		for (int i = 1; i < arrivals.size(); i++) {
			assertThat(Duration.ofNanos(arrivals.get(i) - arrivals.get(i - 1))).isGreaterThanOrEqualTo(DELAY);
		}
	}

	@Test
	void anErrorPageFailsAndStillCountsTowardTheDelay() throws Exception {
		assertThatThrownBy(() -> client.get(URI.create(url("/missing"))))
				.isInstanceOf(IOException.class).hasMessageContaining("returned 404");
		client.get(URI.create(url("/page")));
		assertThat(Duration.ofNanos(arrivals.get(1) - arrivals.get(0))).isGreaterThanOrEqualTo(DELAY);
	}
}

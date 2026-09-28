package com.campusnotices.crawler;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

/** GETs pages from the university site, never faster than one request per {@code crawler.request-delay}. */
@Component
public class PoliteHttpClient implements PageFetcher {

	private final HttpClient http = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.followRedirects(HttpClient.Redirect.NORMAL)
			.build();
	private final CrawlerProperties props;
	private long lastRequestNanos;

	public PoliteHttpClient(CrawlerProperties props) {
		this.props = props;
	}

	@Override
	public synchronized String get(URI uri) throws IOException, InterruptedException {
		long wait = props.requestDelay().toNanos() - (System.nanoTime() - lastRequestNanos);
		if (lastRequestNanos != 0 && wait > 0) {
			Thread.sleep(Duration.ofNanos(wait));
		}
		HttpRequest request = HttpRequest.newBuilder(uri)
				.timeout(Duration.ofSeconds(20))
				.header("User-Agent", props.userAgent())
				.GET()
				.build();
		try {
			HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() != 200) {
				throw new IOException("GET " + uri + " returned " + response.statusCode());
			}
			return response.body();
		} finally {
			lastRequestNanos = System.nanoTime();
		}
	}
}

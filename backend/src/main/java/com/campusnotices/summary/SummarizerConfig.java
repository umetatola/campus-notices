package com.campusnotices.summary;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SummarizerConfig {

	private static final Logger log = LoggerFactory.getLogger(SummarizerConfig.class);

	@Bean
	Summarizer summarizer(SummarizerProperties props) {
		String provider = props.provider() == null ? "auto" : props.provider().strip().toLowerCase();
		boolean hasKey = props.apiKey() != null && !props.apiKey().isBlank();
		if (provider.equals("auto")) {
			provider = hasKey ? "anthropic" : "none";
		}
		switch (provider) {
			case "anthropic" -> {
				if (!hasKey) {
					throw new IllegalStateException("summarizer.provider=anthropic needs ANTHROPIC_API_KEY");
				}
				log.info("Summaries: Claude ({})", props.model());
				return new AnthropicSummarizer(
						AnthropicOkHttpClient.builder().apiKey(props.apiKey()).build(),
						props.model(), props.fallbacks());
			}
			case "stub" -> {
				log.info("Summaries: stub (fake summaries for development)");
				return new StubSummarizer();
			}
			case "none" -> {
				log.info("Summaries: off (no ANTHROPIC_API_KEY); notices stay queued until a key is set");
				return new Summarizer() {
					@Override
					public boolean enabled() {
						return false;
					}

					@Override
					public Result summarize(Input notice) {
						throw new UnsupportedOperationException("summarizer is disabled");
					}
				};
			}
			default -> throw new IllegalStateException("Unknown summarizer.provider: " + props.provider());
		}
	}
}

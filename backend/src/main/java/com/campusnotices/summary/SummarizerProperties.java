package com.campusnotices.summary;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param provider    {@code auto} (Claude when an API key is set, otherwise off), {@code anthropic}, {@code stub}
 *                    (fake summaries for UI work) or {@code none}
 * @param apiKey      Anthropic API key; read from ANTHROPIC_API_KEY (environment or the project's .env file)
 * @param model       Claude model id
 * @param fallbacks   ask the API to retry a declined request on a fallback model (server-side fallback beta)
 * @param interval    how often the worker looks for queued notices
 * @param batchSize   notices summarized per worker run
 * @param maxAttempts give up on a notice after this many failed attempts
 */
@ConfigurationProperties(prefix = "summarizer")
public record SummarizerProperties(
		String provider,
		String apiKey,
		String model,
		boolean fallbacks,
		Duration interval,
		int batchSize,
		int maxAttempts) {
}

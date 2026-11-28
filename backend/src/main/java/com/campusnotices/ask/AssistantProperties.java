package com.campusnotices.ask;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI mode: questions about notices answered by Claude, which searches and reads the notices itself. Uses the same
 * API key as the summaries ({@code summarizer.api-key}); off when there is none.
 *
 * @param model            Claude model id
 * @param questionsPerHour per user (or per desktop install); each question costs API credit
 * @param maxSteps         searches/reads the model may do for one question before it must answer
 */
@ConfigurationProperties(prefix = "assistant")
public record AssistantProperties(String model, int questionsPerHour, int maxSteps) {
}

package com.campusnotices;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Requests per minute per client IP (see {@link RateLimitFilter}).
 *
 * @param signInPerMinute sign-in link requests (each sends an email)
 * @param searchPerMinute notice list searches and feeds
 * @param apiPerMinute    any other /api request
 */
@ConfigurationProperties(prefix = "rate-limit")
public record RateLimitProperties(boolean enabled, int signInPerMinute, int searchPerMinute, int apiPerMinute) {
}

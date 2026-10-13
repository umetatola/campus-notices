package com.campusnotices;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-IP request limits, so one client can't flood sign-in emails or hammer search. In memory (one app instance);
 * behind Caddy the client IP comes from X-Forwarded-For (server.forward-headers-strategy). Over the limit the
 * answer is 429 with Retry-After.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

	private enum Rule { SIGN_IN, SEARCH, API }

	/** Token bucket: refills continuously at {@code perMinute} tokens a minute, holds at most {@code perMinute}. */
	private record Bucket(double tokens, long at) {
	}

	private static final long MINUTE = 60_000_000_000L;
	private static final int MAX_TRACKED = 50_000;

	private final RateLimitProperties props;
	private final LongSupplier nanoTime;
	private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

	public RateLimitFilter(RateLimitProperties props) {
		this(props, System::nanoTime);
	}

	RateLimitFilter(RateLimitProperties props, LongSupplier nanoTime) {
		this.props = props;
		this.nanoTime = nanoTime;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !props.enabled() || !request.getRequestURI().startsWith("/api/");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Rule rule = rule(request);
		int perMinute = switch (rule) {
			case SIGN_IN -> props.signInPerMinute();
			case SEARCH -> props.searchPerMinute();
			case API -> props.apiPerMinute();
		};
		long waitSeconds = take(rule + "|" + request.getRemoteAddr(), perMinute);
		if (waitSeconds > 0) {
			response.setStatus(429);
			response.setHeader("Retry-After", String.valueOf(waitSeconds));
			response.setContentType("application/problem+json");
			response.setCharacterEncoding(StandardCharsets.UTF_8.name());
			response.getWriter().write("{\"title\":\"Too Many Requests\",\"status\":429,"
					+ "\"detail\":\"Too many requests. Please wait " + waitSeconds + " seconds and try again.\"}");
			return;
		}
		chain.doFilter(request, response);
	}

	private static Rule rule(HttpServletRequest request) {
		String path = request.getRequestURI();
		if ("POST".equals(request.getMethod()) && path.equals("/api/auth/request-link")) {
			return Rule.SIGN_IN;
		}
		if ("GET".equals(request.getMethod()) && (path.equals("/api/notices") || path.equals("/api/notices/feed.xml"))) {
			return Rule.SEARCH;
		}
		return Rule.API;
	}

	/** Takes one token; returns 0 when allowed, otherwise the seconds until a token is free. */
	long take(String key, int perMinute) {
		if (buckets.size() > MAX_TRACKED) {
			buckets.clear();   // a flood of distinct addresses: forget them rather than grow without bound
		}
		long now = nanoTime.getAsLong();
		long[] wait = {0};
		buckets.compute(key, (k, b) -> {
			double tokens = b == null ? perMinute
					: Math.min(perMinute, b.tokens() + (now - b.at()) * (double) perMinute / MINUTE);
			if (tokens >= 1) {
				return new Bucket(tokens - 1, now);
			}
			// the epsilon keeps rounding noise (1.0000000001 s) from adding a whole second
			wait[0] = Math.max(1, (long) Math.ceil((1 - tokens) * 60 / perMinute - 1e-9));
			return new Bucket(tokens, now);
		});
		return wait[0];
	}
}

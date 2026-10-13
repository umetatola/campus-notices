package com.campusnotices;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

	private static final long SECOND = 1_000_000_000L;

	private final AtomicLong clock = new AtomicLong(0);
	private final RateLimitFilter filter = new RateLimitFilter(new RateLimitProperties(true, 2, 3, 100), clock::get);

	private MockHttpServletResponse call(String method, String path, String ip) throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest(method, path);
		request.setRemoteAddr(ip);
		MockHttpServletResponse response = new MockHttpServletResponse();
		filter.doFilter(request, response, new MockFilterChain());
		return response;
	}

	@Test
	void limitsSignInLinksPerAddressAndSaysWhenToRetry() throws Exception {
		assertThat(call("POST", "/api/auth/request-link", "1.2.3.4").getStatus()).isEqualTo(200);
		assertThat(call("POST", "/api/auth/request-link", "1.2.3.4").getStatus()).isEqualTo(200);

		MockHttpServletResponse limited = call("POST", "/api/auth/request-link", "1.2.3.4");
		assertThat(limited.getStatus()).isEqualTo(429);
		assertThat(limited.getHeader("Retry-After")).isEqualTo("30");   // 2 a minute: one token every 30 s
		assertThat(limited.getContentAsString()).contains("\"status\":429").contains("wait 30 seconds");

		// another address has its own allowance, and other API calls aren't affected
		assertThat(call("POST", "/api/auth/request-link", "5.6.7.8").getStatus()).isEqualTo(200);
		assertThat(call("GET", "/api/me", "1.2.3.4").getStatus()).isEqualTo(200);
	}

	@Test
	void refillsOverTime() throws Exception {
		for (int i = 0; i < 3; i++) {
			assertThat(call("GET", "/api/notices", "1.2.3.4").getStatus()).isEqualTo(200);
		}
		assertThat(call("GET", "/api/notices/feed.xml", "1.2.3.4").getStatus()).isEqualTo(429);

		clock.addAndGet(19 * SECOND);   // 3 a minute: a token every 20 s
		assertThat(call("GET", "/api/notices", "1.2.3.4").getHeader("Retry-After")).isEqualTo("1");
		clock.addAndGet(2 * SECOND);
		assertThat(call("GET", "/api/notices", "1.2.3.4").getStatus()).isEqualTo(200);
	}

	@Test
	void leavesTheWebAppAndDisabledSetupsAlone() throws Exception {
		for (int i = 0; i < 5; i++) {
			assertThat(call("GET", "/notices/1", "1.2.3.4").getStatus()).isEqualTo(200);
		}
		RateLimitFilter off = new RateLimitFilter(new RateLimitProperties(false, 0, 0, 0), clock::get);
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/request-link");
		MockHttpServletResponse response = new MockHttpServletResponse();
		off.doFilter(request, response, new MockFilterChain());
		assertThat(response.getStatus()).isEqualTo(200);
	}
}

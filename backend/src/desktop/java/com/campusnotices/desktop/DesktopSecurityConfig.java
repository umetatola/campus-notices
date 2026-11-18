package com.campusnotices.desktop;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The desktop settings API and AI mode need no sign-in: the server listens on 127.0.0.1 only, so whoever reaches it
 * is at this PC (and AI mode uses this PC's own API key). Writes still need the CSRF token, so other sites open in a
 * browser can't change settings or spend API credit.
 */
@Configuration
class DesktopSecurityConfig {

	@Bean
	@Order(0)
	SecurityFilterChain desktopApi(HttpSecurity http) throws Exception {
		http.securityMatcher("/api/desktop/**", "/api/ask", "/api/ask/**")
				.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
				.csrf(csrf -> csrf.spa());
		return http.build();
	}
}

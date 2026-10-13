package com.campusnotices.account;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;

/**
 * Session cookie auth for the same-origin SPA. CSRF uses the SPA pattern: the token travels in a readable
 * XSRF-TOKEN cookie and comes back in the X-XSRF-TOKEN header on every write.
 */
@Configuration
public class SecurityConfig {

	/**
	 * Scripts only from this site. Notice bodies are university HTML: their images come from ajou.ac.kr (any https
	 * host is allowed) and they carry inline style attributes. Fonts come from Google Fonts. HSTS is set by Caddy,
	 * which terminates HTTPS.
	 */
	static final String CONTENT_SECURITY_POLICY = String.join("; ",
			"default-src 'self'",
			"script-src 'self'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' https: data:",
			"connect-src 'self'",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'");

	@Bean
	SecurityFilterChain api(HttpSecurity http) throws Exception {
		http
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.GET, "/api/notices/**", "/api/csrf", "/api/status", "/actuator/health").permitAll()
						// API documentation is public: the JSON spec and the Swagger UI page
						.requestMatchers(HttpMethod.GET, "/api/openapi", "/api/openapi/**", "/api/docs", "/api/docs/**").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/auth/request-link", "/api/auth/verify").permitAll()
						// one-click unsubscribe: authorized by the token in the link, not by a session
						.requestMatchers(HttpMethod.POST, "/api/alerts/unsubscribe").permitAll()
						.requestMatchers("/api/**").authenticated()
						.anyRequest().permitAll())
				.csrf(csrf -> csrf.spa().ignoringRequestMatchers("/api/alerts/unsubscribe"))
				.headers(headers -> headers
						.contentSecurityPolicy(csp -> csp.policyDirectives(CONTENT_SECURITY_POLICY))
						.referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
						.frameOptions(frame -> frame.deny())
						.permissionsPolicyHeader(permissions -> permissions.policy("camera=(), microphone=(), geolocation=()")))
				// an API answers 401, it doesn't redirect to a login page
				.exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
				.formLogin(form -> form.disable())
				.httpBasic(basic -> basic.disable())
				.logout(logout -> logout
						.logoutUrl("/api/auth/logout")
						.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)));
		return http.build();
	}

	/** No username/password users exist; this stops Spring Boot from generating a default one. */
	@Bean
	UserDetailsService noPasswordUsers() {
		return new InMemoryUserDetailsManager();
	}
}

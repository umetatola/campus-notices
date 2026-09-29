package com.campusnotices.account;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;

/**
 * Session cookie auth for the same-origin SPA. CSRF uses the SPA pattern: the token travels in a readable
 * XSRF-TOKEN cookie and comes back in the X-XSRF-TOKEN header on every write.
 */
@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain api(HttpSecurity http) throws Exception {
		http
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.GET, "/api/notices/**", "/api/csrf", "/actuator/health").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/auth/request-link", "/api/auth/verify").permitAll()
						.requestMatchers("/api/**").authenticated()
						.anyRequest().permitAll())
				.csrf(csrf -> csrf.spa())
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

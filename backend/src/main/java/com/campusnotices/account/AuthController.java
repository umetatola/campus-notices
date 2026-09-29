package com.campusnotices.account;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {

	public record LinkRequest(@NotBlank @Email @Size(max = 320) String email) {
	}

	public record VerifyRequest(@NotBlank String token) {
	}

	public record Me(String email) {
	}

	private final LoginLinkService links;
	private final SecurityContextRepository contexts = new HttpSessionSecurityContextRepository();

	public AuthController(LoginLinkService links) {
		this.links = links;
	}

	/** Always 202, whether or not an email went out. */
	@PostMapping("/auth/request-link")
	@ResponseStatus(HttpStatus.ACCEPTED)
	public void requestLink(@Valid @RequestBody LinkRequest body) {
		links.requestLink(body.email());
	}

	@PostMapping("/auth/verify")
	public ResponseEntity<Me> verify(@Valid @RequestBody VerifyRequest body, HttpServletRequest request,
			HttpServletResponse response) {
		return links.verify(body.token())
				.map(user -> {
					// new session id on sign-in (prevents session fixation), then store the user in it
					request.getSession(true);
					request.changeSessionId();
					var auth = UsernamePasswordAuthenticationToken.authenticated(user, null,
							List.of(new SimpleGrantedAuthority("ROLE_USER")));
					SecurityContext context = SecurityContextHolder.createEmptyContext();
					context.setAuthentication(auth);
					SecurityContextHolder.setContext(context);
					contexts.saveContext(context, request, response);
					return ResponseEntity.ok(new Me(user.email()));
				})
				.orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_REQUEST).build());
	}

	@GetMapping("/me")
	public Me me(@AuthenticationPrincipal SessionUser user) {
		return new Me(user.email());
	}

	/** Gives the SPA its CSRF cookie before the first form submit. */
	@GetMapping("/csrf")
	public void csrf(CsrfToken token) {
		token.getToken();   // loading the token writes the XSRF-TOKEN cookie
	}
}

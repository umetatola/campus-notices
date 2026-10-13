package com.campusnotices.alerts;

import com.campusnotices.account.SessionUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Turning alert emails off (from the link in an email) and back on (signed in). */
@RestController
@RequestMapping("/api/alerts")
public class AlertSettingsController {

	public record AlertStatus(boolean paused) {
	}

	private final UnsubscribeService unsubscribe;

	public AlertSettingsController(UnsubscribeService unsubscribe) {
		this.unsubscribe = unsubscribe;
	}

	/**
	 * One-click unsubscribe (RFC 8058). Mail apps POST here with the body {@code List-Unsubscribe=One-Click};
	 * the web app's unsubscribe page posts here too. Authorized by the token, so no session or CSRF token.
	 */
	@PostMapping("/unsubscribe")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void unsubscribe(@RequestParam String token) {
		if (!unsubscribe.unsubscribe(token)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This unsubscribe link is not valid");
		}
	}

	@GetMapping("/status")
	public AlertStatus status(@AuthenticationPrincipal SessionUser user) {
		return new AlertStatus(unsubscribe.isPaused(user.id()));
	}

	@PostMapping("/resume")
	public AlertStatus resume(@AuthenticationPrincipal SessionUser user) {
		unsubscribe.resume(user.id());
		return new AlertStatus(false);
	}
}

package com.campusnotices.desktop;

import com.campusnotices.summary.Summarizer;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Desktop app only: the Claude API key and restarting the app to apply it. */
@RestController
@RequestMapping("/api/desktop")
class DesktopSettingsController {

	static final String API_KEY = "ANTHROPIC_API_KEY";
	private static final Instant STARTED_AT = Instant.now();

	private final Summarizer summarizer;

	DesktopSettingsController(Summarizer summarizer) {
		this.summarizer = summarizer;
	}

	/**
	 * {@code summariesOn} is what the running app does; it differs from {@code apiKeySet} until a restart.
	 * {@code startedAt} changes on every start, so the page can tell when a restart has finished.
	 */
	record Settings(boolean apiKeySet, String apiKeyHint, boolean summariesOn, boolean backgroundAvailable,
			boolean keepRunning, Instant startedAt) {
	}

	record ApiKeyChange(String apiKey) {
	}

	record KeepRunningChange(boolean enabled) {
	}

	@GetMapping("/settings")
	Settings settings() {
		String key = SettingsFile.load().getProperty(API_KEY);
		boolean set = key != null && !key.isBlank();
		return new Settings(set, set ? "…" + key.substring(Math.max(0, key.length() - 4)) : null,
				summarizer.enabled(), DesktopLauncher.backgroundAvailable(), DesktopLauncher.keepRunning(), STARTED_AT);
	}

	/** Applies at once, no restart needed. */
	@PutMapping("/settings/keep-running")
	Settings setKeepRunning(@RequestBody KeepRunningChange change) {
		if (change.enabled() && !DesktopLauncher.backgroundAvailable()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Running in the background needs the tray icon.");
		}
		DesktopLauncher.setKeepRunning(change.enabled());
		return settings();
	}

	/** A blank or missing key removes it. */
	@PutMapping("/settings/api-key")
	Settings setApiKey(@RequestBody ApiKeyChange change) {
		String key = change.apiKey() == null ? "" : change.apiKey().strip();
		if (!key.isEmpty() && (key.length() < 20 || key.chars().anyMatch(Character::isWhitespace))) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That doesn't look like an API key.");
		}
		SettingsFile.put(API_KEY, key.isEmpty() ? null : key);
		return settings();
	}

	@PostMapping("/restart")
	ResponseEntity<Void> restart() {
		if (!DesktopLauncher.requestRestart()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Restart only works in the installed app.");
		}
		return ResponseEntity.accepted().build();
	}
}

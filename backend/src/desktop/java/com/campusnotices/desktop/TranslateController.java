package com.campusnotices.desktop;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Desktop app only: machine translation of notice text for the English interface. */
@RestController
class TranslateController {

	private static final int MAX_TEXTS = 100;
	private static final int MAX_LENGTH = 30_000;

	private final MachineTranslator translator;

	TranslateController(MachineTranslator translator) {
		this.translator = translator;
	}

	record Request(List<String> texts) {
	}

	record Response(List<String> translations) {
	}

	@PostMapping("/api/desktop/translate")
	Response translate(@RequestBody Request request) {
		List<String> texts = request.texts() == null ? List.of() : request.texts();
		if (texts.size() > MAX_TEXTS || texts.stream().anyMatch(t -> t != null && t.length() > MAX_LENGTH)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too much text in one request.");
		}
		return new Response(translator.translate(texts));
	}
}

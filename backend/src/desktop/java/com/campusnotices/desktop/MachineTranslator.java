package com.campusnotices.desktop;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Korean to English machine translation for the English interface, so notices read in English without a Claude
 * API key. Uses Google Translate's free web endpoint; every result is cached on this PC, so each text is sent once.
 * A text that can't be translated (offline, rate limited) comes back unchanged.
 */
@Component
class MachineTranslator {

	private static final Logger log = LoggerFactory.getLogger(MachineTranslator.class);
	private static final Pattern HANGUL = Pattern.compile("[\\uac00-\\ud7a3\\u3131-\\u318e]");
	private static final String ENDPOINT = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t";
	/** The endpoint takes a few thousand characters per request; longer texts go in paragraph-sized pieces. */
	private static final int CHUNK = 1800;
	private static final Path CACHE_FILE = DesktopLauncher.HOME.resolve("translations.json");

	/**
	 * Windows' own curl. Google answers Java's HTTP client with 429 (it recognises the client, whatever the request
	 * rate), while the same request from curl goes through.
	 */
	private static final Path CURL = Path.of(System.getenv("SystemRoot"), "System32", "curl.exe");
	private static final String STATUS_MARK = "\n#status:";

	private final ExecutorService pool = Executors.newFixedThreadPool(4);
	private final ObjectMapper json = new ObjectMapper();
	private final Map<String, String> cache = new ConcurrentHashMap<>();

	MachineTranslator() {
		if (Files.exists(CACHE_FILE)) {
			try {
				cache.putAll(json.readValue(CACHE_FILE.toFile(), new TypeReference<Map<String, String>>() {}));
			} catch (IOException e) {
				log.warn("Translation cache unreadable, starting empty: {}", e.toString());
			}
		}
	}

	/** Same order as {@code texts}; texts without Korean are returned as they are. */
	List<String> translate(List<String> texts) {
		List<Future<String>> pending = new ArrayList<>();
		for (String text : texts) {
			pending.add(pool.submit(() -> translateOne(text)));
		}
		List<String> out = new ArrayList<>(texts.size());
		boolean added = false;
		for (int i = 0; i < texts.size(); i++) {
			String text = texts.get(i);
			String result;
			try {
				result = pending.get(i).get();
			} catch (Exception e) {
				result = text;
			}
			out.add(result);
			added |= !result.equals(text) && cache.putIfAbsent(text, result) == null;
		}
		if (added) {
			save();
		}
		return out;
	}

	private String translateOne(String text) {
		if (text == null || text.isBlank() || !HANGUL.matcher(text).find()) {
			return text;
		}
		String cached = cache.get(text);
		if (cached != null) {
			return cached;
		}
		StringBuilder out = new StringBuilder();
		for (String chunk : chunks(text)) {
			String translated = google(chunk);
			if (translated == null) {
				return text;
			}
			out.append(translated);
		}
		return out.toString();
	}

	/** Splits at line breaks so no piece is longer than {@link #CHUNK}; keeps the line breaks. */
	private static List<String> chunks(String text) {
		List<String> chunks = new ArrayList<>();
		StringBuilder current = new StringBuilder();
		for (String line : text.split("(?<=\n)")) {
			if (current.length() + line.length() > CHUNK && !current.isEmpty()) {
				chunks.add(current.toString());
				current.setLength(0);
			}
			for (int i = 0; i < line.length(); i += CHUNK) {
				current.append(line, i, Math.min(line.length(), i + CHUNK));
				if (current.length() >= CHUNK) {
					chunks.add(current.toString());
					current.setLength(0);
				}
			}
		}
		if (!current.isEmpty()) {
			chunks.add(current.toString());
		}
		return chunks;
	}

	/** The response is [[["translated", "original", ...], ...], ...]; null when the request fails. */
	private String google(String text) {
		try {
			// the text goes in on stdin (curl url-encodes it), so nothing from a notice ends up on a command line
			Process curl = new ProcessBuilder(CURL.toString(), "-s", "--max-time", "15", "-w", STATUS_MARK + "%{http_code}",
					"-H", "Content-Type: application/x-www-form-urlencoded;charset=UTF-8", "--data-urlencode", "q@-", ENDPOINT)
					.redirectError(ProcessBuilder.Redirect.DISCARD)
					.start();
			try (OutputStream in = curl.getOutputStream()) {
				in.write(text.getBytes(StandardCharsets.UTF_8));
			}
			String output = new String(curl.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
			curl.waitFor();
			int mark = output.lastIndexOf(STATUS_MARK);
			String status = mark < 0 ? "none" : output.substring(mark + STATUS_MARK.length()).strip();
			if (!status.equals("200")) {
				log.warn("Translation failed: HTTP {}", status);
				return null;
			}
			StringBuilder out = new StringBuilder();
			for (JsonNode sentence : json.readTree(output.substring(0, mark)).path(0)) {
				out.append(sentence.path(0).asText(""));
			}
			return out.toString();
		} catch (IOException e) {
			log.warn("Translation failed: {}", e.toString());
			return null;
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			return null;
		}
	}

	private synchronized void save() {
		try {
			json.writeValue(CACHE_FILE.toFile(), cache);
		} catch (IOException e) {
			log.warn("Translation cache not saved: {}", e.toString());
		}
	}
}

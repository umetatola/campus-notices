package com.campusnotices.desktop;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * The user's settings.properties (ANTHROPIC_API_KEY, MAIL_HOST, ...), the same names as the server's .env. Spring
 * reads it at startup, so changes apply after a restart.
 */
final class SettingsFile {

	static final Path PATH = DesktopLauncher.HOME.resolve("settings.properties");

	private SettingsFile() {
	}

	static Properties load() {
		Properties settings = new Properties();
		if (Files.exists(PATH)) {
			try (Reader in = Files.newBufferedReader(PATH)) {
				settings.load(in);
			} catch (IOException e) {
				throw new UncheckedIOException(e);
			}
		}
		return settings;
	}

	/** Sets {@code key}, or removes it when {@code value} is null; other settings are kept. */
	static synchronized void put(String key, String value) {
		Properties settings = load();
		if (value == null) {
			settings.remove(key);
		} else {
			settings.setProperty(key, value);
		}
		try (Writer out = Files.newBufferedWriter(PATH)) {
			settings.store(out, "Campus Notices settings; applied when the app starts");
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}
}

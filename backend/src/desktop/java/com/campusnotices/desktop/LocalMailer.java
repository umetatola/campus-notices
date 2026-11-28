package com.campusnotices.desktop;

import com.campusnotices.mail.Mailer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Email for the desktop app when no SMTP server is set up: a sign-in link is opened straight in the app window
 * (it is the user's own PC), and alert emails become Windows notifications (also saved as HTML files in the outbox
 * folder).
 */
@Component
@Primary
@ConditionalOnProperty("desktop.local-mail")
class LocalMailer implements Mailer {

	private static final Logger log = LoggerFactory.getLogger(LocalMailer.class);
	private static final Pattern SIGN_IN_LINK = Pattern.compile("https?://\\S+/auth/verify\\?token=\\S+");
	private static final Pattern NOTICE_LINK = Pattern.compile("https?://\\S+/notices/\\d+");
	private static final int TITLES_SHOWN = 3;

	@Override
	public void send(Email email) {
		try {
			Matcher link = SIGN_IN_LINK.matcher(email.text());
			if (link.find()) {
				DesktopLauncher.openWindow(link.group());
				return;
			}
			Path outbox = Files.createDirectories(DesktopLauncher.HOME.resolve("outbox"));
			Path file = outbox.resolve(System.currentTimeMillis() + ".html");
			Files.writeString(file, email.html());
			log.info("Email \"{}\" saved to {}", email.subject(), file);
			Tray tray = DesktopLauncher.tray();
			if (tray != null) {
				notifyAbout(tray, email);
			}
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/**
	 * Alert emails list each notice as "- title" followed by its link; the notification shows the first titles, and
	 * a click opens the notice (or the list, when there are several).
	 */
	static void notifyAbout(Tray tray, Email email) {
		List<String> titles = email.text().lines().filter(l -> l.startsWith("- ")).map(l -> l.substring(2)).toList();
		List<String> links = NOTICE_LINK.matcher(email.text()).results().map(m -> m.group()).toList();
		String message = String.join("\n", titles.subList(0, Math.min(TITLES_SHOWN, titles.size())));
		if (titles.size() > TITLES_SHOWN) {
			message += "\n+" + (titles.size() - TITLES_SHOWN) + " more";
		}
		String open = links.size() == 1 ? links.getFirst() : links.isEmpty() ? null : appHome(links.getFirst());
		tray.notify(email.subject(), message, open);
	}

	private static String appHome(String noticeLink) {
		return noticeLink.substring(0, noticeLink.indexOf("/notices/") + 1);
	}
}

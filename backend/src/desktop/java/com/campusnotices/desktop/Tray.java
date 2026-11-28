package com.campusnotices.desktop;

import java.awt.AWTException;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.MenuItem;
import java.awt.PopupMenu;
import java.awt.SystemTray;
import java.awt.TrayIcon;
import java.awt.image.BaseMultiResolutionImage;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URL;
import java.util.Objects;
import java.util.stream.IntStream;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The app's icon in the Windows notification area: open a window, quit, and Windows notifications for keyword
 * alerts. Clicking a notification opens the notice it is about.
 */
final class Tray {

	private static final Logger log = LoggerFactory.getLogger(Tray.class);

	private final TrayIcon icon;
	private final String appUrl;
	/** Where a click on the icon or the latest notification leads; the app's front page once used. */
	private volatile String clickTarget;

	private Tray(TrayIcon icon, String appUrl) {
		this.icon = icon;
		this.appUrl = appUrl;
		this.clickTarget = appUrl;
	}

	/** Null when Windows offers no notification area (then the app simply runs without one). */
	static Tray show(String appUrl, Runnable quit) {
		if (!SystemTray.isSupported()) {
			return null;
		}
		Image image;
		try {
			image = iconImage();
		} catch (IOException e) {
			log.warn("No tray icon: {}", e.toString());
			return null;
		}
		PopupMenu menu = new PopupMenu();
		TrayIcon icon = new TrayIcon(image, "Campus Notices", menu);
		Tray tray = new Tray(icon, appUrl);

		MenuItem open = new MenuItem("Open Campus Notices");
		open.addActionListener(e -> tray.open(appUrl));
		MenuItem exit = new MenuItem("Quit");
		exit.addActionListener(e -> quit.run());
		menu.add(open);
		menu.addSeparator();
		menu.add(exit);
		// a double-click on the icon, or a click on a notification
		icon.addActionListener(e -> {
			String target = tray.clickTarget;
			tray.clickTarget = tray.appUrl;
			tray.open(target);
		});
		try {
			SystemTray.getSystemTray().add(icon);
			return tray;
		} catch (AWTException e) {
			log.warn("No tray icon: {}", e.toString());
			return null;
		}
	}

	/**
	 * The app icon at the sizes Windows uses for tray icons and notifications (16 to 64 px, by display scaling).
	 * Letting AWT shrink the 192 px icon itself gives a blotchy result, so each size is scaled down in halving steps.
	 */
	private static Image iconImage() throws IOException {
		URL png = Objects.requireNonNull(Tray.class.getResource("/static/icon-192.png"), "tray icon");
		BufferedImage source = ImageIO.read(png);
		Image[] sizes = IntStream.of(16, 20, 24, 32, 40, 48, 64).mapToObj(px -> scaled(source, px)).toArray(Image[]::new);
		return new BaseMultiResolutionImage(sizes);
	}

	private static BufferedImage scaled(BufferedImage source, int size) {
		BufferedImage current = source;
		int width = source.getWidth();
		do {
			width = Math.max(size, width / 2);
			BufferedImage next = new BufferedImage(width, width, BufferedImage.TYPE_INT_ARGB);
			Graphics2D g = next.createGraphics();
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
			g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
			g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
			g.drawImage(current, 0, 0, width, width, null);
			g.dispose();
			current = next;
		} while (width > size);
		return current;
	}

	/** {@code openUrl} is where a click on the notification leads; null for the app's front page. */
	void notify(String title, String message, String openUrl) {
		clickTarget = openUrl != null ? openUrl : appUrl;
		icon.displayMessage(title, message, TrayIcon.MessageType.INFO);
	}

	void remove() {
		SystemTray.getSystemTray().remove(icon);
	}

	private void open(String url) {
		try {
			DesktopLauncher.openWindow(url);
		} catch (IOException e) {
			log.warn("Could not open a window: {}", e.toString());
		}
	}
}

package com.campusnotices.desktop;

import com.campusnotices.BackendApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Windows desktop app: starts a private PostgreSQL and the normal server on this PC, shows the site in its own
 * window, and shuts both down when the window is closed. Everything lives in %LOCALAPPDATA%\CampusNotices.
 */
public final class DesktopLauncher {

	static final Path HOME = Path.of(System.getenv("LOCALAPPDATA"), "CampusNotices");
	/** Port of the running app. A fixed port can be refused by Windows, so each start takes a free one. */
	private static final Path PORT_FILE = HOME.resolve("port");
	/** Shown at once while the server starts; it switches to the app when the server answers. */
	private static final Path STARTING_PAGE = HOME.resolve("starting.html");
	/** Held for the life of the app so a second launch can tell a copy is already running or starting. */
	private static FileLock instanceLock;
	/** The launcher .exe, set by jpackage; null when run from a development classpath. */
	private static final String APP_EXE = System.getProperty("jpackage.app-path");
	private static final String RESTART_ARG = "--restart-on-port=";
	private static volatile boolean restartRequested;
	private static volatile boolean quitRequested;
	static final String KEEP_RUNNING = "KEEP_RUNNING_IN_TRAY";
	/** Keep the server (crawling and alerts) running in the tray after the last window is closed. */
	private static volatile boolean keepRunning;
	private static volatile Tray tray;

	public static void main(String[] args) throws Exception {
		Files.createDirectories(HOME);
		instanceLock = FileChannel.open(HOME.resolve("instance.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE)
				.tryLock();
		if (instanceLock == null) {
			// another copy is running or starting; its starting page leads to it either way
			openWindow(STARTING_PAGE.toUri().toString());
			return;
		}
		// after a restart the open windows reload the same address, so take the old port again if it is still free
		int previousPort = Arrays.stream(args).filter(a -> a.startsWith(RESTART_ARG))
				.mapToInt(a -> Integer.parseInt(a.substring(RESTART_ARG.length()))).findFirst().orElse(0);
		int port = freePort(previousPort);
		String baseUrl = "http://localhost:" + port;
		Files.writeString(STARTING_PAGE, StartingPage.waiting(baseUrl + "/"));
		if (port != previousPort) {
			openWindow(STARTING_PAGE.toUri().toString());
		}

		EmbeddedPostgres db = null;
		ConfigurableApplicationContext app;
		try {
			db = startDatabase();
			app = startServer(db, port, baseUrl);
		} catch (Throwable e) {
			// the details are in the log file; without an exit, leftover worker threads keep a dead app running
			Files.writeString(STARTING_PAGE, StartingPage.failed(HOME.resolve("logs").toString()));
			if (db != null) {
				db.close();
			}
			System.exit(1);
			return;
		}

		keepRunning = Boolean.parseBoolean(SettingsFile.load().getProperty(KEEP_RUNNING));
		tray = Tray.show(baseUrl + "/", DesktopLauncher::quit);
		Files.writeString(PORT_FILE, String.valueOf(port));
		waitForWindowsClosedRestartOrQuit(baseUrl + "/");
		if (tray != null) {
			tray.remove();
		}
		app.close();
		db.close();
		if (restartRequested) {
			// the new copy needs the lock and the database folder, so both are free before it starts
			instanceLock.release();
			new ProcessBuilder(APP_EXE, RESTART_ARG + port).start();
		}
		System.exit(0);
	}

	/**
	 * Asks the app to stop and start again (to apply new settings). The windows stay open and reload once the new
	 * server answers. False when not running as the installed app.
	 */
	static boolean requestRestart() {
		if (APP_EXE == null) {
			return false;
		}
		restartRequested = true;
		return true;
	}

	static Tray tray() {
		return tray;
	}

	/** Running in the tray after the windows close needs a tray to quit from. */
	static boolean backgroundAvailable() {
		return tray != null;
	}

	static boolean keepRunning() {
		return keepRunning;
	}

	static void setKeepRunning(boolean enabled) {
		SettingsFile.put(KEEP_RUNNING, enabled ? "true" : null);
		keepRunning = enabled;
	}

	/** From the tray menu: close the app's windows and stop, also when it runs in the background. */
	private static void quit() {
		quitRequested = true;
		closeWindows();
	}

	/** Ends the Edge processes of the app's own profile; the user's normal Edge is not touched. */
	private static void closeWindows() {
		String profile = HOME.resolve("window").toString().replace("'", "''");
		try {
			new ProcessBuilder("powershell.exe", "-NoProfile", "-Command",
					"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and "
							+ "$_.CommandLine.Contains('" + profile + "') } | ForEach-Object { "
							+ "Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }")
					.inheritIO().start();
		} catch (IOException e) {
			// the server still stops; the windows then show that it is gone
		}
	}

	/** {@code wanted} when it can be bound, otherwise any free port. */
	private static int freePort(int wanted) throws IOException {
		if (wanted > 0) {
			try (ServerSocket socket = new ServerSocket(wanted, 0, InetAddress.getLoopbackAddress())) {
				return wanted;
			} catch (IOException taken) {
				// fall through to a fresh port; the new window finds it through the starting page
			}
		}
		try (ServerSocket socket = new ServerSocket(0, 0, InetAddress.getLoopbackAddress())) {
			return socket.getLocalPort();
		}
	}

	private static EmbeddedPostgres startDatabase() throws IOException {
		return EmbeddedPostgres.builder()
				.setDataDirectory(HOME.resolve("pgdata"))
				.setCleanDataDirectory(false)
				.setOverrideWorkingDirectory(HOME.resolve("postgres").toFile())
				.start();
	}

	private static ConfigurableApplicationContext startServer(EmbeddedPostgres db, int port, String baseUrl) {
		Properties user = SettingsFile.load();

		// system properties outrank application.yml, which would otherwise point at localhost:5432
		Map.of(
				"spring.datasource.url", db.getJdbcUrl("postgres", "postgres"),
				"spring.datasource.username", "postgres",
				"spring.datasource.password", "",
				"spring.config.additional-location", "optional:file:" + SettingsFile.PATH.toString().replace('\\', '/'),
				"server.address", "127.0.0.1",
				"server.port", String.valueOf(port),
				"app.base-url", baseUrl,
				"logging.file.name", HOME.resolve("logs").resolve("campus-notices.log").toString(),
				// closing the window shouldn't wait 30 s for a crawl in progress; the next run picks it up
				"spring.lifecycle.timeout-per-shutdown-phase", "5s",
				// without an SMTP server configured, emails are handled on this PC (see LocalMailer)
				"desktop.local-mail", String.valueOf(!user.containsKey("MAIL_HOST")))
				.forEach(System::setProperty);

		// the tray icon and notifications need AWT, which Spring Boot turns off by default
		return new SpringApplicationBuilder(BackendApplication.class).headless(false).run();
	}

	/**
	 * Edge often hands a new window to another of its processes and exits at once, so the launched process says
	 * nothing. Instead watch the profile's lockfile: Edge holds it open while any window of this profile is open.
	 */
	private static void waitForWindowsClosedRestartOrQuit(String appUrl) throws InterruptedException {
		Path lock = HOME.resolve("window").resolve("lockfile");
		for (int i = 0; i < 30 && !Files.exists(lock); i++) {
			Thread.sleep(1000);
		}
		boolean toldStillRunning = false;
		while (!restartRequested && !quitRequested) {
			if (windowsClosed(lock)) {
				if (!keepRunning || tray == null) {
					return;
				}
				if (!toldStillRunning) {
					tray.notify("Campus Notices is still running",
							"New notices and keyword alerts keep coming in. Quit from the tray icon.", appUrl);
					toldStillRunning = true;
				}
			} else {
				toldStillRunning = false;
			}
			Thread.sleep(2000);
		}
	}

	private static boolean windowsClosed(Path lock) {
		try {
			Files.deleteIfExists(lock);
			return true;
		} catch (IOException stillOpen) {
			return false;
		}
	}

	/**
	 * Opens {@code url} as an app window (Microsoft Edge app mode with its own profile, so the session cookie stays
	 * between runs). The returned process ends when the last app window is closed.
	 */
	static Process openWindow(String url) throws IOException {
		return new ProcessBuilder(List.of(edge().toString(), "--app=" + url,
				"--user-data-dir=" + HOME.resolve("window"), "--no-first-run", "--no-default-browser-check",
				// no extensions or sync: the profile is only for this app, and a synced extension's welcome tab
				// would open a stray browser window (and keep the profile, and so the app, running)
				"--disable-extensions", "--disable-sync", "--hide-crash-restore-bubble",
				"--disable-background-mode", "--window-size=1200,860")).start();
	}

	private static Path edge() {
		for (String root : new String[] {System.getenv("ProgramFiles(x86)"), System.getenv("ProgramFiles")}) {
			if (root != null) {
				Path exe = Path.of(root, "Microsoft", "Edge", "Application", "msedge.exe");
				if (Files.exists(exe)) {
					return exe;
				}
			}
		}
		throw new IllegalStateException("Microsoft Edge was not found; the app window needs it.");
	}
}

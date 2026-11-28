package com.campusnotices.desktop;

/**
 * The page the app window shows while the server starts (a local file, so it appears at once). It checks the server
 * every second and switches to the app as soon as it answers. Every few checks it reloads itself, so it picks up
 * the failure version if the launcher replaces the file after a failed start.
 */
final class StartingPage {

	private static final String STYLE = """
			<style>
			  :root { color-scheme: light dark; --bg: #f5f7f9; --ink: #16202c; --muted: #6e7887; --line: #e2e6eb;
			    --accent: #0e6b63; --due: #b42318; }
			  @media (prefers-color-scheme: dark) { :root { --bg: #0f141a; --ink: #e7ecf2; --muted: #8591a0;
			    --line: #26303b; --accent: #56bfb2; --due: #f7907f; } }
			  body { margin: 0; height: 100vh; display: grid; place-items: center; background: var(--bg);
			    color: var(--ink); font-family: 'Segoe UI', 'Malgun Gothic', system-ui, sans-serif; text-align: center; }
			  h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
			  p { color: var(--muted); margin: 4px 0; }
			  code { font-size: 13px; }
			  .spinner { width: 36px; height: 36px; margin: 0 auto 20px; border-radius: 50%;
			    border: 3px solid var(--line); border-top-color: var(--accent); animation: spin .9s linear infinite; }
			  .failed { width: 36px; height: 36px; margin: 0 auto 20px; border-radius: 50%; background: var(--due);
			    color: var(--bg); font: 600 22px/36px system-ui; }
			  @keyframes spin { to { transform: rotate(360deg); } }
			</style>
			""";

	private StartingPage() {
	}

	static String waiting(String appUrl) {
		return page("Starting Campus Notices…", """
				<div class="spinner" aria-hidden="true"></div>
				<h1>Starting Campus Notices…</h1>
				<p>This takes about half a minute.</p>
				<p lang="ko">캠퍼스 공지를 시작하는 중입니다. 30초쯤 걸립니다.</p>
				<script>
				  const app = '%s';
				  let checks = 0;
				  async function check() {
				    try {
				      await fetch(app + 'actuator/health', { mode: 'no-cors', cache: 'no-store' });
				      location.replace(app);
				    } catch {
				      if (++checks %% 5 === 0) location.reload();
				      else setTimeout(check, 1000);
				    }
				  }
				  check();
				</script>
				""".formatted(appUrl));
	}

	static String failed(String logFolder) {
		return page("Campus Notices couldn't start", """
				<div class="failed" aria-hidden="true">!</div>
				<h1>Campus Notices couldn't start</h1>
				<p>Close this window and open the app again. If it keeps happening, the log explains why:</p>
				<p><code>%s</code></p>
				<p lang="ko">캠퍼스 공지를 시작하지 못했습니다. 창을 닫고 다시 열어 보세요.</p>
				""".formatted(logFolder.replace("&", "&amp;").replace("<", "&lt;")));
	}

	private static String page(String title, String body) {
		return """
				<!doctype html>
				<html lang="en">
				<head><meta charset="utf-8"><title>%s</title>%s</head>
				<body><main>%s</main></body>
				</html>
				""".formatted(title, STYLE, body);
	}
}

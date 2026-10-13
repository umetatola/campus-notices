package com.campusnotices;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.crawler.NoticeCrawler;
import com.campusnotices.crawler.NoticeWriter;
import com.campusnotices.crawler.PageFetcher;
import com.campusnotices.notice.Notice;
import com.campusnotices.notice.ScrapedNotice;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.summary.SummaryQueue;
import com.campusnotices.summary.SummaryStatus;
import com.campusnotices.summary.SummaryWorker;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Crawls saved Ajou pages into a real PostgreSQL (Flyway migrations included) and reads them back
 * over HTTP. Skipped when Docker is not available.
 */
@SpringBootTest(properties = {"crawler.enabled=false", "summarizer.provider=stub", "summarizer.initial-delay=PT1H"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class CrawlAndApiIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

	@Autowired
	NoticeCrawler crawler;

	@Autowired
	NoticeRepository notices;

	@Autowired
	MockMvcTester mvc;

	@Autowired
	SummaryQueue queue;

	@Autowired
	SummaryWorker worker;

	@Autowired
	NoticeWriter writer;

	@Autowired
	JdbcClient jdbc;

	@Test
	void crawlsOnceThenStopsAtKnownNotices() throws Exception {
		// crawler.enabled=false here, so nothing counts as delayed; before any crawl there is no time yet
		assertThat(mvc.get().uri("/api/status")).hasStatusOk().bodyJson()
				.hasPathSatisfying("$.updatesDelayed", v -> v.assertThat().isEqualTo(false));

		NoticeCrawler.Result first = crawler.run();
		assertThat(mvc.get().uri("/api/status")).hasStatusOk().bodyJson()
				.hasPathSatisfying("$.lastUpdatedAt", v -> v.assertThat().isNotNull());
		assertThat(first.noticesSaved()).isEqualTo(19);
		assertThat(first.failures()).isZero();
		assertThat(notices.count()).isEqualTo(19);

		NoticeCrawler.Result second = crawler.run();
		assertThat(second.pagesRead()).isEqualTo(1);
		assertThat(second.noticesSaved()).isZero();

		assertThat(mvc.get().uri("/api/notices?size=5")).hasStatusOk()
				.bodyJson()
				.hasPathSatisfying("$.totalItems", v -> v.assertThat().isEqualTo(19))
				.hasPathSatisfying("$.items.length()", v -> v.assertThat().isEqualTo(5));

		assertThat(mvc.get().uri("/api/notices?q=AutoLand")).hasStatusOk()
				.bodyJson()
				.hasPathSatisfying("$.items[0].title", v -> v.assertThat().asString().contains("기아 AutoLand"));

		assertThat(mvc.get().uri("/api/notices/categories")).hasStatusOk()
				.bodyJson().hasPathSatisfying("$", v -> v.assertThat().asArray().contains("학사"));

		assertThat(mvc.get().uri("/api/notices/999999")).hasStatus(404);

		assertThat(mvc.get().uri("/api/notices/feed.xml?q=AutoLand")).hasStatusOk()
				.hasContentTypeCompatibleWith("application/atom+xml")
				.bodyText().contains("<feed xmlns=\"http://www.w3.org/2005/Atom\">").contains("기아 AutoLand")
				.contains("feed.xml?q=AutoLand");

		// every stored notice was queued exactly once, and nothing is summarized yet
		assertThat(queue.countByStatus(SummaryStatus.PENDING)).isEqualTo(19);
		long id = notices.findAll().getFirst().getId();
		assertThat(mvc.get().uri("/api/notices/" + id)).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.summary.status", v -> v.assertThat().isEqualTo("PENDING"));

		// the worker takes small batches until the queue is empty
		int runs = 0;
		while (worker.runOnce().claimed() > 0) {
			runs++;
		}
		assertThat(runs).isEqualTo(4);   // 19 notices, 5 per batch
		assertThat(queue.countByStatus(SummaryStatus.DONE)).isEqualTo(19);

		assertThat(mvc.get().uri("/api/notices/" + id)).hasStatusOk()
				.bodyJson()
				.hasPathSatisfying("$.summary.status", v -> v.assertThat().isEqualTo("DONE"))
				.hasPathSatisfying("$.summary.titleEn", v -> v.assertThat().asString().startsWith("[Stub] "));
		// stub summaries have no deadline, so there is no calendar file
		assertThat(mvc.get().uri("/api/notices/" + id + "/calendar.ics")).hasStatus(404);
		assertThat(mvc.get().uri("/api/notices?size=1")).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.items[0].titleEn", v -> v.assertThat().asString().startsWith("[Stub] "));
		// search also looks at the English text
		assertThat(mvc.get().uri("/api/notices?q={q}", "stub summary")).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.totalItems", v -> v.assertThat().isEqualTo(19));

		// a recent notice edited on the site: the recheck fetches it again, marks it edited and re-queues the summary
		Notice recent = writer.save("ajou-main", new ScrapedNotice("900001", "학사", "Recent notice", "학사팀",
				LocalDate.now(ZoneId.of("Asia/Seoul")), "https://www.ajou.ac.kr/900001", false, "<p>v1</p>", "v1",
				List.of()));
		assertThat(recent.getEditedAt()).isNull();
		assertThat(crawler.recheckRecent()).isZero(); // just checked, not due yet
		jdbc.sql("update notices set checked_at = now() - interval '7 hours' where id = ?").param(recent.getId()).update();
		FixturePages.PAGES.put("900001", "<p class=\"b-title-box\"><span class=\"b-title\">Recent notice</span></p>"
				+ "<div class=\"b-content-box\"><div class=\"fr-view\"><p>v2: the room changed</p></div></div>");
		assertThat(crawler.recheckRecent()).isEqualTo(1);
		assertThat(crawler.recheckRecent()).isZero(); // checked again just now
		assertThat(mvc.get().uri("/api/notices/" + recent.getId())).hasStatusOk().bodyJson()
				.hasPathSatisfying("$.editedAt", v -> v.assertThat().isNotNull())
				.hasPathSatisfying("$.bodyText", v -> v.assertThat().asString().contains("the room changed"))
				.hasPathSatisfying("$.summary.status", v -> v.assertThat().isEqualTo("PENDING"));
		assertThat(mvc.get().uri("/api/notices?q=Recent")).hasStatusOk().bodyJson()
				.hasPathSatisfying("$.items[0].editedAt", v -> v.assertThat().isNotNull());
		// old notices are never rechecked, and unedited ones have no editedAt
		assertThat(mvc.get().uri("/api/notices/" + id)).hasStatusOk().bodyJson()
				.hasPathSatisfying("$.editedAt", v -> v.assertThat().isNull());

		// upcoming deadlines: due today up to N days ahead, soonest first; past ones and later ones are left out
		LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
		List<Long> ids = notices.findAll().stream().map(Notice::getId).sorted().limit(4).toList();
		LocalDate[] due = {today.plusDays(20), today.plusDays(3), today.minusDays(1), today};
		for (int i = 0; i < ids.size(); i++) {
			jdbc.sql("update notice_summaries set deadline = ? where notice_id = ?").params(due[i], ids.get(i)).update();
		}
		assertThat(mvc.get().uri("/api/notices/deadlines")).hasStatusOk().bodyJson()
				.hasPathSatisfying("$[*].id", v -> v.assertThat().asArray()
						.containsExactly(ids.get(3).intValue(), ids.get(1).intValue()));
		assertThat(mvc.get().uri("/api/notices/deadlines?days=30")).hasStatusOk().bodyJson()
				.hasPathSatisfying("$[*].deadline", v -> v.assertThat().asArray()
						.containsExactly(today.toString(), today.plusDays(3).toString(), today.plusDays(20).toString()));
	}

	@Test
	void exposesPrometheusMetrics() {
		assertThat(mvc.get().uri("/actuator/prometheus")).hasStatusOk()
				.bodyText()
				.contains("campus_notices_crawl_runs_total{outcome=\"ok\"}")
				.contains("campus_notices_summaries_total{outcome=\"done\"}")
				.contains("campus_notices_alert_emails_total{outcome=\"sent\"}")
				.contains("campus_notices_summaries_pending");
	}

	@Test
	void sendsSecurityHeaders() {
		var response = mvc.get().uri("/api/status").exchange();
		assertThat(response).hasStatusOk();
		assertThat(response.getResponse().getHeader("Content-Security-Policy"))
				.contains("script-src 'self'").contains("frame-ancestors 'none'").contains("object-src 'none'");
		assertThat(response.getResponse().getHeader("X-Frame-Options")).isEqualTo("DENY");
		assertThat(response.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
		assertThat(response.getResponse().getHeader("Referrer-Policy")).isEqualTo("strict-origin-when-cross-origin");
		assertThat(response.getResponse().getHeader("Permissions-Policy")).contains("camera=()");
	}

	@Test
	void publishesApiDocsWithoutSignIn() {
		assertThat(mvc.get().uri("/api/openapi")).hasStatusOk()
				.bodyJson()
				.hasPathSatisfying("$.info.title", v -> v.assertThat().isEqualTo("Campus Notices API"))
				.hasPathSatisfying("$.paths['/api/notices'].get", v -> v.assertThat().isNotNull())
				.hasPathSatisfying("$.paths['/api/subscriptions']", v -> v.assertThat().isNotNull());
		// the docs page itself redirects to the bundled Swagger UI
		assertThat(mvc.get().uri("/api/docs")).hasStatus3xxRedirection();
	}

	/** Serves the saved list page, an empty second page, and detail pages (saved ones where we have them). */
	@TestConfiguration
	static class FixturePages {

		/** Detail pages a test can add or change; they win over the saved fixtures. */
		static final Map<String, String> PAGES = new ConcurrentHashMap<>();

		private static final Pattern ARTICLE = Pattern.compile("articleNo=(\\d+)");

		@Bean
		@Primary
		PageFetcher fixtureFetcher() {
			return uri -> {
				String query = uri.getQuery();
				if (query.contains("mode=list")) {
					return query.contains("article.offset=0") ? read("list-page0.html") : "<table><tbody></tbody></table>";
				}
				Matcher m = ARTICLE.matcher(query);
				m.find();
				String id = m.group(1);
				if (PAGES.containsKey(id)) {
					return PAGES.get(id);
				}
				String saved = read("detail-" + id + ".html");
				return saved != null ? saved
						: "<p class=\"b-title-box\"><span class=\"b-title\">Notice " + id + "</span></p>"
								+ "<div class=\"b-content-box\"><div class=\"fr-view\"><p>Body of " + id + "</p></div></div>";
			};
		}

		private static String read(String name) throws IOException {
			try (InputStream in = FixturePages.class.getResourceAsStream("/fixtures/ajou/" + name)) {
				return in == null ? null : new String(in.readAllBytes(), StandardCharsets.UTF_8);
			}
		}
	}
}

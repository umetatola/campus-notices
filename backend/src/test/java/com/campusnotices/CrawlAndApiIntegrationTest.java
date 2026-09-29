package com.campusnotices;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.crawler.NoticeCrawler;
import com.campusnotices.crawler.PageFetcher;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.summary.SummaryQueue;
import com.campusnotices.summary.SummaryStatus;
import com.campusnotices.summary.SummaryWorker;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
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

	@Test
	void crawlsOnceThenStopsAtKnownNotices() throws Exception {
		NoticeCrawler.Result first = crawler.run();
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
		assertThat(mvc.get().uri("/api/notices?size=1")).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.items[0].titleEn", v -> v.assertThat().asString().startsWith("[Stub] "));
		// search also looks at the English text
		assertThat(mvc.get().uri("/api/notices?q={q}", "stub summary")).hasStatusOk()
				.bodyJson().hasPathSatisfying("$.totalItems", v -> v.assertThat().isEqualTo(19));
	}

	/** Serves the saved list page, an empty second page, and detail pages (saved ones where we have them). */
	@TestConfiguration
	static class FixturePages {

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

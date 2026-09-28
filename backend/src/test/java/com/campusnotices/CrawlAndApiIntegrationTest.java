package com.campusnotices;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.crawler.NoticeCrawler;
import com.campusnotices.crawler.PageFetcher;
import com.campusnotices.notice.NoticeRepository;
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
@SpringBootTest(properties = "crawler.enabled=false")
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

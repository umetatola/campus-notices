package com.campusnotices.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.campusnotices.Metrics;
import com.campusnotices.crawler.AjouNoticeParser.Detail;
import com.campusnotices.crawler.AjouNoticeParser.ListEntry;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.notice.ScrapedNotice;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** The list walk: when it pages on, when it stops, and how failures and pinned notices are counted. */
class NoticeCrawlerTest {

	private static final LocalDate DAY = LocalDate.of(2026, 10, 10);

	private final AjouNoticeParser parser = mock(AjouNoticeParser.class);
	private final NoticeRepository notices = mock(NoticeRepository.class);
	private final NoticeWriter writer = mock(NoticeWriter.class);
	private final CrawlStatus status = mock(CrawlStatus.class);
	private final List<URI> fetched = new ArrayList<>();
	private final Set<String> known = new HashSet<>();
	private final Set<String> broken = new HashSet<>();
	private NoticeCrawler crawler;

	@BeforeEach
	void setUp() {
		CrawlerProperties props = new CrawlerProperties(true, URI.create("https://www.ajou.ac.kr/kr/ajou/notice.do"),
				"ajou-main", Duration.ofMinutes(15), 7, Duration.ofHours(6), 10, Duration.ofSeconds(10),
				Duration.ZERO, 3, "test");
		// the "page" is just its URL, so the parser mock can answer by query string
		PageFetcher fetcher = uri -> {
			fetched.add(uri);
			for (String id : broken) {
				if (uri.getQuery().contains("articleNo=" + id)) {
					throw new IOException("timeout");
				}
			}
			return uri.toString();
		};
		when(notices.findKnownArticleIds(eq("ajou-main"), any())).thenAnswer(inv -> {
			Set<String> ids = new HashSet<>(inv.getArgument(1));
			ids.retainAll(known);
			return ids;
		});
		// saved notices become known, as they would in the database
		when(writer.save(eq("ajou-main"), any())).thenAnswer(inv -> {
			known.add(inv.<ScrapedNotice>getArgument(1).sourceArticleId());
			return null;
		});
		when(parser.parseList(anyString())).thenReturn(List.of());
		when(parser.parseDetail(anyString(), anyString()))
				.thenReturn(new Detail(null, null, null, "<p>body</p>", "body", List.of()));
		crawler = new NoticeCrawler(props, fetcher, parser, notices, writer, status, mock(Metrics.class));
	}

	private void page(int n, ListEntry... entries) {
		when(parser.parseList(contains("article.offset=" + n * 10 + "&"))).thenReturn(List.of(entries));
	}

	private static ListEntry entry(String id, boolean pinned) {
		return new ListEntry(id, "학사", "Notice " + id, "학사팀", DAY, pinned);
	}

	@Test
	void pagesOnWhileThereAreNewNoticesAndStopsAtAPageOfKnownOnes() throws Exception {
		page(0, entry("p1", true), entry("5", false), entry("4", false));
		page(1, entry("p1", true), entry("3", false), entry("2", false));
		page(2, entry("p1", true), entry("1", false));
		known.addAll(Set.of("3", "2", "1"));

		NoticeCrawler.Result r = crawler.run();

		assertThat(r.pagesRead()).isEqualTo(2);
		assertThat(r.noticesSaved()).isEqualTo(3);   // p1 (once), 5, 4
		assertThat(r.failures()).isZero();
		verify(status).recordSuccess();
	}

	@Test
	void aNewPinnedNoticeAloneDoesNotKeepPaging() throws Exception {
		page(0, entry("p9", true), entry("5", false));
		page(1, entry("4", false));
		known.add("5");

		NoticeCrawler.Result r = crawler.run();

		assertThat(r.pagesRead()).isEqualTo(1);
		assertThat(r.noticesSaved()).isEqualTo(1);
	}

	@Test
	void stopsAtTheLastListPageAndAtMaxPages() throws Exception {
		assertThat(crawler.run().pagesRead()).isEqualTo(1);   // first page empty

		page(0, entry("9", false));
		page(1, entry("8", false));
		page(2, entry("7", false));
		page(3, entry("6", false));
		NoticeCrawler.Result r = crawler.run();
		assertThat(r.pagesRead()).isEqualTo(3);   // max-pages
		assertThat(fetched).noneMatch(u -> u.getQuery().contains("articleNo=6"));
	}

	@Test
	void aNoticeThatFailsIsCountedAndTheRestAreStillSaved() throws Exception {
		page(0, entry("5", false), entry("4", false));
		broken.add("5");

		NoticeCrawler.Result r = crawler.run();

		assertThat(r.failures()).isEqualTo(1);
		assertThat(r.noticesSaved()).isEqualTo(1);
		verify(writer, never()).save(eq("ajou-main"), org.mockito.ArgumentMatchers.argThat(s -> s.sourceArticleId().equals("5")));
	}

	@Test
	void fallsBackToListValuesWhenTheDetailPageLacksThem() throws Exception {
		page(0, entry("5", false));
		known.add("x");

		crawler.run();

		ArgumentCaptor<ScrapedNotice> saved = ArgumentCaptor.forClass(ScrapedNotice.class);
		verify(writer).save(eq("ajou-main"), saved.capture());
		assertThat(saved.getValue().title()).isEqualTo("Notice 5");
		assertThat(saved.getValue().department()).isEqualTo("학사팀");
		assertThat(saved.getValue().postedOn()).isEqualTo(DAY);
		assertThat(saved.getValue().url()).isEqualTo("https://www.ajou.ac.kr/kr/ajou/notice.do?mode=view&articleNo=5");
	}
}

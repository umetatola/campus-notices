package com.campusnotices.crawler;

import com.campusnotices.crawler.AjouNoticeParser.Detail;
import com.campusnotices.crawler.AjouNoticeParser.ListEntry;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.notice.ScrapedNotice;
import com.campusnotices.notice.Notice;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Walks the notice list newest-first and stores every notice it has not seen before.
 * Stops at the first page with no new regular (non-pinned) notices, so a normal run
 * costs one list request plus one request per new notice.
 */
@Component
public class NoticeCrawler {

	private static final Logger log = LoggerFactory.getLogger(NoticeCrawler.class);
	private static final int PAGE_SIZE = 10;
	private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

	public record Result(int pagesRead, int noticesSaved, int failures) {
	}

	private final CrawlerProperties props;
	private final PageFetcher fetcher;
	private final AjouNoticeParser parser;
	private final NoticeRepository notices;
	private final NoticeWriter writer;
	private final CrawlStatus status;

	public NoticeCrawler(CrawlerProperties props, PageFetcher fetcher, AjouNoticeParser parser,
			NoticeRepository notices, NoticeWriter writer, CrawlStatus status) {
		this.props = props;
		this.fetcher = fetcher;
		this.parser = parser;
		this.notices = notices;
		this.writer = writer;
		this.status = status;
	}

	@Scheduled(fixedDelayString = "${crawler.interval}", initialDelayString = "${crawler.initial-delay}")
	public void scheduledRun() {
		if (!props.enabled()) {
			return;
		}
		try {
			Result r = run();
			log.info("Crawl finished: {} pages read, {} notices saved, {} failures",
					r.pagesRead(), r.noticesSaved(), r.failures());
			int edited = recheckRecent();
			if (edited > 0) {
				log.info("Recheck found {} edited notices", edited);
			}
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		} catch (Exception e) {
			log.warn("Crawl failed: {}", e.toString());
			status.recordFailure(e);
		}
	}

	public Result run() throws Exception {
		int pages = 0;
		int saved = 0;
		int failures = 0;
		for (int page = 0; page < props.maxPages(); page++) {
			List<ListEntry> entries = parser.parseList(fetcher.get(listPage(page)));
			pages++;
			if (entries.isEmpty()) {
				break;
			}
			Set<String> known = new HashSet<>(notices.findKnownArticleIds(props.source(),
					entries.stream().map(ListEntry::articleId).collect(Collectors.toSet())));
			boolean newRegularNotice = false;
			for (ListEntry entry : entries) {
				if (known.contains(entry.articleId())) {
					continue;
				}
				if (!entry.pinned()) {
					newRegularNotice = true;
				}
				try {
					writer.save(props.source(), fetchNotice(entry));
					known.add(entry.articleId());   // pinned notices repeat on every page
					saved++;
				} catch (InterruptedException e) {
					throw e;
				} catch (Exception e) {
					failures++;
					log.warn("Could not store notice {}: {}", entry.articleId(), e.toString());
				}
			}
			if (!newRegularNotice) {
				break;
			}
		}
		status.recordSuccess();
		return new Result(pages, saved, failures);
	}

	/**
	 * Re-fetches a few recent notices (posted in the last {@code recheck-days}, each at most every
	 * {@code recheck-every}) so edits on the university site reach us; a changed notice gets {@code edited_at} and
	 * a new summary. Returns how many were edited. A notice that can no longer be read is marked checked anyway,
	 * so it isn't retried on every run.
	 */
	public int recheckRecent() throws InterruptedException {
		Instant now = Instant.now();
		List<Notice> due = notices.findDueForRecheck(props.source(),
				LocalDate.now(KOREA).minusDays(props.recheckDays()), now.minus(props.recheckEvery()),
				Limit.of(props.recheckBatch()));
		int edited = 0;
		for (Notice n : due) {
			Instant before = n.getEditedAt();
			try {
				URI url = articlePage(n.getSourceArticleId());
				Detail d = parser.parseDetail(fetcher.get(url), url.toString());
				Notice saved = writer.save(props.source(), new ScrapedNotice(n.getSourceArticleId(), n.getCategory(),
						d.title() != null ? d.title() : n.getTitle(),
						d.department() != null ? d.department() : n.getDepartment(),
						d.postedOn() != null ? d.postedOn() : n.getPostedOn(),
						url.toString(), n.isPinned(), d.bodyHtml(), d.bodyText(), d.attachments()));
				if (saved.getEditedAt() != null && !saved.getEditedAt().equals(before)) {
					edited++;
				}
			} catch (InterruptedException e) {
				throw e;
			} catch (Exception e) {
				log.warn("Could not recheck notice {}: {}", n.getSourceArticleId(), e.toString());
				writer.markChecked(n.getId());
			}
		}
		return edited;
	}

	private ScrapedNotice fetchNotice(ListEntry entry) throws Exception {
		URI url = articlePage(entry.articleId());
		Detail d = parser.parseDetail(fetcher.get(url), url.toString());
		return new ScrapedNotice(
				entry.articleId(),
				entry.category(),
				d.title() != null ? d.title() : entry.title(),
				d.department() != null ? d.department() : entry.department(),
				d.postedOn() != null ? d.postedOn() : entry.postedOn(),
				url.toString(),
				entry.pinned(),
				d.bodyHtml(),
				d.bodyText(),
				d.attachments());
	}

	private URI listPage(int page) {
		return UriComponentsBuilder.fromUri(props.listUrl())
				.queryParam("mode", "list")
				.queryParam("article.offset", page * PAGE_SIZE)
				.queryParam("articleLimit", PAGE_SIZE)
				.build().toUri();
	}

	URI articlePage(String articleId) {
		return UriComponentsBuilder.fromUri(props.listUrl())
				.queryParam("mode", "view")
				.queryParam("articleNo", articleId)
				.build().toUri();
	}
}

package com.campusnotices.crawler;

import com.campusnotices.crawler.AjouNoticeParser.Detail;
import com.campusnotices.crawler.AjouNoticeParser.ListEntry;
import com.campusnotices.notice.NoticeRepository;
import com.campusnotices.notice.ScrapedNotice;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

	public record Result(int pagesRead, int noticesSaved, int failures) {
	}

	private final CrawlerProperties props;
	private final PageFetcher fetcher;
	private final AjouNoticeParser parser;
	private final NoticeRepository notices;
	private final NoticeWriter writer;

	public NoticeCrawler(CrawlerProperties props, PageFetcher fetcher, AjouNoticeParser parser,
			NoticeRepository notices, NoticeWriter writer) {
		this.props = props;
		this.fetcher = fetcher;
		this.parser = parser;
		this.notices = notices;
		this.writer = writer;
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
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		} catch (Exception e) {
			log.warn("Crawl failed: {}", e.toString());
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
		return new Result(pages, saved, failures);
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

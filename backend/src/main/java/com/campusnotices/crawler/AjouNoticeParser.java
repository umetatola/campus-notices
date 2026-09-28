package com.campusnotices.crawler;

import com.campusnotices.notice.Attachment;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

/**
 * Reads the Ajou University notice board (the "total_notice" board layout used by /kr/ajou/notice.do).
 * Pure HTML parsing: no network access, so it is unit-tested against saved pages.
 */
@Component
public class AjouNoticeParser {

	private static final Pattern ARTICLE_NO = Pattern.compile("articleNo=(\\d+)");
	private static final Pattern ISO_DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

	/** One row of the list page. */
	public record ListEntry(String articleId, String category, String title, String department,
			LocalDate postedOn, boolean pinned) {
	}

	/** What only the detail page has. */
	public record Detail(String title, String department, LocalDate postedOn, String bodyHtml,
			String bodyText, List<Attachment> attachments) {
	}

	public List<ListEntry> parseList(String html) {
		Document doc = Jsoup.parse(html);
		List<ListEntry> entries = new ArrayList<>();
		for (Element row : doc.select("table tbody tr")) {
			Element link = row.selectFirst(".b-title-box a[href*=articleNo]");
			if (link == null) {
				continue;
			}
			Matcher m = ARTICLE_NO.matcher(link.attr("href"));
			if (!m.find()) {
				continue;
			}
			Elements cells = row.select("> td");
			// columns: number | category | title | attachments | writer | date
			String category = cells.size() > 1 ? blankToNull(cells.get(1).text()) : null;
			String title = link.ownText().strip();
			Element writer = row.selectFirst(".b-writer");
			LocalDate postedOn = findIsoDate(cells);
			boolean pinned = row.selectFirst("td.num-notice") != null;
			entries.add(new ListEntry(m.group(1), category, title,
					writer != null ? blankToNull(writer.text()) : null, postedOn, pinned));
		}
		return entries;
	}

	public Detail parseDetail(String html, String pageUrl) {
		Document doc = Jsoup.parse(html, pageUrl);
		Element title = doc.selectFirst(".b-title-box .b-title");
		Element writer = doc.selectFirst(".b-writer-box span");
		Elements dateSpans = doc.select(".b-date-box span");
		LocalDate postedOn = dateSpans.isEmpty() ? null : parseDate(dateSpans.last().text());

		Element body = doc.selectFirst(".b-content-box .fr-view");
		if (body == null) {
			body = doc.selectFirst(".b-content-box");
		}
		String bodyHtml = null;
		String bodyText = null;
		if (body != null) {
			// make links and images absolute before cleaning, so they still work on our site
			for (Element img : body.select("img[src]")) {
				img.attr("src", img.absUrl("src"));
			}
			for (Element a : body.select("a[href]")) {
				a.attr("href", a.absUrl("href"));
			}
			bodyHtml = Jsoup.clean(body.html(), Safelist.relaxed());
			bodyText = blankToNull(body.text());
		}

		List<Attachment> attachments = new ArrayList<>();
		for (Element a : doc.select(".b-file-box a[href]")) {
			String name = a.text().strip();
			if (!name.isEmpty()) {
				attachments.add(new Attachment(name, a.absUrl("href")));
			}
		}
		return new Detail(title != null ? title.text().strip() : null,
				writer != null ? blankToNull(writer.text()) : null,
				postedOn, bodyHtml, bodyText, attachments);
	}

	private static LocalDate findIsoDate(Elements cells) {
		for (int i = cells.size() - 1; i >= 0; i--) {
			LocalDate d = parseDate(cells.get(i).text());
			if (d != null) {
				return d;
			}
		}
		return null;
	}

	private static LocalDate parseDate(String text) {
		Matcher m = ISO_DATE.matcher(text);
		if (!m.find()) {
			return null;
		}
		try {
			return LocalDate.parse(m.group());
		} catch (DateTimeParseException e) {
			return null;
		}
	}

	private static String blankToNull(String s) {
		if (s == null) {
			return null;
		}
		String t = s.strip();
		return t.isEmpty() ? null : t;
	}
}

package com.campusnotices.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.crawler.AjouNoticeParser.Detail;
import com.campusnotices.crawler.AjouNoticeParser.ListEntry;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Hand-written pages for the shapes the saved fixtures do not contain. */
class AjouNoticeParserEdgeCasesTest {

	private static final String PAGE_URL = "https://www.ajou.ac.kr/kr/ajou/notice.do?mode=view&articleNo=1";
	private final AjouNoticeParser parser = new AjouNoticeParser();

	private static String listRow(String cells) {
		return "<table><tbody><tr>" + cells + "</tr></tbody></table>";
	}

	@Test
	void listRowsWithoutAnArticleLinkAreSkipped() {
		String html = "<table><tbody>"
				+ "<tr><td>1</td><td class='b-title-box'>no link at all</td></tr>"
				+ "<tr><td class='b-title-box'><a href='?mode=view'>link without an article number</a></td></tr>"
				+ "</tbody></table>";

		assertThat(parser.parseList(html)).isEmpty();
	}

	@Test
	void listRowWithOnlyATitleStillParses() {
		String html = listRow("<td class='b-title-box'><a href='?mode=view&articleNo=77'> Title only </a></td>");

		List<ListEntry> entries = parser.parseList(html);

		assertThat(entries).singleElement().satisfies(e -> {
			assertThat(e.articleId()).isEqualTo("77");
			assertThat(e.title()).isEqualTo("Title only");
			assertThat(e.category()).isNull();
			assertThat(e.department()).isNull();
			assertThat(e.postedOn()).isNull();
			assertThat(e.pinned()).isFalse();
		});
	}

	@Test
	void blankCategoryBecomesNullAndTheLastIsoDateWins() {
		String html = listRow("<td class='num-notice'>공지</td><td>   </td>"
				+ "<td class='b-title-box'><a href='?articleNo=5'>T</a></td>"
				+ "<td class='b-writer'>교무팀</td><td>2026-09-01</td><td>2026-09-16</td>");

		assertThat(parser.parseList(html)).singleElement().satisfies(e -> {
			assertThat(e.category()).isNull();
			assertThat(e.department()).isEqualTo("교무팀");
			assertThat(e.postedOn()).isEqualTo(LocalDate.of(2026, 9, 16));
			assertThat(e.pinned()).isTrue();
		});
	}

	@Test
	void anImpossibleDateIsIgnored() {
		String html = listRow("<td>x</td><td class='b-title-box'><a href='?articleNo=5'>T</a></td><td>2026-13-45</td>");

		assertThat(parser.parseList(html)).singleElement().extracting(ListEntry::postedOn).isNull();
	}

	@Test
	void anEmptyDetailPageGivesNullsAndNoAttachments() {
		Detail d = parser.parseDetail("<html><body></body></html>", PAGE_URL);

		assertThat(d.title()).isNull();
		assertThat(d.department()).isNull();
		assertThat(d.postedOn()).isNull();
		assertThat(d.bodyHtml()).isNull();
		assertThat(d.bodyText()).isNull();
		assertThat(d.attachments()).isEmpty();
	}

	@Test
	void detailFallsBackToTheContentBoxAndTakesTheLastDateSpan() {
		String html = "<div class='b-title-box'><span class='b-title'> Title </span></div>"
				+ "<div class='b-writer-box'><span>교무팀</span></div>"
				+ "<div class='b-date-box'><span>작성일</span><span>2026-09-16</span></div>"
				+ "<div class='b-content-box'><p>Plain body</p></div>";

		Detail d = parser.parseDetail(html, PAGE_URL);

		assertThat(d.title()).isEqualTo("Title");
		assertThat(d.department()).isEqualTo("교무팀");
		assertThat(d.postedOn()).isEqualTo(LocalDate.of(2026, 9, 16));
		assertThat(d.bodyText()).isEqualTo("Plain body");
	}

	@Test
	void relativeLinksBecomeAbsoluteAndScriptsAreRemoved() {
		String html = "<div class='b-content-box'><div class='fr-view'>"
				+ "<a href='/files/a.pdf'>file</a><img src='/img/x.png' alt='x'>"
				+ "<script>alert(1)</script><p onclick='steal()'>text</p></div></div>";

		Detail d = parser.parseDetail(html, PAGE_URL);

		assertThat(d.bodyHtml()).contains("https://www.ajou.ac.kr/files/a.pdf", "https://www.ajou.ac.kr/img/x.png")
				.doesNotContain("<script", "alert(1)", "onclick");
		assertThat(d.bodyText()).contains("text");
	}

	@Test
	void attachmentsKeepTheirNamesAndSkipBlankOnes() {
		String html = "<div class='b-file-box'><a href='/d/1'>  form.hwp </a><a href='/d/2'>   </a>"
				+ "<a href='/d/3'>list.pdf</a></div>";

		Detail d = parser.parseDetail(html, PAGE_URL);

		assertThat(d.attachments()).extracting(a -> a.name(), a -> a.url())
				.containsExactly(org.assertj.core.groups.Tuple.tuple("form.hwp", "https://www.ajou.ac.kr/d/1"),
						org.assertj.core.groups.Tuple.tuple("list.pdf", "https://www.ajou.ac.kr/d/3"));
	}
}

package com.campusnotices.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.crawler.AjouNoticeParser.Detail;
import com.campusnotices.crawler.AjouNoticeParser.ListEntry;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Runs against pages saved from www.ajou.ac.kr on 2026-09-28. */
class AjouNoticeParserTest {

	private static final String BASE = "https://www.ajou.ac.kr/kr/ajou/notice.do";
	private final AjouNoticeParser parser = new AjouNoticeParser();

	static String fixture(String name) throws IOException {
		try (InputStream in = AjouNoticeParserTest.class.getResourceAsStream("/fixtures/ajou/" + name)) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

	@Test
	void listPageHasPinnedAndRegularRows() throws IOException {
		List<ListEntry> entries = parser.parseList(fixture("list-page0.html"));

		assertThat(entries).hasSize(19);
		assertThat(entries).filteredOn(ListEntry::pinned).hasSize(9);
		assertThat(entries).extracting(ListEntry::articleId).doesNotHaveDuplicates();

		ListEntry first = entries.getFirst();
		assertThat(first.articleId()).isEqualTo("375874");
		assertThat(first.category()).isEqualTo("학사");
		assertThat(first.title()).isEqualTo("[학부]2026학년도 2학기 수강포기(수강철회) 안내");
		assertThat(first.department()).isEqualTo("교무팀");
		assertThat(first.postedOn()).isEqualTo(LocalDate.of(2026, 9, 16));
		assertThat(first.pinned()).isTrue();

		assertThat(entries).allSatisfy(e -> {
			assertThat(e.title()).isNotBlank();
			assertThat(e.postedOn()).isNotNull();
		});
	}

	@Test
	void textNoticeKeepsBodyAndText() throws IOException {
		Detail d = parser.parseDetail(fixture("detail-376552.html"), BASE + "?mode=view&articleNo=376552");

		assertThat(d.title()).isEqualTo("[일자리+센터] 기아 AutoLand 투어(광명) 참여자 모집(선착순 30명)");
		assertThat(d.bodyText()).contains("대학일자리플러스센터").contains("2026.11.03");
		assertThat(d.bodyHtml()).doesNotContain("<script");
	}

	@Test
	void imageOnlyNoticeHasAbsoluteImagesAndNoText() throws IOException {
		Detail d = parser.parseDetail(fixture("detail-375612.html"), BASE + "?mode=view&articleNo=375612");

		assertThat(d.title()).isEqualTo("[총무팀] 2026학년도 2학기 교내 주차 인프라 개선 사항 안내");
		assertThat(d.department()).isEqualTo("총무팀");
		assertThat(d.postedOn()).isEqualTo(LocalDate.of(2026, 9, 11));
		assertThat(d.bodyText()).isNull();
		assertThat(d.bodyHtml()).contains("src=\"https://www.ajou.ac.kr/_attach/ajou/editor-image/");
		assertThat(d.attachments()).singleElement().satisfies(a -> {
			assertThat(a.name()).endsWith(".pdf");
			assertThat(a.url()).startsWith("https://www.ajou.ac.kr/").contains("attachNo=333317");
		});
	}

	@Test
	void attachmentOnlyNoticeHasFilesButNoText() throws IOException {
		Detail d = parser.parseDetail(fixture("detail-375874.html"), BASE + "?mode=view&articleNo=375874");

		assertThat(d.bodyText()).isNull();
		assertThat(d.attachments()).extracting(a -> a.name())
				.contains("2026-2학기 수강포기 안내.pdf", "2026-2 수강포기(수강철회) 매뉴얼.pdf");
	}
}

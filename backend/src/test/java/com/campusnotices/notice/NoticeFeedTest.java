package com.campusnotices.notice;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.notice.NoticeDtos.NoticeItem;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

class NoticeFeedTest {

	private static final Instant NOW = Instant.parse("2026-10-13T09:00:00Z");

	private static Document parse(String xml) throws Exception {
		var factory = DocumentBuilderFactory.newInstance();
		factory.setNamespaceAware(true);
		return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
	}

	@Test
	void writesAValidAtomFeedWithEscapedText() throws Exception {
		List<NoticeItem> items = List.of(
				new NoticeItem(7, "[학사] 수강 <철회> & 환불 \"안내\"", "Course withdrawal & refunds", "학사", "학사팀",
						LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 19), false, "https://www.ajou.ac.kr/7", null),
				new NoticeItem(8, "주차 안내\u0001", null, null, null, LocalDate.of(2026, 10, 11), null, false,
						"https://www.ajou.ac.kr/8", null));

		String xml = NoticeFeed.atom("https://notices.example", "https://notices.example/api/notices/feed.xml",
				"Campus Notices", items, NOW);
		Document doc = parse(xml); // parses: escaping is correct and control characters are gone

		Element feed = doc.getDocumentElement();
		assertThat(feed.getNamespaceURI()).isEqualTo("http://www.w3.org/2005/Atom");
		assertThat(feed.getElementsByTagName("updated").item(0).getTextContent()).isEqualTo("2026-10-12T00:00:00+09:00");
		var entries = feed.getElementsByTagName("entry");
		assertThat(entries.getLength()).isEqualTo(2);
		Element first = (Element) entries.item(0);
		assertThat(first.getElementsByTagName("title").item(0).getTextContent()).isEqualTo("Course withdrawal & refunds");
		assertThat(first.getElementsByTagName("summary").item(0).getTextContent())
				.isEqualTo("[학사] 수강 <철회> & 환불 \"안내\" (deadline 2026-10-19)");
		assertThat(((Element) first.getElementsByTagName("link").item(0)).getAttribute("href"))
				.isEqualTo("https://notices.example/notices/7");
		// no English title yet: the Korean title is the entry title
		Element second = (Element) entries.item(1);
		assertThat(second.getElementsByTagName("title").item(0).getTextContent()).isEqualTo("주차 안내");
		assertThat(second.getElementsByTagName("category").getLength()).isZero();
	}

	@Test
	void anEmptyFeedIsStillValid() throws Exception {
		Document doc = parse(NoticeFeed.atom("https://n.example", "https://n.example/api/notices/feed.xml", "Campus Notices",
				List.of(), NOW));
		assertThat(doc.getDocumentElement().getElementsByTagName("entry").getLength()).isZero();
	}
}

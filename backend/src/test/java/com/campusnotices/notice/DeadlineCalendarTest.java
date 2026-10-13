package com.campusnotices.notice;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.notice.NoticeDtos.NoticeDetail;
import com.campusnotices.notice.NoticeDtos.Summary;
import com.campusnotices.summary.SummaryStatus;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class DeadlineCalendarTest {

	private static final Instant NOW = Instant.parse("2026-10-13T08:30:00Z");

	private static NoticeDetail notice(Summary summary) {
		return new NoticeDetail(42, "수강 철회 기간 안내", "학사", "학사팀", LocalDate.of(2026, 10, 1), false,
				"https://www.ajou.ac.kr/kr/ajou/notice.do?mode=view&articleNo=42", "<p>본문</p>", "본문", List.of(),
				summary, NOW, NOW, null);
	}

	private static Summary done(LocalDate deadline, String note) {
		return new Summary(SummaryStatus.DONE, "Course withdrawal period",
				"Withdraw online, then confirm; fees are not refunded.", deadline, note);
	}

	/** Undoes line folding, the way calendar apps read the file. */
	private static String unfold(String ics) {
		return ics.replace("\r\n ", "");
	}

	@Test
	void writesAnAllDayEventOnTheDeadlineWithAReminder() {
		String ics = DeadlineCalendar.of(notice(done(LocalDate.of(2026, 10, 31), "until 17:00")), NOW);
		String text = unfold(ics);

		assertThat(text).startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n").endsWith("END:VCALENDAR\r\n");
		assertThat(text).contains("UID:notice-42-deadline@campus-notices\r\n")
				.contains("DTSTAMP:20261013T083000Z\r\n")
				.contains("DTSTART;VALUE=DATE:20261031\r\n")
				.contains("DTEND;VALUE=DATE:20261101\r\n")
				.contains("SUMMARY:Due: Course withdrawal period\r\n")
				.contains("URL:https://www.ajou.ac.kr/kr/ajou/notice.do?mode=view&articleNo=42\r\n")
				.contains("TRIGGER:-P1D\r\n");
		// commas and semicolons are escaped, paragraphs become \n
		assertThat(text).contains("DESCRIPTION:Deadline: until 17:00\\n\\nWithdraw online\\, then confirm\\; "
				+ "fees are not refunded.\\n\\nOriginal notice: https://www.ajou.ac.kr/");
	}

	@Test
	void usesTheKoreanTitleWhenThereIsNoEnglishOne() {
		Summary noTitle = new Summary(SummaryStatus.DONE, null, null, LocalDate.of(2026, 11, 2), null);
		assertThat(unfold(DeadlineCalendar.of(notice(noTitle), NOW))).contains("SUMMARY:Due: 수강 철회 기간 안내\r\n");
	}

	@Test
	void returnsNothingWithoutADeadline() {
		Summary pending = new Summary(SummaryStatus.PENDING, null, null, null, null);
		assertThat(DeadlineCalendar.of(notice(pending), NOW)).isNull();
	}

	@Test
	void foldsLongLinesAt75OctetsWithoutSplittingKoreanCharacters() {
		StringBuilder out = new StringBuilder();
		String korean = "가".repeat(60); // 180 octets in UTF-8
		DeadlineCalendar.line(out, "SUMMARY:" + korean);

		String[] lines = out.toString().split("\r\n");
		assertThat(lines).hasSizeGreaterThan(2);
		assertThat(Arrays.stream(lines).mapToInt(l -> l.getBytes(StandardCharsets.UTF_8).length)).allMatch(n -> n <= 75);
		assertThat(Arrays.stream(lines).skip(1)).allMatch(l -> l.startsWith(" "));
		assertThat(unfold(out.toString())).isEqualTo("SUMMARY:" + korean + "\r\n");
	}
}

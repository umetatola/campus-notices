package com.campusnotices.summary;

import static org.assertj.core.api.Assertions.assertThat;

import com.campusnotices.summary.Summarizer.Input;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The parts of the Claude summarizer that don't need the network. */
class AnthropicSummarizerTest {

	@Test
	void promptCarriesEveryFieldAndMarksImageOnlyNotices() {
		String text = AnthropicSummarizer.render(new Input("[총무팀] 주차 안내", "사무", "총무팀",
				LocalDate.of(2026, 9, 11), null, List.of("카드뉴스.pdf")));

		assertThat(text)
				.contains("Title: [총무팀] 주차 안내")
				.contains("Office: 총무팀")
				.contains("Posted: 2026-09-11")
				.contains("Attachments: 카드뉴스.pdf")
				.contains("no text: the notice is images and/or attachments only");
	}

	@Test
	void deadlineIsParsedOrDropped() {
		assertThat(AnthropicSummarizer.parseDate("2026-09-30")).isEqualTo(LocalDate.of(2026, 9, 30));
		assertThat(AnthropicSummarizer.parseDate("")).isNull();
		assertThat(AnthropicSummarizer.parseDate("next Tuesday")).isNull();
	}
}

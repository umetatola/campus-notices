package com.campusnotices.summary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/** Which summarizer the provider/API-key settings pick. */
class SummarizerConfigTest {

	private final SummarizerConfig config = new SummarizerConfig();

	private static SummarizerProperties props(String provider, String apiKey) {
		return new SummarizerProperties(provider, apiKey, "claude-test", false, Duration.ofMinutes(1), 5, 3);
	}

	@Test
	void autoWithoutKeyIsOff() {
		for (String provider : new String[] {null, "auto", " AUTO "}) {
			Summarizer s = config.summarizer(props(provider, "  "));
			assertThat(s.enabled()).isFalse();
		}
	}

	@Test
	void autoWithKeyUsesClaude() {
		assertThat(config.summarizer(props("auto", "sk-test"))).isInstanceOf(AnthropicSummarizer.class);
	}

	@Test
	void anthropicNeedsAKey() {
		assertThatThrownBy(() -> config.summarizer(props("anthropic", null)))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("ANTHROPIC_API_KEY");
		assertThat(config.summarizer(props("Anthropic", "sk-test"))).isInstanceOf(AnthropicSummarizer.class);
	}

	@Test
	void stubIsForDevelopment() {
		Summarizer s = config.summarizer(props("stub", null));
		assertThat(s).isInstanceOf(StubSummarizer.class);
		assertThat(s.enabled()).isTrue();
	}

	@Test
	void disabledSummarizerRefusesToSummarize() {
		Summarizer s = config.summarizer(props("none", "sk-test"));
		assertThat(s.enabled()).isFalse();
		assertThatThrownBy(() -> s.summarize(null)).isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	void unknownProviderFailsFast() {
		assertThatThrownBy(() -> config.summarizer(props("gpt", null)))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("gpt");
	}
}

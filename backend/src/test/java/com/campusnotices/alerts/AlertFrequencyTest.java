package com.campusnotices.alerts;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class AlertFrequencyTest {

	@Test
	void theDigestTimeIsTheLatestEightOClockInKorea() {
		// 07:59 KST on Oct 14 -> still Oct 13, 08:00 KST
		assertThat(AlertFrequency.lastDigestTime(Instant.parse("2026-10-13T22:59:00Z")))
				.isEqualTo(Instant.parse("2026-10-12T23:00:00Z"));
		// 08:00 KST exactly and later the same day -> that morning
		assertThat(AlertFrequency.lastDigestTime(Instant.parse("2026-10-13T23:00:00Z")))
				.isEqualTo(Instant.parse("2026-10-13T23:00:00Z"));
		assertThat(AlertFrequency.lastDigestTime(Instant.parse("2026-10-14T14:59:00Z")))
				.isEqualTo(Instant.parse("2026-10-13T23:00:00Z"));
	}
}

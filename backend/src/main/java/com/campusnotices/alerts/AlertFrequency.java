package com.campusnotices.alerts;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** How often a user gets alert emails. */
public enum AlertFrequency {
	/** As soon as matching notices are found (checked every minute). */
	INSTANT,
	/** One email a day with everything that matched, after 08:00 Korean time. */
	DAILY;

	static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
	static final LocalTime DIGEST_TIME = LocalTime.of(8, 0);

	/** The most recent 08:00 in Korea at or before {@code now}; daily users last emailed before it are due. */
	static Instant lastDigestTime(Instant now) {
		ZonedDateTime korea = now.atZone(KOREA);
		LocalDate day = korea.toLocalTime().isBefore(DIGEST_TIME) ? korea.toLocalDate().minusDays(1) : korea.toLocalDate();
		return day.atTime(DIGEST_TIME).atZone(KOREA).toInstant();
	}
}

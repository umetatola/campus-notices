package com.campusnotices.alerts;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param interval    how often new notices are matched and alert emails sent
 * @param summaryWait how long a new notice may wait for its English summary before it is matched anyway
 *                    (English keywords can only match once the summary exists)
 * @param maxAttempts give up on an alert email after this many failed sends
 */
@ConfigurationProperties(prefix = "alerts")
public record AlertProperties(Duration interval, Duration summaryWait, int maxAttempts) {
}

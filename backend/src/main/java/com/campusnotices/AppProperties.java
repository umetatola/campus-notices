package com.campusnotices;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param baseUrl  public address of the web app; links in emails point here
 * @param mailFrom sender of every email, e.g. "Campus Notices &lt;no-reply@example.com&gt;"
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String baseUrl, String mailFrom) {
}

package com.campusnotices.alerts;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AlertWorker {

	private static final Logger log = LoggerFactory.getLogger(AlertWorker.class);

	private final AlertMatcher matcher;
	private final AlertSender sender;

	public AlertWorker(AlertMatcher matcher, AlertSender sender) {
		this.matcher = matcher;
		this.sender = sender;
	}

	@Scheduled(fixedDelayString = "${alerts.interval}", initialDelayString = "${alerts.initial-delay:PT30S}")
	public void run() {
		try {
			int checked = matcher.matchNewNotices(100);
			int sent = sender.sendPending(50);
			if (checked > 0 || sent > 0) {
				log.info("Alerts: {} notices checked, {} emails sent", checked, sent);
			}
		} catch (Exception e) {
			log.warn("Alert run failed: {}", e.toString());
		}
	}
}

package com.campusnotices.alerts;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checks each new notice against every followed keyword, once, and records who should hear about it.
 *
 * <p>A notice is checked when its English summary is finished (so English keywords can match), or after
 * {@code alerts.summary-wait} if the summary is slow or summaries are off. Matching is case-insensitive
 * substring search over the Korean title and body and the English title and summary. A subscription only
 * matches notices first seen after it was created: following "장학" today doesn't dig up last month's notices.
 * Users who unsubscribed (paused alerts) are skipped, so nothing piles up while alerts are off.
 */
@Component
public class AlertMatcher {

	private final JdbcClient jdbc;
	private final AlertProperties props;

	public AlertMatcher(JdbcClient jdbc, AlertProperties props) {
		this.jdbc = jdbc;
		this.props = props;
	}

	/** Returns how many notices were checked. */
	@Transactional
	public int matchNewNotices(int limit) {
		List<Long> ready = jdbc.sql("""
				select n.id from notices n
				  left join notice_summaries s on s.notice_id = n.id
				 where n.alerts_checked_at is null
				   and (s.status in ('DONE', 'FAILED')
				        or n.first_seen_at < now() - make_interval(secs => :wait))
				 order by n.first_seen_at
				 limit :limit
				   for update of n skip locked
				""")
				.param("wait", props.summaryWait().toSeconds())
				.param("limit", limit)
				.query(Long.class)
				.list();
		if (ready.isEmpty()) {
			return 0;
		}
		jdbc.sql("""
				insert into alert_deliveries (user_id, notice_id, keyword)
				select distinct on (sub.user_id, n.id) sub.user_id, n.id, sub.keyword
				  from notices n
				  left join notice_summaries s on s.notice_id = n.id
				  join subscriptions sub on sub.created_at <= n.first_seen_at
				  join users u on u.id = sub.user_id and u.alerts_paused_at is null
				 where n.id in (:ids)
				   and (strpos(lower(n.title), lower(sub.keyword)) > 0
				        or strpos(lower(coalesce(n.body_text, '')), lower(sub.keyword)) > 0
				        or strpos(lower(coalesce(s.title_en, '')), lower(sub.keyword)) > 0
				        or strpos(lower(coalesce(s.summary_en, '')), lower(sub.keyword)) > 0)
				 order by sub.user_id, n.id, sub.created_at
				on conflict do nothing
				""")
				.param("ids", ready)
				.update();
		jdbc.sql("update notices set alerts_checked_at = now() where id in (:ids)").param("ids", ready).update();
		return ready.size();
	}
}

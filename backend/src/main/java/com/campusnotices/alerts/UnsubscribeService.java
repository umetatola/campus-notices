package com.campusnotices.alerts;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Unsubscribing pauses alert emails without deleting the user's keywords. The link in each email carries a
 * random per-user token (256 bits), so it works without signing in; it can only pause alerts.
 */
@Service
public class UnsubscribeService {

	private static final SecureRandom RANDOM = new SecureRandom();

	private final JdbcClient jdbc;

	public UnsubscribeService(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** The user's token, created on first use. */
	@Transactional
	public String tokenFor(long userId) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String fresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		// keeps an existing token; only fills it in when missing
		return jdbc.sql("""
				update users set unsubscribe_token = coalesce(unsubscribe_token, :t)
				 where id = :u
				returning unsubscribe_token
				""")
				.param("t", fresh).param("u", userId)
				.query(String.class).single();
	}

	/**
	 * Pauses alerts for the token's owner and drops their unsent alerts, so turning alerts back on later doesn't
	 * deliver old news. Idempotent. Returns false for an unknown token.
	 */
	@Transactional
	public boolean unsubscribe(String token) {
		if (token == null || token.isBlank() || token.length() > 64) {
			return false;
		}
		Long userId = jdbc.sql("""
				update users set alerts_paused_at = coalesce(alerts_paused_at, now())
				 where unsubscribe_token = :t
				returning id
				""")
				.param("t", token).query(Long.class).optional().orElse(null);
		if (userId == null) {
			return false;
		}
		jdbc.sql("delete from alert_deliveries where user_id = :u and sent_at is null").param("u", userId).update();
		return true;
	}

	public boolean isPaused(long userId) {
		return jdbc.sql("select alerts_paused_at is not null from users where id = :u")
				.param("u", userId).query(Boolean.class).single();
	}

	public void resume(long userId) {
		jdbc.sql("update users set alerts_paused_at = null where id = :u").param("u", userId).update();
	}

	public AlertFrequency frequency(long userId) {
		return AlertFrequency.valueOf(jdbc.sql("select alert_frequency from users where id = :u")
				.param("u", userId).query(String.class).single());
	}

	/** Switching to daily counts as "just sent", so the first digest comes after the next 08:00, not right away. */
	public void setFrequency(long userId, AlertFrequency frequency) {
		jdbc.sql("""
				update users set alert_frequency = :f,
				       last_digest_at = case when :f = 'DAILY' and alert_frequency <> 'DAILY' then now() else last_digest_at end
				 where id = :u
				""")
				.param("f", frequency.name()).param("u", userId).update();
	}
}

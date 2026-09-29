package com.campusnotices.account;

import com.campusnotices.AppProperties;
import com.campusnotices.mail.EmailHtml;
import com.campusnotices.mail.Mailer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Passwordless sign-in: a random one-time token is emailed as a link. The database keeps only its SHA-256
 * hash, the link expires after {@link #VALID_FOR}, and it works exactly once.
 */
@Service
public class LoginLinkService {

	private static final Logger log = LoggerFactory.getLogger(LoginLinkService.class);
	static final Duration VALID_FOR = Duration.ofMinutes(15);
	/** Links per address per {@link #VALID_FOR}, so the form can't be used to flood someone's inbox. */
	static final int MAX_LINKS_PER_WINDOW = 3;

	private final JdbcClient jdbc;
	private final Mailer mailer;
	private final AppProperties app;
	private final SecureRandom random = new SecureRandom();

	public LoginLinkService(JdbcClient jdbc, Mailer mailer, AppProperties app) {
		this.jdbc = jdbc;
		this.mailer = mailer;
		this.app = app;
	}

	/**
	 * Emails a sign-in link. Callers always answer the same way whether or not this sent anything, so the
	 * endpoint can't be used to find out which addresses have accounts.
	 */
	@Transactional
	public void requestLink(String rawEmail) {
		String email = normalize(rawEmail);
		int recent = jdbc.sql("""
				select count(*) from login_tokens
				 where lower(email) = :email and created_at > now() - make_interval(secs => :window)
				""")
				.param("email", email)
				.param("window", VALID_FOR.toSeconds())
				.query(Integer.class).single();
		if (recent >= MAX_LINKS_PER_WINDOW) {
			log.info("Sign-in link not sent: rate limit reached for an address");
			return;
		}

		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		jdbc.sql("""
				insert into login_tokens (email, token_hash, expires_at)
				values (:email, :hash, now() + make_interval(secs => :valid))
				""")
				.param("email", email)
				.param("hash", sha256(token))
				.param("valid", VALID_FOR.toSeconds())
				.update();

		String link = UriComponentsBuilder.fromUriString(app.baseUrl()).path("/auth/verify")
				.queryParam("token", token).build().toUriString();
		mailer.send(new Mailer.Email(email, "Your Campus Notices sign-in link",
				"""
				Sign in to Campus Notices with this link:

				%s

				The link works once and expires in %d minutes. If you didn't ask for it, you can ignore this email.
				""".formatted(link, VALID_FOR.toMinutes()),
				EmailHtml.page("<p style=\"margin:0\">Click the button to sign in to Campus Notices.</p>"
						+ EmailHtml.button(link, "Sign in")
						+ EmailHtml.note("The link works once and expires in " + VALID_FOR.toMinutes()
								+ " minutes. If you didn't ask for it, you can ignore this email."))));
	}

	/** Uses up the token and returns the user it signs in, creating the account on first sign-in. */
	@Transactional
	public Optional<SessionUser> verify(String token) {
		if (token == null || token.isBlank() || token.length() > 100) {
			return Optional.empty();
		}
		// one statement marks the token used, so two simultaneous clicks can't both succeed
		Optional<String> email = jdbc.sql("""
				update login_tokens set used_at = now()
				 where token_hash = :hash and used_at is null and expires_at > now()
				returning email
				""")
				.param("hash", sha256(token))
				.query(String.class).optional();
		return email.map(e -> jdbc.sql("""
				insert into users (email, last_login_at) values (:email, now())
				on conflict ((lower(email))) do update set last_login_at = now()
				returning id, email
				""")
				.param("email", e)
				.query((rs, i) -> new SessionUser(rs.getLong("id"), rs.getString("email")))
				.single());
	}

	static String normalize(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

	static String sha256(String token) {
		try {
			return HexFormat.of().formatHex(
					MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}

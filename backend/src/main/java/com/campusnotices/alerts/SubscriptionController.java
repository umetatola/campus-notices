package com.campusnotices.alerts;

import com.campusnotices.account.SessionUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** The keywords a signed-in user follows. */
@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

	static final int MAX_PER_USER = 20;

	public record Subscription(long id, String keyword, Instant createdAt) {
	}

	public record NewSubscription(@NotBlank @Size(max = 50) String keyword) {
	}

	private final JdbcClient jdbc;

	public SubscriptionController(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	@GetMapping
	public List<Subscription> list(@AuthenticationPrincipal SessionUser user) {
		return jdbc.sql("select id, keyword, created_at from subscriptions where user_id = :u order by created_at")
				.param("u", user.id())
				.query((rs, i) -> new Subscription(rs.getLong("id"), rs.getString("keyword"),
						rs.getTimestamp("created_at").toInstant()))
				.list();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public Subscription add(@AuthenticationPrincipal SessionUser user, @Valid @RequestBody NewSubscription body) {
		String keyword = body.keyword().strip().replaceAll("\\s+", " ");
		if (keyword.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keyword is empty");
		}
		// lock the user's row so two quick clicks can't both pass the limit check
		jdbc.sql("select id from users where id = :u for update").param("u", user.id()).query(Long.class).single();
		int count = jdbc.sql("select count(*) from subscriptions where user_id = :u")
				.param("u", user.id()).query(Integer.class).single();
		if (count >= MAX_PER_USER) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "You can follow up to " + MAX_PER_USER + " keywords");
		}
		try {
			return jdbc.sql("""
					insert into subscriptions (user_id, keyword) values (:u, :k)
					returning id, keyword, created_at
					""")
					.param("u", user.id())
					.param("k", keyword)
					.query((rs, i) -> new Subscription(rs.getLong("id"), rs.getString("keyword"),
							rs.getTimestamp("created_at").toInstant()))
					.single();
		} catch (DuplicateKeyException e) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "You already follow \"" + keyword + "\"");
		}
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void remove(@AuthenticationPrincipal SessionUser user, @PathVariable long id) {
		// scoped to the user: nobody can delete someone else's keyword by guessing ids
		int deleted = jdbc.sql("delete from subscriptions where id = :id and user_id = :u")
				.param("id", id).param("u", user.id()).update();
		if (deleted == 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND);
		}
	}
}

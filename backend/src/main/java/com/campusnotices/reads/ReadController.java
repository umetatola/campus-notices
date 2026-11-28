package com.campusnotices.reads;

import com.campusnotices.account.SessionUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Which notices a signed-in user has opened. The browser keeps its own copy for signed-out reading and sends what it
 * read here, so the bold "unread" titles agree across a user's devices. Adding is idempotent and ignores ids that
 * aren't notices, so a stale local copy can always be sent as it is.
 */
@RestController
@RequestMapping("/api/reads")
public class ReadController {

	/** Same as the browser's limit: months of notices. Older reads drop off first. */
	static final int MAX_PER_USER = 3000;
	/** Per request; the page sends a "Mark all as read" page or a local backlog in batches. */
	static final int MAX_PER_REQUEST = 500;

	public record Reads(@NotNull @Size(max = MAX_PER_REQUEST) List<@NotNull Long> ids) {
	}

	private final JdbcClient jdbc;

	public ReadController(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Ids of the notices this user has opened, most recently read first. */
	@GetMapping
	public List<Long> list(@AuthenticationPrincipal SessionUser user) {
		return jdbc.sql("select notice_id from notice_reads where user_id = :u order by read_at desc, notice_id desc limit :max")
				.param("u", user.id())
				.param("max", MAX_PER_USER)
				.query(Long.class)
				.list();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Transactional
	public void add(@AuthenticationPrincipal SessionUser user, @Valid @RequestBody Reads body) {
		if (body.ids().isEmpty()) {
			return;
		}
		List<Long> ids = body.ids().stream().distinct().toList();
		// unknown ids are skipped by the join; ones already read keep their first read time
		jdbc.sql("""
				insert into notice_reads (user_id, notice_id)
				select :u, n.id from notices n where n.id in (:ids)
				on conflict do nothing
				""")
				.param("u", user.id())
				.param("ids", ids)
				.update();
		// keep only the newest MAX_PER_USER, like the browser does
		jdbc.sql("""
				delete from notice_reads r
				 where r.user_id = :u
				   and r.notice_id not in (select notice_id from notice_reads where user_id = :u
				                            order by read_at desc, notice_id desc limit :max)
				""")
				.param("u", user.id())
				.param("max", MAX_PER_USER)
				.update();
	}
}

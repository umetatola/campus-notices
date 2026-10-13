package com.campusnotices.bookmarks;

import com.campusnotices.account.SessionUser;
import com.campusnotices.notice.NoticeDtos.NoticeItem;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Notices a signed-in user saved to read later. PUT and DELETE are idempotent, so a double click is harmless. */
@RestController
@RequestMapping("/api/bookmarks")
public class BookmarkController {

	static final int MAX_PER_USER = 200;

	private final JdbcClient jdbc;

	public BookmarkController(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Saved notices, most recently saved first. */
	@GetMapping
	public List<NoticeItem> list(@AuthenticationPrincipal SessionUser user) {
		return jdbc.sql("""
				select n.id, n.title, s.title_en, n.category, n.department, n.posted_on, s.deadline, n.pinned, n.url,
				       n.edited_at
				  from bookmarks b
				  join notices n on n.id = b.notice_id
				  left join notice_summaries s on s.notice_id = n.id
				 where b.user_id = :u
				 order by b.created_at desc, n.id desc
				""")
				.param("u", user.id())
				.query((rs, i) -> item(rs))
				.list();
	}

	@PutMapping("/{noticeId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Transactional
	public void add(@AuthenticationPrincipal SessionUser user, @PathVariable long noticeId) {
		boolean exists = jdbc.sql("select exists (select 1 from notices where id = :n)")
				.param("n", noticeId).query(Boolean.class).single();
		if (!exists) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such notice");
		}
		// lock the user's row so two quick clicks can't both pass the limit check
		jdbc.sql("select id from users where id = :u for update").param("u", user.id()).query(Long.class).single();
		if (saved(user.id(), noticeId)) {
			return;
		}
		int count = jdbc.sql("select count(*) from bookmarks where user_id = :u")
				.param("u", user.id()).query(Integer.class).single();
		if (count >= MAX_PER_USER) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "You can save up to " + MAX_PER_USER + " notices");
		}
		jdbc.sql("insert into bookmarks (user_id, notice_id) values (:u, :n)")
				.param("u", user.id()).param("n", noticeId).update();
	}

	@DeleteMapping("/{noticeId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void remove(@AuthenticationPrincipal SessionUser user, @PathVariable long noticeId) {
		jdbc.sql("delete from bookmarks where user_id = :u and notice_id = :n")
				.param("u", user.id()).param("n", noticeId).update();
	}

	private boolean saved(long userId, long noticeId) {
		return jdbc.sql("select exists (select 1 from bookmarks where user_id = :u and notice_id = :n)")
				.param("u", userId).param("n", noticeId).query(Boolean.class).single();
	}

	private static NoticeItem item(ResultSet rs) throws SQLException {
		Timestamp edited = rs.getTimestamp("edited_at");
		java.sql.Date deadline = rs.getDate("deadline");
		return new NoticeItem(rs.getLong("id"), rs.getString("title"), rs.getString("title_en"),
				rs.getString("category"), rs.getString("department"), rs.getDate("posted_on").toLocalDate(),
				deadline == null ? null : deadline.toLocalDate(), rs.getBoolean("pinned"), rs.getString("url"),
				edited == null ? null : edited.toInstant());
	}
}

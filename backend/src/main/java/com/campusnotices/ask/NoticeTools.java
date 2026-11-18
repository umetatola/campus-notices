package com.campusnotices.ask;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** What the AI can do with the notice database: search it and read one notice. Read-only. */
@Component
public class NoticeTools {

	static final int SEARCH_LIMIT = 12;
	static final int BODY_LIMIT = 12_000;

	/** One search hit, also used for the "sources" list under an answer. */
	public record Hit(long id, String title, String titleEn, String department, LocalDate postedOn, LocalDate deadline,
			String snippet) {
	}

	/** Search filters; every one is optional. */
	public record Search(String query, String category, Integer postedWithinDays, Integer deadlineWithinDays) {
	}

	private final JdbcClient jdbc;

	public NoticeTools(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public List<Hit> search(Search s) {
		StringBuilder where = new StringBuilder("where true");
		var params = new java.util.HashMap<String, Object>();
		if (s.query() != null && !s.query().isBlank()) {
			// every word must appear somewhere (Korean original or English summary), like the site's search box
			String[] words = s.query().strip().split("\\s+");
			for (int i = 0; i < words.length && i < 6; i++) {
				where.append("""
						 and (strpos(lower(n.title), lower(:w%1$d)) > 0
						      or strpos(lower(coalesce(n.body_text, '')), lower(:w%1$d)) > 0
						      or strpos(lower(coalesce(s.title_en, '')), lower(:w%1$d)) > 0
						      or strpos(lower(coalesce(s.summary_en, '')), lower(:w%1$d)) > 0)""".formatted(i));
				params.put("w" + i, words[i]);
			}
		}
		if (s.category() != null && !s.category().isBlank()) {
			where.append(" and n.category = :category");
			params.put("category", s.category().strip());
		}
		if (s.postedWithinDays() != null) {
			where.append(" and n.posted_on >= current_date - :posted");
			params.put("posted", clamp(s.postedWithinDays(), 0, 365));
		}
		if (s.deadlineWithinDays() != null) {
			where.append(" and s.deadline between current_date and current_date + :due");
			params.put("due", clamp(s.deadlineWithinDays(), 0, 365));
		}
		String order = s.deadlineWithinDays() != null ? "s.deadline, n.id" : "n.posted_on desc, n.id desc";
		var spec = jdbc.sql("""
				select n.id, n.title, s.title_en, n.department, n.posted_on, s.deadline,
				       coalesce(s.summary_en, left(n.body_text, 300)) as snippet
				  from notices n
				  left join notice_summaries s on s.notice_id = n.id
				""" + where + " order by " + order + " limit " + SEARCH_LIMIT);
		for (var e : params.entrySet()) {
			spec = spec.param(e.getKey(), e.getValue());
		}
		return spec.query((rs, i) -> new Hit(rs.getLong("id"), rs.getString("title"), rs.getString("title_en"),
				rs.getString("department"), rs.getObject("posted_on", LocalDate.class),
				rs.getObject("deadline", LocalDate.class), rs.getString("snippet"))).list();
	}

	/** The notice as text for the model, or empty when there is no such notice. */
	public Optional<String> read(long id) {
		Optional<String> text = jdbc.sql("""
				select n.title, n.category, n.department, n.posted_on, n.url, n.body_text,
				       s.title_en, s.summary_en, s.deadline, s.deadline_note
				  from notices n
				  left join notice_summaries s on s.notice_id = n.id
				 where n.id = :id
				""").param("id", id).query((rs, i) -> {
			String body = rs.getString("body_text");
			if (body == null || body.isBlank()) {
				body = "(no text: the notice is published as images and/or attachments)";
			} else if (body.length() > BODY_LIMIT) {
				body = body.substring(0, BODY_LIMIT) + "\n[... the rest of this long notice is cut here]";
			}
			return """
					Notice %d
					Title: %s
					English title: %s
					Category: %s
					Office: %s
					Posted: %s
					Deadline: %s
					English summary: %s
					Original page: %s

					Body:
					%s""".formatted(id, rs.getString("title"), orDash(rs.getString("title_en")),
					orDash(rs.getString("category")), orDash(rs.getString("department")), rs.getObject("posted_on", LocalDate.class),
					rs.getObject("deadline") == null ? "-"
							: rs.getObject("deadline", LocalDate.class)
									+ (rs.getString("deadline_note") == null ? "" : " (" + rs.getString("deadline_note") + ")"),
					orDash(rs.getString("summary_en")), rs.getString("url"), body);
		}).optional();
		if (text.isEmpty()) {
			return text;
		}
		List<String> files = jdbc.sql("select name from notice_attachments where notice_id = :id order by position")
				.param("id", id).query(String.class).list();
		return Optional.of(text.get() + "\n\nAttachments: " + (files.isEmpty() ? "none" : String.join(", ", files)));
	}

	/** Titles for the notices an answer links to, in the order given; unknown ids are skipped. */
	public List<Hit> describe(List<Long> ids) {
		if (ids.isEmpty()) {
			return List.of();
		}
		List<Hit> found = jdbc.sql("""
				select n.id, n.title, s.title_en, n.department, n.posted_on, s.deadline, null as snippet
				  from notices n left join notice_summaries s on s.notice_id = n.id
				 where n.id in (:ids)
				""").param("ids", ids).query((rs, i) -> new Hit(rs.getLong("id"), rs.getString("title"),
				rs.getString("title_en"), rs.getString("department"), rs.getObject("posted_on", LocalDate.class),
				rs.getObject("deadline", LocalDate.class), null)).list();
		List<Hit> ordered = new ArrayList<>();
		for (long id : ids) {
			found.stream().filter(h -> h.id() == id).findFirst().ifPresent(ordered::add);
		}
		return ordered;
	}

	public List<String> categories() {
		return jdbc.sql("select distinct category from notices where category is not null order by category")
				.query(String.class).list();
	}

	private static int clamp(int v, int lo, int hi) {
		return Math.max(lo, Math.min(hi, v));
	}

	private static String orDash(String s) {
		return s == null || s.isBlank() ? "-" : s;
	}
}

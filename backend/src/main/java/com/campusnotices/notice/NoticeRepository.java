package com.campusnotices.notice;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

	Optional<Notice> findBySourceAndSourceArticleId(String source, String sourceArticleId);

	@Query("select n.sourceArticleId from Notice n where n.source = :source and n.sourceArticleId in :ids")
	Set<String> findKnownArticleIds(@Param("source") String source, @Param("ids") Collection<String> ids);

	String SEARCH_WHERE = """
			where (:category is null or n.category = :category)
			  and (:q is null
			       or lower(n.title) like lower(concat('%', cast(:q as string), '%'))
			       or lower(s.titleEn) like lower(concat('%', cast(:q as string), '%'))
			       or lower(s.summaryEn) like lower(concat('%', cast(:q as string), '%')))
			""";

	/** Newest first; {@code q} matches the Korean title and the English title and summary. */
	@Query(value = """
			select new com.campusnotices.notice.NoticeListRow(n.id, n.title, n.category, n.department,
			       n.postedOn, n.pinned, n.url, s.titleEn, s.deadline, n.editedAt)
			from Notice n left join NoticeSummary s on s.noticeId = n.id
			""" + SEARCH_WHERE + """
			order by n.postedOn desc, n.id desc
			""",
			countQuery = "select count(n) from Notice n left join NoticeSummary s on s.noticeId = n.id " + SEARCH_WHERE)
	Page<NoticeListRow> search(@Param("category") String category, @Param("q") String q, Pageable pageable);

	/** The newest notices from one department, leaving one notice out. */
	@Query("""
			select new com.campusnotices.notice.NoticeListRow(n.id, n.title, n.category, n.department,
			       n.postedOn, n.pinned, n.url, s.titleEn, s.deadline, n.editedAt)
			from Notice n left join NoticeSummary s on s.noticeId = n.id
			where n.department = :department and n.id <> :exclude
			order by n.postedOn desc, n.id desc
			""")
	List<NoticeListRow> findLatestFromDepartment(@Param("department") String department,
			@Param("exclude") long exclude, org.springframework.data.domain.Limit limit);

	/** Notices whose deadline (from the summary) falls between the two dates, soonest first. */
	@Query("""
			select new com.campusnotices.notice.NoticeListRow(n.id, n.title, n.category, n.department,
			       n.postedOn, n.pinned, n.url, s.titleEn, s.deadline, n.editedAt)
			from Notice n join NoticeSummary s on s.noticeId = n.id
			where s.deadline between :from and :to
			order by s.deadline asc, n.postedOn desc, n.id desc
			""")
	List<NoticeListRow> findDeadlinesBetween(@Param("from") java.time.LocalDate from,
			@Param("to") java.time.LocalDate to, org.springframework.data.domain.Limit limit);

	/** Recent notices not looked at since {@code before}, least recently checked first. */
	@Query("""
			select n from Notice n
			 where n.source = :source and n.postedOn >= :since
			   and (n.checkedAt is null or n.checkedAt < :before)
			 order by n.checkedAt asc nulls first
			""")
	List<Notice> findDueForRecheck(@Param("source") String source, @Param("since") java.time.LocalDate since,
			@Param("before") java.time.Instant before, org.springframework.data.domain.Limit limit);

	@Query("select distinct n.category from Notice n where n.category is not null order by n.category")
	List<String> findCategories();
}

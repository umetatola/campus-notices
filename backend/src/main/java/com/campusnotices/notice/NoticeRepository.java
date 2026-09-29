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
			       n.postedOn, n.pinned, n.url, s.titleEn, s.deadline)
			from Notice n left join NoticeSummary s on s.noticeId = n.id
			""" + SEARCH_WHERE + """
			order by n.postedOn desc, n.id desc
			""",
			countQuery = "select count(n) from Notice n left join NoticeSummary s on s.noticeId = n.id " + SEARCH_WHERE)
	Page<NoticeListRow> search(@Param("category") String category, @Param("q") String q, Pageable pageable);

	@Query("select distinct n.category from Notice n where n.category is not null order by n.category")
	List<String> findCategories();
}

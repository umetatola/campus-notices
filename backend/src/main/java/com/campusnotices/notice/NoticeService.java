package com.campusnotices.notice;

import com.campusnotices.notice.NoticeDtos.NoticeDetail;
import com.campusnotices.notice.NoticeDtos.NoticeItem;
import com.campusnotices.notice.NoticeDtos.PageResponse;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NoticeService {

	public static final int MAX_PAGE_SIZE = 50;

	private final NoticeRepository notices;

	public NoticeService(NoticeRepository notices) {
		this.notices = notices;
	}

	public PageResponse<NoticeItem> list(String category, String query, int page, int size) {
		String q = query == null || query.isBlank() ? null : query.strip();
		String c = category == null || category.isBlank() ? null : category.strip();
		Page<Notice> result = notices.search(c, q,
				PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE)));
		return new PageResponse<>(result.map(NoticeItem::from).getContent(), result.getNumber(),
				result.getSize(), result.getTotalElements(), result.getTotalPages());
	}

	public NoticeDetail get(long id) {
		return notices.findById(id).map(NoticeDetail::from)
				.orElseThrow(() -> new NoticeNotFoundException(id));
	}

	public List<String> categories() {
		return notices.findCategories();
	}
}

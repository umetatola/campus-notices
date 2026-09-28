package com.campusnotices.notice;

import com.campusnotices.notice.NoticeDtos.NoticeDetail;
import com.campusnotices.notice.NoticeDtos.NoticeItem;
import com.campusnotices.notice.NoticeDtos.PageResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

	private final NoticeService service;

	public NoticeController(NoticeService service) {
		this.service = service;
	}

	@GetMapping
	public PageResponse<NoticeItem> list(
			@RequestParam(required = false) String category,
			@RequestParam(required = false) String q,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		return service.list(category, q, page, size);
	}

	@GetMapping("/{id}")
	public NoticeDetail get(@PathVariable long id) {
		return service.get(id);
	}

	@GetMapping("/categories")
	public List<String> categories() {
		return service.categories();
	}
}

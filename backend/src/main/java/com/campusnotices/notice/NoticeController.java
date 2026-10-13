package com.campusnotices.notice;

import com.campusnotices.notice.NoticeDtos.NoticeDetail;
import com.campusnotices.notice.NoticeDtos.NoticeItem;
import com.campusnotices.notice.NoticeDtos.PageResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

	/** The deadline as a calendar file (all-day event + reminder the day before); 404 when there is none. */
	@GetMapping("/{id}/calendar.ics")
	public ResponseEntity<String> calendar(@PathVariable long id) {
		String ics = DeadlineCalendar.of(service.get(id), Instant.now());
		if (ics == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This notice has no known deadline");
		}
		return ResponseEntity.ok()
				.contentType(new MediaType("text", "calendar", StandardCharsets.UTF_8))
				.header(HttpHeaders.CONTENT_DISPOSITION,
						ContentDisposition.attachment().filename("notice-" + id + "-deadline.ics").build().toString())
				.body(ics);
	}

	@GetMapping("/categories")
	public List<String> categories() {
		return service.categories();
	}
}

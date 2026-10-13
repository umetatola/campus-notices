package com.campusnotices.notice;

import com.campusnotices.AppProperties;
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
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

	private static final int FEED_SIZE = 30;

	private final NoticeService service;
	private final AppProperties app;

	public NoticeController(NoticeService service, AppProperties app) {
		this.service = service;
		this.app = app;
	}

	/** The newest notices as an Atom feed, with the same filters as the list. */
	@GetMapping("/feed.xml")
	public ResponseEntity<String> feed(@RequestParam(required = false) String category,
			@RequestParam(required = false) String q) {
		var page = service.list(category, q, 0, FEED_SIZE);
		String self = UriComponentsBuilder.fromUriString(app.baseUrl()).path("/api/notices/feed.xml")
				.queryParamIfPresent("category", java.util.Optional.ofNullable(category).filter(c -> !c.isBlank()))
				.queryParamIfPresent("q", java.util.Optional.ofNullable(q).filter(t -> !t.isBlank()))
				.encode().build().toUriString();
		String title = "Campus Notices" + (category != null && !category.isBlank() ? " · " + category : "")
				+ (q != null && !q.isBlank() ? " · \"" + q.strip() + "\"" : "");
		return ResponseEntity.ok()
				.contentType(new MediaType("application", "atom+xml", StandardCharsets.UTF_8))
				.body(NoticeFeed.atom(app.baseUrl(), self, title, page.items(), Instant.now()));
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

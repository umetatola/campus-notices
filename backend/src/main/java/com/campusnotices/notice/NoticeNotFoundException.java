package com.campusnotices.notice;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class NoticeNotFoundException extends RuntimeException {

	public NoticeNotFoundException(long id) {
		super("Notice " + id + " not found");
	}
}

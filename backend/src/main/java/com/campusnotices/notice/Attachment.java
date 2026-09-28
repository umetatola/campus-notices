package com.campusnotices.notice;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public record Attachment(
		@Column(nullable = false) String name,
		@Column(nullable = false) String url) {
}

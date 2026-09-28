package com.campusnotices.crawler;

import java.io.IOException;
import java.net.URI;

/** Fetches one HTML page. Tests replace it with saved pages. */
public interface PageFetcher {

	String get(URI uri) throws IOException, InterruptedException;
}

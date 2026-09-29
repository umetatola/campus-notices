package com.campusnotices;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * In production the React app is bundled into the jar (static/). Its pages, like /notices/12 or /alerts, exist
 * only in the browser, so opening one directly must return index.html and let the React router take over.
 * Paths with a dot (files such as /assets/app.js) and /api or /actuator are not matched here.
 */
@Controller
public class SpaController {

	private static final String PAGE = "^(?!api$|actuator$|assets$)[^.]+";
	private static final String SEGMENT = "[^.]+";

	// One to three segments without a dot. A missing file such as /assets/app.js keeps its 404.
	@GetMapping({"/", "/{a:" + PAGE + "}", "/{a:" + PAGE + "}/{b:" + SEGMENT + "}",
			"/{a:" + PAGE + "}/{b:" + SEGMENT + "}/{c:" + SEGMENT + "}"})
	public String index() {
		return "forward:/index.html";
	}
}

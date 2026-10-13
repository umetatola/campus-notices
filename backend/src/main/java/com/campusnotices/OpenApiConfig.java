package com.campusnotices;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Title and description for the generated API docs (Swagger UI at /api/docs). */
@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI campusNoticesApi() {
		return new OpenAPI()
				.info(new Info()
						.title("Campus Notices API")
						.version("0.1.0")
						.description("""
								English digests of Ajou University notices, with keyword alerts.

								Reading notices needs no sign-in. Keyword endpoints need the session cookie from \
								the email sign-in link, and every write needs the CSRF token: read the `XSRF-TOKEN` \
								cookie (GET `/api/csrf` sets it) and send it back as the `X-XSRF-TOKEN` header.""")
						.license(new License().name("Source on GitHub").url("https://github.com/umetatola/campus-notices")))
				.components(new Components().addSecuritySchemes("session",
						new SecurityScheme().type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("JSESSIONID")))
				.addSecurityItem(new SecurityRequirement().addList("session"));
	}
}

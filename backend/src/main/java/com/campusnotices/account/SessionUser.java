package com.campusnotices.account;

import java.io.Serializable;

/** The signed-in user, kept in the HTTP session. */
public record SessionUser(long id, String email) implements Serializable {
}

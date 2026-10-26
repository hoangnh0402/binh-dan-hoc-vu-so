package vn.bdhvs.auth;

import vn.bdhvs.common.error.ApiException;

/** BR-AUTH-01: 8–64 ký tự, có ít nhất 1 chữ cái và 1 chữ số, không trùng email. */
public final class PasswordPolicy {

    private PasswordPolicy() {
    }

    public static void check(String field, String password, String email) {
        if (password == null || password.length() < 8 || password.length() > 64) {
            throw ApiException.validation(field, "Mật khẩu phải dài từ 8 đến 64 ký tự");
        }
        if (!password.matches(".*\\p{L}.*") || !password.matches(".*\\d.*")) {
            throw ApiException.validation(field, "Mật khẩu phải có ít nhất 1 chữ cái và 1 chữ số");
        }
        if (email != null && password.equalsIgnoreCase(email)) {
            throw ApiException.validation(field, "Mật khẩu không được trùng với email");
        }
    }
}

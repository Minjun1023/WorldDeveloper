// 백엔드 backend/.../auth/PasswordPolicy.java 와 동일 규칙 (10자, 대/소문자, 숫자, ASCII).
// 규칙 변경 시 양쪽을 함께 수정할 것. (최대 72바이트는 입력 maxLength + 백엔드 권위검증으로 처리)

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
}

export function checkPassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 10,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

export function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.length && c.upper && c.lower && c.digit;
}

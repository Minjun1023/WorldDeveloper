package com.devjobs.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * 인증 메일 발송. spring.mail.host 가 blank 면(=메일 미설정) 인증번호를 로그로 출력해
 * 로컬 가입이 막히지 않게 한다. host 가 설정된 경우에만 실제 발송.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender; // null 가능
    private final String from;
    private final boolean enabled;
    private final boolean requireSecure;  // 운영(=true)에선 인증번호를 로그로 노출하지 않음

    // Spring 빈 생성용 (JavaMailSender 는 optional — host 미설정 시 없을 수 있음).
    // 생성자가 하나뿐이라 @Autowired 는 생략(Spring 4.3+ 자동 주입).
    public MailService(@Nullable JavaMailSender sender,
                       @Value("${app.mail-from}") String from,
                       @Value("${spring.mail.host:}") String host,
                       @Value("${app.require-secure-secrets:false}") boolean requireSecure) {
        this.sender = sender;
        this.from = from;
        this.enabled = sender != null && host != null && !host.isBlank();
        this.requireSecure = requireSecure;
    }

    // 메일 미설정 폴백 로그 — 운영에선 코드를 찍지 않는다(로그 수집 환경에서 코드 유출 = 계정 탈취).
    private void logDisabled(String kind, String email, String code) {
        if (requireSecure) {
            log.warn("[MAIL DISABLED] {} {} 미발송 — 메일 설정 누락(운영). 코드는 로깅하지 않음.", email, kind);
        } else {
            log.warn("[MAIL DISABLED] {} 의 {}: {}", email, kind, code);
        }
    }

    public void sendVerificationCode(String email, String code) {
        if (!enabled) {
            logDisabled("이메일 인증번호", email, code);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(email);
        msg.setSubject("[DevPass] 이메일 인증번호");
        msg.setText("인증번호: " + code + "\n\n회원가입 화면에 위 6자리 번호를 입력해 이메일을 인증하세요 (10분 이내 유효).");
        sender.send(msg);
    }

    public void sendPasswordResetCode(String email, String code) {
        if (!enabled) {
            logDisabled("비밀번호 재설정 인증번호", email, code);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(email);
        msg.setSubject("[DevPass] 비밀번호 재설정 인증번호");
        msg.setText("인증번호: " + code + "\n\n비밀번호 재설정 화면에 위 6자리 번호를 입력하세요 (10분 이내 유효). "
            + "본인이 요청하지 않았다면 이 메일을 무시하세요.");
        sender.send(msg);
    }

    /**
     * 저장 검색 신규 공고 다이제스트. body 는 호출부(SearchAlertScheduler)가 조립한 평문.
     * 미설정 환경에선 제목만 로그(본문은 개인 검색 조건 포함이라 찍지 않음).
     */
    public void sendSearchDigest(String email, String subject, String body) {
        if (!enabled) {
            log.warn("[MAIL DISABLED] {} 다이제스트 미발송: {}", email, subject);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(email);
        msg.setSubject(subject);
        msg.setText(body);
        sender.send(msg);
    }
}

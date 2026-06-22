package com.devjobs.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

    // Spring 빈 생성용 (JavaMailSender 는 optional — host 미설정 시 없을 수 있음)
    @Autowired
    public MailService(@Nullable JavaMailSender sender,
                       @Value("${app.mail-from}") String from,
                       @Value("${spring.mail.host:}") String host) {
        this.sender = sender;
        this.from = from;
        this.enabled = sender != null && host != null && !host.isBlank();
    }

    public void sendVerificationCode(String email, String code) {
        if (!enabled) {
            log.warn("[MAIL DISABLED] {} 의 이메일 인증번호: {}", email, code);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(email);
        msg.setSubject("[WorldDeveloper] 이메일 인증번호");
        msg.setText("인증번호: " + code + "\n\n회원가입 화면에 위 6자리 번호를 입력해 이메일을 인증하세요 (10분 이내 유효).");
        sender.send(msg);
    }

    public void sendPasswordResetCode(String email, String code) {
        if (!enabled) {
            log.warn("[MAIL DISABLED] {} 의 비밀번호 재설정 인증번호: {}", email, code);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(email);
        msg.setSubject("[WorldDeveloper] 비밀번호 재설정 인증번호");
        msg.setText("인증번호: " + code + "\n\n비밀번호 재설정 화면에 위 6자리 번호를 입력하세요 (10분 이내 유효). "
            + "본인이 요청하지 않았다면 이 메일을 무시하세요.");
        sender.send(msg);
    }
}

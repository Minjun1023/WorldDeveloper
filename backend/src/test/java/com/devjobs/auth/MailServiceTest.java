package com.devjobs.auth;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class MailServiceTest {

    @Test
    void sendsWhenSenderPresentAndHostConfigured() {
        JavaMailSender sender = Mockito.mock(JavaMailSender.class);
        MailService svc = new MailService(sender, "no-reply@x.dev", "localhost");
        svc.sendVerification("u@x.dev", "http://app/verify-email?token=abc");
        ArgumentCaptor<SimpleMailMessage> cap = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(cap.capture());
    }

    @Test
    void logsAndSkipsWhenSenderNull() {
        MailService svc = new MailService(null, "no-reply@x.dev", "");
        svc.sendVerification("u@x.dev", "http://app/verify-email?token=abc"); // 예외 없음
    }

    @Test
    void logsAndSkipsWhenHostBlankEvenIfSenderPresent() {
        JavaMailSender sender = Mockito.mock(JavaMailSender.class);
        MailService svc = new MailService(sender, "no-reply@x.dev", "  ");
        svc.sendVerification("u@x.dev", "http://app/verify-email?token=abc");
        verifyNoInteractions(sender);
    }
}

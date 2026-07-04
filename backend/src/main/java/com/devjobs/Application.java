package com.devjobs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // 저장 검색 알림 다이제스트(SearchAlertScheduler) 등 배치 작업용
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

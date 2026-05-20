package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.InterviewPrepResponse;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class CoachService {

    private final JobRepository jobRepository;

    public CoachService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    public Optional<InterviewPrepResponse> interviewPrep(String jobId) {
        return activeJob(jobId).map(InterviewPrep::generate);
    }

    private Optional<JobEntity> activeJob(String jobId) {
        return jobRepository.findById(jobId)
            .filter(j -> Boolean.TRUE.equals(j.getIsActive()));
    }
}

using System;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Interfaces;

public interface IAiJobTracker
{
    AiJobInfo CreateJob(Guid lessonId, string jobType);
    void UpdateJobStatus(Guid jobId, AiJobStatus status, string? error = null);
    AiJobInfo? GetJob(Guid jobId);
    AiJobInfo? GetLatestJobForLesson(Guid lessonId, string? jobType = null);
}

using System;
using System.Collections.Concurrent;
using System.Linq;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace LearnDynamicPro.Infrastructure.Services;

public class AiJobTracker : IAiJobTracker
{
    private readonly ConcurrentDictionary<Guid, AiJobInfo> _jobs = new();
    private readonly ILogger<AiJobTracker> _logger;

    public AiJobTracker(ILogger<AiJobTracker> logger)
    {
        _logger = logger;
    }

    public AiJobInfo CreateJob(Guid lessonId, string jobType)
    {
        var job = new AiJobInfo
        {
            JobId = Guid.NewGuid(),
            LessonId = lessonId,
            JobType = jobType,
            Status = AiJobStatus.Processing,
            CreatedAt = DateTime.UtcNow
        };

        _jobs[job.JobId] = job;
        _logger.LogInformation("[AiJobTracker] Job Created | JobId={JobId} LessonId={LessonId} Type={Type}",
            job.JobId, lessonId, jobType);

        // Prune old jobs if collection exceeds 1000 items
        if (_jobs.Count > 1000)
        {
            var oldJobs = _jobs.Values
                .Where(j => j.CompletedAt.HasValue && j.CompletedAt.Value < DateTime.UtcNow.AddHours(-2))
                .OrderBy(j => j.CreatedAt)
                .Take(200);

            foreach (var oldJob in oldJobs)
            {
                _jobs.TryRemove(oldJob.JobId, out _);
            }
        }

        return job;
    }

    public void UpdateJobStatus(Guid jobId, AiJobStatus status, string? error = null)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Status = status;
            job.Error = error;
            if (status == AiJobStatus.Completed || status == AiJobStatus.Failed)
            {
                job.CompletedAt = DateTime.UtcNow;
            }
            _logger.LogInformation("[AiJobTracker] Job Updated | JobId={JobId} Status={Status} Error={Error}",
                jobId, status, error);
        }
    }

    public AiJobInfo? GetJob(Guid jobId)
    {
        _jobs.TryGetValue(jobId, out var job);
        return job;
    }

    public AiJobInfo? GetLatestJobForLesson(Guid lessonId, string? jobType = null)
    {
        return _jobs.Values
            .Where(j => j.LessonId == lessonId && (string.IsNullOrEmpty(jobType) || j.JobType.Equals(jobType, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(j => j.CreatedAt)
            .FirstOrDefault();
    }
}

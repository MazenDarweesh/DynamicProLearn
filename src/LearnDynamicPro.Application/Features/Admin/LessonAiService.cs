using System.Diagnostics;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace LearnDynamicPro.Application.Features.Admin;

public class LessonAiService : ILessonAiService
{
    private readonly IPythonAiClient _pythonAiClient;
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly IAiJobTracker _jobTracker;
    private readonly ILogger<LessonAiService> _logger;

    public LessonAiService(
        IPythonAiClient pythonAiClient, 
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IServiceScopeFactory serviceScopeFactory,
        IAiJobTracker jobTracker,
        ILogger<LessonAiService> logger)
    {
        _pythonAiClient = pythonAiClient;
        _context = context;
        _currentUserService = currentUserService;
        _serviceScopeFactory = serviceScopeFactory;
        _jobTracker = jobTracker;
        _logger = logger;
    }

    public async Task<Result<bool>> GenerateLessonQuizAsync(Guid lessonId)
    {
        if (_currentUserService.UserId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        if (!await _context.Lessons.AnyAsync(l => l.Id == lessonId))
            return Result<bool>.Failure(AppErrors.General.NotFound);

        return await ExecuteQuizCoreAsync(lessonId, _context, _pythonAiClient, _logger);
    }

    public async Task<Result<bool>> GenerateLessonSummaryAsync(Guid lessonId)
    {
        if (_currentUserService.UserId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        if (!await _context.Lessons.AnyAsync(l => l.Id == lessonId))
            return Result<bool>.Failure(AppErrors.General.NotFound);

        return await ExecuteSummaryCoreAsync(lessonId, _context, _pythonAiClient, _logger);
    }

    public async Task<Result<AdminLessonQuizDto>> GetAdminLessonQuizAsync(Guid lessonId)
    {
        if (_currentUserService.UserId == Guid.Empty)
            return Result<AdminLessonQuizDto>.Failure(AppErrors.Authorization.AccessDenied);

        var quiz = await _context.LessonQuizzes
            .AsNoTracking()
            .FirstOrDefaultAsync(q => q.LessonId == lessonId);

        if (quiz == null)
            return Result<AdminLessonQuizDto>.Failure(AppErrors.General.NotFound);

        var dto = new AdminLessonQuizDto
        {
            LessonId = quiz.LessonId,
            GeneratedAt = quiz.GeneratedAt,
            Questions = quiz.Questions.Select(q => new AdminQuizQuestionDto
            {
                QuestionNumber = q.QuestionNumber,
                QuestionText = q.QuestionText,
                CorrectAnswerId = q.CorrectAnswerId,
                Explanation = q.Explanation,
                Options = q.Options.Select(o => new AdminQuizOptionDto
                {
                    OptionId = o.OptionId,
                    Text = o.Text
                }).ToList()
            }).ToList()
        };

        return Result<AdminLessonQuizDto>.Success(dto);
    }

    public async Task<Result<AdminLessonSummaryDto>> GetAdminLessonSummaryAsync(Guid lessonId)
    {
        if (_currentUserService.UserId == Guid.Empty)
            return Result<AdminLessonSummaryDto>.Failure(AppErrors.Authorization.AccessDenied);

        var summary = await _context.LessonSummaries
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.LessonId == lessonId);

        if (summary == null)
            return Result<AdminLessonSummaryDto>.Failure(AppErrors.General.NotFound);

        var dto = new AdminLessonSummaryDto
        {
            LessonId = summary.LessonId,
            Overview = summary.Overview,
            GeneratedAt = summary.GeneratedAt,
            Topics = summary.Topics.Select(t => new AdminSummaryTopicDto
            {
                TopicName = t.TopicName,
                Explanation = t.Explanation,
                KeyPoints = t.KeyPoints
            }).ToList()
        };

        return Result<AdminLessonSummaryDto>.Success(dto);
    }

    public Task<Result<AiJobInfo>> EnqueueLessonQuizGenerationAsync(Guid lessonId) =>
        EnqueueAiJobAsync(lessonId, "Quiz", ExecuteQuizCoreAsync);

    public Task<Result<AiJobInfo>> EnqueueLessonSummaryGenerationAsync(Guid lessonId) =>
        EnqueueAiJobAsync(lessonId, "Summary", ExecuteSummaryCoreAsync);

    private async Task<Result<AiJobInfo>> EnqueueAiJobAsync(
        Guid lessonId,
        string jobType,
        Func<Guid, IApplicationDbContext, IPythonAiClient, ILogger, Task<Result<bool>>> executeCoreAsync)
    {
        _logger.LogInformation("[{JobType}.Enqueue] REQUEST | LessonId={LessonId} UserId={UserId}",
            jobType, lessonId, _currentUserService.UserId);

        if (_currentUserService.UserId == Guid.Empty)
            return Result<AiJobInfo>.Failure(AppErrors.Authorization.AccessDenied);

        var lessonExists = await _context.Lessons.AnyAsync(l => l.Id == lessonId);
        if (!lessonExists)
            return Result<AiJobInfo>.Failure(AppErrors.General.NotFound);

        var job = _jobTracker.CreateJob(lessonId, jobType);

        // Execute in background using dedicated service scope
        _ = Task.Run(async () =>
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var pythonClient = scope.ServiceProvider.GetRequiredService<IPythonAiClient>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<LessonAiService>>();
            var tracker = scope.ServiceProvider.GetRequiredService<IAiJobTracker>();

            try
            {
                logger.LogInformation("[{JobType}.Enqueue.Background] START | JobId={JobId} LessonId={LessonId}", jobType, job.JobId, lessonId);
                var result = await executeCoreAsync(lessonId, context, pythonClient, logger);
                if (result.IsSuccess)
                {
                    tracker.UpdateJobStatus(job.JobId, AiJobStatus.Completed);
                    logger.LogInformation("[{JobType}.Enqueue.Background] SUCCESS | JobId={JobId} LessonId={LessonId}", jobType, job.JobId, lessonId);
                }
                else
                {
                    tracker.UpdateJobStatus(job.JobId, AiJobStatus.Failed, result.Error);
                    logger.LogWarning("[{JobType}.Enqueue.Background] FAILED | JobId={JobId} LessonId={LessonId} Error={Error}", jobType, job.JobId, lessonId, result.Error);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[{JobType}.Enqueue.Background] EXCEPTION | JobId={JobId} LessonId={LessonId}", jobType, job.JobId, lessonId);
                tracker.UpdateJobStatus(job.JobId, AiJobStatus.Failed, ex.Message);
            }
        });

        return Result<AiJobInfo>.Success(job);
    }

    private static async Task<Result<bool>> ExecuteQuizCoreAsync(
        Guid lessonId,
        IApplicationDbContext context,
        IPythonAiClient pythonClient,
        ILogger logger)
    {
        var sw = Stopwatch.StartNew();
        logger.LogInformation("[Quiz.Generate] CALLING_PYTHON | LessonId={LessonId}", lessonId);
        var generatedQuiz = await pythonClient.GenerateQuizAsync(lessonId);
        if (generatedQuiz == null || !generatedQuiz.Questions.Any())
        {
            logger.LogError("[Quiz.Generate] PYTHON_EMPTY | LessonId={LessonId} ElapsedMs={ElapsedMs}",
                lessonId, sw.ElapsedMilliseconds);
            return Result<bool>.Failure("لم يتمكن محرك الذكاء الاصطناعي من توليد الاختبار. تأكد من أن الدرس تمت معالجته ورفع محتواه مسبقاً، وأن خدمة الذكاء الاصطناعي تعمل.");
        }

        logger.LogInformation("[Quiz.Generate] PYTHON_OK | LessonId={LessonId} QuestionCount={Count} ElapsedMs={ElapsedMs}",
            lessonId, generatedQuiz.Questions.Count, sw.ElapsedMilliseconds);

        var newQuiz = new LessonQuiz
        {
            LessonId = lessonId,
            GeneratedAt = DateTime.UtcNow,
            Questions = generatedQuiz.Questions.Select(q => new QuizQuestion
            {
                QuestionNumber = q.QuestionNumber,
                QuestionText = q.QuestionText,
                CorrectAnswerId = q.CorrectAnswerId,
                Explanation = q.Explanation,
                Options = q.Options.Select(o => new QuizOption
                {
                    OptionId = o.OptionId,
                    Text = o.Text
                }).ToList()
            }).ToList()
        };

        logger.LogInformation("[Quiz.Generate] DB_REPLACE | LessonId={LessonId}", lessonId);
        await context.LessonQuizzes.Where(q => q.LessonId == lessonId).ExecuteDeleteAsync();
        context.LessonQuizzes.Add(newQuiz);
        await context.SaveChangesAsync();

        sw.Stop();
        logger.LogInformation("[Quiz.Generate] DONE | LessonId={LessonId} QuestionCount={Count} TotalMs={TotalMs}",
            lessonId, newQuiz.Questions.Count, sw.ElapsedMilliseconds);

        return Result<bool>.Success(true);
    }

    private static async Task<Result<bool>> ExecuteSummaryCoreAsync(
        Guid lessonId,
        IApplicationDbContext context,
        IPythonAiClient pythonClient,
        ILogger logger)
    {
        var sw = Stopwatch.StartNew();
        logger.LogInformation("[Summary.Generate] CALLING_PYTHON | LessonId={LessonId}", lessonId);
        var generatedSummary = await pythonClient.GenerateSummaryAsync(lessonId);
        if (generatedSummary == null || string.IsNullOrEmpty(generatedSummary.Overview))
        {
            logger.LogError("[Summary.Generate] PYTHON_EMPTY | LessonId={LessonId} ElapsedMs={ElapsedMs}",
                lessonId, sw.ElapsedMilliseconds);
            return Result<bool>.Failure("لم يتمكن محرك الذكاء الاصطناعي من توليد الملخص. تأكد من أن الدرس تمت معالجته ورفع محتواه مسبقاً، وأن خدمة الذكاء الاصطناعي تعمل.");
        }

        logger.LogInformation("[Summary.Generate] PYTHON_OK | LessonId={LessonId} TopicCount={Count} ElapsedMs={ElapsedMs}",
            lessonId, generatedSummary.Topics?.Count ?? 0, sw.ElapsedMilliseconds);

        var newSummary = new LessonSummary
        {
            LessonId = lessonId,
            GeneratedAt = DateTime.UtcNow,
            Overview = generatedSummary.Overview,
            Topics = (generatedSummary.Topics ?? new()).Select(t => new SummaryTopic
            {
                TopicName = t.Title,
                Explanation = string.Empty,
                KeyPoints = t.Points
            }).ToList()
        };

        logger.LogInformation("[Summary.Generate] DB_REPLACE | LessonId={LessonId}", lessonId);
        await context.LessonSummaries.Where(s => s.LessonId == lessonId).ExecuteDeleteAsync();
        context.LessonSummaries.Add(newSummary);
        await context.SaveChangesAsync();

        sw.Stop();
        logger.LogInformation("[Summary.Generate] DONE | LessonId={LessonId} TopicCount={Count} TotalMs={TotalMs}",
            lessonId, newSummary.Topics.Count, sw.ElapsedMilliseconds);

        return Result<bool>.Success(true);
    }

    public AiJobInfo? GetAiJobStatus(Guid lessonId, Guid? jobId = null)
    {
        if (jobId.HasValue && jobId.Value != Guid.Empty)
        {
            return _jobTracker.GetJob(jobId.Value);
        }
        return _jobTracker.GetLatestJobForLesson(lessonId);
    }
}

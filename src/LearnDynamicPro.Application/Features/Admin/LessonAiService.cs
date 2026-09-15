using System.Diagnostics;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LearnDynamicPro.Application.Features.Admin;

public class LessonAiService : ILessonAiService
{
    private readonly IPythonAiClient _pythonAiClient;
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<LessonAiService> _logger;

    public LessonAiService(
        IPythonAiClient pythonAiClient, 
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        ILogger<LessonAiService> logger)
    {
        _pythonAiClient = pythonAiClient;
        _context = context;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public async Task<Result<bool>> GenerateLessonQuizAsync(Guid lessonId)
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("[Quiz.Generate] START | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);

        // 1. Authorization check
        if (_currentUserService.UserId == Guid.Empty)
        {
            _logger.LogWarning("[Quiz.Generate] DENIED | LessonId={LessonId} Reason=Unauthorized", lessonId);
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);
        }

        // 2. Validate lesson exists
        var lessonExists = await _context.Lessons.AnyAsync(l => l.Id == lessonId);
        if (!lessonExists)
        {
            _logger.LogWarning("[Quiz.Generate] NOT_FOUND | LessonId={LessonId}", lessonId);
            return Result<bool>.Failure(AppErrors.General.NotFound);
        }

        // 3. Call Python Engine
        _logger.LogInformation("[Quiz.Generate] CALLING_PYTHON | LessonId={LessonId}", lessonId);
        var generatedQuiz = await _pythonAiClient.GenerateQuizAsync(lessonId);
        if (generatedQuiz == null || !generatedQuiz.Questions.Any())
        {
            _logger.LogError("[Quiz.Generate] PYTHON_EMPTY | LessonId={LessonId} ElapsedMs={ElapsedMs}",
                lessonId, sw.ElapsedMilliseconds);
            return Result<bool>.Failure("AI.GenerationFailed: Failed to generate quiz from AI engine.");
        }

        _logger.LogInformation("[Quiz.Generate] PYTHON_OK | LessonId={LessonId} QuestionCount={Count} ElapsedMs={ElapsedMs}",
            lessonId, generatedQuiz.Questions.Count, sw.ElapsedMilliseconds);

        // 4. Map DTO to Domain Entity
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

        // 5. Replace existing quiz if any directly in DB (bypasses EF Core JSON change-tracker ordinal bug)
        _logger.LogInformation("[Quiz.Generate] DB_REPLACE | LessonId={LessonId}", lessonId);
        await _context.LessonQuizzes.Where(q => q.LessonId == lessonId).ExecuteDeleteAsync();

        // 6. Save to DB
        _context.LessonQuizzes.Add(newQuiz);
        await _context.SaveChangesAsync();

        sw.Stop();
        _logger.LogInformation("[Quiz.Generate] DONE | LessonId={LessonId} QuestionCount={Count} TotalMs={TotalMs}",
            lessonId, newQuiz.Questions.Count, sw.ElapsedMilliseconds);

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> GenerateLessonSummaryAsync(Guid lessonId)
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("[Summary.Generate] START | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);

        // 1. Authorization check
        if (_currentUserService.UserId == Guid.Empty)
        {
            _logger.LogWarning("[Summary.Generate] DENIED | LessonId={LessonId} Reason=Unauthorized", lessonId);
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);
        }

        // 2. Validate lesson exists
        var lessonExists = await _context.Lessons.AnyAsync(l => l.Id == lessonId);
        if (!lessonExists)
        {
            _logger.LogWarning("[Summary.Generate] NOT_FOUND | LessonId={LessonId}", lessonId);
            return Result<bool>.Failure(AppErrors.General.NotFound);
        }

        // 3. Call Python Engine
        _logger.LogInformation("[Summary.Generate] CALLING_PYTHON | LessonId={LessonId}", lessonId);
        var generatedSummary = await _pythonAiClient.GenerateSummaryAsync(lessonId);
        if (generatedSummary == null || string.IsNullOrEmpty(generatedSummary.Overview))
        {
            _logger.LogError("[Summary.Generate] PYTHON_EMPTY | LessonId={LessonId} ElapsedMs={ElapsedMs}",
                lessonId, sw.ElapsedMilliseconds);
            return Result<bool>.Failure("AI.GenerationFailed: Failed to generate summary from AI engine.");
        }

        _logger.LogInformation("[Summary.Generate] PYTHON_OK | LessonId={LessonId} TopicCount={Count} ElapsedMs={ElapsedMs}",
            lessonId, generatedSummary.Topics?.Count ?? 0, sw.ElapsedMilliseconds);

        // 4. Map DTO to Domain Entity
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

        // 5. Replace existing summary if any directly in DB (bypasses EF Core JSON change-tracker ordinal bug)
        _logger.LogInformation("[Summary.Generate] DB_REPLACE | LessonId={LessonId}", lessonId);
        await _context.LessonSummaries.Where(s => s.LessonId == lessonId).ExecuteDeleteAsync();

        // 6. Save to DB
        _context.LessonSummaries.Add(newSummary);
        await _context.SaveChangesAsync();

        sw.Stop();
        _logger.LogInformation("[Summary.Generate] DONE | LessonId={LessonId} TopicCount={Count} TotalMs={TotalMs}",
            lessonId, newSummary.Topics.Count, sw.ElapsedMilliseconds);

        return Result<bool>.Success(true);
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
}

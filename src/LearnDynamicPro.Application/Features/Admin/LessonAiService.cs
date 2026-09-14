using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Admin;

public class LessonAiService : ILessonAiService
{
    private readonly IPythonAiClient _pythonAiClient;
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public LessonAiService(
        IPythonAiClient pythonAiClient, 
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _pythonAiClient = pythonAiClient;
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<bool>> GenerateLessonQuizAsync(Guid lessonId)
    {
        // 1. Authorization check
        if (_currentUserService.UserId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        // 2. Validate lesson exists
        var lessonExists = await _context.Lessons.AnyAsync(l => l.Id == lessonId);
        if (!lessonExists)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        // 3. Call Python Engine
        var generatedQuiz = await _pythonAiClient.GenerateQuizAsync(lessonId);
        if (generatedQuiz == null || !generatedQuiz.Questions.Any())
            return Result<bool>.Failure("AI.GenerationFailed: Failed to generate quiz from AI engine.");

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

        // 5. Replace existing quiz if any (Domain Rules - allows seamless regeneration)
        var existingQuiz = await _context.LessonQuizzes.FirstOrDefaultAsync(q => q.LessonId == lessonId);
        if (existingQuiz != null)
        {
            _context.LessonQuizzes.Remove(existingQuiz);
        }

        // 6. Save to DB
        _context.LessonQuizzes.Add(newQuiz);
        await _context.SaveChangesAsync();

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> GenerateLessonSummaryAsync(Guid lessonId)
    {
        // 1. Authorization check
        if (_currentUserService.UserId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        // 2. Validate lesson exists
        var lessonExists = await _context.Lessons.AnyAsync(l => l.Id == lessonId);
        if (!lessonExists)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        // 3. Call Python Engine
        var generatedSummary = await _pythonAiClient.GenerateSummaryAsync(lessonId);
        if (generatedSummary == null || string.IsNullOrEmpty(generatedSummary.Overview))
            return Result<bool>.Failure("AI.GenerationFailed: Failed to generate summary from AI engine.");

        // 4. Map DTO to Domain Entity
        var newSummary = new LessonSummary
        {
            LessonId = lessonId,
            GeneratedAt = DateTime.UtcNow,
            Overview = generatedSummary.Overview,
            Topics = generatedSummary.Topics.Select(t => new SummaryTopic
            {
                TopicName = t.Title,
                Explanation = string.Empty,
                KeyPoints = t.Points
            }).ToList()
        };

        // 5. Replace existing summary if any (Domain Rules - allows seamless regeneration)
        var existingSummary = await _context.LessonSummaries.FirstOrDefaultAsync(s => s.LessonId == lessonId);
        if (existingSummary != null)
        {
            _context.LessonSummaries.Remove(existingSummary);
        }

        // 6. Save to DB
        _context.LessonSummaries.Add(newSummary);
        await _context.SaveChangesAsync();

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

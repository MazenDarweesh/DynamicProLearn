using System.Text;
using LearnDynamicPro.Application.Features.Admin;
using LearnDynamicPro.Application.Features.Auth;
using LearnDynamicPro.Application.Features.Progress;
using LearnDynamicPro.Application.Features.Student;
using LearnDynamicPro.Application.Features.Tester;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Enums;
using LearnDynamicPro.Infrastructure.Identity;
using LearnDynamicPro.Infrastructure.Persistence;
using LearnDynamicPro.Infrastructure.Persistence.Interceptors;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Formatting.Json;
using LearnDynamicPro.API.Middlewares;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(new JsonFormatter(), "logs/log-.json", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container.
builder.Services.AddControllers();

// Register Interceptors
builder.Services.AddScoped<AuditableEntityInterceptor>();

// Configure Database
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var interceptor = sp.GetRequiredService<AuditableEntityInterceptor>();
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
           .AddInterceptors(interceptor);
});
builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<AppDbContext>());

// Configure JWT Settings
var jwtSettingsSection = builder.Configuration.GetSection(JwtSettings.SectionName);
builder.Services.Configure<JwtSettings>(jwtSettingsSection);
var jwtSettings = jwtSettingsSection.Get<JwtSettings>();

// Configure Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings?.Issuer,
            ValidAudience = jwtSettings?.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings?.Secret ?? string.Empty))
        };
    });

// Configure Authorization Policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => 
        policy.RequireRole(UserRole.Admin.ToString()));
        
    options.AddPolicy("StudentOrAbove", policy => 
        policy.RequireRole(UserRole.Admin.ToString(), UserRole.Student.ToString(), UserRole.Tester.ToString()));
        
    options.AddPolicy("TesterOnly", policy => 
        policy.RequireRole(UserRole.Tester.ToString(), UserRole.Admin.ToString()));
});

// Register Core Infrastructure Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<ITokenService, TokenService>();

// Register Repositories
builder.Services.AddScoped(typeof(LearnDynamicPro.Application.Interfaces.Repositories.IGenericRepository<>), typeof(LearnDynamicPro.Infrastructure.Persistence.Repositories.GenericRepository<>));
builder.Services.AddScoped<LearnDynamicPro.Application.Interfaces.Repositories.IUnitOfWork, LearnDynamicPro.Infrastructure.Persistence.Repositories.UnitOfWork>();

// Register Feature Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICompanyService, CompanyService>();
builder.Services.AddScoped<IModuleService, ModuleService>();
builder.Services.AddScoped<IAssignmentService, AssignmentService>();
builder.Services.AddScoped<IStudentService, StudentService>();
builder.Services.AddScoped<IProgressService, ProgressService>();
builder.Services.AddScoped<IProgressAnalyticsService, ProgressAnalyticsService>();
builder.Services.AddScoped<ITesterService, TesterService>();

// Configure CORS for Angular
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp",
        policy => policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

// Configure Swagger/OpenApi
builder.Services.AddOpenApi();

var app = builder.Build();

// Apply migrations and seed data — retry up to 5 times (defence against slow DB startup)
using (var scope = app.Services.CreateScope())
{
    var services   = scope.ServiceProvider;
    var startLogger = services.GetRequiredService<ILogger<Program>>();

    const int maxRetries = 5;
    const int delaySeconds = 10;

    for (int attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            await DatabaseSeeder.SeedAsync(services);
            startLogger.LogInformation("✅ Database migration and seeding completed successfully.");
            break;
        }
        catch (Exception ex) when (attempt < maxRetries)
        {
            startLogger.LogWarning(ex,
                "⚠️ Database migration attempt {Attempt}/{Max} failed. Retrying in {Delay}s...",
                attempt, maxRetries, delaySeconds);
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
        }
        catch (Exception ex)
        {
            startLogger.LogError(ex,
                "❌ All {Max} migration attempts failed. The application will start but may be unstable.",
                maxRetries);
        }
    }
}

// Configure the HTTP request pipeline.
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseMiddleware<LogContextEnrichmentMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("AllowAngularApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();
// Cache bust 2

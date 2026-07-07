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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Configure Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
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
        policy.RequireRole(UserRole.Admin.ToString(), UserRole.Student.ToString()));
        
    options.AddPolicy("TesterOnly", policy => 
        policy.RequireRole(UserRole.Tester.ToString(), UserRole.Admin.ToString()));
});

// Register Core Infrastructure Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<ITokenService, TokenService>();

// Register Feature Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICompanyService, CompanyService>();
builder.Services.AddScoped<IModuleService, ModuleService>();
builder.Services.AddScoped<IAssignmentService, AssignmentService>();
builder.Services.AddScoped<IStudentService, StudentService>();
builder.Services.AddScoped<IProgressService, ProgressService>();
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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.UseCors("AllowAngularApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

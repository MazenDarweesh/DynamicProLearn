# ============================================================================
# LearnDynamicPro - Multi-Stage Dockerfile (Frontend & Backend)
# ============================================================================

# Stage 1: Build Frontend (Angular)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY learn-dynamic-pro-ui/package*.json ./
RUN npm ci
COPY learn-dynamic-pro-ui/ ./
RUN npm run build -- --configuration production

# Stage 2: Build Backend (.NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-builder
WORKDIR /src

# Copy Solution & Projects
COPY LearnDynamicPro.sln .
COPY src/LearnDynamicPro.API/LearnDynamicPro.API.csproj src/LearnDynamicPro.API/
COPY src/LearnDynamicPro.Application/LearnDynamicPro.Application.csproj src/LearnDynamicPro.Application/
COPY src/LearnDynamicPro.Domain/LearnDynamicPro.Domain.csproj src/LearnDynamicPro.Domain/
COPY src/LearnDynamicPro.Infrastructure/LearnDynamicPro.Infrastructure.csproj src/LearnDynamicPro.Infrastructure/

# Restore dependencies
RUN dotnet restore src/LearnDynamicPro.API/LearnDynamicPro.API.csproj

# Copy all backend source code
COPY src/ src/

# Build and Publish backend
RUN dotnet publish src/LearnDynamicPro.API/LearnDynamicPro.API.csproj -c Release -o /app/publish --no-restore

# Stage 3: Final Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Copy published backend files with correct ownership for built-in non-root 'app' user
COPY --from=backend-builder --chown=app:app /app/publish .

# Copy built frontend static files to wwwroot with correct ownership
COPY --from=frontend-builder --chown=app:app /app/dist/learn-dynamic-pro-ui/browser ./wwwroot

USER app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "LearnDynamicPro.API.dll"]

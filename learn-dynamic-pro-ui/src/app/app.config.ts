import { ApplicationConfig, provideZoneChangeDetection, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { routes } from './app.routes';
import { provideMarkdown } from 'ngx-markdown';

const changeDetectionProvider = typeof (window as any)?.Zone !== 'undefined'
  ? provideZoneChangeDetection({ eventCoalescing: true })
  : provideExperimentalZonelessChangeDetection();

export const appConfig: ApplicationConfig = {
  providers: [
    changeDetectionProvider,
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([jwtInterceptor])
    ),
    provideMarkdown()
  ]
};

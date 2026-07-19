import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonDetailsAnalyticsComponent } from './lesson-details-analytics.component';

describe('LessonDetailsAnalyticsComponent', () => {
  let component: LessonDetailsAnalyticsComponent;
  let fixture: ComponentFixture<LessonDetailsAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonDetailsAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LessonDetailsAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonsAnalyticsComponent } from './lessons-analytics.component';

describe('LessonsAnalyticsComponent', () => {
  let component: LessonsAnalyticsComponent;
  let fixture: ComponentFixture<LessonsAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonsAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LessonsAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContinueLearningComponent } from './continue-learning.component';

describe('ContinueLearningComponent', () => {
  let component: ContinueLearningComponent;
  let fixture: ComponentFixture<ContinueLearningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContinueLearningComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContinueLearningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
